"use client";

import { useTheme } from "./ThemeProvider";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={`Current: ${theme === "dark" ? "Dark Mode" : "White Mode"}. Click to toggle.`}
      className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.08] active:scale-95 shadow-sm"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <>
          <Moon size={15} className="text-[#a69eff]" />
          {showLabel && <span className="font-semibold text-[#c7c0ff]">Dark</span>}
        </>
      ) : (
        <>
          <Sun size={15} className="text-[#f59e0b]" />
          {showLabel && <span className="font-semibold text-[#d97706]">White</span>}
        </>
      )}
    </button>
  );
}
