// Serializable DTOs passed from server components to client components and
// returned by the JSON API. Dates are ISO strings (or YYYY-MM-DD for date-only
// columns) so they survive JSON / RSC serialization without surprises.
import type {
  BookingStatus,
  ContactMessageStatus,
  InventoryTxType,
  InvoiceStatus,
  NotificationChannel,
  NotificationStatus,
  PaymentMethod,
  PurchaseOrderStatus,
  RecordType,
} from "./enums";

export interface ClientDTO {
  clientId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  patientCount?: number;
}

export interface PatientDTO {
  patientId: number;
  clientId: number;
  name: string;
  species: string | null;
  breed: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  isNeutered: boolean;
  microchipId: string | null;
  notes: string | null;
  clientName?: string;
}

export interface BookingDTO {
  bookingId: number;
  patientId: number;
  patientName: string;
  clientId: number;
  clientName: string;
  staffId: number | null;
  staffName: string | null;
  typeId: number | null;
  typeName: string | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  notes: string | null;
}

export interface StaffOption {
  userId: number;
  label: string;
}

export interface BookingTypeOption {
  typeId: number;
  name: string;
  durationMinutes: number;
}

export interface PatientOption {
  patientId: number;
  label: string;
}

export interface ClinicalRecordDTO {
  recordId: number;
  recordType: RecordType;
  subcategory: string | null;
  title: string;
  notes: string | null;
  details: Record<string, unknown> | null;
  performedAt: string;
  nextDueDate: string | null;
  performerName: string | null;
}

// Lightweight option used in the Add Record dialog to populate the
// subcategory dropdown from the services table (source of truth for procedures).
export interface ServicePickerOption {
  serviceId: number;
  name: string;
  category: string | null;
}

// Decimal columns are serialized as strings to avoid float rounding and to keep
// RSC payloads made of plain values only.
export interface InventoryItemDTO {
  itemId: number;
  name: string;
  category: string | null;
  barcode: string | null;
  unit: string | null;
  currentStock: number;
  reorderLevel: number;
  salePrice: string | null;
  lastCost: string | null;
  // Consignment: the sourcing partner (null = clinic-owned) and the agreed
  // profit-share %, which falls back to the partner default when unset.
  partnerId: number | null;
  partnerName: string | null;
  partnerSharePct: string | null;
  // Purchasing: the company this item is usually reordered from. Advisory only
  // and independent of the partner fields.
  supplierId: number | null;
  supplierName: string | null;
  expiryDate: string | null;
  notes: string | null;
  isLowStock: boolean;
  isExpired: boolean;
}

export interface InventoryTransactionDTO {
  transactionId: number;
  itemId: number;
  type: InventoryTxType;
  quantity: number;
  unitCost: string | null;
  // Frozen on a Sold movement (and its void reversal), null on every other type.
  salePrice: string | null;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  performedAt: string;
  performerName: string | null;
}

export interface ServiceDTO {
  serviceId: number;
  name: string;
  category: string | null;
  price: string;
  isActive: boolean;
  description: string | null;
}

