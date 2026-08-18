import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Supabase's pooler requires TLS and its cert is not on the system trust store,
// so remote connections encrypt without chain verification. A local Postgres
// typically has SSL disabled, and forcing TLS there fails the connection with
// "the server does not support SSL connections", so skip it for localhost.
function sslFor(connectionString: string | undefined) {
  if (!connectionString) return undefined;
  try {
    const { hostname } = new URL(connectionString);
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return undefined;
    }
  } catch {
    // Unparseable connection string: fall through to the encrypted default.
  }
  return { rejectUnauthorized: false };
}

function createClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Supabase's transaction-mode pooler (Supavisor) multiplexes many client
    // connections onto a few real Postgres connections, so each serverless
    // instance only needs a small pool.
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslFor(process.env.DATABASE_URL),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
