import React from "react";
import { FaMoon, FaSun } from "react-icons/fa6";
import { useThemeMode } from "../hooks/useThemeMode";

export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode();
  return (
    <button
      onClick={toggle}
      aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center border border-border text-ink-dim transition-colors hover:border-accent/50 hover:text-accent"
    >
      {mode === "dark" ? <FaSun className="text-sm" /> : <FaMoon className="text-sm" />}
    </button>
  );
}
