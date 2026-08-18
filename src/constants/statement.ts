// Aging buckets for the supplier statement, in the order they are reported.
// `maxDays` is the inclusive upper bound on how long a charge has been
// outstanding; the last bucket is open-ended.
//
// 30-day steps are the accounts-payable convention, so the report lines up with
// what a supplier's own aged-payables listing shows.
export const AGING_BUCKETS: {
  id: string;
  label: string;
  maxDays: number | null;
}[] = [
  { id: "current", label: "Current", maxDays: 30 },
  { id: "d31to60", label: "31 - 60 days", maxDays: 60 },
  { id: "d61to90", label: "61 - 90 days", maxDays: 90 },
  { id: "over90", label: "Over 90 days", maxDays: null },
];
