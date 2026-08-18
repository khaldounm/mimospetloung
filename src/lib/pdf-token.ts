import { createHmac, timingSafeEqual } from "crypto";

// Signs short-lived, tamper-proof links to the public invoice-PDF endpoint so
// WaSenderApi can fetch the file without a user session. The token binds an
// invoice id to an expiry and is verified with HMAC-SHA256 over NEXTAUTH_SECRET.

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

// Returns "<expiresMs>.<sig>" for the given invoice.
export function signInvoicePdfToken(
  invoiceId: number,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const expiresMs = Date.now() + ttlMs;
  const sig = sign(`${invoiceId}.${expiresMs}`);
  return `${expiresMs}.${sig}`;
}

// Validates a token against an invoice id; false when malformed, expired, or
// the signature does not match.
export function verifyInvoicePdfToken(
  invoiceId: number,
  token: string,
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresMs = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) return false;

  const expected = sign(`${invoiceId}.${expiresMs}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
