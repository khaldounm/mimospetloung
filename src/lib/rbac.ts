// Reading and editing role permissions as a matrix: modules down the side,
// roles across the top, a read and a write switch in every cell.
//
// The catalogue in the database is the source of truth for what permissions
// exist (seeded from prisma/rbac.ts); constants/rbac.ts only decides how they
// are ordered and named on screen. Grants are edited one switch at a time, and
// the read/write invariant is enforced HERE rather than in the component, so it
// holds for any caller: write always implies read.

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { isPermissionEnabled, moduleOf } from "@/constants/features";
import { fallbackGroupLabel, PERMISSION_GROUPS } from "@/constants/rbac";
import { USER_ADMIN_PERMISSION } from "@/lib/users";
import type {
  PermissionMatrixDTO,
  PermissionMatrixRow,
  RoleOption,
} from "@/types/entities";

// "invoices:write" -> "write". A permission with no colon has no action half
// and can only ever be shown, never toggled.
function actionOf(permission: string): string | null {
  const separator = permission.indexOf(":");
  return separator === -1 ? null : permission.slice(separator + 1);
}

// Builds the rows from whatever the catalogue currently holds. Modules switched
// off for this deployment are left out entirely: hasPermission() denies them
// regardless of the grant, so a switch for one would do nothing. Their existing
// grants stay in the database untouched, which is what lets a module be turned
// back on later without re-granting anything.
function buildRows(permissionNames: string[]): PermissionMatrixRow[] {
  const byModule = new Map<string, { read?: string; write?: string }>();

  for (const name of permissionNames) {
    if (!isPermissionEnabled(name)) continue;
    const action = actionOf(name);
    // The catalogue is read/write throughout. Anything else is shown nowhere
    // and, because the API only accepts names the matrix produced, is never
    // touched by an edit either.
    if (action !== "read" && action !== "write") continue;

    const moduleName = moduleOf(name);
    const entry = byModule.get(moduleName) ?? {};
    entry[action] = name;
    byModule.set(moduleName, entry);
  }

  const rows: PermissionMatrixRow[] = [];

  for (const group of PERMISSION_GROUPS) {
    const entry = byModule.get(group.module);
    if (!entry) continue;
    rows.push({
      module: group.module,
      label: group.label,
      ...(group.hint ? { hint: group.hint } : {}),
      readPermission: entry.read ?? null,
      writePermission: entry.write ?? null,
    });
    byModule.delete(group.module);
  }

  // Anything added to the catalogue but not yet given a row above still shows,
  // at the end, under its raw module name. A new permission going unnoticed is
  // the one failure mode worth designing out of this screen.
  for (const moduleName of [...byModule.keys()].sort()) {
    const entry = byModule.get(moduleName)!;
    rows.push({
      module: moduleName,
      label: fallbackGroupLabel(moduleName),
      readPermission: entry.read ?? null,
      writePermission: entry.write ?? null,
    });
  }

  return rows;
}

