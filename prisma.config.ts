import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations run through the session-mode pooler (port 5432). The runtime
    // app uses the transaction pooler (DATABASE_URL) via the pg driver adapter.
    url: env("DIRECT_URL"),
  },
});
