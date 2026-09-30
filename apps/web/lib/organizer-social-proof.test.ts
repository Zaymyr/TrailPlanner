import { describe, expect, it } from "vitest";

import { organizerSocialProofUpdateSchema } from "./organizer-social-proof";

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

