import {
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";
import type { CountryCode } from "libphonenumber-js/min";

// The clinic is in Lebanon, so old locally-entered numbers should default to
// the Lebanese calling code when no international prefix is present.
const DEFAULT_COUNTRY: CountryCode = "LB";

// Normalizes a raw phone number to E.164 (e.g. "+96170121556") so messaging
// providers (WaSenderApi/WhatsApp) accept it. Supports the common ways a
// number gets entered:
//   "70 121 556"        -> "+96170121556"  (local, country code prepended)
//   "03-123456"         -> "+9613123456"   (national trunk 0 stripped)
//   "0096170121556"     -> "+96170121556"  ("00" international prefix dropped)
//   "+961 70 121 556"   -> "+96170121556"  (already international)
//   "+44 7498 963592"   -> "+447498963592" (non-Lebanese international kept)
// Returns null when the input can't form a plausible number.
export function normalizePhone(
  raw: string | null | undefined,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Respect explicit international numbers first so a stored UK/US/etc.
  // number is never mistaken for a Lebanese local number.
  const explicitInternational = trimmed.startsWith("+")
    ? trimmed
    : digits.startsWith("00")
      ? `+${digits.slice(2)}`
      : null;
  if (explicitInternational) {
    const parsed = parsePhoneNumberFromString(explicitInternational);
    return parsed?.isPossible() ? parsed.number : null;
  }

  const parsedLocal = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (parsedLocal?.isPossible()) return parsedLocal.number;

  // Some stored numbers may already include their country code but be missing
  // the leading "+" (for example "447498963592").
  if (!trimmed.startsWith("0") && digits.length >= 10) {
    const parsedInternational = parsePhoneNumberFromString(`+${digits}`);
    if (parsedInternational?.isPossible()) return parsedInternational.number;
  }

  // Last fallback for old local data: strip a single national trunk "0" and
  // prepend the clinic's default calling code.
  const localDigits = digits.replace(/^0/, "");
  if (!localDigits) return null;

  const countryCode = getCountryCallingCode(defaultCountry);
  const parsedFallback = parsePhoneNumberFromString(
    `+${countryCode}${localDigits}`,
  );
  return parsedFallback?.isPossible() ? parsedFallback.number : null;
}
