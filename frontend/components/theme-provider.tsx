"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function subscribeToTheme(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("autolens-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("autolens-theme-change", callback);
  };
}

function getTheme(): Theme {
  return window.localStorage.getItem("autolens-theme") === "light" ? "light" : "dark";
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore<Theme>(
    subscribeToTheme,
    getTheme,
    () => "dark",
  );
  const setTheme = (nextTheme: Theme) => {
    window.localStorage.setItem("autolens-theme", nextTheme);
    window.dispatchEvent(new Event("autolens-theme-change"));
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    window.localStorage.setItem("autolens-theme", theme);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme: theme, setTheme }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
