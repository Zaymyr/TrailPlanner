import { colors as paceColors, radius, shadows, spacing } from "@pace-yourself/design-system/tokens";
import type { Config } from "tailwindcss";

const toPxScale = (tokens: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [key, `${value}px`])
  );

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // The web app is light-only (dark theme removed 2026-11-23). Keep "class": nothing adds `.dark` any more,
  // so leftover `dark:` utilities stay inert instead of following the OS setting as "media" would.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        input: "hsl(var(--input))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        "surface-muted": "hsl(var(--surface-muted))",
        ring: "hsl(var(--ring))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        brand: "hsl(var(--brand))",
        "brand-light": "hsl(var(--brand-light))",
        "brand-surface": "hsl(var(--brand-surface))",
        "brand-border": "hsl(var(--brand-border))",
        "brand-foreground": "hsl(var(--brand-foreground))",
        success: "hsl(var(--success))",
        "success-foreground": "hsl(var(--success-foreground))",
        pace: paceColors,
      },
      spacing: toPxScale(spacing as Record<string, number>),
      borderRadius: toPxScale(radius as Record<string, number>),
      boxShadow: shadows,
    },
  },
  plugins: [],
};

export default config;
