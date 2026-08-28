import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicRaces, permanentRedirect, resolvePublicRaceSlug } = vi.hoisted(() => ({
  getPublicRaces: vi.fn(),
  permanentRedirect: vi.fn(),
  resolvePublicRaceSlug: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
  permanentRedirect,
}));

vi.mock("../../../lib/public-races", () => ({
  getPublicRaces,
  resolvePublicRaceSlug,
}));

import RacePage, { generateMetadata } from "./page";

const canonicalRace = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: null,
  slug: "trail-canonique",
  name: "Trail canonique",
  eventName: null,
  date: "2026-09-12",
  location: "Annecy",
  distanceKm: 42,
  elevationGainM: 2100,
  thumbnailUrl: null,
  externalSiteUrl: null,
};

describe("public race legacy slug page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permanentRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("uses canonical metadata for a known old slug", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: true });

    const metadata = await generateMetadata({ params: { slug: "ancien-trail" } });

    expect(metadata.alternates).toEqual({ canonical: "/courses/trail-canonique" });
    expect(metadata.robots).toBeUndefined();
  });

  it("keeps unknown slugs out of the index", async () => {
    resolvePublicRaceSlug.mockResolvedValue(null);

    await expect(generateMetadata({ params: { slug: "course-inconnue" } })).resolves.toEqual({
      title: "Course introuvable",
      robots: { index: false, follow: false },
    });
  });

  it("permanently redirects before loading the surrounding catalog", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: true });

    await expect(RacePage({ params: { slug: "ancien-trail" } })).rejects.toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/courses/trail-canonique");
    expect(getPublicRaces).not.toHaveBeenCalled();
  });
});
