import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const authState = vi.hoisted(() => ({
  admin: false,
  requireOrganizerAuth: vi.fn(),
}));

const userId = "00000000-0000-0000-0000-000000000001";
const firstEventId = "11111111-1111-1111-1111-111111111111";
const secondEventId = "22222222-2222-2222-2222-222222222222";

const buildJsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });

const eventSummary = (id: string, name: string) => ({
  id,
  name,
  location: "Annecy",
  race_date: "2026-09-12",
  thumbnail_url: null,
  is_live: false,
});

const membership = (eventId: string, name: string) => ({
  id: eventId,
  created_at: "2026-08-25T10:00:00.000Z",
  event_id: eventId,
  role: "owner",
  dashboard_onboarding_completed_at: null,
  race_events: eventSummary(eventId, name),
});

const eventDetail = (id: string, name: string) => ({
  ...eventSummary(id, name),
  organizer_details: { officialWebsiteUrl: "https://trail.example" },
  race_event_editions: [],
  races: [],
});

const request = (eventId?: string) =>
  new NextRequest(`http://localhost/api/organizer/bootstrap${eventId ? `?eventId=${eventId}` : ""}`, {
    headers: { authorization: "Bearer user-token" },
  });

const installFetch = ({
  memberships = [],
  adminEvents = [],
  events = {},
}: {
  memberships?: unknown[];
  adminEvents?: unknown[];
  events?: Record<string, unknown>;
}) => {
  const mockFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/race_event_claims?")) return buildJsonResponse([]);
    if (url.includes("/race_event_organizers?")) return buildJsonResponse(memberships);
    if (url.includes("/race_event_edition_requests?")) return buildJsonResponse([]);
    if (url.includes("/race_event_publication_requests?")) return buildJsonResponse([]);
    if (url.includes("/race_events?select=")) return buildJsonResponse(adminEvents);
    if (url.includes("/race_events?id=eq.")) {
      const eventId = url.match(/race_events\?id=eq\.([^&]+)/)?.[1] ?? "";
      return buildJsonResponse(events[eventId] ? [events[eventId]] : []);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", mockFetch);
  return mockFetch;
};

describe("/api/organizer/bootstrap", () => {
  beforeEach(() => {
    authState.admin = false;
    authState.requireOrganizerAuth.mockReset().mockResolvedValue({
      user: { id: userId, appMetadata: { role: "user" } },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns claims data and the first membership event for a non-admin", async () => {
    const mockFetch = installFetch({
      memberships: [membership(firstEventId, "A Trail")],
      events: { [firstEventId]: eventDetail(firstEventId, "A Trail") },
    });

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      claims: [],
      memberships: [expect.objectContaining({
        event_id: firstEventId,
        role: "owner",
        dashboard_onboarding_completed_at: null,
      })],
      editionRequests: [],
      publicationRequests: [],
      event: expect.objectContaining({ id: firstEventId, organizerDetails: expect.any(Object) }),
    });
    expect(authState.requireOrganizerAuth).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });

  it("loads an explicitly selected event when the organizer membership allows it", async () => {
    installFetch({
      memberships: [membership(firstEventId, "A Trail"), membership(secondEventId, "B Trail")],
      events: { [secondEventId]: eventDetail(secondEventId, "B Trail") },
    });

    const response = await GET(request(secondEventId));
    expect(response.status).toBe(200);
    expect((await response.json()).event.id).toBe(secondEventId);
  });

  it("rejects an explicitly selected event outside the organizer memberships", async () => {
    const mockFetch = installFetch({ memberships: [membership(firstEventId, "A Trail")] });

    const response = await GET(request(secondEventId));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ message: "Not authorized for this event." });
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("lets an admin select any event from the complete event catalog", async () => {
    authState.admin = true;
    const mockFetch = installFetch({
      adminEvents: [eventSummary(firstEventId, "A Trail"), eventSummary(secondEventId, "B Trail")],
      events: { [secondEventId]: eventDetail(secondEventId, "B Trail") },
    });

    const response = await GET(request(secondEventId));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.memberships).toEqual([
      expect.objectContaining({ event_id: firstEventId, role: "admin" }),
      expect.objectContaining({ event_id: secondEventId, role: "admin" }),
    ]);
    expect(payload.event.id).toBe(secondEventId);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("returns a null event when the organizer has no active membership", async () => {
    const mockFetch = installFetch({});

    const response = await GET(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.memberships).toEqual([]);
    expect(payload.event).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("returns lightweight tile status summaries in the initial bootstrap", async () => {
    const editionId = "33333333-3333-4333-8333-333333333333";
    const raceId = "44444444-4444-4444-8444-444444444444";
    installFetch({
      memberships: [membership(firstEventId, "A Trail")],
      events: {
        [firstEventId]: {
          ...eventDetail(firstEventId, "A Trail"),
          race_event_editions: [{
            id: editionId,
            event_id: firstEventId,
            edition_year: 2026,
            start_date: "2026-09-12",
            end_date: "2026-09-13",
            is_current: true,
            is_visible: true,
            race_edition_services: [{ id: "55555555-5555-4555-8555-555555555555" }],
            race_event_edition_sponsors: [{ id: "66666666-6666-4666-8666-666666666666", is_active: true, click_count: 7 }],
            race_event_edition_branding: {
              edition_id: editionId,
              draft_logo_url: null,
              draft_primary_color: "#112233",
              draft_accent_color: "#445566",
              published_logo_url: null,
              published_primary_color: "#112233",
              published_accent_color: "#445566",
              published_at: "2026-09-01T10:00:00.000Z",
              updated_at: "2026-09-01T10:00:00.000Z",
            },
          }],
          races: [{
            id: raceId,
            edition_id: editionId,
            edition_group_id: "77777777-7777-4777-8777-777777777777",
            series_name: "42K",
            name: "42K",
            race_date: "2026-09-12",
            distance_km: 42,
            elevation_gain_m: 2100,
            is_live: true,
            race_aid_stations: [{ id: "88888888-8888-4888-8888-888888888888" }],
            race_start_waves: [{ id: "99999999-9999-4999-8999-999999999999" }],
            race_awards: [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
          }],
        },
      },
    });

    const response = await GET(request());
    const payload = await response.json();

    expect(payload.event.editions[0]).toMatchObject({
      serviceCount: 1,
      sponsorCount: 1,
      sponsorClicks: 7,
      brandingConfigured: true,
      brandingUnpublished: false,
    });
    expect(payload.event.races[0]).toMatchObject({ aidStationCount: 1, startWaveCount: 1, awardCount: 1 });
  });
});

vi.mock("../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireOrganizerAuth: authState.requireOrganizerAuth,
  serviceHeaders: () => ({
    apikey: "service-key",
    Authorization: "Bearer service-key",
  }),
}));

vi.mock("../../../../lib/supabase", () => ({
  isAdminUser: () => authState.admin,
}));

vi.mock("../../../../lib/organizer-entitlements", () => ({
  loadOrganizerEditionEntitlements: () => Promise.resolve({}),
}));
