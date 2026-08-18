import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { toBookingDTO } from "@/lib/bookings";
import type {
  BookingTypeOption,
  PatientOption,
  StaffOption,
} from "@/types/entities";
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

  const [bookings, staff, types, patients] = await Promise.all([
    prisma.booking.findMany({
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
    prisma.patient.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { client: { select: { firstName: true, lastName: true } } },
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

  const patientOptions: PatientOption[] = patients.map((p) => ({
    patientId: p.patientId,
    label: `${p.name} (${p.client.firstName} ${p.client.lastName})`,
  }));

  return (
    <BookingsTable
      initialBookings={initialBookings}
      patientOptions={patientOptions}
      staffOptions={staffOptions}
      typeOptions={typeOptions}
      canWrite={canWrite}
    />
  );
}
