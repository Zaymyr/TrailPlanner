export const DEFAULT_RACEBOOK_PRIMARY_COLOR = "#2D5016";
export const DEFAULT_RACEBOOK_ACCENT_COLOR = "#B45309";
export const RACEBOOK_EDITION_LOGO_ENABLED = false;

export type RacebookBranding = {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

export type ResolvedRacebookTheme = RacebookBranding & {
  onPrimaryColor: "#FFFFFF" | "#1A1A1A";
  primarySurfaceColor: string;
  primaryBorderColor: string;
  accentSurfaceColor: string;
  accentBorderColor: string;
};

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : fallback;
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value.trim().toUpperCase());
}

function hexToRgb(value: string) {
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
}

function toHex(value: number) {
  return Math.round(value).toString(16).padStart(2, "0").toUpperCase();
}

function mixWithWhite(value: string, colorWeight: number) {
  const { red, green, blue } = hexToRgb(value);
  const mix = (channel: number) => channel * colorWeight + 255 * (1 - colorWeight);
  return `#${toHex(mix(red))}${toHex(mix(green))}${toHex(mix(blue))}`;
}

function relativeLuminance(value: string) {
  const { red, green, blue } = hexToRgb(value);
  const linearize = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
}

function contrastRatio(left: string, right: string) {
  const first = relativeLuminance(left);
  const second = relativeLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function resolveRacebookTheme(input?: Partial<RacebookBranding> | null): ResolvedRacebookTheme {
  const primaryColor = normalizeHexColor(input?.primaryColor, DEFAULT_RACEBOOK_PRIMARY_COLOR);
  const accentColor = normalizeHexColor(input?.accentColor, DEFAULT_RACEBOOK_ACCENT_COLOR);
  const whiteContrast = contrastRatio(primaryColor, "#FFFFFF");
  const darkContrast = contrastRatio(primaryColor, "#1A1A1A");

  return {
    logoUrl:
      RACEBOOK_EDITION_LOGO_ENABLED && typeof input?.logoUrl === "string" && /^https:\/\//i.test(input.logoUrl)
        ? input.logoUrl
        : null,
    primaryColor,
    accentColor,
    onPrimaryColor: whiteContrast >= darkContrast ? "#FFFFFF" : "#1A1A1A",
    primarySurfaceColor: mixWithWhite(primaryColor, 0.12),
    primaryBorderColor: mixWithWhite(primaryColor, 0.35),
    accentSurfaceColor: mixWithWhite(accentColor, 0.12),
    accentBorderColor: mixWithWhite(accentColor, 0.35),
  };
}
