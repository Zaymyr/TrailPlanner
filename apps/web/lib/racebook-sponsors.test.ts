import { describe, expect, it } from "vitest";

import {
  MAX_RACEBOOK_LOADING_SPONSORS,
  MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES,
  MAX_RACEBOOK_SPONSORS_PER_EDITION,
  hasOrganizerRacebookContent,
  sponsorMetadataSchema,
} from "./racebook-sponsors";

describe("RaceBook sponsor validation", () => {
  it("keeps the configured edition and loading limits", () => {
    expect(MAX_RACEBOOK_SPONSORS_PER_EDITION).toBe(10);
    expect(MAX_RACEBOOK_LOADING_SPONSORS).toBe(2);
    expect(MAX_RACEBOOK_SPONSOR_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it("requires an HTTP(S) URL and a placement for active sponsors", () => {
    const base = { name: "Nivalis", isActive: true, showOnLoading: false, showInBanner: false, position: 0 };
    expect(sponsorMetadataSchema.safeParse({ ...base, websiteUrl: "ftp://example.com" }).success).toBe(false);
    expect(sponsorMetadataSchema.safeParse({ ...base, websiteUrl: "https://example.com" }).success).toBe(false);
    expect(sponsorMetadataSchema.safeParse({ ...base, websiteUrl: "https://example.com", showInBanner: true }).success).toBe(true);
  });

  it("detects whether a RaceBook has content worth presenting", () => {
    expect(hasOrganizerRacebookContent({}, {}, "solo")).toBe(false);
    expect(hasOrganizerRacebookContent({}, {}, "relay")).toBe(true);
    expect(hasOrganizerRacebookContent({ emergencyContact: { phone: "+33 6 00 00 00 00" } }, {}, "solo")).toBe(true);
  });
});
