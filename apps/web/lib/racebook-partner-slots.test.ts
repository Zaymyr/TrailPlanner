import { describe, expect, it } from "vitest";

import {
  buildPublishedPartnerSlots,
  listAffiliatePartnerSlots,
  racebookPartnerSlotUpdateSchema,
  toOrganizerPartnerSlots,
  toRunnerPartnerSlots,
  type RacebookPartnerSlotRow,
} from "./racebook-partner-slots";

const editionId = "7a110000-0000-4000-8000-000000000002";
const sponsorId = "7a110000-5001-4000-8000-000000000001";
const sponsor = { id: sponsorId, name: "Trail Shop", logo_url: "https://cdn.example.com/logo.png", website_url: "https://shop.example.com" };
const row = (overrides: Partial<RacebookPartnerSlotRow>): RacebookPartnerSlotRow => ({
  edition_id: editionId,
  slot_key: "equipment",
  mode: "partner",
  sponsor_id: sponsorId,
  headline: "-10 % coureurs",
  impression_count: 4,
  click_count: 1,
  ...overrides,
});

describe("buildPublishedPartnerSlots", () => {
  it("keeps every slot on its affiliate default without the sponsors module", () => {
    expect(buildPublishedPartnerSlots([row({})], [sponsor], false)).toEqual([]);
  });

  it("freezes partner and hidden slots, omitting affiliate ones", () => {
    const slots = buildPublishedPartnerSlots(
      [row({}), row({ slot_key: "lodging", mode: "hidden", sponsor_id: null, headline: null })],
      [sponsor],
      true,
    );
    expect(slots).toEqual([
      {
        slot: "equipment",
        mode: "partner",
        partner: { sponsorId, name: "Trail Shop", logoUrl: sponsor.logo_url, destinationUrl: sponsor.website_url, headline: "-10 % coureurs" },
      },
      { slot: "lodging", mode: "hidden", partner: null },
    ]);
  });

  it("falls back to the affiliate default when the partner sponsor is missing", () => {
    expect(buildPublishedPartnerSlots([row({})], [], true)).toEqual([]);
  });
});

describe("toRunnerPartnerSlots", () => {
  const published = buildPublishedPartnerSlots([row({})], [sponsor], true);
  const clickUrl = (slot: string) => `https://app.example.com/api/racebook-partner-slots/${slot}/click?raceId=r`;

  it("replaces the destination with a counted redirect", () => {
    expect(toRunnerPartnerSlots(published, true, clickUrl)).toEqual({
      equipment: { mode: "partner", name: "Trail Shop", logoUrl: sponsor.logo_url, headline: "-10 % coureurs", clickUrl: clickUrl("equipment") },
      lodging: { mode: "affiliate" },
    });
  });

  it("returns affiliate defaults when the edition lost the sponsors module", () => {
    expect(toRunnerPartnerSlots(published, false, clickUrl)).toEqual({ equipment: { mode: "affiliate" }, lodging: { mode: "affiliate" } });
  });
});

describe("listAffiliatePartnerSlots", () => {
  it("lists slots still showing Pace Yourself affiliate links", () => {
    expect(listAffiliatePartnerSlots([{ slot: "lodging", mode: "hidden", partner: null }])).toEqual([
      { slot: "equipment", label: "Matériel", partner: "Decathlon" },
    ]);
  });
});

describe("partner slot organizer contract", () => {
  it("defaults absent rows to the affiliate mode with zero counters", () => {
    expect(toOrganizerPartnerSlots([])).toEqual([
      expect.objectContaining({ slot: "equipment", mode: "affiliate", sponsorId: null, impressionCount: 0, clickCount: 0 }),
      expect.objectContaining({ slot: "lodging", mode: "affiliate" }),
    ]);
  });

  it("requires a sponsor for partner mode and normalizes the headline", () => {
    expect(racebookPartnerSlotUpdateSchema.safeParse({ slot: "equipment", mode: "partner" }).success).toBe(false);
    const parsed = racebookPartnerSlotUpdateSchema.parse({ slot: "lodging", mode: "partner", sponsorId, headline: "   " });
    expect(parsed).toMatchObject({ headline: null });
  });
});
