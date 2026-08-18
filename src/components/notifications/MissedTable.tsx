"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { formatDateTime } from "@/utils/format";
import type { MissedBookingDTO } from "@/types/entities";
import ComposeNotificationDialog from "./ComposeNotificationDialog";
import type {
  BookingOption,
  ClientOption,
  PatientOption,
  TemplateOption,
} from "./ComposeNotificationDialog";

interface Props {
  initialMissed: MissedBookingDTO[];
  clientOptions: ClientOption[];
  patientOptions: PatientOption[];
  bookingOptions: BookingOption[];
  templateOptions: TemplateOption[];
  canWrite: boolean;
}

// MUI Chip color per missed-booking status.
const STATUS_COLOR: Record<string, "default" | "warning" | "error"> = {
  Scheduled: "default",
  Confirmed: "warning",
  "No Show": "error",
};

export default function MissedTable({
  initialMissed,
  clientOptions,
  patientOptions,
  bookingOptions,
  templateOptions,
  canWrite,
}: Props) {
  const [missed] = useState(initialMissed);
  const [followUp, setFollowUp] = useState<MissedBookingDTO | null>(null);

  // Past bookings aren't in the upcoming-only bookingOptions, so add the one
  // being followed up on so the compose dialog can link it.
  const dialogBookingOptions = useMemo(() => {
    if (!followUp) return bookingOptions;
    if (bookingOptions.some((b) => b.bookingId === followUp.bookingId)) {
      return bookingOptions;
    }
    const label = `${followUp.patientName} - ${formatDateTime(
      followUp.startsAt,
    )}`;
    return [
      ...bookingOptions,
      {
        bookingId: followUp.bookingId,
        clientId: followUp.clientId,
        label,
      },
    ];
  }, [bookingOptions, followUp]);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Past bookings that were never completed (still Scheduled or Confirmed,
        or marked No Show). Send a follow-up message to reschedule.
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Patient</TableCell>
              <TableCell>Client</TableCell>
              <TableCell>Status</TableCell>
              {canWrite && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {missed.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canWrite ? 5 : 4} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    No missed appointments.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              missed.map((b) => (
                <TableRow key={b.bookingId} hover>
                  <TableCell>{formatDateTime(b.startsAt)}</TableCell>
                  <TableCell>{b.patientName}</TableCell>
                  <TableCell>{b.clientName}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={STATUS_COLOR[b.bookingStatus] ?? "default"}
                      label={b.bookingStatus}
                    />
                  </TableCell>
                  {canWrite && (
                    <TableCell align="right">
                      <Tooltip title="Send a follow-up message">
                        <Button
                          size="small"
                          startIcon={<SendIcon fontSize="small" />}
                          onClick={() => setFollowUp(b)}
                        >
                          Follow up
                        </Button>
                      </Tooltip>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ComposeNotificationDialog
        open={followUp !== null}
        clientOptions={clientOptions}
        patientOptions={patientOptions}
        bookingOptions={dialogBookingOptions}
        templateOptions={templateOptions}
        prefill={
          followUp
            ? {
                clientId: followUp.clientId,
                patientId: followUp.patientId,
                bookingId: followUp.bookingId,
              }
            : undefined
        }
        onClose={() => setFollowUp(null)}
        onSaved={() => setFollowUp(null)}
      />
    </Box>
  );
}
