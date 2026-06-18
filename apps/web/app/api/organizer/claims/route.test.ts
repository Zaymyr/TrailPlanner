import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const claimRequest = (body: Record<string, unknown> = {}) =>
  new NextRequest("http://localhost/api/organizer/claims", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

const claimsGetRequest = () =>
  new NextRequest("http://localhost/api/organizer/claims", {
    method: "GET",
    headers: {
      authorization: "Bearer user-token",
    },
  });

describe("/api/organizer/claims", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a pending claim for the authenticated user", async () => {
    const mockFetch = vi.mocked(fetch);
    const eventId = "11111111-1111-1111-1111-111111111111";

    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([{ id: eventId }]))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse(
          [
            {
              id: "22222222-2222-2222-2222-222222222222",
              created_at: "2026-05-28T10:00:00.000Z",
              event_id: eventId,
              organization_name: "Trail Org",
              role_title: "Race director",
              contact_email: "orga@example.com",
              official_site_url: "https://example.com",
              message: "We organize this race.",
              status: "pending",
            },
          ],
          { status: 201 }
        )
      );

    const response = await POST(
      claimRequest({
        eventId,
        organizationName: "Trail Org",
        roleTitle: "Race director",
        contactEmail: "orga@example.com",
        officialSiteUrl: "https://example.com",
        message: "We organize this race.",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.claim.status).toBe("pending");

    const insertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_claims") && init?.method === "POST"
    );
    expect(insertCall).toBeDefined();
    const insertBody = JSON.parse(insertCall?.[1]?.body as string);
    expect(insertBody).toMatchObject({
      user_id: "00000000-0000-0000-0000-000000000001",
      event_id: eventId,
      organization_name: "Trail Org",
      status: "pending",
    });
  });

  it("creates a draft event before creating a manual organizer claim", async () => {
    const mockFetch = vi.mocked(fetch);
    const eventId = "11111111-1111-1111-1111-111111111111";

    mockFetch
      .mockResolvedValueOnce(buildJsonResponse([{ id: eventId }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse([]))
      .mockResolvedValueOnce(
        buildJsonResponse(
          [
            {
              id: "22222222-2222-2222-2222-222222222222",
              created_at: "2026-05-28T10:00:00.000Z",
              event_id: eventId,
              organization_name: "Trail Org",
              role_title: "Race director",
              contact_email: "orga@example.com",
              official_site_url: "https://example.com",
              message: "We organize this missing race.",
              status: "pending",
            },
          ],
          { status: 201 }
        )
      );

    const response = await POST(
      claimRequest({
        manualEvent: {
          name: "Grand Trail des Cretes",
          location: "Annecy",
          raceDate: "2026-09-12",
        },
        organizationName: "Trail Org",
        roleTitle: "Race director",
        contactEmail: "orga@example.com",
        officialSiteUrl: "https://example.com",
        message: "We organize this missing race.",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.claim.event_id).toBe(eventId);

    const eventInsertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).endsWith("/rest/v1/race_events") && init?.method === "POST"
    );
    expect(eventInsertCall).toBeDefined();
    const eventInsertBody = JSON.parse(eventInsertCall?.[1]?.body as string);
    expect(eventInsertBody).toMatchObject({
      name: "Grand Trail des Cretes",
      location: "Annecy",
      race_date: "2026-09-12",
      thumbnail_url: null,
      is_live: false,
    });

    const claimInsertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_claims") && init?.method === "POST"
    );
    const claimInsertBody = JSON.parse(claimInsertCall?.[1]?.body as string);
    expect(claimInsertBody).toMatchObject({
      user_id: "00000000-0000-0000-0000-000000000001",
      event_id: eventId,
      status: "pending",
    });
  });

  it("returns open memberships with claims for the organizer dashboard", async () => {
    const mockFetch = vi.mocked(fetch);
    const eventId = "11111111-1111-1111-1111-111111111111";

    mockFetch
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "22222222-2222-2222-2222-222222222222",
            created_at: "2026-05-28T10:00:00.000Z",
            event_id: eventId,
            organization_name: "Trail Org",
            role_title: "Race director",
            contact_email: "orga@example.com",
            status: "approved",
            race_events: { id: eventId, name: "Grand Trail", location: "Annecy", race_date: "2026-06-20" },
          },
        ])
      )
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: "33333333-3333-3333-3333-333333333333",
            created_at: "2026-05-28T10:05:00.000Z",
            event_id: eventId,
            role: "owner",
            race_events: { id: eventId, name: "Grand Trail", location: "Annecy", race_date: "2026-06-20" },
          },
        ])
      );

    const response = await GET(claimsGetRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.claims).toHaveLength(1);
    expect(payload.memberships).toHaveLength(1);
    expect(payload.memberships[0].event_id).toBe(eventId);
  });
});

vi.mock("../../../../lib/http", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../lib/http")>();
  return {
    ...original,
    checkRateLimitAsync: () => Promise.resolve({ allowed: true, remaining: 8 }),
    withSecurityHeaders: (response: Response) => response,
  };
});

vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({
    supabaseUrl: "https://supabase.example",
    supabaseServiceRoleKey: "service-key",
  }),
  extractBearerToken: () => "user-token",
  fetchSupabaseUser: () =>
    Promise.resolve({
      id: "00000000-0000-0000-0000-000000000001",
      email: "organizer@example.com",
      appMetadata: { role: "user" },
    }),
  isAdminUser: () => false,
}));
