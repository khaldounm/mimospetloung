// Step 1 of the legacy migration: pull the real tables out of the Access file
// into CSV. Nothing here touches the database.
//
// The .mdb contains live client PII. Every file this writes lands in workDir,
// which must sit outside the repository.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_TABLES, stagingTableName } from "@/constants/legacy-import";

export interface ExtractResult {
  table: string;
  csvPath: string;
  rows: number;
}

// mdb-export emits dates as MM/DD/YY HH:MM:SS by default, which Postgres reads
// ambiguously. Force ISO so the staging load never has to guess.
const DATE_FORMAT = "%Y-%m-%d %H:%M:%S";

export function extractTable(
  mdbPath: string,
  table: string,
  workDir: string,
): ExtractResult {
  const csvPath = join(workDir, `${stagingTableName(table)}.csv`);
  const csv = execFileSync(
    "mdb-export",
    ["-D", DATE_FORMAT, "-b", "strip", mdbPath, table],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  writeFileSync(csvPath, csv, { mode: 0o600 });
  // Row count excludes the header. Embedded newlines inside quoted values mean
  // this is a lower bound used only for logging; the load itself is authoritative.
  const rows = csv.split("\n").filter(Boolean).length - 1;
  return { table, csvPath, rows };
}

export function extractAll(mdbPath: string, workDir: string): ExtractResult[] {
  mkdirSync(workDir, { recursive: true, mode: 0o700 });
  return LEGACY_TABLES.map((t) => extractTable(mdbPath, t, workDir));
}
