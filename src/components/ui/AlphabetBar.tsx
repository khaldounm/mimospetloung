"use client";

import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Tooltip from "@mui/material/Tooltip";

// A jump bar for name-ordered lists.
//
// Built from the letters actually present rather than a hardcoded A-Z: in this
// data seven letters hold fewer than ten pets and several hold none at all, so
// a fixed alphabet would be mostly dead targets. Letters with no rows are shown
// muted and unclickable rather than hidden, because a bar that changes width as
// you filter is harder to aim at than one that stays put.
export default function AlphabetBar({
  letters,
  value,
  onChange,
  disabled = false,
  noun = "pets",
  nounSingular,
}: {
  /** Every letter present in the data, with its row count. */
  letters: { letter: string; count: number }[];
  /** The selected letter, or null for "all". */
  value: string | null;
  onChange: (letter: string | null) => void;
  disabled?: boolean;
  /** What is being counted, for the tooltip and screen readers. */
  noun?: string;
  /** Singular form, when it is not just `noun` minus its final "s". */
  nounSingular?: string;
}) {
  const one = nounSingular ?? noun.replace(/s$/, "");
  const counts = new Map(letters.map((l) => [l.letter, l.count]));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const total = letters.reduce((sum, l) => sum + l.count, 0);

  const cell = {
    minWidth: 30,
    height: 30,
    px: 0.5,
    borderRadius: 1,
    fontSize: "0.8125rem",
    fontWeight: 500,
    lineHeight: 1,
    transition: "background-color 120ms ease, color 120ms ease",
  } as const;

  return (
    <Box
      role="group"
      aria-label="Jump to a letter"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 0.5,
        alignItems: "center",
        mb: 2,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <ButtonBase
        onClick={() => onChange(null)}
        aria-pressed={value === null}
        sx={{
          ...cell,
          px: 1.25,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          fontSize: "0.6875rem",
          color: value === null ? "primary.contrastText" : "text.secondary",
          backgroundColor: value === null ? "primary.main" : "transparent",
          border: 1,
          borderColor: value === null ? "primary.main" : "divider",
          "&:hover": {
            backgroundColor: value === null ? "primary.main" : "action.hover",
          },
        }}
      >
        All {total > 0 ? total.toLocaleString() : ""}
      </ButtonBase>

      {alphabet.map((letter) => {
        const count = counts.get(letter) ?? 0;
        const selected = value === letter;
        const empty = count === 0;
        const button = (
          <ButtonBase
            key={letter}
            disabled={empty}
            onClick={() => onChange(selected ? null : letter)}
            aria-pressed={selected}
            aria-label={`${letter}, ${count} ${count === 1 ? one : noun}`}
            sx={{
              ...cell,
              color: selected
                ? "primary.contrastText"
                : empty
                  ? "text.disabled"
                  : "text.primary",
              backgroundColor: selected ? "primary.main" : "transparent",
              border: 1,
              borderColor: selected ? "primary.main" : "transparent",
              cursor: empty ? "default" : "pointer",
              "&:hover": {
                backgroundColor: selected ? "primary.main" : "action.hover",
                borderColor: selected ? "primary.main" : "divider",
              },
              "&.Mui-focusVisible": {
                outline: 2,
                outlineColor: "secondary.main",
                outlineOffset: 2,
              },
            }}
          >
            {letter}
          </ButtonBase>
        );
        // A count on hover answers "is it worth clicking" without cluttering
        // 26 cells with numbers.
        return empty ? (
          button
        ) : (
          <Tooltip
            key={letter}
            title={`${count} ${count === 1 ? one : noun}`}
          >
            {button}
          </Tooltip>
        );
      })}
    </Box>
  );
}
