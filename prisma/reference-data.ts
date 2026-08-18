import type { PrismaClient } from "../src/generated/prisma/client";

// ── Booking types ───────────────────────────────────────────
// The appointment kinds offered on the new-booking form. durationMinutes
// drives the default slot length when a type is picked.
export const BOOKING_TYPES = [
  { name: "Consultation", durationMinutes: 30 },
  { name: "Vaccination", durationMinutes: 15 },
  { name: "Grooming", durationMinutes: 60 },
  { name: "Surgery", durationMinutes: 120 },
];

// Idempotently upsert the booking types. Safe to run repeatedly. Shared by the
// seed and the add-user script.
export async function seedBookingTypes(prisma: PrismaClient): Promise<void> {
  for (const bt of BOOKING_TYPES) {
    await prisma.bookingType.upsert({
      where: { name: bt.name },
      update: { durationMinutes: bt.durationMinutes },
      create: bt,
    });
  }
}
