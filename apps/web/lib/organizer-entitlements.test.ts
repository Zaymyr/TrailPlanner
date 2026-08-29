import { describe, expect, it } from "vitest";

import { hasOrganizerCapability, ORGANIZER_TIER_CAPABILITIES, type OrganizerTier } from "./organizer-entitlements";

const entitlement = (tier: OrganizerTier, status: "active" | "revoked" = "active") => ({ tier, status });

describe("organizer edition capabilities", () => {
  it("keeps the free tier limited to catalog management", () => {
    expect(ORGANIZER_TIER_CAPABILITIES.visibility).toEqual(["catalog.manage"]);
    expect(hasOrganizerCapability(entitlement("visibility"), "racebook.publish")).toBe(false);
    expect(hasOrganizerCapability(entitlement("visibility"), "edition.duplicate")).toBe(false);
  });

  it("lets RaceBook publish without enabling runner notifications", () => {
    expect(hasOrganizerCapability(entitlement("racebook"), "racebook.publish")).toBe(true);
    expect(hasOrganizerCapability(entitlement("racebook"), "followers.notify")).toBe(false);
    expect(hasOrganizerCapability(entitlement("racebook"), "relay.manage")).toBe(false);
  });

  it("enables every declared capability for Pro and rejects revoked rights", () => {
    for (const capability of ORGANIZER_TIER_CAPABILITIES.pro) {
      expect(hasOrganizerCapability(entitlement("pro"), capability)).toBe(true);
      expect(hasOrganizerCapability(entitlement("pro", "revoked"), capability)).toBe(false);
    }
  });
});