// Columns, rows, and who currently holds what. One call, because the client
// re-syncs the whole matrix from the response after every click rather than
// trusting its own optimistic guess.
export async function getPermissionMatrix(): Promise<PermissionMatrixDTO> {
  const [permissions, roles] = await Promise.all([
    prisma.permission.findMany({ select: { name: true } }),
    prisma.role.findMany({
      select: {
        roleId: true,
        name: true,
        rolePermissions: { select: { permission: { select: { name: true } } } },
      },
    }),
  ]);

  const rows = buildRows(permissions.map((p) => p.name));
  const cells = new Set(
    rows.flatMap((r) => [r.readPermission, r.writePermission]).filter(Boolean),
  );

  // Admin-capable roles first, then alphabetical. The column that can change
  // this screen belongs at the left of it.
  const ordered = [...roles].sort((a, b) => {
    const adminA = a.rolePermissions.some(
      (rp) => rp.permission.name === USER_ADMIN_PERMISSION,
    );
    const adminB = b.rolePermissions.some(
      (rp) => rp.permission.name === USER_ADMIN_PERMISSION,
    );
    if (adminA !== adminB) return adminA ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const roleOptions: RoleOption[] = ordered.map((r) => ({
    roleId: r.roleId,
    name: r.name,
  }));

  const grants: Record<string, string[]> = {};
  for (const role of ordered) {
    grants[String(role.roleId)] = role.rolePermissions
      .map((rp) => rp.permission.name)
      .filter((name) => cells.has(name));
  }

  return { roles: roleOptions, rows, grants };
}

export interface PermissionChange {
  permission: string;
  granted: boolean;
}

// Applies one switch, plus whatever the invariant drags along with it:
//
//   write on   -> read on
//   read off   -> write off
//
// Returns only what actually moved, so the audit entry records a real change
// rather than a click that landed on the state it was already in.
export async function applyPermissionToggle(input: {
  roleId: number;
  permission: string;
  granted: boolean;
}): Promise<PermissionChange[]> {
  const { roleId, granted } = input;

  const action = actionOf(input.permission);
  if (action !== "read" && action !== "write") {
    throw new ApiError(400, "That permission cannot be edited here");
  }
  if (!isPermissionEnabled(input.permission)) {
    throw new ApiError(400, "That module is switched off for this clinic");
  }

  const role = await prisma.role.findUnique({
    where: { roleId },
    select: {
      name: true,
      rolePermissions: { select: { permission: { select: { name: true } } } },
    },
  });
  if (!role) throw new ApiError(404, "Role not found");

  const moduleName = moduleOf(input.permission);
  const siblings = await prisma.permission.findMany({
    where: { name: { in: [`${moduleName}:read`, `${moduleName}:write`] } },
    select: { permissionId: true, name: true },
  });
  const idOf = new Map(siblings.map((p) => [p.name, p.permissionId]));
  if (!idOf.has(input.permission)) {
    throw new ApiError(400, "Unknown permission");
  }

  const readName = `${moduleName}:read`;
  const writeName = `${moduleName}:write`;
  const held = new Set(role.rolePermissions.map((rp) => rp.permission.name));

  const wanted = new Set(held);
  if (granted) {
    wanted.add(input.permission);
    // Write without read is not a state this app can render: every write screen
    // is reached through its read screen.
    if (action === "write" && idOf.has(readName)) wanted.add(readName);
  } else {
    wanted.delete(input.permission);
    // The same invariant seen from the other side: taking the read away takes
    // the write with it.
    if (action === "read") wanted.delete(writeName);
  }

  const changes: PermissionChange[] = [];
  for (const name of [readName, writeName]) {
    if (!idOf.has(name)) continue;
    if (held.has(name) !== wanted.has(name)) {
      changes.push({ permission: name, granted: wanted.has(name) });
    }
  }
  if (changes.length === 0) return [];

  // The lockout rail. Losing user management means losing this screen, the
  // staff list, and the ability to grant any of it back, so the last active
  // holder of it cannot be switched off from here.
  const losingAdmin = changes.some(
    (c) => c.permission === USER_ADMIN_PERMISSION && !c.granted,
  );
  if (losingAdmin) {
    const othersRemaining = await prisma.user.count({
      where: {
        isActive: true,
        roleId: { not: roleId },
        role: {
          rolePermissions: {
            some: { permission: { name: USER_ADMIN_PERMISSION } },
          },
        },
      },
    });
    if (othersRemaining === 0) {
      throw new ApiError(
        409,
        `${role.name} is the last role that can manage staff. Give another role staff write access first.`,
      );
    }
  }

  await prisma.$transaction(
    changes.map((c) => {
      const permissionId = idOf.get(c.permission)!;
      return c.granted
        ? prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId, permissionId } },
            update: {},
            create: { roleId, permissionId },
          })
        : prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
    }),
  );

  return changes;
}
