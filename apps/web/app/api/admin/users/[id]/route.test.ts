import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const USER = "22222222-2222-4222-8222-222222222222";
const RACE = "33333333-3333-4333-8333-333333333333";
const request = () => new Request(`http://localhost/api/admin/users/${USER}`, { headers: { authorization: "Bearer admin" } });
const call = (id = USER) => GET(request(), { params: { id } });

let failing: string | null = null;
let missingUser = false;

describe("GET /api/admin/users/[id]", () => {
  beforeEach(() => {
    failing = null;
    missingUser = false;
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase } });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      if (failing && url.includes(failing)) return new Response("", { status: 500 });
      if (url.includes(`/auth/v1/admin/users/${USER}`)) {
        return missingUser
          ? new Response("", { status: 404 })
          : Response.json({ id: USER, email: "camille@gmail.com", created_at: "2026-01-01T00:00:00.000Z", last_sign_in_at: "2026-11-20T00:00:00.000Z", app_metadata: { role: "user" } });
      }
      if (url.includes("/user_profiles?")) return Response.json([{ user_id: USER, full_name: "Camille", sign_in_count: 4, onboarding_completed_at: "2026-01-02T00:00:00.000Z" }]);
      if (url.includes("/subscriptions?")) return Response.json([]);
      if (url.includes("/premium_grants?")) return Response.json([{ id: "g1", user_id: USER, starts_at: new Date(Date.now() - 86_400_000).toISOString(), initial_duration_days: 30, reason: "support", ends_at: null }]);
      if (url.includes("/race_plans?") && url.includes("limit=1")) return new Response("[]", { status: 200, headers: { "content-range": "0-0/3" } });
      if (url.includes("/race_plans?")) return Response.json([{ id: "p1", name: "UTMB", created_at: "2026-10-01T00:00:00.000Z", updated_at: "2026-10-02T00:00:00.000Z" }]);
      if (url.includes("/runner_plan_unlocks?")) return Response.json([{ id: "u1", user_id: USER, plan_key: `race:${RACE}:edition:x`, provider: "stripe", provider_transaction_id: "pi_1", status: "active", purchased_at: "2026-11-01T00:00:00.000Z" }]);
      if (url.includes("/runner_subscription_accounts?")) return Response.json([]);
      if (url.includes("/runner_support_purchases?")) return Response.json([]);
      if (url.includes("/races?")) return Response.json([{ id: RACE, name: "La Sainté-Lyon" }]);
      if (url.includes("/user_notifications?")) return Response.json([]);
      if (url.includes("/app_feedback?")) return Response.json([{ id: 8, created_at: "2026-11-05T00:00:00.000Z", kind: "feedback", subject: "[feedback] Super", status: "pending", source: "web" }]);
      if (url.includes("/race_requests?")) return Response.json([]);
      return Response.json({ message: `Unhandled ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the runner profile with access, purchases and feedback", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unavailable).toEqual([]);
    expect(body.profile).toMatchObject({ id: USER, email: "camille@gmail.com", fullName: "Camille", roles: ["user"], plans: { total: 3 } });
    expect(body.profile.access).toMatchObject({ isPremium: true, activeSources: ["Attribution (Support)"] });
    expect(body.profile.purchases[0]).toMatchObject({ object: "Plan · La Sainté-Lyon", status: "paid", method: "stripe" });
    expect(body.profile.feedback[0]).toMatchObject({ title: "Super", typeLabel: "Retour" });
  });

  it("still answers when a secondary source fails, and lists it", async () => {
    failing = "/premium_grants?";
    const body = await (await call()).json();
    expect(body.unavailable).toEqual(["attributions Premium"]);
    expect(body.profile.access.grants).toEqual([]);
  });

  it("answers 404 for an unknown account, 400 for an invalid id, and keeps the admin guard", async () => {
    missingUser = true;
    expect((await call()).status).toBe(404);
    expect((await call("not-a-uuid")).status).toBe(400);
    mocks.gate.mockResolvedValue({ ok: false, response: new Response("", { status: 403 }) });
    expect((await call()).status).toBe(403);
  });

  it("never logs the runner e-mail", async () => {
    failing = "/auth/v1/admin/users/";
    const errors = vi.mocked(console.error);
    expect((await call()).status).toBe(502);
    expect(JSON.stringify(errors.mock.calls)).not.toContain("camille@gmail.com");
  });
});
