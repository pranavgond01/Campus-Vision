"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check saved theme or default to dark
    const saved = localStorage.getItem("scv_theme") as Theme | null;
    if (saved === "light" || saved === "dark") {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      setThemeState("dark");
      applyTheme("dark");
    }
    setMounted(true);
  }, []);

  function applyTheme(t: Theme) {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (t === "light") {
        root.classList.remove("dark");
        root.classList.add("light");
        root.setAttribute("data-theme", "light");
        document.body.classList.remove("dark");
        document.body.classList.add("light");
      } else {
        root.classList.remove("light");
        root.classList.add("dark");
        root.setAttribute("data-theme", "dark");
        document.body.classList.remove("light");
        document.body.classList.add("dark");
      }
    }
  }

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      localStorage.setItem("scv_theme", t);
    } catch {}
    applyTheme(t);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
