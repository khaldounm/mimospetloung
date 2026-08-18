import type { PrismaClient } from "../src/generated/prisma/client";

// ── Permission catalogue ────────────────────────────────────
export const PERMISSIONS: Record<string, string> = {
  "patients:read": "View clients and patients",
  "patients:write": "Create/edit clients and patients",
  "clinical:read": "View clinical records",
  "clinical:write": "Create/edit clinical records",
  "bookings:read": "View bookings",
  "bookings:write": "Create/edit bookings",
  "inventory:read": "View inventory",
  "inventory:write": "Receive/adjust inventory",
  "invoices:read": "View invoices",
  "invoices:write": "Create/issue invoices",
  "payments:write": "Record payments",
  "notifications:read": "View notifications/templates",
  "notifications:write": "Manage notifications/templates",
  // Website contact form. Separate from notifications:* so a deployment without
  // a public website can switch the module off without losing reminders.
  "messages:read": "View website contact form messages",
  "users:read": "View staff/users",
  "users:write": "Manage staff/users",
  "audit:read": "View audit log",
  "analytics:read": "View the analytics dashboard",
  "costs:read": "View running costs and net profit",
  "costs:write": "Manage running costs",
  "partners:read": "View partners and consignment balances",
  "partners:write": "Manage partners and record payouts",
  // Purchasing. Deliberately separate from inventory:* so clinical staff can
  // see stock levels without seeing what the clinic pays for it.
  "orders:read": "View suppliers and purchase orders",
  "orders:write": "Manage suppliers and purchase orders",
};

// ── Role → permission grants ────────────────────────────────
export const ROLE_GRANTS: Record<string, string[]> = {
  Admin: Object.keys(PERMISSIONS), // everything
  Vet: [
    "patients:read",
    "clinical:read",
    "clinical:write",
    "bookings:read",
    "bookings:write",
    // Kept deliberately. On a deployment with inventory switched off this grant
    // clips inside hasPermission() and is simply invisible, so the catalogue and
    // the grants stay portable across clinics.
    "inventory:read",
    "invoices:read",
    "notifications:read",
    "messages:read",
  ],
  Receptionist: [
    "patients:read",
    "patients:write",
    "bookings:read",
    "bookings:write",
    "invoices:read",
    "invoices:write",
    "payments:write",
    "notifications:read",
    "notifications:write",
    "messages:read",
  ],
  Groomer: [
    "patients:read",
    "clinical:read",
    "clinical:write",
    "bookings:read",
    "bookings:write",
    "notifications:read",
    "messages:read",
  ],
};

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: "Full access to all modules and settings",
  Vet: "Veterinarian: clinical records, bookings, read-only invoices. No stock or purchasing.",
  Receptionist: "Front desk, clients, bookings, invoicing and payments",
  Groomer: "Grooming bookings and grooming records",
};

// Idempotently upsert the permission catalogue, the roles, and their grants.
// Safe to run repeatedly. Shared by the seed and the add-user script.
export async function seedRbac(prisma: PrismaClient): Promise<void> {
  for (const [name, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description },
    });
  }

  for (const [roleName, grants] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: { description: ROLE_DESCRIPTIONS[roleName] },
      create: { name: roleName, description: ROLE_DESCRIPTIONS[roleName] },
    });

    for (const permName of grants) {
      const perm = await prisma.permission.findUniqueOrThrow({
        where: { name: permName },
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.roleId,
            permissionId: perm.permissionId,
          },
        },
        update: {},
        create: { roleId: role.roleId, permissionId: perm.permissionId },
      });
    }
  }
}
