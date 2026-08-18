"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { apiRequest } from "@/utils/api-client";
import { formatDateTime } from "@/utils/format";
import type { RoleOption, UserDTO } from "@/types/entities";
import UserFormDialog from "./UserFormDialog";
import ResetPasswordDialog from "./ResetPasswordDialog";

interface Props {
  initialUsers: UserDTO[];
  roleOptions: RoleOption[];
  currentUserId: number | null;
  canWrite: boolean;
}

export default function UsersTable({
  initialUsers,
  roleOptions,
  currentUserId,
  canWrite,
}: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UserDTO | null>(null);
  const [pwUser, setPwUser] = useState<UserDTO | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  async function load(q: string) {
    const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
    const data = await apiRequest<{ users: UserDTO[] }>(`/api/users${params}`);
    setUsers(data.users);
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const t = setTimeout(() => void load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(user: UserDTO) {
    setEditing(user);
    setFormOpen(true);
  }

  async function toggleActive(user: UserDTO) {
    setError(null);
    setBusyId(user.userId);
    try {
      await apiRequest(`/api/users/${user.userId}`, {
        method: "PATCH",
        body: { isActive: !user.isActive },
      });
      await load(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}
      >
        <Typography variant="h4">Staff</Typography>
        {canWrite && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
            New user
          </Button>
        )}
      </Stack>

      <TextField
        placeholder="Search by name or email"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        fullWidth
        size="small"
        sx={{ mb: 2 }}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last login</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 6 : 5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No users found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => {
                const isSelf = u.userId === currentUserId;
                return (
                  <TableRow key={u.userId} hover>
                    <TableCell>
                      {u.firstName} {u.lastName}
                      {isSelf && (
                        <Chip size="small" label="You" sx={{ ml: 1 }} />
                      )}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.roleName}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={u.isActive ? "success" : "default"}
                        variant={u.isActive ? "filled" : "outlined"}
                        label={u.isActive ? "Active" : "Inactive"}
                      />
                    </TableCell>
                    <TableCell>
                      {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                    </TableCell>
                    {canWrite && (
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ justifyContent: "flex-end" }}
                        >
                          <Button size="small" onClick={() => openEdit(u)}>
                            Edit
                          </Button>
                          <Button size="small" onClick={() => setPwUser(u)}>
                            Reset password
                          </Button>
                          <Tooltip
                            title={
                              isSelf
                                ? "You cannot deactivate your own account"
                                : ""
                            }
                          >
                            <span>
                              <Button
                                size="small"
                                color={u.isActive ? "error" : "primary"}
                                disabled={
                                  (isSelf && u.isActive) || busyId === u.userId
                                }
                                onClick={() => void toggleActive(u)}
                              >
                                {u.isActive ? "Deactivate" : "Activate"}
                              </Button>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <UserFormDialog
        open={formOpen}
        user={editing}
        roleOptions={roleOptions}
        isSelf={editing?.userId === currentUserId}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load(query)}
      />
      <ResetPasswordDialog
        open={pwUser !== null}
        user={pwUser}
        onClose={() => setPwUser(null)}
        onSaved={() => setPwUser(null)}
      />
    </Box>
  );
}
