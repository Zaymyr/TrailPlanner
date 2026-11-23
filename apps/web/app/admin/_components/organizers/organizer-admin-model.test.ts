import { describe, expect, it } from "vitest";

import {
  activeTier,
  editionLinks,
  editionPendingRequests,
  editionRacebookCounts,
  eventMembers,
  filterPublicationEvents,
  pageNumbersAround,
  publicationRequestMatches,
  readEditionDrawer,
  writeEditionDrawer,
  type OrganizerClaim,
  type OrganizerEditionRequest,
  type OrganizerMembership,
  type OrganizerPublicationRequest,
  type RacebookPublicationEvent,
} from "./organizer-admin-model";

const EVENT = "11111111-1111-4111-8111-111111111111";
const EDITION_2026 = "22222222-2222-4222-8222-222222222222";
const EDITION_2025 = "33333333-3333-4333-8333-333333333333";

const edition = (patch: Partial<RacebookPublicationEvent>): RacebookPublicationEvent => ({
  id: EVENT,
  name: "Trail des Écrins",
  location: "Briançon",
  race_date: "2026-07-12",
  editionId: EDITION_2026,
  editionYear: 2026,
  editionSlug: "trail-des-ecrins-2026",
  isCurrentEdition: true,
  entitlement: { edition_id: EDITION_2026, tier: "complete", source: "stripe", status: "active" },
  featureGrants: [],
  invoices: [],
  payments: [],
  races: [
    { id: "race-42", name: "Marathon", racebook_is_live: true, racebook_publication_approved_at: "2026-05-01", data_status: "complete" },
    { id: "race-20", name: "Découverte", racebook_is_live: false, racebook_publication_approved_at: null, data_status: "draft" },
  ],
  ...patch,
});

const current = edition({});
const previous = edition({ editionId: EDITION_2025, editionYear: 2025, isCurrentEdition: false, entitlement: { edition_id: EDITION_2025, tier: "essential", source: "admin", status: "revoked" }, races: [{ id: "race-old", name: "Ultra", racebook_is_live: false }] });

describe("organizer admin model", () => {
  it("resolves the active pack (a revoked right is Visibilité)", () => {
    expect(activeTier(current)).toBe("complete");
    expect(activeTier(previous)).toBe("visibility");
    expect(activeTier({ entitlement: null })).toBe("visibility");
  });

  it("filters editions by `?edition=`, pack and accent-insensitive search (formats included)", () => {
    const events = [current, previous];
    expect(filterPublicationEvents(events, { editionId: EDITION_2025, tier: "all", search: "" })).toEqual([previous]);
    expect(filterPublicationEvents(events, { editionId: null, tier: "visibility", search: "" })).toEqual([previous]);
    expect(filterPublicationEvents(events, { editionId: null, tier: "all", search: "ecrins 2026" })).toEqual([current]);
    expect(filterPublicationEvents(events, { editionId: null, tier: "all", search: "decouverte" })).toEqual([current]);
    expect(filterPublicationEvents(events, { editionId: null, tier: "all", search: "chamonix" })).toEqual([]);
  });

  it("matches a publication request to an edition by format, else to the current edition", () => {
    const byFormat = { id: "p1", event_id: EVENT, race_id: "race-old" } as OrganizerPublicationRequest;
    const byEvent = { id: "p2", event_id: EVENT, race_id: null } as OrganizerPublicationRequest;
    expect(publicationRequestMatches(byFormat, previous)).toBe(true);
    expect(publicationRequestMatches(byFormat, current)).toBe(false);
    expect(publicationRequestMatches(byEvent, current)).toBe(true);
    expect(publicationRequestMatches(byEvent, previous)).toBe(false);
  });

  it("gathers the pending requests and members of an edition", () => {
    const claims = [{ id: "c1", event_id: EVENT }, { id: "c2", event_id: "other" }] as OrganizerClaim[];
    const editionRequests = [{ id: "e1", event_id: EVENT }] as OrganizerEditionRequest[];
    const publicationRequests = [{ id: "p1", event_id: EVENT, race_id: "race-42" }, { id: "p2", event_id: EVENT, race_id: "race-old" }] as OrganizerPublicationRequest[];
    const pending = editionPendingRequests(current, { claims, editionRequests, publicationRequests });
    expect(pending.claims.map((claim) => claim.id)).toEqual(["c1"]);
    expect(pending.editionRequests.map((request) => request.id)).toEqual(["e1"]);
    expect(pending.publicationRequests.map((request) => request.id)).toEqual(["p1"]);
    const memberships = [{ id: "m1", event_id: EVENT }, { id: "m2", event_id: EVENT, revoked_at: "2026-01-01" }, { id: "m3", event_id: "other" }] as OrganizerMembership[];
    expect(eventMembers(EVENT, memberships).map((member) => member.id)).toEqual(["m1"]);
  });

  it("counts the Racebook state of the formats", () => {
    expect(editionRacebookCounts(current)).toEqual({ formats: 2, published: 1, approved: 1, complete: 1 });
  });

  it("reads and writes the drawer URL and keeps the other parameters", () => {
    expect(readEditionDrawer(`?vue=publication&edition=${EDITION_2026.toUpperCase()}&fiche=facturation`)).toEqual({ editionId: EDITION_2026, tab: "facturation" });
    expect(readEditionDrawer("?edition=abc&fiche=inconnu")).toEqual({ editionId: null, tab: "resume" });
    expect(writeEditionDrawer("?vue=acces", EDITION_2026, "pack")).toBe(`?vue=acces&edition=${EDITION_2026}&fiche=pack`);
    expect(writeEditionDrawer(`?edition=${EDITION_2026}&fiche=pack`, EDITION_2025)).toBe(`?edition=${EDITION_2025}`);
    expect(writeEditionDrawer(`?vue=acces&edition=${EDITION_2026}&fiche=pack`, null)).toBe("?vue=acces");
    expect(writeEditionDrawer(`?edition=${EDITION_2026}`, null)).toBe("");
  });

  it("links to the organizer space and the public page", () => {
    expect(editionLinks(current)).toEqual({ organizerHref: `/organizer?eventId=${EVENT}`, publicHref: "/courses/evenements/trail-des-ecrins-2026" });
    expect(editionLinks({ id: EVENT, editionSlug: null }).publicHref).toBeNull();
  });

  it("numbers the pages around the current one", () => {
    expect(pageNumbersAround(1, 1)).toEqual([1]);
    expect(pageNumbersAround(5, 9)).toEqual([1, 4, 5, 6, 9]);
    expect(pageNumbersAround(1, 3)).toEqual([1, 2, 3]);
  });
});
