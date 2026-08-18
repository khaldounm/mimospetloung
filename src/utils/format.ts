import { CURRENCY } from "@/constants/clinic";

// Date-only column (@db.Date) -> "YYYY-MM-DD". Prisma returns these as a Date at
// UTC midnight, so slicing the ISO string avoids timezone drift.
export function toDateOnly(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

// Full timestamp -> human-friendly local date + time for display.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time-only display (e.g. for a day's schedule).
export function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ISO timestamp -> "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">.
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// Money value (string from a Decimal column, or number) -> currency display
// using the app-wide CURRENCY (e.g. "$1,234.56"). Single source of truth for
// money formatting across every module. Returns "-" for absent values.
export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: CURRENCY.code,
  });
}

// Human-friendly date for display, from a "YYYY-MM-DD" string.
export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
