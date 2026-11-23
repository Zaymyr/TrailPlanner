import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const mocks = vi.hoisted(() => ({ gate: vi.fn(), identities: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});
vi.mock("../../../../lib/admin-user-notifications", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/admin-user-notifications")>("../../../../lib/admin-user-notifications");
  return { ...actual, loadAdminUserIdentities: mocks.identities };
});

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const ACTOR = "11111111-1111-4111-8111-111111111111";
const request = (search = "") => new Request(`http://localhost/api/admin/audit${search}`, { headers: { authorization: "Bearer admin" } });

const row = (patch: Record<string, unknown> = {}) => ({
  id: "22222222-2222-4222-8222-222222222222",
  created_at: "2026-11-23T10:00:00Z",
  actor_user_id: ACTOR,
  actor_label: "fa***@gmail.com",
  action: "premium.grant",
  target_type: "user",
  target_id: "u1",
  summary: "Premium accordé au coureur u1 pour 30 jours",
  before: null,
  after: { initialDurationDays: 30, reason: "Geste commercial" },
  request_path: "POST /api/admin/premium",
  status: "ok",
  error: null,
  ...patch,
});

describe("GET /api/admin/audit", () => {
  let urls: string[];
  let auditStatus: number;

  beforeEach(() => {
    urls = [];
    auditStatus = 200;
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: ACTOR, supabase } });
    mocks.identities.mockResolvedValue({ names: new Map([[ACTOR, "Faustin"]]), emails: new Map() });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      urls.push(`${init?.method ?? "GET"} ${url}`);
      if (auditStatus !== 200) return new Response("missing", { status: auditStatus });
      if (url.includes("select=actor_user_id")) return Response.json([{ actor_user_id: ACTOR }, { actor_user_id: ACTOR }]);
      return new Response(JSON.stringify([row()]), { status: 200, headers: { "content-range": "0-0/121", "content-type": "application/json" } });
    }));
  });

  afterEach(() => vi.restoreAllMocks());

  it("requires an admin session and stays read-only", async () => {
    mocks.gate.mockResolvedValue({ ok: false, response: NextResponse.json({ message: "Not authorized." }, { status: 403 }) });
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(urls).toEqual([]);
  });

  it("returns the page with the actor name, labels, target link and pagination, and never writes", async () => {
    const response = await GET(request("?page=2"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.available).toBe(true);
    expect(payload.entries[0]).toMatchObject({
      actorName: "Faustin",
      actionLabel: "Premium accordé",
      familyLabel: "Premium",
      targetHref: "/admin/runners?coureur=u1",
      status: "ok",
    });
    expect(payload.actors).toEqual([{ id: ACTOR, name: "Faustin" }]);
    expect(payload.pagination).toEqual({ page: 2, pageSize: 50, total: 121, totalPages: 3 });
    expect(urls.every((url) => url.startsWith("GET "))).toBe(true);
    expect(urls[0]).toContain("offset=50");
    expect(urls[0]).toContain("order=created_at.desc,id.desc");
  });

  it("translates the filters to the database query (Paris days, family, status, actor, target)", async () => {
    await GET(request(`?du=2026-11-01&au=2026-11-30&acteur=${ACTOR}&action=premium,billing.invoice-settle&statut=echec&cible=u1&recherche=geste`));
    const url = decodeURIComponent(urls[0]);
    expect(url).toContain("created_at=gte.2026-10-31T23:00:00.000Z");
    expect(url).toContain("created_at=lt.2026-11-30T23:00:00.000Z");
    expect(url).toContain(`actor_user_id=eq.${ACTOR}`);
    expect(url).toContain("status=eq.error");
    expect(url).toContain("or=(action.like.premium.*,action.eq.billing.invoice-settle)");
    expect(url).toContain("or=(target_id.eq.u1,target_type.eq.u1)");
    expect(url).toContain("summary.ilike.*geste*");
  });

  it("reads one line by id and exports every match", async () => {
    await GET(request("?entree=22222222-2222-4222-8222-222222222222&statut=echec"));
    expect(urls[0]).toContain("id=eq.22222222-2222-4222-8222-222222222222");
    expect(urls[0]).not.toContain("status=eq");
    expect(urls.some((url) => url.includes("select=actor_user_id"))).toBe(false);

    urls.length = 0;
    await GET(request("?export=1&page=3"));
    expect(urls[0]).toContain("limit=5000");
    expect(urls[0]).toContain("offset=0");
  });

  it("answers « not available » while the migration is not applied", async () => {
    auditStatus = 404;
    const response = await GET(request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ available: false, entries: [], pagination: { total: 0, totalPages: 1 } });
  });

  it("answers 502 when the database fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    auditStatus = 500;
    const response = await GET(request());
    expect(response.status).toBe(502);
  });
});
