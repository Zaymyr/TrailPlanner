import { describe, expect, it } from "vitest";

import { organizerSocialProofUpdateSchema, resolveOrganizerSocialProofLogo } from "./organizer-social-proof";

const base = {
  editionId: "11111111-1111-4111-8111-111111111111",
  status: "draft" as const,
  displayOrder: 0,
  quoteText: null,
  quoteAuthorName: null,
  quoteAuthorRole: null,
  consentConfirmed: false,
  refreshStats: false,
};

describe("organizer social proof validation", () => {
  it("keeps an empty quote as null", () => {
    expect(organizerSocialProofUpdateSchema.parse({ ...base, quoteText: "  " }).quoteText).toBeNull();
  });

  it("requires consent for publication", () => {
    expect(organizerSocialProofUpdateSchema.safeParse({ ...base, status: "published" }).success).toBe(false);
  });

  it("rejects a quote attribution without a quote", () => {
    expect(organizerSocialProofUpdateSchema.safeParse({ ...base, quoteAuthorName: "Camille" }).success).toBe(false);
  });
});

describe("organizer social proof logo", () => {
  const thumbnail = "https://example.supabase.co/storage/v1/object/public/race-images/organizer-events/e/thumbnail.png";
  const racebookLogo = "https://example.supabase.co/storage/v1/object/public/race-images/organizer-branding/e/logo.png";

  it("prefers the published Livret coureur logo from the organizer space", () => {
    expect(resolveOrganizerSocialProofLogo({ published_logo_url: racebookLogo }, thumbnail))
      .toEqual({ logoUrl: racebookLogo, logoSource: "racebook" });
    expect(resolveOrganizerSocialProofLogo([{ published_logo_url: racebookLogo }], null))
      .toEqual({ logoUrl: racebookLogo, logoSource: "racebook" });
  });

  it("falls back to the organizer event image, then to no logo", () => {
    expect(resolveOrganizerSocialProofLogo({ published_logo_url: null }, thumbnail))
      .toEqual({ logoUrl: thumbnail, logoSource: "event" });
    expect(resolveOrganizerSocialProofLogo(null, null)).toEqual({ logoUrl: null, logoSource: null });
  });
});
