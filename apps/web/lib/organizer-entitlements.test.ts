import { describe, expect, it } from "vitest";

import {
  hasEffectiveOrganizerCapability,
  hasOrganizerCapability,
  ORGANIZER_TIER_CAPABILITIES,
  resolveOrganizerCapabilityAccess,
  type OrganizerTier,
} from "./organizer-entitlements";

const entitlement = (tier: OrganizerTier, status: "active" | "revoked" = "active") => ({ tier, status });

describe("organizer edition capabilities", () => {
  it("keeps the free tier limited to catalog management", () => {
    expect(ORGANIZER_TIER_CAPABILITIES.visibility).toEqual(["catalog.manage"]);
    expect(hasOrganizerCapability(entitlement("visibility"), "racebook.publish")).toBe(false);
    expect(hasOrganizerCapability(entitlement("visibility"), "edition.duplicate")).toBe(false);
  });

  it("lets Essential publish basic content only", () => {
    expect(hasOrganizerCapability(entitlement("essential"), "racebook.publish")).toBe(true);
    expect(hasOrganizerCapability(entitlement("essential"), "racebook_content.basic.manage")).toBe(true);
    expect(hasOrganizerCapability(entitlement("essential"), "followers.notify")).toBe(false);
    expect(hasOrganizerCapability(entitlement("essential"), "relay.manage")).toBe(false);
  });

  it("adds advanced operations at Complete", () => {
    expect(hasOrganizerCapability(entitlement("complete"), "racebook_content.advanced.manage")).toBe(true);
    expect(hasOrganizerCapability(entitlement("complete"), "followers.notify")).toBe(true);
    expect(hasOrganizerCapability(entitlement("complete"), "edition.duplicate")).toBe(true);
    expect(hasOrganizerCapability(entitlement("complete"), "branding.manage")).toBe(false);
    expect(hasOrganizerCapability(entitlement("complete"), "racebook_analytics.view")).toBe(false);
  });

  it("enables every declared capability for Signature and rejects revoked rights", () => {
    for (const capability of ORGANIZER_TIER_CAPABILITIES.signature) {
      expect(hasOrganizerCapability(entitlement("signature"), capability)).toBe(true);
      expect(hasOrganizerCapability(entitlement("signature", "revoked"), capability)).toBe(false);
    }
    expect(hasOrganizerCapability(entitlement("signature"), "racebook_analytics.view")).toBe(true);
  });

  it("supplements a lower tier with an active complimentary analytics grant", () => {
    const activeGrant = [{ capabilityKey: "racebook_analytics.view" as const, status: "active" as const }];

    expect(hasEffectiveOrganizerCapability(entitlement("essential"), activeGrant, "racebook_analytics.view")).toBe(true);
    expect(resolveOrganizerCapabilityAccess(entitlement("essential"), activeGrant, "racebook_analytics.view")).toEqual({
      allowed: true,
      source: "complimentary",
    });
    expect(resolveOrganizerCapabilityAccess(entitlement("signature"), activeGrant, "racebook_analytics.view")).toEqual({
      allowed: true,
      source: "tier",
    });
  });

  it("does not let revoked or unrelated grants unlock a capability", () => {
    const revokedGrant = [{ capabilityKey: "racebook_analytics.view" as const, status: "revoked" as const }];

    expect(hasEffectiveOrganizerCapability(entitlement("essential"), revokedGrant, "racebook_analytics.view")).toBe(false);
    expect(hasEffectiveOrganizerCapability(entitlement("essential"), [], "branding.manage")).toBe(false);
  });
});
