import { useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

export interface Theme {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  resolved: ThemeMode;
}

/**
 * Dark is the default (Urbish's call 2026-10-05); the toggle switches to
 * light. Persisted in localStorage; drives `data-theme` on <html>.
 */
export function useTheme(): Theme {
  const [mode, setMode] = useState<ThemeMode>(() =>
    typeof localStorage !== "undefined" &&
    localStorage.getItem("mohar-theme") === "light"
      ? "light"
      : "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    if (mode === "light") root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("mohar-theme", mode);
    } catch {
      /* private mode */
    }
  }, [mode]);

  return { mode, setMode, resolved: mode };
}

/** Theme-correct logo file per the brand guide.
 * Uses the transparent locked marks (no baked-in tile), so the logo blends
 * seamlessly into the page background in both themes. */
export function logoFor(resolved: "light" | "dark"): string {
  return resolved === "dark" ? "/mohar-mark-dark.svg" : "/mohar-mark-light.svg";
}
