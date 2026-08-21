// GS1 Application Identifier parsing, for the 2D DataMatrix on pharma cartons.
//
// A vet pharma carton does not carry a plain EAN-13. It carries a DataMatrix
// encoding several fields at once, each introduced by a two-to-four digit
// Application Identifier:
//
//   (01) GTIN            (17) expiry YYMMDD      (10) batch/lot
//
// so one scan at goods receipt yields the product, its expiry AND its lot. That
// is what makes batch tracking bearable for staff rather than a chore they
// route around.
//
// The catch is that the scanner emits the whole thing as one string:
//
//   0108711231104093172612311021ABC123
//
// A naive `where barcode = scanned` therefore fails on exactly the products
// that need expiry most. Parsing has to happen at the scan boundary, before any
// lookup, and the lookup has to match on the extracted (01).

/** Element separator. Scanners transmit FNC1 as GS, ASCII 29. */
const GS = "\x1d";

// Fixed-length AIs: value length is implied, so no separator follows them.
// Only the ones that can realistically appear on stock we handle are listed;
// anything else is treated as variable length and terminated by a separator.
const FIXED_LENGTH: Record<string, number> = {
  "00": 18, // SSCC
  "01": 14, // GTIN
  "02": 14, // GTIN of contained trade items
  "11": 6, // production date
  "12": 6, // due date
  "13": 6, // packaging date
  "15": 6, // best before
  "16": 6, // sell by
  "17": 6, // expiry date
  "20": 2, // variant
};

// Variable-length AIs we care about, with their maximum lengths. A value runs
// to the next separator, or to the end of the string when it is last.
const VARIABLE_MAX: Record<string, number> = {
  "10": 20, // batch / lot
  "21": 20, // serial number
  "240": 30,
  "241": 30,
  "30": 8,
};

export interface Gs1Scan {
  /** (01), normalised to 14 digits. */
  gtin?: string;
  /** (17), as a date. */
  expiryDate?: Date;
  /** (10). */
  lotNumber?: string;
  /** (21). */
  serial?: string;
  /** Every AI found, unparsed, for anything not promoted above. */
  raw: Record<string, string>;
}

/**
 * GS1 dates are YYMMDD with a two-digit year. The standard reads 00-50 as 20xx
 * and 51-99 as 19xx. A day of "00" means "end of that month", which is what
 * cartons printed with a month-only expiry use.
 */
function parseGs1Date(value: string): Date | undefined {
  if (!/^\d{6}$/.test(value)) return undefined;
  const yy = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4));
  const day = Number(value.slice(4, 6));
  if (month < 1 || month > 12) return undefined;
  const year = yy <= 50 ? 2000 + yy : 1900 + yy;
  // Day 0 of the following month is the last day of this one.
  const date =
    day === 0
      ? new Date(Date.UTC(year, month, 0))
      : new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Pull the Application Identifiers out of a scanned string.
 *
 * Returns null when the input does not look like an AI string at all, which is
 * every ordinary EAN-13 and every internal code, so callers can fall straight
 * through to their existing lookup.
 */
export function parseGs1(scanned: string): Gs1Scan | null {
  // Some scanners prefix a symbology identifier: ]d2 for DataMatrix, ]C1 for
  // GS1-128, ]e0 for GS1 DataBar.
  const input = scanned.trim().replace(/^\](?:d2|C1|e0|Q3|d1)/, "");
  if (input.length === 0) return null;

  // A bare 8, 12, 13 or 14 digit number is a plain GTIN, not an AI string.
  // Treating "0112345678901231" and "01234567" the same way would misread every
  // EAN-8 whose first two digits happen to be "01".
  if (/^\d+$/.test(input) && [8, 12, 13, 14].includes(input.length)) {
    return null;
  }

  const raw: Record<string, string> = {};
  let i = 0;
  let matchedAnything = false;

  while (i < input.length) {
    // Skip any separator sitting between elements.
    if (input[i] === GS) {
      i += 1;
      continue;
    }

    const two = input.slice(i, i + 2);
    const three = input.slice(i, i + 3);

    let ai: string | undefined;
    let length: number | undefined;

    if (FIXED_LENGTH[two] !== undefined) {
      ai = two;
      length = FIXED_LENGTH[two];
    } else if (VARIABLE_MAX[two] !== undefined) {
      ai = two;
    } else if (VARIABLE_MAX[three] !== undefined) {
      ai = three;
    }

    if (!ai) {
      // Unrecognised AI. Anything after this point cannot be split reliably, so
      // stop rather than guess and mis-attribute a lot number.
      break;
    }

    const start = i + ai.length;
    let value: string;
    if (length !== undefined) {
      value = input.slice(start, start + length);
      i = start + length;
    } else {
      const sep = input.indexOf(GS, start);
      const end =
        sep === -1 ? Math.min(input.length, start + VARIABLE_MAX[ai]) : sep;
      value = input.slice(start, end);
      i = end;
    }

    if (value.length === 0) break;
    raw[ai] = value;
    matchedAnything = true;
  }

  if (!matchedAnything) return null;

  const result: Gs1Scan = { raw };
  if (raw["01"]) result.gtin = raw["01"].padStart(14, "0");
  if (raw["17"]) result.expiryDate = parseGs1Date(raw["17"]);
  if (raw["10"]) result.lotNumber = raw["10"];
  if (raw["21"]) result.serial = raw["21"];
  return result;
}

/**
 * The code to look an item up by, whatever was scanned. A GS1 string resolves
 * to its (01); anything else is passed through untouched.
 */
export function scannedLookupCode(scanned: string): string {
  return parseGs1(scanned)?.gtin ?? scanned.trim();
}
