-- ============================================================
-- WEBSITE CONTACT MESSAGES
-- Inbound enquiries from the public marketing site's contact form. The public
-- site (zeinavet) inserts rows here; staff triage them in the VCMS. These are
-- leads, not yet linked to a client record, so no FK to clients.
--
-- status carries the triage lifecycle (New / Read / Archived). updated_at is
-- maintained by the shared set_updated_at() trigger defined in the init
-- migration. email is CITEXT so lookups match a client's email case-insensitively.
-- ============================================================
CREATE TABLE contact_messages (
    message_id  SERIAL PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL,
    email       CITEXT       NOT NULL,
    phone       VARCHAR(40),
    pet_name    VARCHAR(60),
    pet_type    VARCHAR(40),
    message     TEXT         NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'New'
                    CHECK (status IN ('New', 'Read', 'Archived')),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Inbox query: newest enquiries first.
CREATE INDEX idx_contact_messages_created ON contact_messages (created_at DESC);

-- Tab filter: unread / archived counts and lists.
CREATE INDEX idx_contact_messages_status ON contact_messages (status);

CREATE TRIGGER trg_contact_messages_updated BEFORE UPDATE ON contact_messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
