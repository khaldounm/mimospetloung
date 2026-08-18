// Step 2: land the CSVs in a `staging` schema as all-TEXT columns.
//
// Staging is deliberately outside Prisma: it is created by raw SQL so Prisma
// migrations stay authoritative over the app's own tables. Every column is TEXT
// with no constraints, so a malformed legacy value can never fail the load. All
// interpretation happens later, in the transform, where it can be reported on.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { STAGING_SCHEMA, stagingTableName } from "@/constants/legacy-import";
import type { ExtractResult } from "./extract";

function psql(databaseUrl: string, sql: string): string {
  return execFileSync(
    "psql",
    [databaseUrl, "-v", "ON_ERROR_STOP=1", "-tAc", sql],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
}

// Reads just the header line, respecting quoted column names.
function csvHeader(path: string): string[] {
  const firstLine = readFileSync(path, "utf8").split("\n", 1)[0] ?? "";
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/\r$/, ""));
}

const quoteIdent = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function loadStaging(
  databaseUrl: string,
  extracts: ExtractResult[],
): { table: string; loaded: number }[] {
  psql(databaseUrl, `CREATE SCHEMA IF NOT EXISTS ${STAGING_SCHEMA};`);

  return extracts.map(({ table, csvPath }) => {
    const name = stagingTableName(table);
    const target = `${STAGING_SCHEMA}.${quoteIdent(name)}`;
    const cols = csvHeader(csvPath);

    // Recreated every run, so the loader is safe to re-run at cutover.
    const columnDefs = cols.map((c) => `${quoteIdent(c)} TEXT`).join(", ");
    psql(databaseUrl, `DROP TABLE IF EXISTS ${target};`);
    psql(databaseUrl, `CREATE TABLE ${target} (${columnDefs});`);

    // \copy runs client-side, so the CSV never needs to be readable by the
    // server process and no superuser rights are required.
    execFileSync(
      "psql",
      [
        databaseUrl,
        "-v",
        "ON_ERROR_STOP=1",
        "-c",
        `\\copy ${target} FROM '${csvPath}' WITH (FORMAT csv, HEADER true)`,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );

    const loaded = Number(
      psql(databaseUrl, `SELECT count(*) FROM ${target};`).trim(),
    );
    return { table, loaded };
  });
}
