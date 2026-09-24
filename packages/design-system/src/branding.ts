export const DEFAULT_RACEBOOK_PRIMARY_COLOR = "#2D5016";
export const DEFAULT_RACEBOOK_ACCENT_COLOR = "#B45309";
export const RACEBOOK_EDITION_LOGO_ENABLED = true;

export type RacebookBranding = {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
};

export type ResolvedRacebookTheme = RacebookBranding & {
  onPrimaryColor: "#FFFFFF" | "#1A1A1A";
  onAccentColor: "#FFFFFF" | "#1A1A1A";
  primaryForegroundColor: string;
  primaryGraphicColor: string;
  primarySurfaceColor: string;
  primaryBorderColor: string;
  accentForegroundColor: string;
  accentGraphicColor: string;
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

function mixColors(value: string, target: string, targetWeight: number) {
  const sourceRgb = hexToRgb(value);
  const targetRgb = hexToRgb(target);
  const mix = (source: number, destination: number) => source * (1 - targetWeight) + destination * targetWeight;
  return `#${toHex(mix(sourceRgb.red, targetRgb.red))}${toHex(mix(sourceRgb.green, targetRgb.green))}${toHex(mix(sourceRgb.blue, targetRgb.blue))}`;
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

function strongestContrastText(background: string): "#FFFFFF" | "#1A1A1A" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#1A1A1A") ? "#FFFFFF" : "#1A1A1A";
}

function ensureContrast(value: string, background: string, minimumRatio: number) {
  if (contrastRatio(value, background) >= minimumRatio) return value;

  const target = contrastRatio("#000000", background) >= contrastRatio("#FFFFFF", background)
    ? "#000000"
    : "#FFFFFF";
  let low = 0;
  let high = 1;

  for (let iteration = 0; iteration < 16; iteration += 1) {
    const midpoint = (low + high) / 2;
    if (contrastRatio(mixColors(value, target, midpoint), background) >= minimumRatio) high = midpoint;
    else low = midpoint;
  }

  return mixColors(value, target, high);
}

export function resolveRacebookTheme(input?: Partial<RacebookBranding> | null): ResolvedRacebookTheme {
  const primaryColor = normalizeHexColor(input?.primaryColor, DEFAULT_RACEBOOK_PRIMARY_COLOR);
  const accentColor = normalizeHexColor(input?.accentColor, DEFAULT_RACEBOOK_ACCENT_COLOR);
  const logoUrl = typeof input?.logoUrl === "string" ? input.logoUrl.trim() : "";

  return {
    logoUrl:
      RACEBOOK_EDITION_LOGO_ENABLED && /^https:\/\//i.test(logoUrl)
        ? logoUrl
        : null,
    primaryColor,
    accentColor,
    onPrimaryColor: strongestContrastText(primaryColor),
    onAccentColor: strongestContrastText(accentColor),
    primaryForegroundColor: ensureContrast(primaryColor, "#FFFFFF", 4.5),
    primaryGraphicColor: ensureContrast(primaryColor, "#FFFFFF", 3),
    primarySurfaceColor: mixWithWhite(primaryColor, 0.12),
    primaryBorderColor: mixWithWhite(primaryColor, 0.35),
    accentForegroundColor: ensureContrast(accentColor, "#FFFFFF", 4.5),
    accentGraphicColor: ensureContrast(accentColor, "#FFFFFF", 3),
    accentSurfaceColor: mixWithWhite(accentColor, 0.12),
    accentBorderColor: mixWithWhite(accentColor, 0.35),
  };
}
