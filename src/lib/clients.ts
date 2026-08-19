import { prisma } from "@/lib/prisma";
import type { ClientDTO } from "@/types/entities";

// Relations to pull when a client is rendered with its active patient count.
export const clientInclude = {
  _count: { select: { patients: { where: { deletedAt: null } } } },
} as const;

// Shape returned by the client queries (using `clientInclude`). Mapping to a
// flat DTO here keeps the API response and the server-rendered page identical,
// so the client table doesn't lose the patient count when it refetches.
type ClientWithCount = {
  clientId: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  needsReview: boolean;
  reviewNote: string | null;
  _count: { patients: number };
};

export function toClientDTO(c: ClientWithCount): ClientDTO {
  return {
    clientId: c.clientId,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    needsReview: c.needsReview,
    reviewNote: c.reviewNote,
    patientCount: c._count.patients,
  };
}

// ---- Client list (paged) ----

/**
 * One page of the client list, plus the letter buckets the jump bar needs.
 *
 * Raw SQL for the same reasons as the patient list: the page, its total, the
 * per-client pet count and the bucket counts all arrive in two round trips
 * instead of one query per row. The page previously fetched all 1,875 clients
 * with a correlated count on every keystroke.
 *
 * Both the ordering and the letter bucket key on
 * `coalesce(nullif(last_name,''), first_name)` -- 135 clients have no surname,
 * and sorting them by a blank while filing them under their first initial
 * would put them somewhere the jump bar cannot reach.
 */
export interface ClientListPage {
  clients: ClientDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** Every first letter present in the data, with how many clients sit under it. */
  letters: { letter: string; count: number }[];
  /**
   * How many clients are flagged in total, not just on this page. The filter
   * chip shows it, so it must stay the same whatever else is filtered.
   */
  reviewCount: number;
}

export interface ClientListQuery {
  q?: string;
  letter?: string;
  page?: number;
  pageSize?: number;
  /** Show only records the migration flagged for a human to confirm. */
  needsReview?: boolean;
}

export const CLIENT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

type ClientListRow = {
  client_id: number;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  needs_review: boolean;
  review_note: string | null;
  patient_count: bigint;
  total_count: bigint;
};

export async function listClients(
  query: ClientListQuery = {},
): Promise<ClientListPage> {
  const pageSize = Math.min(query.pageSize ?? CLIENT_PAGE_SIZE, MAX_PAGE_SIZE);
  const page = Math.max(query.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  // A single letter only; anything else is ignored rather than rejected, so a
  // stale link cannot break the page.
  const letter =
    query.letter && /^[A-Za-z]$/.test(query.letter)
      ? query.letter.toUpperCase()
      : null;
  const search = query.q?.trim() ? `%${query.q.trim().toLowerCase()}%` : null;
  // Passed as a nullable boolean so one prepared statement serves both cases.
  const reviewOnly = query.needsReview ? true : null;

  const [rows, letters, reviewCount] = await Promise.all([
    prisma.$queryRaw<ClientListRow[]>`
      SELECT c.client_id, c.first_name, c.last_name, c.phone, c.email, c.notes,
             c.needs_review, c.review_note,
             (SELECT count(*) FROM patients p
               WHERE p.client_id = c.client_id
                 AND p.deleted_at IS NULL) AS patient_count,
             COUNT(*) OVER () AS total_count
      FROM clients c
      WHERE c.deleted_at IS NULL
        AND (${reviewOnly}::boolean IS NULL OR c.needs_review = TRUE)
        AND (
          ${letter}::text IS NULL
          OR upper(left(coalesce(nullif(c.last_name, ''), c.first_name), 1))
             = ${letter}
        )
        AND (
          ${search}::text IS NULL
          OR lower(c.first_name || ' ' || c.last_name) LIKE ${search}
          OR lower(coalesce(c.email, '')) LIKE ${search}
          OR coalesce(c.phone, '') LIKE ${search}
          OR coalesce(c.phone2, '') LIKE ${search}
        )
      -- Names starting with punctuation or a digit ("(no name)", "1") sort
      -- before letters in the default collation, so the page would open on the
      -- worst rows in the table. They go last instead; the jump bar already
      -- excludes them, and they are all flagged for review anyway.
      ORDER BY (coalesce(nullif(c.last_name, ''), c.first_name) ~ '^[A-Za-z]')
                 DESC,
               coalesce(nullif(c.last_name, ''), c.first_name) ASC,
               c.first_name ASC, c.client_id ASC
      LIMIT ${pageSize} OFFSET ${offset}`,
    prisma.$queryRaw<{ letter: string; count: bigint }[]>`
      SELECT upper(left(coalesce(nullif(last_name, ''), first_name), 1))
               AS letter,
             count(*) AS count
      FROM clients
      WHERE deleted_at IS NULL
        AND coalesce(nullif(last_name, ''), first_name) ~ '^[A-Za-z]'
      GROUP BY 1
      ORDER BY 1`,
    prisma.client.count({ where: { deletedAt: null, needsReview: true } }),
  ]);

  return {
    clients: rows.map((r) => ({
      clientId: r.client_id,
      firstName: r.first_name,
      lastName: r.last_name,
      phone: r.phone,
      email: r.email,
      notes: r.notes,
      needsReview: r.needs_review,
      reviewNote: r.review_note,
      patientCount: Number(r.patient_count),
    })),
    total: rows.length > 0 ? Number(rows[0]!.total_count) : 0,
    page,
    pageSize,
    letters: letters.map((l) => ({ letter: l.letter, count: Number(l.count) })),
    reviewCount,
  };
}
