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
      memberships: [expect.objectContaining({ event_id: firstEventId, role: "owner" })],
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
