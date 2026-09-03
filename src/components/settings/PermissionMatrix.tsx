"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import IOSSwitch from "@/components/ui/IOSSwitch";
import { apiRequest } from "@/utils/api-client";
import type {
  PermissionMatrixDTO,
  PermissionMatrixRow,
} from "@/types/entities";

interface Props {
  initial: PermissionMatrixDTO;
}

const LABEL_COLUMN = 240;
const ROLE_COLUMN = 168;

// Mirrors the cascade in lib/rbac.ts so the switch that gets dragged along moves
// at the same instant as the one that was clicked. The server still decides:
// its answer replaces this the moment it arrives.
function withToggle(
  matrix: PermissionMatrixDTO,
  roleId: number,
  permission: string,
  granted: boolean,
): PermissionMatrixDTO {
  const row = matrix.rows.find(
    (r) => r.readPermission === permission || r.writePermission === permission,
  );
  const held = new Set(matrix.grants[String(roleId)] ?? []);

  if (granted) {
    held.add(permission);
    if (row?.writePermission === permission && row.readPermission) {
      held.add(row.readPermission);
    }
  } else {
    held.delete(permission);
    if (row?.readPermission === permission && row.writePermission) {
      held.delete(row.writePermission);
    }
  }

  return {
    ...matrix,
    grants: { ...matrix.grants, [String(roleId)]: [...held] },
  };
}

