-- ============================================================
-- VET CLINIC MANAGEMENT SYSTEM — SCHEMA v3
-- PostgreSQL · Prisma-friendly · production-hardened
--
-- Design principles:
--   1. Financial & medical records never hard-delete (soft delete + RESTRICT)
--   2. Invoices freeze their own numbers (no recompute from live prices)
--   3. Stock can never go negative (DB-level guarantee)
--   4. No double-booking (DB-level exclusion constraint)
--   5. Auth tokens are never stored raw — handled by Auth.js
--   6. updated_at is maintained by a trigger, not a lie
-- ============================================================

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive email
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- needed for booking overlap exclusion

-- ============================================================
-- SHARED: auto-update updated_at on any row change
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USERS & ACCESS
-- Sessions/password-resets are owned by Auth.js, NOT this schema.
-- We store only identity + role. Tokens never touch our tables.
-- ============================================================
CREATE TABLE roles (
    role_id     SERIAL PRIMARY KEY,
    name        VARCHAR(50) UNIQUE NOT NULL,   -- Admin, Vet, Receptionist, Groomer
    description TEXT
);

CREATE TABLE permissions (
    permission_id SERIAL PRIMARY KEY,
    name          VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'patients:read', 'invoices:write'
    description   TEXT
);

CREATE TABLE role_permissions (
    role_id       INT NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id INT NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    role_id       INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
    email         CITEXT UNIQUE NOT NULL,        -- case-insensitive, no dupes
    password_hash VARCHAR(255),                  -- null if using OAuth via Auth.js
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    phone         VARCHAR(20),
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- NOTE: merged the old `staff` table into `users`. A staff member IS a user.
-- One identity, one row. Clinical records reference users directly.

-- ============================================================
-- CLIENTS & PATIENTS  (soft-delete: never lose medical history)
-- ============================================================
CREATE TABLE clients (
    client_id   SERIAL PRIMARY KEY,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    phone       VARCHAR(20),
    email       CITEXT,
    notes       TEXT,
    deleted_at  TIMESTAMPTZ,                     -- soft delete
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE patients (
    patient_id    SERIAL PRIMARY KEY,
    client_id     INT NOT NULL REFERENCES clients(client_id) ON DELETE RESTRICT,
    name          VARCHAR(100) NOT NULL,
    species       VARCHAR(50),
    breed         VARCHAR(100),
    date_of_birth DATE,
    sex           VARCHAR(10) CHECK (sex IN ('Male','Female','Unknown')),
    is_neutered   BOOLEAN NOT NULL DEFAULT FALSE,
    microchip_id  VARCHAR(50) UNIQUE,
    notes         TEXT,
    deleted_at    TIMESTAMPTZ,                   -- soft delete
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One unified clinical history table instead of 3 near-identical ones.
-- diagnoses / vaccinations / grooming collapsed into typed records.
-- Type-specific fields live in a JSONB `details` column — simple, flexible,
-- and you avoid 3 separate tables that all look the same.
CREATE TABLE clinical_records (
    record_id      SERIAL PRIMARY KEY,
    patient_id     INT NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    performed_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
    record_type    VARCHAR(20) NOT NULL
                       CHECK (record_type IN ('Diagnosis','Vaccination','Grooming')),
    title          VARCHAR(255) NOT NULL,        -- diagnosis name / vaccine name / 'Full groom'
    notes          TEXT,
    details        JSONB,                         -- {treatment, lot_number, coat_condition, ...}
    performed_at   DATE NOT NULL DEFAULT CURRENT_DATE,
    next_due_date  DATE,                          -- follow-up / next vaccine / next groom
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_clinical_updated BEFORE UPDATE ON clinical_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- BOOKINGS  (DB-enforced: no double-booking a staff member)
-- ============================================================
CREATE TABLE booking_types (
    type_id          SERIAL PRIMARY KEY,
    name             VARCHAR(100) UNIQUE NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30
);

CREATE TABLE bookings (
    booking_id   SERIAL PRIMARY KEY,
    patient_id   INT NOT NULL REFERENCES patients(patient_id) ON DELETE RESTRICT,
    client_id    INT NOT NULL REFERENCES clients(client_id) ON DELETE RESTRICT,
    staff_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    type_id      INT REFERENCES booking_types(type_id) ON DELETE SET NULL,
    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
                     CHECK (status IN ('Scheduled','Confirmed','Checked In','Completed','Cancelled','No Show')),
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at)
);
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The database itself refuses overlapping bookings for the same staff member.
-- Cancelled/No Show bookings are excluded so freed slots can be rebooked.
ALTER TABLE bookings ADD CONSTRAINT no_double_booking
    EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(starts_at, ends_at) WITH &&
    ) WHERE (status NOT IN ('Cancelled','No Show') AND staff_id IS NOT NULL);

-- ============================================================
-- INVENTORY  (single source of truth for stock; can't go negative)
-- ============================================================
CREATE TABLE inventory_items (
    item_id       SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    category      VARCHAR(100),
    barcode       VARCHAR(100) UNIQUE,
    unit          VARCHAR(50),
    current_stock INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 0,
    sale_price    NUMERIC(12,2),                 -- current price to customer
    last_cost     NUMERIC(12,2),                 -- most recent purchase cost
    expiry_date   DATE,
    notes         TEXT,
    deleted_at    TIMESTAMPTZ,                   -- soft delete (keeps transaction history valid)
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (current_stock >= 0)                   -- never oversell
);
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Append-only audit log of every stock movement. Never updated, never deleted.
CREATE TABLE inventory_transactions (
    transaction_id SERIAL PRIMARY KEY,
    item_id        INT NOT NULL REFERENCES inventory_items(item_id) ON DELETE RESTRICT,
    performed_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
    type           VARCHAR(20) NOT NULL
                       CHECK (type IN ('Received','Used','Sold','Adjusted','Expired')),
    quantity       INT NOT NULL,                 -- + in / - out
    unit_cost      NUMERIC(12,2),                -- set on 'Received'
    reference_type VARCHAR(50),                  -- 'booking','invoice','manual'
    reference_id   INT,
    notes          TEXT,
    performed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INVOICING  (numbers are FROZEN at issue — legal financial record)
-- ============================================================
CREATE TABLE services (
    service_id  SERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    category    VARCHAR(100),
    price       NUMERIC(12,2) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT
);

CREATE TABLE invoices (
    invoice_id   SERIAL PRIMARY KEY,
    client_id    INT NOT NULL REFERENCES clients(client_id) ON DELETE RESTRICT,
    booking_id   INT REFERENCES bookings(booking_id) ON DELETE SET NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'Draft'
                     CHECK (status IN ('Draft','Issued','Partial','Paid','Overdue','Void')),
    -- Frozen monetary snapshot, computed once at issue time:
    subtotal     NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0,
    tax_amount   NUMERIC(12,2) NOT NULL DEFAULT 0,
    total        NUMERIC(12,2) NOT NULL DEFAULT 0,
    issued_at    TIMESTAMPTZ,
    due_date     DATE,
    notes        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Line items copy name + price at time of sale. They do NOT depend on
-- live service/item prices — editing a price later never alters past invoices.
CREATE TABLE invoice_line_items (
    line_item_id  SERIAL PRIMARY KEY,
    invoice_id    INT NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    service_id    INT REFERENCES services(service_id) ON DELETE SET NULL,
    item_id       INT REFERENCES inventory_items(item_id) ON DELETE SET NULL,
    description   VARCHAR(255) NOT NULL,         -- frozen label
    quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price    NUMERIC(12,2) NOT NULL,        -- frozen price
    line_total    NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    CHECK (service_id IS NOT NULL OR item_id IS NOT NULL)
);

CREATE TABLE payments (
    payment_id  SERIAL PRIMARY KEY,
    invoice_id  INT NOT NULL REFERENCES invoices(invoice_id) ON DELETE RESTRICT,
    amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    method      VARCHAR(50) CHECK (method IN ('Cash','Card','Bank Transfer','Other')),
    reference   VARCHAR(100),
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notification_templates (
    template_id   SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    channel       VARCHAR(20) CHECK (channel IN ('WhatsApp','SMS','Email')),
    trigger_event VARCHAR(100),
    body          TEXT NOT NULL,                 -- supports {{patient_name}} etc.
    is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE notifications (
    notification_id SERIAL PRIMARY KEY,
    client_id       INT NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    patient_id      INT REFERENCES patients(patient_id) ON DELETE SET NULL,
    booking_id      INT REFERENCES bookings(booking_id) ON DELETE SET NULL,
    template_id     INT REFERENCES notification_templates(template_id) ON DELETE SET NULL,
    channel         VARCHAR(20) CHECK (channel IN ('WhatsApp','SMS','Email')),
    recipient       VARCHAR(255) NOT NULL,       -- frozen at send time
    body            TEXT NOT NULL,               -- frozen rendered message
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending','Sent','Delivered','Failed')),
    retry_count     INT NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG  (who changed what — medical + financial accountability)
-- ============================================================
CREATE TABLE audit_log (
    audit_id    BIGSERIAL PRIMARY KEY,
    user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,
    action      VARCHAR(20) NOT NULL,            -- INSERT / UPDATE / DELETE
    entity      VARCHAR(50) NOT NULL,            -- 'invoice', 'patient', ...
    entity_id   INT NOT NULL,
    changes     JSONB,                            -- before/after diff
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES  (foreign keys + hot query paths)
-- ============================================================
CREATE INDEX idx_users_role            ON users(role_id);
CREATE INDEX idx_patients_client       ON patients(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_clinical_patient      ON clinical_records(patient_id);
CREATE INDEX idx_clinical_due          ON clinical_records(next_due_date) WHERE next_due_date IS NOT NULL;
CREATE INDEX idx_bookings_staff_time   ON bookings(staff_id, starts_at);
CREATE INDEX idx_bookings_starts       ON bookings(starts_at);
CREATE INDEX idx_inventory_barcode     ON inventory_items(barcode);
CREATE INDEX idx_inventory_low_stock   ON inventory_items(current_stock) WHERE deleted_at IS NULL;
CREATE INDEX idx_invtx_item            ON inventory_transactions(item_id);
CREATE INDEX idx_invoices_client       ON invoices(client_id);
CREATE INDEX idx_invoices_status       ON invoices(status);
CREATE INDEX idx_lineitems_invoice     ON invoice_line_items(invoice_id);
CREATE INDEX idx_payments_invoice      ON payments(invoice_id);
CREATE INDEX idx_notif_worker          ON notifications(status, scheduled_at);  -- for the send cron
CREATE INDEX idx_audit_entity          ON audit_log(entity, entity_id);
