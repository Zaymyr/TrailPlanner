import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), paymentActivity: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../lib/admin-system-health-server", () => ({ loadPaymentActivity: mocks.paymentActivity }));

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const EDITION = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const RACE = "33333333-3333-4333-8333-333333333333";
const request = (query = "") => new Request(`http://localhost/api/admin/billing${query}`, { headers: { authorization: "Bearer admin" } });
const recent = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

let failing: string | null = null;
const urls: string[] = [];

describe("GET /api/admin/billing", () => {
  beforeEach(() => {
    failing = null;
    urls.length = 0;
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase } });
    mocks.paymentActivity.mockResolvedValue({
      stripeConfigured: true, webhookSecretConfigured: true, lastEventAt: recent(1), lastEventSource: "achat coureur",
      unprocessed: [], failedOrganizerPayments: 0, lastOrganizerPaymentAt: null, lastFlyoverPaidAt: null, lastRunnerEventAt: null,
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      urls.push(url);
      if (failing && url.includes(failing)) return new Response("", { status: 500 });
      if (url.includes("/organizer_edition_payments?")) {
        return Response.json([{
          id: "pay-1", edition_id: EDITION, created_at: recent(3), purchase_kind: "essential_direct", from_tier: "visibility", to_tier: "essential", status: "paid",
          payment_channel: "stripe", stripe_checkout_session_id: "cs_1", stripe_payment_intent_id: "pi_1", amount_subtotal: 19900, amount_tax: 3980, amount_total: 23880,
          currency: "eur", paid_at: recent(3), race_event_editions: { edition_year: 2026, race_events: { name: "Trail TST" } },
        }]);
      }
      if (url.includes("/organizer_invoices?")) return Response.json([]);
      if (url.includes("/flyover_video_orders?")) return Response.json([{ id: "fly-1", offer: "collab", amount_cents: 2999, currency: "eur", status: "ready", race_name: "Ultra", contact_email: "orga@club.fr", paid_at: recent(2), created_at: recent(2) }]);
      if (url.includes("/runner_plan_unlocks?")) return Response.json([{ id: "u1", user_id: USER, plan_key: `race:${RACE}:edition:x`, provider: "apple", provider_transaction_id: "100", status: "active", purchased_at: recent(1) }]);
      if (url.includes("/runner_subscription_accounts?")) return Response.json([]);
      if (url.includes("/runner_support_purchases?")) return Response.json([]);
      if (url.includes(`/auth/v1/admin/users/${USER}`)) return Response.json({ id: USER, email: "camille@gmail.com" });
      if (url.includes("/races?")) return Response.json([{ id: RACE, name: "La Sainté-Lyon" }]);
      if (url.includes("/race_event_editions?")) return Response.json([{ id: EDITION, edition_year: 2026, race_events: { name: "Trail TST" } }]);
      return Response.json({ message: `Unhandled ${url}` }, { status: 500 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("refuses non-admins", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: Response.json({ message: "Accès refusé." }, { status: 403 }) });
    expect((await GET(request())).status).toBe(403);
  });

  it("merges every source, masks runner e-mails, never sends a runner amount", async () => {
    const response = await GET(request("?periode=tout"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries.map((entry: { rowId: string }) => entry.rowId)).toEqual(["u1", "fly-1", "pay-1"]);
    expect(body.entries[0]).toMatchObject({ client: "ca***@gmail.com", amounts: null, object: "Plan · La Sainté-Lyon" });
    expect(JSON.stringify(body)).not.toContain("camille@gmail.com");
    expect(body.summary).toMatchObject({ collectedMinor: 23880 + 2999, transactionCount: 3, untrackedCount: 1 });
    expect(body.sources.every((source: { ok: boolean }) => source.ok)).toBe(true);
    expect(body.paymentsHealth).toMatchObject({ status: "ok" });
    expect(urls.some((url) => url.includes("organizer_edition_payments") && url.includes("status=neq.expired"))).toBe(true);
  });

  it("searches on the full e-mail but answers masked", async () => {
    const body = await (await GET(request("?periode=tout&recherche=camille"))).json();
    expect(body.entries.map((entry: { rowId: string }) => entry.rowId)).toEqual(["u1"]);
  });

  it("reads only the organizer sources of an edition and labels it", async () => {
    const body = await (await GET(request(`?periode=tout&edition=${EDITION}`))).json();
    expect(body.edition).toEqual({ id: EDITION, label: "Trail TST · édition 2026" });
    expect(body.sources.map((source: { key: string }) => source.key)).toEqual(["organizer_pack", "organizer_invoice"]);
    expect(urls.some((url) => url.includes("flyover_video_orders"))).toBe(false);
    expect(urls.some((url) => url.includes(`organizer_invoices?`) && url.includes(`edition_id=eq.${EDITION}`))).toBe(true);
  });

  it("keeps the other sources when one fails", async () => {
    failing = "/flyover_video_orders?";
    const body = await (await GET(request("?periode=tout"))).json();
    expect(body.entries).toHaveLength(2);
    expect(body.sources.find((source: { key: string }) => source.key === "flyover")).toMatchObject({ ok: false });
  });

  it("applies the Paris-day bounds of a custom period", async () => {
    await GET(request("?du=2026-11-01&au=2026-11-30"));
    const invoices = urls.find((url) => url.includes("organizer_invoices?"));
    expect(invoices).toContain("invoice_issued_at=gte.2026-10-31T23:00:00.000Z");
    expect(invoices).toContain("invoice_issued_at=lt.2026-11-30T23:00:00.000Z");
  });

  it("exports every matching line without the health line", async () => {
    const body = await (await GET(request("?periode=tout&export=1"))).json();
    expect(body.pageSize).toBe(5000);
    expect(body.paymentsHealth).toBeNull();
    expect(mocks.paymentActivity).not.toHaveBeenCalled();
  });
});
