// Internal barcodes for imported goods whose supplier codes can't be trusted.
// We mint our own in GS1's internal-use prefix range (20-29), which is reserved
// worldwide for in-store circulation and can never collide with a real
// manufacturer GTIN. The result is a valid, natively-scannable EAN-13.

const INTERNAL_PREFIX = "20";

// Standard EAN-13 mod-10 check digit over the first 12 digits: odd positions
// (1-indexed, left to right) weigh 1, even positions weigh 3.
export function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = digits12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// A full 13-digit internal EAN-13: "20" + 10 random digits + check digit.
export function randomInternalEan13(): string {
  let body = INTERNAL_PREFIX;
  for (let i = 0; i < 10; i++) {
    body += Math.floor(Math.random() * 10).toString();
  }
  return body + ean13CheckDigit(body).toString();
}

// True when the string is a well-formed EAN-13 with a valid check digit.
export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === code.charCodeAt(12) - 48;
}
