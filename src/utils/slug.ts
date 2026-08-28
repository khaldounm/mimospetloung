// URL segments for free-text values (inventory categories, running-cost
// categories). The value is not stored as a slug anywhere, so the slug is
// derived on the way out and resolved by comparing slugs on the way back in,
// rather than trusting the URL to spell the value exactly.

export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The value whose slug matches, or null when nothing does. */
export function categoryFromSlug(
  slug: string,
  categories: readonly string[],
): string | null {
  const wanted = slug.toLowerCase();
  return categories.find((c) => categorySlug(c) === wanted) ?? null;
}
