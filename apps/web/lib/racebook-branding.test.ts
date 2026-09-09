import { RACEBOOK_EDITION_LOGO_ENABLED, resolveRacebookTheme } from "@pace-yourself/design-system";
import { describe, expect, it } from "vitest";

import {
  detectRacebookBrandingLogoType,
  racebookBrandingDraftSchema,
  toOrganizerBranding,
  toPublishedBranding,
} from "./racebook-branding";

const row = {
  edition_id: "33333333-3333-4333-8333-333333333333",
  draft_logo_url: "https://example.com/draft.png",
  draft_primary_color: "#123456",
  draft_accent_color: "#ABCDEF",
  published_logo_url: "https://example.com/published.png",
  published_primary_color: "#654321",
  published_accent_color: "#FEDCBA",
  published_at: "2026-09-07T12:00:00.000Z",
  updated_at: "2026-09-07T12:00:00.000Z",
};

describe("RaceBook branding mapping", () => {
  it("validates and normalizes editable colors", () => {
    expect(racebookBrandingDraftSchema.parse({ primaryColor: "#abcdef", accentColor: "#123456" })).toEqual({
      primaryColor: "#ABCDEF",
      accentColor: "#123456",
    });
    expect(racebookBrandingDraftSchema.safeParse({ primaryColor: "red", accentColor: "#123456" }).success).toBe(false);
  });

  it("selects readable foregrounds and derives light surfaces", () => {
    expect(resolveRacebookTheme({ primaryColor: "#FFFF00", accentColor: "#123ABC" })).toMatchObject({
      primaryColor: "#FFFF00",
      accentColor: "#123ABC",
      onPrimaryColor: "#1A1A1A",
      primarySurfaceColor: expect.stringMatching(/^#[0-9A-F]{6}$/),
      accentSurfaceColor: expect.stringMatching(/^#[0-9A-F]{6}$/),
      accentBorderColor: expect.stringMatching(/^#[0-9A-F]{6}$/),
    });
  });

  it("keeps edition logos dormant in resolved themes", () => {
    expect(RACEBOOK_EDITION_LOGO_ENABLED).toBe(false);
    expect(resolveRacebookTheme({ logoUrl: "https://example.com/published.png" }).logoUrl).toBeNull();
    expect(toOrganizerBranding({
      ...row,
      draft_primary_color: row.published_primary_color,
      draft_accent_color: row.published_accent_color,
    }).hasUnpublishedChanges).toBe(false);
  });

  it("exposes only published values to runners", () => {
    expect(toPublishedBranding(row)).toEqual({
      logoUrl: null,
      primaryColor: "#654321",
      accentColor: "#FEDCBA",
    });
    expect(toOrganizerBranding(row).hasUnpublishedChanges).toBe(true);
  });

  it("detects supported image signatures instead of trusting a declared MIME type", () => {
    expect(detectRacebookBrandingLogoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectRacebookBrandingLogoType(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectRacebookBrandingLogoType(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
    expect(detectRacebookBrandingLogoType(new TextEncoder().encode("0000ftypavif"))).toBe("image/avif");
    expect(detectRacebookBrandingLogoType(new TextEncoder().encode("0000ftypmif10000avif"))).toBe("image/avif");
    expect(detectRacebookBrandingLogoType(new TextEncoder().encode("not-an-image"))).toBeNull();
  });
});
