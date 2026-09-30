import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { filterOrganizerSocialProofEditions } from "./AdminOrganizerSocialProofsTab";

const editions = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    eventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    eventName: "Trail du Château",
    editionYear: 2026,
    startDate: "2026-05-01",
    endDate: "2026-05-02",
    location: "Lyon",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    eventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    eventName: "Ultra des Crêtes",
    editionYear: 2025,
    startDate: "2025-08-10",
    endDate: "2025-08-10",
    location: "Annecy",
  },
];

describe("Admin Organizer social-proof edition search", () => {
  it("filters editions by accent-insensitive trail name, year, and location", () => {
    expect(filterOrganizerSocialProofEditions(editions, "chateau")).toEqual([editions[0]]);
    expect(filterOrganizerSocialProofEditions(editions, "2025 annecy")).toEqual([editions[1]]);
    expect(filterOrganizerSocialProofEditions(editions, "trail lyon 2026")).toEqual([editions[0]]);
  });

  it("returns every edition for an empty query", () => {
    expect(filterOrganizerSocialProofEditions(editions, "   ")).toEqual(editions);
  });

  it("renders the edition picker as an accessible search combobox", () => {
    const source = readFileSync(resolve(process.cwd(), "app/admin/_components/AdminOrganizerSocialProofsTab.tsx"), "utf8");

    expect(source).toContain('role="combobox"');
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain("Rechercher un trail, une année ou un lieu…");
    expect(source).not.toContain('<select\n          id="social-proof-edition"');
  });
});