// Who can do what, as a grid. No save button: a click is the change, and the
// whole grid locks until the database has answered, so what is on screen is
// never a guess about what was stored.
export default function PermissionMatrix({ initial }: Props) {
  const [matrix, setMatrix] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Reading a role's answer for one module means crossing four columns of
  // near-identical switches, so the row under the pointer lifts.
  const [hovered, setHovered] = useState<string | null>(null);

  const { roles, rows } = matrix;
  const cellCount = rows.reduce(
    (n, r) => n + (r.readPermission ? 1 : 0) + (r.writePermission ? 1 : 0),
    0,
  );

  function heldBy(roleId: number): Set<string> {
    return new Set(matrix.grants[String(roleId)] ?? []);
  }

  async function toggle(roleId: number, permission: string, granted: boolean) {
    if (busy) return;
    const snapshot = matrix;

    setError(null);
    setPending(`${roleId}:${permission}`);
    setBusy(true);
    setMatrix(withToggle(matrix, roleId, permission, granted));

    try {
      setMatrix(
        await apiRequest<PermissionMatrixDTO>("/api/settings/permissions", {
          method: "PATCH",
          body: { roleId, permission, granted },
        }),
      );
    } catch (err) {
      // Nothing was stored, so the screen goes back to what the database last
      // told us rather than keeping the optimistic flip.
      setMatrix(snapshot);
      setError(
        err instanceof Error ? err.message : "Could not change that permission",
      );
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  // Full access reads warmer than read-only, so a glance down a column shows
  // where the power sits without reading a single label.
  function tintFor(hasRead: boolean, hasWrite: boolean): number {
    if (hasWrite) return 0.1;
    if (hasRead) return 0.045;
    return 0;
  }

  function renderSwitch(
    row: PermissionMatrixRow,
    roleId: number,
    roleName: string,
    kind: "read" | "write",
  ) {
    const permission =
      kind === "read" ? row.readPermission : row.writePermission;

    if (!permission) {
      return (
        <Tooltip
          title={
            kind === "write"
              ? `${row.label} has nothing to write`
              : `${row.label} has nothing to read`
          }
        >
          <Typography
            component="span"
            sx={{ color: "text.disabled", fontSize: 14, userSelect: "none" }}
          >
            –
          </Typography>
        </Tooltip>
      );
    }

    const on = heldBy(roleId).has(permission);
    return (
      <IOSSwitch
        checked={on}
        disabled={busy}
        onChange={(_, checked) => void toggle(roleId, permission, checked)}
        slotProps={{
          input: {
            "aria-label": `${roleName}: ${kind} ${row.label}`,
          },
        }}
      />
    );
  }

  return (
    <Paper variant="outlined" sx={{ position: "relative", overflow: "hidden" }}>
      {busy && (
        <LinearProgress
          color="secondary"
          sx={{ position: "absolute", insetInline: 0, top: 0, height: 2 }}
        />
      )}

      <Stack spacing={1} sx={{ p: 3, pb: 2 }}>
        <Typography variant="h6">Access by role</Typography>
        <Typography variant="body2" color="text.secondary">
          What each role may open, and what it may change. Every click saves on
          its own, so there is nothing to press afterwards. Write implies read:
          switching write on switches read on, and switching read off takes
          write with it.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          A change reaches someone within about two minutes. They do not need to
          sign out and back in.
        </Typography>
      </Stack>

      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 3, mb: 2 }}
        >
          {error}
        </Alert>
      )}

      <Box sx={{ overflowX: "auto", pb: 1 }}>
        <Box
          aria-busy={busy}
          sx={{
            display: "grid",
            gridTemplateColumns: `${LABEL_COLUMN}px repeat(${roles.length}, minmax(${ROLE_COLUMN}px, 1fr))`,
            minWidth: LABEL_COLUMN + roles.length * ROLE_COLUMN,
            opacity: busy ? 0.55 : 1,
            pointerEvents: busy ? "none" : "auto",
            transition: "opacity 150ms ease",
          }}
        >
          {/* Header: the roles, each splitting into a read and a write column. */}
          <Box
            sx={{
              position: "sticky",
              left: 0,
              zIndex: 2,
              bgcolor: "background.paper",
              borderBottom: 2,
              borderColor: "divider",
              px: 3,
              py: 1.5,
            }}
          />
          {roles.map((role) => {
            const granted = heldBy(role.roleId).size;
            return (
              <Box
                key={role.roleId}
                sx={{
                  borderBottom: 2,
                  borderLeft: 1,
                  borderColor: "divider",
                  px: 1,
                  pt: 1.5,
                  pb: 1,
                  textAlign: "center",
                }}
              >
                <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {role.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mb: 0.75 }}
                >
                  {granted} of {cellCount}
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0.5,
                  }}
                >
                  {(["Read", "Write"] as const).map((label) => (
                    <Typography
                      key={label}
                      variant="overline"
                      sx={{ color: "text.secondary", fontSize: 10 }}
                    >
                      {label}
                    </Typography>
                  ))}
                </Box>
              </Box>
            );
          })}

          {/* One row per module. */}
          {rows.map((row) => (
            <Box key={row.module} sx={{ display: "contents" }}>
              <Box
                onMouseEnter={() => setHovered(row.module)}
                onMouseLeave={() => setHovered(null)}
                sx={(theme) => ({
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  bgcolor:
                    hovered === row.module
                      ? theme.palette.mode === "dark"
                        ? alpha(theme.palette.common.white, 0.05)
                        : alpha(theme.palette.common.black, 0.03)
                      : theme.palette.background.paper,
                  borderBottom: 1,
                  borderColor: "divider",
                  px: 3,
                  py: 1.25,
                })}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {row.label}
                </Typography>
                {row.hint && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", lineHeight: 1.35 }}
                  >
                    {row.hint}
                  </Typography>
                )}
              </Box>

              {roles.map((role) => {
                const held = heldBy(role.roleId);
                const hasRead = Boolean(
                  row.readPermission && held.has(row.readPermission),
                );
                const hasWrite = Boolean(
                  row.writePermission && held.has(row.writePermission),
                );
                const tint = tintFor(hasRead, hasWrite);
                const isPending =
                  pending === `${role.roleId}:${row.readPermission}` ||
                  pending === `${role.roleId}:${row.writePermission}`;

                return (
                  <Box
                    key={role.roleId}
                    onMouseEnter={() => setHovered(row.module)}
                    onMouseLeave={() => setHovered(null)}
                    sx={(theme) => ({
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      alignItems: "center",
                      justifyItems: "center",
                      borderBottom: 1,
                      borderLeft: 1,
                      borderColor: "divider",
                      px: 1,
                      py: 1,
                      bgcolor: alpha(
                        theme.palette.secondary.main,
                        hovered === row.module ? tint + 0.05 : tint,
                      ),
                      transition: "background-color 200ms ease",
                      ...(isPending && {
                        boxShadow: `inset 0 0 0 2px ${alpha(
                          theme.palette.secondary.main,
                          0.55,
                        )}`,
                      }),
                    })}
                  >
                    {renderSwitch(row, role.roleId, role.name, "read")}
                    {renderSwitch(row, role.roleId, role.name, "write")}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
    </Paper>
  );
}
