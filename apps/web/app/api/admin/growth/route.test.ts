import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const runnerId = "11111111-1111-1111-1111-111111111111";
const organizerId = "22222222-2222-2222-2222-222222222222";
const eventId = "33333333-3333-3333-3333-333333333333";
const editionId = "44444444-4444-4444-4444-444444444444";
const paidEditionId = "55555555-5555-5555-5555-555555555555";
const adminId = "66666666-6666-6666-6666-666666666666";
const adminEventId = "77777777-7777-7777-7777-777777777777";
const adminEditionId = "88888888-8888-8888-8888-888888888888";

describe("GET /api/admin/growth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("rpc/get_admin_user_rows")) return Response.json([
        { user_id: runnerId, email: "runner@example.com", created_at: "2026-08-20T08:00:00.000Z", last_sign_in_at: "2026-08-25T08:00:00.000Z", app_metadata: {} },
        { user_id: organizerId, email: "club@example.com", created_at: "2026-08-01T08:00:00.000Z", last_sign_in_at: "2026-08-20T08:00:00.000Z", app_metadata: {} },
        { user_id: adminId, email: "admin@example.com", created_at: "2026-08-21T08:00:00.000Z", last_sign_in_at: "2026-08-30T08:00:00.000Z", app_metadata: { roles: ["admin"] } },
      ]);
      if (url.includes("race_plans")) return Response.json([
        { user_id: runnerId, created_at: "2026-08-20T12:00:00.000Z", updated_at: "2026-08-25T12:00:00.000Z" },
        { user_id: adminId, created_at: "2026-08-21T12:00:00.000Z", updated_at: "2026-08-26T12:00:00.000Z" },
      ]);
      if (url.includes("subscriptions")) return Response.json([]);
      if (url.includes("race_event_organizers")) return Response.json([
        { event_id: eventId, user_id: organizerId, role: "owner", created_at: "2026-08-01T08:00:00.000Z", revoked_at: null, created_by: organizerId },
        { event_id: adminEventId, user_id: adminId, role: "owner", created_at: "2026-08-02T08:00:00.000Z", revoked_at: null, created_by: adminId },
      ]);
      if (url.includes("race_events")) return Response.json([{ id: eventId, name: "Trail des Tests" }, { id: adminEventId, name: "Admin Demo" }]);
      if (url.includes("race_event_editions")) return Response.json([
        { id: editionId, event_id: eventId, created_at: "2026-08-01T08:00:00.000Z", updated_at: "2026-08-10T08:00:00.000Z" },
        { id: paidEditionId, event_id: eventId, created_at: "2026-08-02T08:00:00.000Z", updated_at: "2026-08-11T08:00:00.000Z" },
        { id: adminEditionId, event_id: adminEventId, created_at: "2026-08-03T08:00:00.000Z", updated_at: "2026-08-12T08:00:00.000Z" },
      ]);
      if (url.includes("/races?")) return Response.json([]);
      if (url.includes("organizer_edition_entitlements")) return Response.json([
        { edition_id: editionId, tier: "racebook", source: "admin", status: "active" },
        { edition_id: paidEditionId, tier: "pro", source: "stripe", status: "active" },
        { edition_id: adminEditionId, tier: "pro", source: "legacy_admin", status: "active" },
      ]);
      return Response.json({ message: `Unhandled URL: ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns Supabase growth metrics and organizer follow-ups", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/admin/growth?range=custom&start=2026-08-01&end=2026-08-31",
      { headers: { authorization: "Bearer admin-token" } }
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.overview).toMatchObject({
      newAccounts: 2,
      activatedUsers: 1,
      activePlanUsers: 1,
      newPlans: 1,
    });
    expect(payload.trend).toHaveLength(31);
    expect(payload.trend.find((point: { date: string }) => point.date === "2026-08-20")).toMatchObject({
      newAccounts: 1,
      activatedUsers: 1,
      newPlans: 1,
    });
    expect(payload).not.toHaveProperty("web");
    expect(payload).not.toHaveProperty("app");
    expect(payload.organizers).toMatchObject({
      newOrganizers: 1,
      activeOrganizers: 1,
      returningOrganizers: 1,
      eventsCreated: 1,
      formatsCreated: 0,
      activatedRacebooks: 2,
      giftedRacebooks: 1,
      paidRacebooks: 1,
    });
    expect(payload.organizers.followUps[0]).toMatchObject({
      eventId,
      eventName: "Trail des Tests",
      organizerEmail: "club@example.com",
      status: "no_format",
    });
    expect(payload.organizers.funnel[0]).toMatchObject({ step: "Nouveaux organisateurs", count: 1 });
    expect(payload.actions.map((action: { id: string }) => action.id)).not.toContain("configure-posthog-query");
  });
});

vi.mock("../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve({ id: "99999999-9999-9999-9999-999999999999", appMetadata: { role: "admin" } }),
  isAdminUser: () => true,
}));
