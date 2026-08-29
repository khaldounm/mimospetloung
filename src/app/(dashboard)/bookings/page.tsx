import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toBookingDTO } from "@/lib/bookings";
import { toDateOnly } from "@/utils/format";
import type { BookingTypeOption, StaffOption } from "@/types/entities";
import BookingsTable from "@/components/bookings/BookingsTable";

const bookingInclude = {
  patient: { select: { patientId: true, name: true } },
  client: { select: { clientId: true, firstName: true, lastName: true } },
  staff: { select: { userId: true, firstName: true, lastName: true } },
  bookingType: { select: { typeId: true, name: true } },
} as const;

export default async function BookingsPage() {
  const session = await auth();
  const canWrite = hasPermission(session?.user, "bookings:write");

  // The diary opens on today onwards rather than on every booking ever taken.
  // Sorted ascending, an unscoped list put the clinic's oldest appointment at
  // the top and grew by a page a month; looking further back is what the From
  // field is for.
  //
  // Passed to the table as well so its From box agrees with what is on screen,
  // and so its first refetch asks for the same window rather than widening it.
  const from = toDateOnly(new Date())!;

  const [bookings, staff, types] = await Promise.all([
    prisma.booking.findMany({
      where: { startsAt: { gte: new Date(from) } },
      orderBy: { startsAt: "asc" },
      include: bookingInclude,
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { userId: true, firstName: true, lastName: true },
    }),
    prisma.bookingType.findMany({
      orderBy: { name: "asc" },
      select: { typeId: true, name: true, durationMinutes: true },
    }),
  ]);

  const initialBookings = bookings.map(toBookingDTO);

  const staffOptions: StaffOption[] = staff.map((s) => ({
    userId: s.userId,
    label: `${s.firstName} ${s.lastName}`,
  }));

  const typeOptions: BookingTypeOption[] = types.map((t) => ({
    typeId: t.typeId,
    name: t.name,
    durationMinutes: t.durationMinutes,
  }));

  return (
    <BookingsTable
      initialBookings={initialBookings}
      initialFrom={from}
      staffOptions={staffOptions}
      typeOptions={typeOptions}
      canWrite={canWrite}
    />
  );
}
