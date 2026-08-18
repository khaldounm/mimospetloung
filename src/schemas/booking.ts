import { z } from "zod";
import { optionalString } from "./common";
import { BOOKING_STATUSES } from "@/types/enums";

// Optional numeric id from a form: "" / null -> undefined, else positive int.
const optionalId = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const optionalStatus = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.enum(BOOKING_STATUSES).optional(),
);

export const bookingCreateSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  staffId: optionalId,
  typeId: optionalId,
  startsAt: z.coerce.date(),
  // Optional: the API computes it from the booking type duration when omitted.
  endsAt: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.date().optional(),
  ),
  status: optionalStatus,
  notes: optionalString(5000),
});

// Patient is fixed once booked; everything else can be edited.
export const bookingUpdateSchema = bookingCreateSchema
  .omit({ patientId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "No fields to update",
  });

export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingUpdateInput = z.infer<typeof bookingUpdateSchema>;
