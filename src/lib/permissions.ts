// Single source of truth for RBAC checks, route gating, and nav visibility.

import { isPermissionEnabled } from "@/constants/features";

export interface PermissionHolder {
  permissions?: string[] | null;
}

export function hasPermission(
  user: PermissionHolder | null | undefined,
  permission: string,
): boolean {
  // Deployment gate first. A permission belonging to a module this clinic does
  // not run is denied even when the role grants it, so dead grants (the Vet's
  // inventory:read, Admin's everything) clip harmlessly and nothing has to be
  // removed from the catalogue in prisma/rbac.ts. This is the single chokepoint:
  // requirePermission() delegates here, and nav visibility plus proxy.ts route
  // gating both flow through it.
  if (!isPermissionEnabled(permission)) return false;
  return Boolean(user?.permissions?.includes(permission));
}

export function hasAnyPermission(
  user: PermissionHolder | null | undefined,
  permissions: string[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

// Module navigation — each entry requires its `read` permission to be visible
// and to access the page/API under its path prefix.
export interface NavModule {
  href: string;
  label: string;
  icon: string; // MUI icon name, resolved in the nav component
  permission: string;
}

export const NAV_MODULES: NavModule[] = [
  {
    href: "/patients",
    label: "Patients",
    icon: "Pets",
    permission: "patients:read",
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: "Event",
    permission: "bookings:read",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: "Inventory2",
    permission: "inventory:read",
  },
  {
    href: "/orders",
    label: "Orders",
    icon: "ShoppingCart",
    permission: "orders:read",
  },
  {
    href: "/suppliers",
    label: "Suppliers",
    icon: "LocalShipping",
    permission: "orders:read",
  },
  {
    href: "/invoices",
    label: "Invoices",
    icon: "Receipt",
    permission: "invoices:read",
  },
  {
    href: "/notifications",
    label: "Reminders",
    icon: "Notifications",
    permission: "notifications:read",
  },
  {
    href: "/services",
    label: "Services",
    icon: "MedicalServices",
    permission: "invoices:read",
  },
  {
    // Its own permission rather than notifications:read, so the website contact
    // form can be switched off per deployment independently of reminders.
    href: "/messages",
    label: "Web Contact Form",
    icon: "Email",
    permission: "messages:read",
  },
  { href: "/users", label: "Staff", icon: "Group", permission: "users:read" },
  {
    href: "/running-costs",
    label: "Running costs",
    icon: "Payments",
    permission: "costs:read",
  },
  {
    href: "/partners",
    label: "Partners",
    icon: "Handshake",
    permission: "partners:read",
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: "Insights",
    permission: "analytics:read",
  },
  {
    href: "/audit",
    label: "Audit log",
    icon: "History",
    permission: "audit:read",
  },
];

// Maps a request path prefix to the permission required to access it.
// Covers both the dashboard pages and their matching /api/* routes.
const ROUTE_RULES: { prefix: string; permission: string }[] = [
  { prefix: "/analytics", permission: "analytics:read" },
  { prefix: "/api/analytics", permission: "analytics:read" },
  { prefix: "/running-costs", permission: "costs:read" },
  { prefix: "/api/running-costs", permission: "costs:read" },
  { prefix: "/partners", permission: "partners:read" },
  { prefix: "/api/partners", permission: "partners:read" },
  // Purchasing sits behind its own permission, not inventory:read, so clinical
  // staff never see purchase costs.
  { prefix: "/suppliers", permission: "orders:read" },
  { prefix: "/api/suppliers", permission: "orders:read" },
  { prefix: "/orders", permission: "orders:read" },
  { prefix: "/api/orders", permission: "orders:read" },
  { prefix: "/patients", permission: "patients:read" },
  // Clients are part of the Patients module, gated by the same permission.
  { prefix: "/clients", permission: "patients:read" },
  { prefix: "/api/clients", permission: "patients:read" },
  { prefix: "/bookings", permission: "bookings:read" },
  { prefix: "/inventory", permission: "inventory:read" },
  { prefix: "/invoices", permission: "invoices:read" },
  // Services are the billable catalog behind invoicing, gated the same way.
  { prefix: "/services", permission: "invoices:read" },
  { prefix: "/notifications", permission: "notifications:read" },
  // Website contact messages have their own permission so the module can be
  // gated per deployment. The proxy checks these rules before any handler runs,
  // which is what makes the page and its API unreachable when the flag is off.
  { prefix: "/messages", permission: "messages:read" },
  { prefix: "/api/messages", permission: "messages:read" },
  { prefix: "/users", permission: "users:read" },
  { prefix: "/api/users", permission: "users:read" },
  { prefix: "/audit", permission: "audit:read" },
  { prefix: "/api/audit", permission: "audit:read" },
  { prefix: "/api/patients", permission: "patients:read" },
  { prefix: "/api/bookings", permission: "bookings:read" },
  { prefix: "/api/inventory", permission: "inventory:read" },
  { prefix: "/api/invoices", permission: "invoices:read" },
  { prefix: "/api/services", permission: "invoices:read" },
  { prefix: "/api/notifications", permission: "notifications:read" },
];

// Returns the permission required for a path, or null if the path is not gated.
export function requiredPermissionForPath(pathname: string): string | null {
  const rule = ROUTE_RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return rule ? rule.permission : null;
}

// First module the user is allowed to see — used as a post-login landing page.
export function firstAllowedHref(
  user: PermissionHolder | null | undefined,
): string | null {
  const mod = NAV_MODULES.find((m) => hasPermission(user, m.permission));
  return mod ? mod.href : null;
}
