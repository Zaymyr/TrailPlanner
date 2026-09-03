import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const eventId = "33333333-3333-3333-3333-333333333333";

const metrics = {
  overview: {
    newAccounts: 3,
    activationEligibleAccounts: 2,
    activatedUsers: 1,
    activePlanUsers: 1,
    newPlans: 1,
    activePremiumUsers: 4,
    premium: {
      paidSubscriptions: 2,
      appTrials: 2,
      grants: 1,
      effectiveUsers: 4,
      providers: { web: 1, apple: 1, google: 0 },
    },
  },
  trend: [{ date: "2026-08-20", newAccounts: 2, activationEligibleAccounts: 1, activatedUsers: 1, activePlanUsers: 1, newPlans: 1 }],
  organizers: {
    newOrganizers: 1,
    activeOrganizers: 1,
    returningOrganizers: 1,
    eventsCreated: 1,
    editionsCreated: 1,
    formatsCreated: 1,
    publishedRacebooks: 0,
    activatedRacebooks: 2,
    giftedRacebooks: 1,
    paidRacebooks: 1,
    commercial: {
      checkoutsStarted: 4,
      checkoutCohortPaid: 3,
      checkoutConversion: 75,
      paidTransactions: 3,
      grossRevenueMinor: 59640,
      invalidatedTransactions: 1,
      invalidatedRevenueMinor: 11880,
      netRevenueMinor: 47760,
      currency: "eur",
      racebookSales: 1,
      proDirectSales: 1,
      proUpgradeSales: 1,
    },
    funnel: [
      { step: "Événements de la cohorte", count: 1, conversionFromPrevious: null },
      { step: "Avec une édition", count: 1, conversionFromPrevious: 100 },
      { step: "Avec un format complet", count: 1, conversionFromPrevious: 100 },
      { step: "Avec un RaceBook publié", count: 0, conversionFromPrevious: 0 },
    ],
    followUps: [{
      eventId,
      eventName: "Trail des Tests",
      organizerEmail: "club@example.com",
      lastActivityAt: "2026-08-20T08:00:00.000Z",
      status: "ready_to_publish",
      daysInactive: 14,
    }],
  },
};

describe("GET /api/admin/growth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("rpc/get_admin_growth_metrics")) return Response.json(metrics);
      return Response.json({ message: `Unhandled URL: ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads a bounded Europe/Paris aggregate and exposes mature activation and Premium details", async () => {
    const response = await GET(new NextRequest(
      "http://localhost/api/admin/growth?range=custom&start=2026-08-01&end=2026-08-31",
      { headers: { authorization: "Bearer admin-token" } }
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.overview).toMatchObject({
      newAccounts: 3,
      activationEligibleAccounts: 2,
      activatedUsers: 1,
      activePremiumUsers: 4,
      premium: { paidSubscriptions: 2, appTrials: 2, grants: 1, effectiveUsers: 4 },
    });
    expect(payload.organizers.funnel.map((row: { count: number }) => row.count)).toEqual([1, 1, 1, 0]);
    expect(payload.organizers.commercial).toMatchObject({
      checkoutsStarted: 4,
      checkoutConversion: 75,
      netRevenueMinor: 47760,
    });
    expect(payload.actions[0]).toMatchObject({ id: "organizer-follow-ups", severity: "critical" });

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    expect(String(fetchCall[0])).toContain("rpc/get_admin_growth_metrics");
    expect(JSON.parse(String(fetchCall[1]?.body))).toEqual({
      p_start_date: "2026-08-01",
      p_end_date: "2026-09-01",
      p_timezone: "Europe/Paris",
    });
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