export interface InvoiceLineItemDTO {
  lineItemId: number;
  invoiceId: number;
  serviceId: number | null;
  itemId: number | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

export interface PaymentDTO {
  paymentId: number;
  invoiceId: number;
  amount: string;
  method: PaymentMethod | null;
  reference: string | null;
  paidAt: string;
  notes: string | null;
}

// Full invoice with its lines + payments, for the detail view.
export interface InvoiceDTO {
  invoiceId: number;
  number: string;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  bookingId: number | null;
  status: InvoiceStatus;
  subtotal: string;
  discountPct: string;
  taxPct: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  balance: string;
  issuedAt: string | null;
  dueDate: string | null;
  notes: string | null;
  createdAt: string;
  isOverdue: boolean;
  lineItems: InvoiceLineItemDTO[];
  payments: PaymentDTO[];
}

// ── Notifications ─────────────────────────────────────────
export interface NotificationTemplateDTO {
  templateId: number;
  name: string;
  channel: NotificationChannel | null;
  triggerEvent: string | null;
  body: string;
  isActive: boolean;
}

export interface NotificationDTO {
  notificationId: number;
  clientId: number;
  clientName: string;
  patientId: number | null;
  patientName: string | null;
  bookingId: number | null;
  templateId: number | null;
  templateName: string | null;
  channel: NotificationChannel | null;
  recipient: string;
  body: string;
  status: NotificationStatus;
  retryCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

// One row of the audit trail. auditId is a BigInt in the DB, serialized as a
// string so it survives JSON.
export interface AuditLogDTO {
  auditId: string;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: number;
  changes: unknown;
  createdAt: string;
}

// A staff/user account. Never carries the password hash. `canManageUsers`
// flags whether the user's role grants users:write (i.e. is an admin), used to
// surface lockout guard rails in the UI.
export interface UserDTO {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  roleId: number;
  roleName: string;
  isActive: boolean;
  canManageUsers: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// A selectable role for the user form's role picker.
export interface RoleOption {
  roleId: number;
  name: string;
}

// An upcoming booking within the reminder window, with the status of its
// reminder notification (if one has been created from the reminder template).
export interface UpcomingBookingDTO {
  bookingId: number;
  clientId: number;
  clientName: string;
  patientName: string;
  startsAt: string;
  bookingStatus: BookingStatus;
  reminderStatus: NotificationStatus | null;
  reminderNotificationId: number | null;
}

// A past booking that was never completed (still Scheduled / Confirmed, or a
// No Show). Surfaced in the Missed tab so staff can send a follow-up message.
export interface MissedBookingDTO {
  bookingId: number;
  clientId: number;
  clientName: string;
  patientId: number;
  patientName: string;
  startsAt: string;
  bookingStatus: BookingStatus;
}

// An open recall reminder (Vaccination or Grooming) whose due date is
// approaching or already past. Surfaced in the Vaccinations / Grooming tabs so
// staff can send a recall message, snooze, or dismiss it. One row per patient
// per type (their active recall, materialised in the reminders table).
export interface DueRecordDTO {
  reminderId: number;
  recordType: RecordType;
  title: string; // vaccine name / "Full groom", etc.
  patientId: number;
  patientName: string;
  clientId: number;
  clientName: string;
  nextDueDate: string; // "YYYY-MM-DD"
  isOverdue: boolean;
  followUpSentAt: string | null; // ISO timestamp, null if no follow-up sent yet
}

// ── Analytics ─────────────────────────────────────────────
// Aggregate figures for the dashboard. Money values are plain numbers (already
// rounded to 2dp) rather than the string-Decimal convention used elsewhere,
// because they feed charts and KPI cards, not authoritative records.

export interface NamedCount {
  label: string;
  count: number;
}

export interface NamedValue {
  label: string;
  value: number;
}

// A closed date range, both bounds inclusive, each as "YYYY-MM-DD". Drives the
// time-boxable analytics sections.
export interface AnalyticsRange {
  from: string;
  to: string;
}

export interface RevenueAnalytics {
  periodCollected: number; // payments received within the range
  periodInvoiced: number; // value issued within the range
  outstandingTotal: number; // unpaid balance across open invoices, as of today
  avgInvoiceValue: number; // mean total of invoices issued within the range
  voidRate: number; // voided / issued within the range, as a percentage
  aging: {
    current: number; // not yet due
    d1to30: number;
    d31to60: number;
    d61plus: number;
  };
  trend: { label: string; collected: number; outstanding: number }[]; // bucketed by issue date over the range
  byService: NamedValue[]; // top services by billed revenue within the range
}

export interface ClientsAnalytics {
  totalActive: number;
  newThisMonth: number;
  lapsed: number; // active clients with no booking in the last 6 months
  totalPatients: number;
  avgPatientsPerClient: number;
  newTrend: NamedCount[]; // new clients per month, 12 months
  speciesMix: NamedCount[]; // patient species distribution
}

export interface InventoryAnalytics {
  totalItems: number; // count of active inventory items
  stockValuation: number; // sum of currentStock * unit cost
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number; // within 30 days
  lowStockItems: {
    itemId: number;
    name: string;
    currentStock: number;
    reorderLevel: number;
    unit: string | null;
  }[];
  outOfStockItems: {
    itemId: number;
    name: string;
    unit: string | null;
  }[];
  topConsumed: NamedValue[]; // most-sold items by quantity, last 90 days
}

export interface BookingsAnalytics {
  periodCount: number; // bookings within the range
  noShowRate: number; // within the range, percentage
  cancellationRate: number; // within the range, percentage
  completedRate: number; // within the range, percentage
  volumeTrend: NamedCount[]; // bookings bucketed over the range
  statusMix: NamedCount[]; // booking status distribution within the range
  byWeekday: NamedCount[]; // bookings per weekday within the range
}

export interface ProfitAnalytics {
  periodRevenue: number; // payments collected within the range
  periodCogs: number; // cost of clinic-owned inventory items sold within the range
  periodPartnerPayouts: number; // owed to partners on consigned sales within the range
  periodCosts: number; // running (operating) costs incurred within the range
  periodProfit: number; // revenue minus COGS minus partner payouts minus operating costs
  // Value of stock that left without being sold, over the range. Reported for
  // visibility and deliberately NOT subtracted from periodProfit: consumables
  // are expensed through running costs, so charging them here as well would
  // count the same stock twice.
  periodClinicUse: number; // stock consumed in the clinic (Used movements)
  periodWriteOffs: number; // stock binned (Expired movements)
  // Bucketed over the range: collected revenue, COGS, partner payouts, operating
  // costs, net profit.
  trend: {
    label: string;
    revenue: number;
    cogs: number;
    partnerPayouts: number;
    costs: number;
    profit: number;
  }[];
  byCategory: NamedValue[]; // costs split by category (incl. COGS + partner payouts) within the range
}

// Cash out to suppliers. Deliberately separate from ProfitAnalytics and never
// folded into it: the clinic recognises stock cost as COGS when the item sells,
// so buying stock moves cash without touching profit. Adding purchases to the
// profit figure would count the same stock twice.
export interface PurchasesAnalytics {
  periodBilled: number; // orders that became Received within the range
  periodPaid: number; // payments dated within the range
  periodOrderCount: number; // orders that became Received within the range
  // As of now, not range-scoped. A balance is a position, not a flow.
  owedNow: number; // sum of positive supplier balances
  creditNow: number; // sum of negative balances, as a positive figure
  inProgressNow: number; // value of orders placed but not yet fully delivered
  trend: { label: string; billed: number; paid: number }[];
  bySupplier: NamedValue[]; // top suppliers by amount billed within the range
}

export interface AnalyticsDTO {
  generatedAt: string;
  // The range the boxable sections were initially computed for (the default);
  // each of those sections can be re-queried for a different range on demand.
  defaultRange: AnalyticsRange;
  revenue: RevenueAnalytics;
  clients: ClientsAnalytics;
  inventory: InventoryAnalytics;
  bookings: BookingsAnalytics;
  // Only populated for users allowed to see costs (costs:read). Net-profit
  // figures combine revenue with running costs, which are admin-only.
  profit?: ProfitAnalytics | null;
  // Only populated for users allowed to see purchasing (orders:read), since it
  // exposes what the clinic pays suppliers.
  purchases?: PurchasesAnalytics | null;
}

// ── Running costs (operating expenses) ────────────────────
export interface RunningCostDTO {
  costId: number;
  category: string;
  description: string; // the specific item/line, e.g. "Electricity"
  amount: string; // money as a string (Decimal convention)
  incurredOn: string; // "YYYY-MM-DD"
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

// ── Partners (outsourced / consignment inventory) ─────────
// A partner fronts the cost of certain inventory items; on sale the clinic owes
// them their cost back plus a share of the profit. Stats (earned/paid/balance)
// are optional so the same DTO serves both the list (with stats) and pickers.
// A company the clinic buys stock from. Distinct from a partner: the clinic
// pays a supplier and owns the goods outright, with no profit share.
// What the clinic owes a supplier and what it has settled. Kept apart because
// the clinic buys both on the spot and on credit, so neither figure can be
// derived from the other.
//
// An order counts as invoiced once it reaches Received, meaning fully delivered
// or closed short. Orders still in Draft, Placed or Partial are shown as in
// progress and are deliberately not counted as owed: the supplier has not
// finished delivering, so there is no bill yet.
export interface SupplierMoneyDTO {
  invoiced: string; // total of Received orders
  paid: string; // total of recorded payments
  balance: string; // invoiced minus paid, what is still owed
  inProgress: string; // value of Draft / Placed / Partial orders, not yet owed
  orderCount: number; // Received orders
  openOrderCount: number; // Draft / Placed / Partial
}

export interface SupplierDTO {
  supplierId: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  isActive: boolean;
  itemCount?: number; // inventory items whose usual supplier is this one
  money?: SupplierMoneyDTO;
  createdAt: string;
}

// ---- Supplier statement (accounts payable) ----

// One source document on a supplier's statement, with the account balance as it
// stood immediately after it. Every figure on the statement traces to one of
// these, which is what makes the report auditable.
export interface StatementLineDTO {
  kind: "order" | "payment";
  date: string;
  reference: string;
  description: string;
  charge: string; // "0.00" on a payment row
  payment: string; // "0.00" on a charge row
  balance: string; // running account balance after this row
  href: string | null;
}

export interface StatementSupplierDTO {
  supplierId: number;
  supplierName: string;
  openingBalance: string;
  billed: string;
  paid: string;
  closingBalance: string;
  // False if the running balance across the lines does not land on the closing
  // figure, which would mean a document is missing. Surfaced, never hidden.
  ties: boolean;
  // Closing balance split by how long it has been outstanding, keyed by the ids
  // in AGING_BUCKETS. Sums back to closingBalance.
  aging: Record<string, string>;
  lines: StatementLineDTO[];
}

export interface StatementTotalsDTO {
  openingBalance: string;
  billed: string;
  paid: string;
  closingBalance: string;
  ties: boolean;
  aging: Record<string, string>;
  supplierCount: number;
}

export interface StatementDTO {
  clinicName: string;
  currency: string;
  range: AnalyticsRange;
  asAt: string; // the last day of the period, which balances are stated as at
  generatedAt: string;
  suppliers: StatementSupplierDTO[];
  totals: StatementTotalsDTO;
}

export interface SupplierPaymentDTO {
  paymentId: number;
  supplierId: number;
  // The order this settled, when it was one specific bill rather than a lump
  // sum against the account.
  orderId: number | null;
  orderReference: string | null;
  amount: string;
  paidOn: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface PurchaseOrderLineDTO {
  lineId: number;
  orderId: number;
  itemId: number;
  itemName: string;
  unit: string | null;
  currentStock: number;
  reorderLevel: number;
  quantityOrdered: string;
  quantityReceived: string;
  quantityOutstanding: string; // ordered minus received, 0 once the line is complete
  unitCost: string | null;
  lineTotal: string; // quantityOrdered * unitCost, 0 when no cost is set yet
  notes: string | null;
}

// A reorder sheet. supplierId is null for the "No supplier" bucket, which
// collects items that have no usual supplier yet and cannot be placed until one
// is assigned.
export interface PurchaseOrderDTO {
  orderId: number;
  supplierId: number | null;
  supplierName: string | null;
  status: PurchaseOrderStatus;
  reference: string | null;
  orderedOn: string | null;
  receivedOn: string | null;
  discountAmount: string | null;
  shippingAmount: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  notes: string | null;
  lineCount: number;
  // True once at least one line has been delivered but something is still
  // outstanding, which is what puts the order in Partial.
  hasOutstanding: boolean;
  subtotal: string; // sum of the line totals
  taxableBase: string; // subtotal - discount + shipping, what VAT is charged on
  total: string; // taxable base plus tax
  createdByName: string | null;
  createdAt: string;
  lines?: PurchaseOrderLineDTO[];
}

// The money side of a consignment relationship, split so the clinic can tell
// revenue, capital and profit apart rather than seeing one blended number.
//
// The sales figures are scoped to a date range. The balance figures are not:
// what is owed is a running total, and slicing it by month would be meaningless.
export interface PartnerMoneyDTO {
  // --- range-scoped: what their stock did over the selected period ---
  revenue: string; // what customers paid for their items
  costOfSales: string; // their capital in the items that sold, returning to them
  grossProfit: string; // revenue minus cost of sales
  partnerShare: string; // their cut of the profit only, excluding capital back
  clinicShare: string; // what the clinic kept (can be negative on a below-cost sale)
  accrued: string; // costOfSales + partnerShare, the total owed for the period
  unitsSold: string;
  paidInRange: string; // payouts recorded in the period
  // --- position as at the range's end date ---
  // A balance is a point in time, not a span, so these are cumulative up to and
  // including the last day of the range. With a range ending today they equal
  // the all-time figures; with a past range they are the position as it stood.
  earnedToDate: string;
  paidToDate: string;
  balance: string; // earnedToDate minus paidToDate, the amount owed at that point
  // The balance split into its two halves, which always sum back to it. Payouts
  // are treated as settling capital before profit, so a part-paid partner reads
  // as "your money is back, what is left is your cut".
  capitalOwed: string;
  profitOwed: string;
  profitShareToDate: string; // their cut earned up to that date, paid or not
  capitalDeployed: string; // their money in play then: in stock + recovered
  capitalOnShelf: string; // their money still sitting in unsold stock at that date
  capitalRecoveredToDate: string; // capital freed up by sales, paid out or still owed
  sellThroughPct: string; // share of their capital that had come back through sales
}

export interface PartnerDTO {
  partnerId: number;
  name: string;
  phone: string | null;
  defaultSharePct: string; // percentage as a string, e.g. "20.00"
  notes: string | null;
  isActive: boolean;
  itemCount?: number; // consigned items sourced from this partner
  money?: PartnerMoneyDTO;
  createdAt: string;
}

// One of a partner's items, and how it performed over the selected range. Shows
// the clinic which of a partner's lines actually earn and which sit still.
export interface PartnerItemPerformanceDTO {
  itemId: number;
  itemName: string;
  unit: string | null;
  currentStock: number;
  capitalOnShelf: string;
  unitsSold: string;
  revenue: string;
  costOfSales: string;
  grossProfit: string;
  partnerShare: string;
  clinicShare: string;
}

export interface PartnerPayoutDTO {
  payoutId: number;
  partnerId: number;
  amount: string;
  paidOn: string; // "YYYY-MM-DD"
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}

// One consigned sale (or its void reversal) contributing to a partner's balance.
export interface PartnerEarningDTO {
  transactionId: number;
  performedAt: string;
  type: InventoryTxType;
  itemName: string;
  quantity: string;
  payable: string; // amount owed for this line (negative on a void reversal)
  invoiceNumber: string | null;
}

// ── Website contact messages ──────────────────────────────
// An inbound enquiry submitted through the public marketing site's contact
// form. These are leads, not yet linked to a client record.
export interface ContactMessageDTO {
  messageId: number;
  name: string;
  email: string;
  phone: string | null;
  petName: string | null;
  petType: string | null;
  message: string;
  status: ContactMessageStatus;
  createdAt: string;
}

// Lighter row for the invoices list.
export interface InvoiceListItemDTO {
  invoiceId: number;
  number: string;
  clientName: string;
  status: InvoiceStatus;
  total: string;
  amountPaid: string;
  balance: string;
  issuedAt: string | null;
  dueDate: string | null;
  isOverdue: boolean;
}
