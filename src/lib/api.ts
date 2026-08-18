import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import type { Session } from "next-auth";

// Thrown by guards to short-circuit a handler with a specific HTTP response.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Resolves the session and asserts the given permission. The middleware already
// gates *read* access by path prefix; handlers call this to enforce the
// write/read permission appropriate to the HTTP method.
export async function requirePermission(permission: string): Promise<Session> {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  if (!hasPermission(session.user, permission)) {
    throw new ApiError(403, "Forbidden");
  }
  return session;
}

// Parses a route param that must be a positive integer id, throwing
// ApiError(400) otherwise. Callers await the Next.js params promise first.
export function parseId(value: string, label = "id"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return id;
}

// Parses + validates a JSON body against a schema, throwing ApiError(400) on
// malformed JSON or validation failure.
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join(".");
    throw new ApiError(400, path ? `${path}: ${first.message}` : first.message);
  }
  return result.data;
}

// Wraps a handler so thrown ApiErrors become JSON responses; anything else
// becomes a 500.
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
