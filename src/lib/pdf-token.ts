import { createHmac, timingSafeEqual } from "crypto";

// Signs short-lived, tamper-proof links to the public PDF endpoints so
// WaSenderApi can fetch the file without a user session. The token binds a
// document kind and id to an expiry, and is verified with HMAC-SHA256 over
// NEXTAUTH_SECRET.
//
// The kind is inside the signed payload rather than only in the URL, so a token
// minted for invoice 12 cannot be replayed against purchase order 12. Purchase
// orders carry supplier cost, which is otherwise Admin-only, and a medical
// record carries a patient's clinical history. A client statement carries their
// whole account history, which is why it is bound the same way.

const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

/** Documents reachable over a signed public link. */
export type PdfKind =
  | "invoice"
  | "order"
  | "medical-record"
  | "client-statement";

function secret(): string {
  const value = process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

// Returns "<expiresMs>.<sig>" for the given document.
export function signPdfToken(
  kind: PdfKind,
  id: number,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const expiresMs = Date.now() + ttlMs;
  return `${expiresMs}.${sign(`${kind}.${id}.${expiresMs}`)}`;
}

// Validates a token against a document; false when malformed, expired, or the
// signature does not match.
export function verifyPdfToken(
  kind: PdfKind,
  id: number,
  token: string,
): boolean {
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const expiresMs = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(expiresMs) || expiresMs < Date.now()) return false;

  const expected = sign(`${kind}.${id}.${expiresMs}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
