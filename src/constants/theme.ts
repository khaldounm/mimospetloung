// Name of the cookie that persists the chosen color mode.
//
// This lives in constants rather than in ThemeRegistry because the root layout
// (a server component) reads it. Importing a plain constant from a "use client"
// module into a server component yields a client-reference stub instead of the
// value, so `cookies().get(...)` was being called with undefined and the server
// always rendered the light theme.
export const COLOR_MODE_COOKIE = "color-mode";
