/**
 * Exports everything flagged by the curated seed as a CSV worklist.
 *
 * The clients and patients tables show a review badge per row, but there is no
 * way to list only flagged records, and the answers live with the clinic staff
 * rather than in the data. This produces a file they can work through away
 * from the app, ordered so the decisions that matter most come first.
 *
 *   pnpm review:export            -> prisma/seed-data/review-worklist.csv
 *
 * Fill in the "decision" column and hand it back; nothing here writes to the
 * database.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";

type Row = {
  priority: number;
  kind: string;
  record: string;
  legacyId: number | null;
  name: string;
  detail: string;
  question: string;
};

function classify(note: string): {
  priority: number;
  kind: string;
  question: string;
} {
  if (note.includes("same person recorded more than once"))
    return {
      priority: 1,
      kind: "Possible duplicate",
      question: "Same person? If yes, which record should survive?",
    };
  if (note.includes("also recorded this client as"))
    return {
      priority: 2,
      kind: "Conflicting name",
      question: "Which spelling is correct?",
    };
  if (note.includes("needs a real name") || note.includes("had no name"))
    return {
      priority: 3,
      kind: "Missing name",
      question: "Who is this client?",
    };
  if (note.includes("confirm this is two pets"))
    return {
      priority: 4,
      kind: "One pet or two?",
      question: "Is this one animal or two? Give the real names.",
    };
  if (note.includes("recorded") && note.includes("animals"))
    return {
      priority: 5,
      kind: "Unnamed litter",
      question: "What are these animals called?",
    };
  if (note.includes("where a pet name should be"))
    return {
      priority: 6,
      kind: "Pet has no name",
      question: "What is this animal's name?",
    };
  if (note.includes("cannot be right for a stocked item"))
    return {
      priority: 5,
      kind: "Impossible stock",
      question: "Count this item and enter the real quantity.",
    };
  if (note.includes("No sale price"))
    return {
      priority: 7,
      kind: "No sale price",
      question: "What does this sell for? Leave blank if it is never sold.",
    };
  if (note.includes("purchase order or a stock movement"))
    return {
      priority: 4,
      kind: "Service held as stock",
      question:
        "This is a service, but it has stock or purchase history. Resolve those.",
    };
  if (note.includes("recorded this only as"))
    return {
      priority: 6,
      kind: "Unclear name",
      question: "What is this product?",
    };
  if (note.includes("confirm the surname"))
    return {
      priority: 7,
      kind: "Uncertain surname",
      question: "Is the surname split correctly?",
    };
  if (note.includes("same household"))
    return {
      priority: 9,
      kind: "Shared phone (FYI)",
      question: "No action needed unless these are the same person.",
    };
  return { priority: 8, kind: "Other", question: "Check this record." };
}

function csv(rows: Row[]): string {
  const head = [
    "priority",
    "issue",
    "record",
    "legacy id",
    "name",
    "what the old system had",
    "question for the clinic",
    "decision",
  ];
  const esc = (v: string | number | null) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [r.priority, r.kind, r.record, r.legacyId, r.name, r.detail, r.question, ""]
      .map(esc)
      .join(","),
  );
  return [head.map(esc).join(","), ...body].join("\n");
}

async function main() {
  const rows: Row[] = [];

  const clients = await prisma.client.findMany({
    where: { needsReview: true, deletedAt: null },
    select: {
      legacyId: true,
      salutation: true,
      firstName: true,
      lastName: true,
      phone: true,
      reviewNote: true,
    },
    orderBy: { legacyId: "asc" },
  });
  for (const c of clients) {
    const note = c.reviewNote ?? "";
    const { priority, kind, question } = classify(note);
    rows.push({
      priority,
      kind,
      record: "Client",
      legacyId: c.legacyId,
      name: [c.salutation, c.firstName, c.lastName].filter(Boolean).join(" "),
      detail: `${note}${c.phone ? ` (phone ${c.phone})` : ""}`,
      question,
    });
  }

  const patients = await prisma.patient.findMany({
    where: { needsReview: true, deletedAt: null },
    select: {
      legacyId: true,
      name: true,
      species: true,
      breed: true,
      reviewNote: true,
      client: { select: { firstName: true, lastName: true, legacyId: true } },
    },
    orderBy: { legacyId: "asc" },
  });
  for (const p of patients) {
    const note = p.reviewNote ?? "";
    const { priority, kind, question } = classify(note);
    const owner = `${p.client.firstName} ${p.client.lastName}`.trim();
    rows.push({
      priority,
      kind,
      record: "Pet",
      legacyId: p.client.legacyId,
      name: `${p.name}${p.breed ? ` (${p.breed})` : ""} - owner ${owner}`,
      detail: note,
      question,
    });
  }

  const invItems = await prisma.inventoryItem.findMany({
    where: { needsReview: true, deletedAt: null },
    select: {
      legacyId: true,
      name: true,
      category: true,
      currentStock: true,
      salePrice: true,
      reviewNote: true,
    },
    orderBy: { name: "asc" },
  });
  for (const it of invItems) {
    const note = it.reviewNote ?? "";
    const { priority, kind, question } = classify(note);
    rows.push({
      priority,
      kind,
      record: "Stock item",
      legacyId: it.legacyId,
      name: `${it.name}${it.category ? ` (${it.category})` : ""}`,
      detail: `${note} [stock ${it.currentStock}, price ${it.salePrice ?? "-"}]`,
      question,
    });
  }

  const svcs = await prisma.service.findMany({
    where: { needsReview: true },
    select: {
      legacyId: true,
      name: true,
      category: true,
      price: true,
      reviewNote: true,
    },
    orderBy: { name: "asc" },
  });
  for (const sv of svcs) {
    const note = sv.reviewNote ?? "";
    const { priority, kind, question } = classify(note);
    rows.push({
      priority,
      kind,
      record: "Service",
      legacyId: sv.legacyId,
      name: `${sv.name}${sv.category ? ` (${sv.category})` : ""}`,
      detail: `${note} [price ${sv.price}]`,
      question,
    });
  }

  rows.sort(
    (a, b) => a.priority - b.priority || (a.legacyId ?? 0) - (b.legacyId ?? 0),
  );

  const out = join(import.meta.dirname, "seed-data", "review-worklist.csv");
  writeFileSync(out, csv(rows), "utf8");

  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  console.log(`${rows.length} items written to ${out}\n`);
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${kind}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
