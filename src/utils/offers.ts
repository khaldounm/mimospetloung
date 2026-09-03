import { formatMoney } from "@/utils/format";
import type { OfferDiscountMode } from "@/constants/offers";

// How an offer's terms read in one line: "20% off" or "$5 off".
//
// Every screen that mentions an offer says it this way, so a chip on a client,
// a row in Settings and the banner on an invoice cannot describe the same deal
// in three different words.
export function offerTerms(offer: {
  discountMode: OfferDiscountMode;
  discountPct: string;
  discountAmount: string;
}): string {
  return offer.discountMode === "pct"
    ? `${Number(offer.discountPct)}% off`
    : `${formatMoney(offer.discountAmount)} off`;
}
