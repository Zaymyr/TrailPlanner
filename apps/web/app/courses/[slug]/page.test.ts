import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublicRaceDetail, getPublicRaces, permanentRedirect, resolvePublicRaceSlug } = vi.hoisted(() => ({
  getPublicRaceDetail: vi.fn(),
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

vi.mock("../../../lib/public-race-detail", () => ({ getPublicRaceDetail }));

import RacePage, { generateMetadata } from "./page";

const canonicalRace = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: null,
  editionId: null,
  slug: "trail-canonique",
  name: "Trail canonique",
  eventName: null,
  date: "2026-09-12",
  location: "Annecy",
  distanceKm: 42,
  elevationGainM: 2100,
  raceThumbnailUrl: null,
  eventThumbnailUrl: null,
  thumbnailUrl: null,
  externalSiteUrl: null,
};

const detailedRace = {
  ...canonicalRace,
  elevationLossM: 1800,
  minAltitudeM: 450,
  maxAltitudeM: 2350,
  participationMode: "solo" as const,
  eventEndDate: null,
  officialWebsiteUrl: "https://event.example.com",
  instagramUrl: null,
  facebookUrl: null,
  routePreview: null,
  aidStations: [],
  practical: {
    schedule: { startTime: null, finishCutoffTime: null, cutoffNote: null, note: null },
    equipment: { items: [], note: null },
    bibPickup: {
      locations: [],
      schedule: null,
      requiredDocuments: null,
      thirdPartyPickupAllowed: null,
      equipmentCheck: null,
      note: null,
    },
    access: {
      startAddress: null,
      startLocation: { label: null, googleMapsUrl: null },
      finishAddress: null,
      finishLocation: { label: null, googleMapsUrl: null },
      officialParkings: null,
      shuttles: null,
      shuttleSchedule: null,
      roadRestrictions: null,
      mapUrl: null,
      note: null,
    },
    runnerInfo: { startArea: null, briefing: null, rules: null, note: null },
    services: {
      supporters: null,
      accommodations: null,
      restaurants: null,
      recovery: null,
      partners: null,
      note: null,
    },
  },
};

function hasHref(node: unknown, href: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => hasHref(child, href));
  const props = (node as { props?: { href?: unknown; children?: unknown } }).props;
  return props?.href === href || hasHref(props?.children, href);
}

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

  it("uses the preferred format image in Open Graph and Twitter metadata", async () => {
    resolvePublicRaceSlug.mockResolvedValue({
      race: {
        ...canonicalRace,
        raceThumbnailUrl: "https://images.example.com/format.jpg",
        eventThumbnailUrl: "https://images.example.com/event.jpg",
        thumbnailUrl: "https://images.example.com/format.jpg",
      },
      shouldRedirect: false,
    });

    const metadata = await generateMetadata({ params: { slug: canonicalRace.slug } });

    expect(metadata.openGraph).toEqual(expect.objectContaining({
      images: [{ url: "https://images.example.com/format.jpg", alt: canonicalRace.name }],
    }));
    expect(metadata.twitter).toEqual(expect.objectContaining({
      card: "summary_large_image",
      images: ["https://images.example.com/format.jpg"],
    }));
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

  it("links directly to a planner preselected with the catalog race id", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: false });
    getPublicRaceDetail.mockResolvedValue(detailedRace);
    getPublicRaces.mockResolvedValue([canonicalRace]);

    const page = await RacePage({ params: { slug: canonicalRace.slug } });

    expect(hasHref(page, `/race-planner?catalogRaceId=${canonicalRace.id}`)).toBe(true);
  });
});
