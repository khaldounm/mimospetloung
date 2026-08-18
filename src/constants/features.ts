// Which product modules this deployment exposes.
//
// This repo serves exactly one clinic (Dr Zeina), so the constant below is the
// source of truth. No module code is deleted and the permission catalogue in
// prisma/rbac.ts stays complete, so a module can be switched back on later
// without restoring code.
//
// The gate is applied in one place: hasPermission() in src/lib/permissions.ts.
// requirePermission() in src/lib/api.ts delegates to hasPermission(), and both
// the proxy.ts route gating and DashboardShell's nav filtering flow through it,
// so clipping there covers nav, pages and every API route at once.

export const ENABLED_MODULES = [
  "patients", // clients and patients
  "clinical",
  "bookings",
  "invoices", // also gates Services, which has no permission of its own
  "payments",
  "notifications",
  "users",
  "audit",
] as const;

// Off for this deployment. Documentation only, nothing reads this array: the
// gate is a whitelist, so anything missing from ENABLED_MODULES is denied.
export const DISABLED_MODULES = [
  "inventory", // she runs a separate store application
  "orders", // purchase orders and suppliers
  "partners",
  "costs",
  "analytics", // mostly store-derived, off for v1
  "messages", // website contact form
] as const;

// Optional override for demos: FEATURES="patients,invoices,analytics".
//
// A set value REPLACES the list above wholesale rather than adding to it, so a
// stale or partial value can never silently widen access beyond what it names.
// Unset, empty, or all-whitespace falls back to ENABLED_MODULES, never to
// all-on. Read once at module load, so changing it needs a server restart.
function resolveEnabledModules(): ReadonlySet<string> {
  const raw = process.env.FEATURES;
  if (raw) {
    const parsed = raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    if (parsed.length > 0) return new Set(parsed);
  }
  return new Set<string>(ENABLED_MODULES);
}

const enabledModules = resolveEnabledModules();

// "invoices:write" -> "invoices". A permission with no colon is its own module.
export function moduleOf(permission: string): string {
  const separator = permission.indexOf(":");
  const name = separator === -1 ? permission : permission.slice(0, separator);
  return name.toLowerCase();
}

export function isModuleEnabled(module: string): boolean {
  return enabledModules.has(module.toLowerCase());
}

export function isPermissionEnabled(permission: string): boolean {
  return isModuleEnabled(moduleOf(permission));
}
