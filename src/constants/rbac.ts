// How the permission catalogue is presented to a human.
//
// The catalogue itself lives in the database (seeded from prisma/rbac.ts) and
// stays the source of truth: this file only decides the order the modules are
// shown in and what they are called on screen. A permission whose module is not
// listed here still appears in the matrix, at the end, under its raw module
// name, so a newly added permission can never silently become invisible.

export interface PermissionGroup {
  module: string;
  label: string;
  // Shown under the label. Only worth writing where the gate reaches further
  // than the name suggests, so the person flipping the switch knows what else
  // moves with it.
  hint?: string;
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { module: "patients", label: "Clients & patients" },
  { module: "clinical", label: "Clinical records" },
  { module: "bookings", label: "Bookings" },
  {
    module: "invoices",
    label: "Invoices & services",
    hint: "Read also opens the services catalogue",
  },
  { module: "payments", label: "Record payments" },
  { module: "inventory", label: "Inventory" },
  {
    module: "orders",
    label: "Suppliers & purchase orders",
    hint: "Read also reveals what stock costs the clinic",
  },
  {
    module: "partners",
    label: "Partners & payouts",
    hint: "Read also reveals partner cost and profit shares",
  },
  { module: "costs", label: "Running costs" },
  { module: "analytics", label: "Analytics" },
  {
    module: "users",
    label: "Staff / users",
    hint: "Write also opens Settings, including this matrix",
  },
  { module: "audit", label: "Audit log" },
  { module: "notifications", label: "Reminders & notifications" },
  { module: "messages", label: "Website contact form" },
];

// "inventory" -> "Inventory". Fallback label for a module that has been added to
// the catalogue but not yet given a row above.
export function fallbackGroupLabel(module: string): string {
  return module.charAt(0).toUpperCase() + module.slice(1);
}
