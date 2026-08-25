// Supplier discounts taken at the point of delivery.
//
// The discount is not stored as a charge of its own: it reduces the unit cost
// and the net figure is what the delivery books. That keeps every downstream
// figure right without touching any of them, because quantity * unitCost is
// already what the order total, the supplier balance, the item's last cost and
// COGS are all built from. A discount recorded beside the cost instead would
// have to be re-applied correctly in each of those places.

import { DISCOUNT_UNITS, type DiscountUnit } from "@/constants/order";

export function isDiscountUnit(value: unknown): value is DiscountUnit {
  return (
    typeof value === "string" &&
    (DISCOUNT_UNITS as readonly string[]).includes(value)
  );
}

// The unit cost after the discount, in the same terms the cost was given in.
//
// Applied before any loose-unit conversion, never after, so both kinds behave on
// a line bought by the kilo: a 0.50 off a 5.00/kg cost is 4.50/kg and still
// multiplies up by the pack size, and a percentage is scale-free either way.
//
// Floored at zero. A discount larger than the cost is refused at the edges
// rather than silently inverted into a negative cost, but the floor means that
// even if one slips through, stock is never booked at a price that would pay the
// clinic to receive it.
export function netUnitCost(
  unitCost: number,
  discount: number | undefined,
  unit: DiscountUnit,
): number {
  if (!Number.isFinite(unitCost)) return unitCost;
  if (discount === undefined || !Number.isFinite(discount) || discount <= 0) {
    return unitCost;
  }
  const net =
    unit === "percent" ? unitCost * (1 - discount / 100) : unitCost - discount;
  return net > 0 ? net : 0;
}

// Whether a discount is bigger than the cost it is taken off. Percentages are
// capped by their own validation, so this only really bites on an amount.
export function discountExceedsCost(
  unitCost: number,
  discount: number | undefined,
  unit: DiscountUnit,
): boolean {
  if (discount === undefined || !Number.isFinite(discount) || discount <= 0) {
    return false;
  }
  if (!Number.isFinite(unitCost)) return false;
  return unit === "percent" ? discount > 100 : discount > unitCost;
}
