import { describe, expect, it } from "vitest";

import { resolvePartnerLinkUrl, type PartnerLinkSetting } from "./partner-links";

const baseSetting: PartnerLinkSetting = {
  partnerKey: "booking",
  standardUrl: "https://www.booking.com/",
  affiliateUrl: "https://affiliate.example/booking",
  affiliateEnabled: false,
  isEnabled: true,
  updatedAt: "2026-09-28T10:00:00.000Z",
};

describe("resolvePartnerLinkUrl", () => {
  it("uses the normal URL before affiliate mode is enabled", () => {
    expect(resolvePartnerLinkUrl(baseSetting)).toBe("https://www.booking.com/");
  });

  it("uses the affiliate URL only when explicitly enabled", () => {
    expect(resolvePartnerLinkUrl({ ...baseSetting, affiliateEnabled: true })).toBe("https://affiliate.example/booking");
  });

  it("returns no destination while the partner is disabled", () => {
    expect(resolvePartnerLinkUrl({ ...baseSetting, isEnabled: false })).toBeNull();
  });
});
