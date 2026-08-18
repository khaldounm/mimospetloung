// Phone normalisation for the legacy import only.
//
// The app uses libphonenumber-js via @/utils/phone, which is the right tool
// inside Next. It cannot be used here: under tsx (Node 24 + pnpm) the package's
// bundled metadata fails to bind and every call throws, for every subpath and
// for require() too. Rather than weaken the shared util to suit a script
// runner, the loader carries this narrow, auditable version covering the shapes
// actually present in the file. Anything it cannot read is flagged for review
// instead of being silently dropped.
//
// Digit-length profile of the 2,690 numbers in GT_Data26:
//    8 digits x1,375  local, e.g. "03 001 259"
//   11 digits x959    country code without a plus, e.g. "96170123456"
//   10 digits x323    leading trunk zero, e.g. "09 88924669"
//   16 digits x8      TWO numbers in one cell, separated by a newline
//   remainder x14     junk ("961"), truncated ("03 641"), or foreign

export interface LegacyPhone {
  /** E.164, or null when the value could not be read. */
  phone: string | null;
  /** A second number found in the same cell. */
  extra: string | null;
  /** Set when a human should look at the original value. */
  problem: string | null;
}

const LB = "961";

function toE164(rawLine: string): string | null {
  const trimmed = rawLine.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Explicitly international: trust it and keep the country as written.
  if (trimmed.startsWith("+"))
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.startsWith("00")) {
    const rest = digits.slice(2);
    return rest.length >= 8 && rest.length <= 15 ? `+${rest}` : null;
  }
  // Country code present but no plus: "96170123456" and "9613966827".
  if (digits.startsWith(LB) && digits.length >= 10 && digits.length <= 11) {
    return `+${digits}`;
  }
  // Local numbers. Lebanese mobile prefixes 70/71/76/78/79/81 are written as a
  // full 8-digit national number, while the 3-prefix is written with the
  // national trunk zero ("03 001 259" -> national number 3001259). Stripping
  // leading zeros first makes both land on a 7 or 8 digit national number.
  const local = digits.replace(/^0+/, "");
  if (local.length === 7 || local.length === 8) return `+${LB}${local}`;

  // Long enough to be a foreign number carrying its own country code.
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function normalizeLegacyPhone(
  raw: string | null | undefined,
): LegacyPhone {
  const value = (raw ?? "").trim();
  if (!value || value === "0")
    return { phone: null, extra: null, problem: null };

  // A few cells hold two numbers on separate lines.
  const lines = value
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const phone = toE164(lines[0] ?? "");
  const extra = lines.length > 1 ? toE164(lines[1] ?? "") : null;

  const problem = phone
    ? null
    : `Phone "${value.replace(/\s+/g, " ")}" could not be read as a valid number.`;
  return { phone, extra, problem };
}
