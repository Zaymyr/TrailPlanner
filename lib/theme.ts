export type Theme = "light" | "dark";

export function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  return prefersDark ? "dark" : "light";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  root.style.colorScheme = theme;
}
