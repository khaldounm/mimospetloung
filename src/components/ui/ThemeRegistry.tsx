"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { COLOR_MODE_COOKIE } from "@/constants/theme";
import { darkTheme, lightTheme } from "./theme";

type Mode = "light" | "dark";

const ColorModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: "light",
  toggle: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

// Persist the mode in a cookie (not localStorage) so the server can read it in
// the root layout and render the matching theme. That keeps the SSR markup and
// the client hydration in sync, avoiding the emotion class-hash mismatch.
function persistMode(next: Mode) {
  document.cookie = `${COLOR_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

export default function ThemeRegistry({
  initialMode,
  children,
}: {
  initialMode: Mode;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const colorMode = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((prev) => {
          const next = prev === "light" ? "dark" : "light";
          persistMode(next);
          return next;
        }),
    }),
    [mode],
  );

  const theme = mode === "light" ? lightTheme : darkTheme;

  return (
    <AppRouterCacheProvider options={{ key: "mui" }}>
      <ColorModeContext.Provider value={colorMode}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </ColorModeContext.Provider>
    </AppRouterCacheProvider>
  );
}
