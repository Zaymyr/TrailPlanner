"use client";

import { useEffect, useState } from "react";

type ThemeDebugState = {
  theme: "light" | "dark";
  background: string;
  foreground: string;
  border: string;
  width: number;
};

const readThemeValues = (): ThemeDebugState => {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const isDark = root.classList.contains("dark");

  return {
    theme: isDark ? "dark" : "light",
    background: styles.getPropertyValue("--background").trim(),
    foreground: styles.getPropertyValue("--foreground").trim(),
    border: styles.getPropertyValue("--border").trim(),
    width: window.innerWidth,
  };
};

export function ThemeDebugPanel() {
  const [state, setState] = useState<ThemeDebugState | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const update = () => setState(readThemeValues());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  if (process.env.NODE_ENV !== "development" || !state) {
    return null;
  }

  return (
    <div className="fixed bottom-3 right-3 z-50 rounded-md border border-border bg-card px-3 py-2 text-[11px] text-foreground shadow-lg">
      <div className="font-semibold uppercase tracking-wide text-muted-foreground">Theme Debug</div>
      <div>Theme: {state.theme}</div>
      <div>Viewport: {state.width}px</div>
      <div>--background: {state.background}</div>
      <div>--foreground: {state.foreground}</div>
      <div>--border: {state.border}</div>
    </div>
  );
}
