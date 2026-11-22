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

import { DEMO_EVENT_ID } from "../../../lib/demo-race";
import RacePage, { generateMetadata, generateStaticParams } from "./page";
import { buildEventEditionMetadataTitle, buildRaceMetadataDescription, buildRaceMetadataTitle } from "./race-metadata";

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
  eventWebsiteUrl: "https://event.example.com",
  updatedAt: "2026-09-09T12:00:00.000Z",
};

const detailedRace = {
  ...canonicalRace,
  racebookAvailableInApp: true,
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

function hasProp(node: unknown, key: string, value: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((child) => hasProp(child, key, value));
  const props = (node as { props?: Record<string, unknown> }).props;
  return props?.[key] === value || hasProp(props?.children, key, value);
}

function collectJsonLd(node: unknown): string[] {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(collectJsonLd);
  const props = (node as { props?: { children?: unknown; dangerouslySetInnerHTML?: { __html?: string } } }).props;
  const own = props?.dangerouslySetInnerHTML?.__html;
  return [...(own ? [own] : []), ...collectJsonLd(props?.children)];
}

describe("public race legacy slug page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permanentRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("defers course generation until the first request", async () => {
    await expect(generateStaticParams()).resolves.toEqual([]);
    expect(getPublicRaces).not.toHaveBeenCalled();
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

  it("falls back to the shared large social image when the race has no image", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: false });

    const metadata = await generateMetadata({ params: { slug: canonicalRace.slug } });

    expect(metadata.openGraph).toEqual(expect.objectContaining({
      images: [expect.objectContaining({ url: "/branding/social-preview-v2.png" })],
    }));
    expect(metadata.twitter).toEqual(expect.objectContaining({
      card: "summary_large_image",
      images: ["/branding/social-preview-v2.png"],
    }));
  });

  it("keeps edition years distinct and metadata within snippet limits", () => {
    const longRace = {
      ...canonicalRace,
      name: "Le Muratori avec un nom de format particulièrement long pour cette édition alpine",
      location: "Une commune française au nom particulièrement long",
    };
    const nextEdition = { ...longRace, date: "2027-09-12" };

    const currentTitle = buildRaceMetadataTitle(longRace);
    const nextTitle = buildRaceMetadataTitle(nextEdition);

    expect(currentTitle).not.toBe(nextTitle);
    expect(currentTitle).toContain("2026");
    expect(nextTitle).toContain("2027");
    expect(currentTitle.length).toBeLessThanOrEqual(60);
    expect(nextTitle.length).toBeLessThanOrEqual(60);
    expect(buildRaceMetadataDescription(longRace).length).toBeLessThanOrEqual(160);
  });

  it("keeps long sibling format titles distinct after truncation", () => {
    const shared = {
      ...canonicalRace,
      eventName: "Ultra-Trail du Mont-Blanc avec un nom d’événement volontairement très long",
      date: "2027-08-29",
      distanceKm: 57,
    };
    const occ = buildRaceMetadataTitle({
      ...shared,
      name: `${shared.eventName} — format montagne OCC`,
    });
    const relay = buildRaceMetadataTitle({
      ...shared,
      name: `${shared.eventName} — format montagne RELAIS`,
    });

    expect(occ).not.toBe(relay);
    expect(occ).toContain("OCC");
    expect(relay).toContain("RELAIS");
    expect(occ).toContain("57 km · 2027");
    expect(occ.length).toBeLessThanOrEqual(60);
    expect(relay.length).toBeLessThanOrEqual(60);
  });

  it("uses distance to distinguish otherwise identical long race names", () => {
    const shared = {
      ...canonicalRace,
      name: "Trail international avec un nom de course volontairement très long",
      date: "2027-05-01",
    };
    const shortFormat = buildRaceMetadataTitle({ ...shared, distanceKm: 42 });
    const ultraFormat = buildRaceMetadataTitle({ ...shared, distanceKm: 100 });

    expect(shortFormat).not.toBe(ultraFormat);
    expect(shortFormat).toContain("42 km · 2027");
    expect(ultraFormat).toContain("100 km · 2027");
  });

  it("does not repeat a distance already in the name and adds the estimate hook when it fits", () => {
    const title = buildRaceMetadataTitle({ ...canonicalRace, name: "SaintéLyon — 80 km", distanceKm: 80, date: "2026-11-28" });

    expect(title).toBe("SaintéLyon — 80 km | 2026 · temps & ravitos");
  });

  it("prefixes a generic format name with its event so titles stay unique", () => {
    const lyon = buildRaceMetadataTitle({ ...canonicalRace, name: "10 km", eventName: "Run In Lyon", distanceKm: 10, date: "2026-10-04" });
    const night = buildRaceMetadataTitle({ ...canonicalRace, name: "10 km", eventName: "LUT by Night", distanceKm: 10, date: "2026-10-04" });

    expect(lyon).toBe("Run In Lyon — 10 km | 2026 · temps & ravitos");
    expect(night).not.toBe(lyon);
    expect(buildRaceMetadataDescription({ ...canonicalRace, name: "10 km", eventName: "Run In Lyon" })).toMatch(/^Run In Lyon — 10 km :/);
    expect(buildRaceMetadataTitle({ ...canonicalRace, name: "SaintéLyon — 80 km", eventName: "SaintéLyon", distanceKm: 80, date: "2026-11-28" }))
      .toBe("SaintéLyon — 80 km | 2026 · temps & ravitos");
  });

  it("keeps event-edition titles within 60 characters with the year", () => {
    expect(buildEventEditionMetadataTitle("Trail TST", 2026)).toBe("Trail TST 2026 : formats, parcours et ravitos");
    expect(buildEventEditionMetadataTitle("Run In Lyon by Harmonie Mutuelle", 2026)).toBe("Run In Lyon by Harmonie Mutuelle 2026 : parcours et ravitos");
    const long = buildEventEditionMetadataTitle("JD Ultra-Trail Great Wall by UTMB® avec un nom vraiment très très long", 2026);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith(" 2026")).toBe(true);
    expect(buildEventEditionMetadataTitle("Trail 2026", 2026)).toBe("Trail 2026 : formats, parcours et ravitos");
  });

  it("puts the reference finishing-time range in the search snippet", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: false });
    getPublicRaceDetail.mockResolvedValue(detailedRace);

    const metadata = await generateMetadata({ params: { slug: canonicalRace.slug } });

    expect(metadata.description).toMatch(/Temps estimé de \d+ h \d{2} à \d+ h \d{2} selon ton niveau/);
    expect((metadata.description as string).length).toBeLessThanOrEqual(160);
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

  it("links the registration action to the event website", async () => {
    resolvePublicRaceSlug.mockResolvedValue({ race: canonicalRace, shouldRedirect: false });
    getPublicRaceDetail.mockResolvedValue(detailedRace);
    getPublicRaces.mockResolvedValue([canonicalRace]);

    const page = await RacePage({ params: { slug: canonicalRace.slug } });

    expect(hasHref(page, canonicalRace.eventWebsiteUrl)).toBe(true);
  });

  it("keeps the Trail TST demo reachable but noindex, labelled and without official links", async () => {
    const demoRace = { ...canonicalRace, eventId: DEMO_EVENT_ID, eventName: "Trail TST" };
    resolvePublicRaceSlug.mockResolvedValue({ race: demoRace, shouldRedirect: false });
    getPublicRaceDetail.mockResolvedValue({ ...detailedRace, ...demoRace });
    getPublicRaces.mockResolvedValue([demoRace]);

    const metadata = await generateMetadata({ params: { slug: canonicalRace.slug } });
    const page = await RacePage({ params: { slug: canonicalRace.slug } });

    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(hasHref(page, canonicalRace.eventWebsiteUrl)).toBe(false);
    expect(hasProp(page, "isDemo", true)).toBe(true);
    expect(collectJsonLd(page).some((json) => json.includes("SportsEvent"))).toBe(false);
  });

  it("writes distances with a French decimal comma in the description", () => {
    expect(buildRaceMetadataDescription({ ...canonicalRace, distanceKm: 158.68 })).toContain("158,68 km");
  });
});
