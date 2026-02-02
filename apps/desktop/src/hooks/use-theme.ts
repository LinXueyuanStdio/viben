import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/stores";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

// Check if user prefers reduced motion
const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Get the system's preferred color scheme.
 */
function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Apply the theme to the document root.
 * Adds or removes the 'dark' class and optionally enables transitions.
 */
function applyTheme(resolvedTheme: ResolvedTheme, withTransition = true): void {
  const root = document.documentElement;

  // Add transition class if animations are allowed and transition is requested
  if (withTransition && !prefersReducedMotion) {
    root.classList.add("theme-transition");
  }

  if (resolvedTheme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Remove transition class after animation completes
  if (withTransition && !prefersReducedMotion) {
    // Duration matches --duration-fast (200ms) as specified in PRD
    setTimeout(() => {
      root.classList.remove("theme-transition");
    }, 200);
  }
}

export interface UseThemeReturn {
  /** Current theme setting: "light" | "dark" | "system" */
  theme: Theme;
  /** Set the theme */
  setTheme: (theme: Theme) => void;
  /** The actual applied theme: "light" | "dark" */
  resolvedTheme: ResolvedTheme;
}

/**
 * Hook for managing theme state and application.
 * Supports light, dark, and system (auto) modes.
 * Persists to Zustand store which uses localStorage.
 */
export function useTheme(): UseThemeReturn {
  const theme = useAppStore((state) => state.theme);
  const setThemeStore = useAppStore((state) => state.setTheme);

  // Track the resolved theme (what's actually applied)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    if (theme === "system") {
      return getSystemTheme();
    }
    return theme;
  });

  // Resolve theme based on setting and system preference
  const resolveTheme = useCallback((themeSetting: Theme): ResolvedTheme => {
    if (themeSetting === "system") {
      return getSystemTheme();
    }
    return themeSetting;
  }, []);

  // Apply theme when theme setting changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved, true);
  }, [theme, resolveTheme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const newResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(newResolvedTheme);
      applyTheme(newResolvedTheme, true);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Wrapper for setTheme that also applies the theme immediately
  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeStore(newTheme);
      // Theme will be applied by the effect above
    },
    [setThemeStore]
  );

  return {
    theme,
    setTheme,
    resolvedTheme,
  };
}
