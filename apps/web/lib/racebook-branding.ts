import {
  DEFAULT_RACEBOOK_ACCENT_COLOR,
  DEFAULT_RACEBOOK_PRIMARY_COLOR,
  normalizeHexColor,
  resolveRacebookTheme,
  type RacebookBranding,
} from "@pace-yourself/design-system";
import { z } from "zod";

export const MAX_RACEBOOK_BRANDING_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
export const RACEBOOK_BRANDING_LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export function detectRacebookBrandingLogoType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "image/webp";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    for (let offset = 8; offset + 4 <= Math.min(bytes.length, 64); offset += 4) {
      const brand = String.fromCharCode(...bytes.slice(offset, offset + 4));
      if (brand === "avif" || brand === "avis") return "image/avif";
    }
  }
  return null;
}

export const racebookBrandingColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Use a #RRGGBB color.")
  .transform((value) => value.toUpperCase());

export const racebookBrandingDraftSchema = z.object({
  primaryColor: racebookBrandingColorSchema,
  accentColor: racebookBrandingColorSchema,
});

export const racebookBrandingRowSchema = z.object({
  edition_id: z.string().uuid(),
  draft_logo_url: z.string().url().nullable(),
  draft_primary_color: racebookBrandingColorSchema,
  draft_accent_color: racebookBrandingColorSchema,
  published_logo_url: z.string().url().nullable(),
  published_primary_color: racebookBrandingColorSchema.nullable(),
  published_accent_color: racebookBrandingColorSchema.nullable(),
  published_at: z.string().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string(),
});

export type RacebookBrandingRow = z.infer<typeof racebookBrandingRowSchema>;

export const defaultRacebookBranding = (): RacebookBranding => ({
  logoUrl: null,
  primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR,
  accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR,
});

export const toDraftBranding = (row: RacebookBrandingRow | null): RacebookBranding => ({
  logoUrl: row?.draft_logo_url ?? null,
  primaryColor: normalizeHexColor(row?.draft_primary_color, DEFAULT_RACEBOOK_PRIMARY_COLOR),
  accentColor: normalizeHexColor(row?.draft_accent_color, DEFAULT_RACEBOOK_ACCENT_COLOR),
});

export const toPublishedBranding = (row: RacebookBrandingRow | null): RacebookBranding => {
  const resolved = resolveRacebookTheme({
    logoUrl: row?.published_at ? row.published_logo_url : null,
    primaryColor: row?.published_at ? row.published_primary_color ?? undefined : undefined,
    accentColor: row?.published_at ? row.published_accent_color ?? undefined : undefined,
  });
  return {
    logoUrl: resolved.logoUrl,
    primaryColor: resolved.primaryColor,
    accentColor: resolved.accentColor,
  };
};

export const toOrganizerBranding = (row: RacebookBrandingRow | null) => {
  const draft = toDraftBranding(row);
  const published = toPublishedBranding(row);
  return {
    draft,
    published,
    publishedAt: row?.published_at ?? null,
    hasUnpublishedChanges:
      draft.logoUrl !== published.logoUrl ||
      draft.primaryColor !== published.primaryColor ||
      draft.accentColor !== published.accentColor,
  };
};

export const storagePathFromRacebookBrandingUrl = (supabaseUrl: string, url: string | null | undefined) => {
  const prefix = `${supabaseUrl}/storage/v1/object/public/race-images/`;
  return url?.startsWith(prefix) ? decodeURIComponent(url.slice(prefix.length)) : null;
};
