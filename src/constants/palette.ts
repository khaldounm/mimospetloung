// Editorial cream/ink palette. These are the light-mode brand tokens; the dark
// theme derives an inverted neutral set from them (see components/ui/theme.ts).
export const palette = {
  cream: "#F4F1EA", // page background
  paper: "#FBFAF6", // card / surface background
  ink: "#1A1714", // near-black text + primary
  inkSoft: "#5C554C", // secondary text / muted ink
  caramel: "#B07D49", // accent
  rule: "#DCD6C9", // dividers / borders
} as const;

export type Palette = typeof palette;

// Dark-mode surfaces and accent. Near-black grounds with a mauve/lilac accent,
// layered so the page sits darkest, cards a step up, and the nav pane a step
// above that. The nav's active pill is painted in `bg`, so a selected item
// reads as the pane being notched through to the page behind it.
export const darkPalette = {
  bg: "#0B0A0D", // page background, and the nav's active pill
  paper: "#17141C", // card / surface background
  nav: "#191521", // nav pane, a step lighter than paper
  textPrimary: "#F3EFF5",
  textSecondary: "#A9A1AE",
  mauve: "#C9A2C8", // accent
  mauveSoft: "#F0E2F0", // accent text on dark grounds
  rule: "#2A2531", // dividers / borders
} as const;

export type DarkPalette = typeof darkPalette;
