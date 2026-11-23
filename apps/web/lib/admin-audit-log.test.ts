import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT as putPartnerLinks } from "../app/api/admin/partner-links/route";
import { PATCH as patchFeedback } from "../app/api/admin/feedback/route";
import { DELETE as deleteVoice } from "../app/api/admin/video-generator/voices/[id]/route";
import { adminActorFromRequest, guessAuditTargetId, recordAdminAction, withAdminAudit } from "./admin-audit-log";

const ADMIN_ID = "99999999-9999-4999-8999-999999999999";
const VOICE_ID = "33333333-3333-4333-8333-333333333333";

const mocks = vi.hoisted(() => ({ deleteVoice: vi.fn(), identities: vi.fn(), replies: vi.fn(), review: vi.fn(), deliver: vi.fn() }));

vi.mock("./video-voices", async () => {
  const actual = await vi.importActual<typeof import("./video-voices")>("./video-voices");
  return { ...actual, deletePoolVoice: mocks.deleteVoice };
});
vi.mock("./video-render-api", async () => {
  const actual = await vi.importActual<typeof import("./video-render-api")>("./video-render-api");
  return {
    ...actual,
    authorizeVideoAdmin: () => Promise.resolve({ ok: true, value: { userId: "99999999-9999-4999-8999-999999999999", supabase: { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" } } }),
  };
});
vi.mock("./admin-user-notifications", () => ({
  deliverAdminUserNotification: mocks.deliver,
  loadAdminUserIdentities: mocks.identities,
  loadLatestReplies: mocks.replies,
  reviewAppFeedbackWithNotification: mocks.review,
}));
vi.mock("./http", async () => {
  const actual = await vi.importActual<typeof import("./http")>("./http");
  return { ...actual, checkRateLimitAsync: () => Promise.resolve({ allowed: true }) };
});
vi.mock("./organizer", async () => {
  const actual = await vi.importActual<typeof import("./organizer")>("./organizer");
  return {
    ...actual,
    requireAdminAuth: () => Promise.resolve({
      user: { id: "99999999-9999-4999-8999-999999999999" },
      serviceConfig: { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" },
    }),
  };
});

const token = (claims: Record<string, unknown>) => ["header", Buffer.from(JSON.stringify(claims)).toString("base64url"), "signature"].join(".");
const adminToken = token({ sub: ADMIN_ID, email: "faustin@example.com", app_metadata: { role: "admin" }, user_metadata: { role: "admin" } });
const runnerToken = token({ sub: ADMIN_ID, app_metadata: {}, user_metadata: { role: "admin" } });

const settingsRows = [
  { partner_key: "booking", standard_url: "https://www.booking.com/", affiliate_url: null, affiliate_enabled: false, is_enabled: true, updated_at: "2026-11-23T10:00:00.000Z" },
  { partner_key: "decathlon", standard_url: "https://www.decathlon.fr/", affiliate_url: "https://track.example/d", affiliate_enabled: true, is_enabled: true, updated_at: "2026-11-23T10:00:00.000Z" },
];
const partnerBody = {
  settings: [
    { partnerKey: "booking", standardUrl: "https://www.booking.com/", affiliateUrl: "", affiliateEnabled: false, isEnabled: true },
    { partnerKey: "decathlon", standardUrl: "https://www.decathlon.fr/", affiliateUrl: "https://track.example/d", affiliateEnabled: true, isEnabled: true },
  ],
};

const jsonRequest = (url: string, method: string, body: unknown, bearer = adminToken) =>
  new NextRequest(url, { method, headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" }, body: JSON.stringify(body) });

const auditCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter((call) => String(call[0]).includes("/rest/v1/admin_audit_log"));
const auditRows = (fetchMock: ReturnType<typeof vi.fn>) => auditCalls(fetchMock).map((call) => JSON.parse(String((call[1] as RequestInit).body)));

describe("admin action journal", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_AUDIT_LOG_DISABLED", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    fetchMock.mockImplementation(async (url: string) => (String(url).includes("admin_audit_log") ? new Response(null, { status: 201 }) : Response.json(settingsRows)));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("actor", () => {
    it("reads the actor from the trusted app_metadata claims only", () => {
      const request = (bearer: string) => new Request("http://localhost/x", { headers: { authorization: `Bearer ${bearer}` } });
      expect(adminActorFromRequest(request(adminToken))).toEqual({ userId: ADMIN_ID, label: "fa***@example.com" });
      expect(adminActorFromRequest(request(runnerToken))).toBeNull();
      expect(adminActorFromRequest(request(token({ sub: ADMIN_ID, app_metadata: { roles: ["user", "admin"] } })))).toEqual({ userId: ADMIN_ID, label: null });
      expect(adminActorFromRequest(request("not-a-jwt"))).toBeNull();
      expect(adminActorFromRequest(new Request("http://localhost/x"))).toBeNull();
    });
  });

  describe("sample of routes", () => {
    it("writes one line for a successful partner-links update, without changing the response", async () => {
      const response = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(response.status).toBe(200);
      expect((await response.json()).settings).toHaveLength(2);

      const rows = auditRows(fetchMock);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        actor_user_id: ADMIN_ID,
        actor_label: "fa***@example.com",
        action: "partner.links",
        target_type: "partner",
        summary: "Liens partenaires mis à jour",
        request_path: "PUT /api/admin/partner-links",
        status: "ok",
        error: null,
        after: { settings: [{ partnerKey: "booking", isEnabled: true, affiliateEnabled: false }, { partnerKey: "decathlon", isEnabled: true, affiliateEnabled: true }] },
      });
      const headers = (auditCalls(fetchMock)[0][1] as RequestInit).headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer service");
    });

    it("journals a feedback status change with the status, never the reply content", async () => {
      mocks.review.mockResolvedValue({ id: "n1" });
      mocks.deliver.mockResolvedValue({});
      const response = await patchFeedback(jsonRequest("http://localhost/api/admin/feedback", "PATCH", {
        feedbackId: 7,
        status: "completed",
        notification: { id: "44444444-4444-4444-8444-444444444444", title: "Merci", body: "Corrigé dans la 1.2, écrivez-nous à lea@example.com", sendEmail: true, sendPush: false },
      }));
      expect(response.status).toBe(200);
      const [row] = auditRows(fetchMock);
      expect(row).toMatchObject({ action: "feedback.status", target_type: "feedback", target_id: "7", after: { status: "completed", replied: true } });
      expect(row.summary).toBe("Bug ou retour n° 7 marqué « traité » avec réponse");
      expect(JSON.stringify(row)).not.toContain("Corrigé");
      expect(JSON.stringify(row)).not.toContain("lea@example.com");
    });

    it("journals a voice deletion from the route params", async () => {
      mocks.deleteVoice.mockResolvedValue(true);
      const response = await deleteVoice(
        new Request(`http://localhost/api/admin/video-generator/voices/${VOICE_ID}`, { method: "DELETE", headers: { authorization: `Bearer ${adminToken}` } }),
        { params: { id: VOICE_ID } },
      );
      expect(response.status).toBe(200);
      const [row] = auditRows(fetchMock);
      expect(row).toMatchObject({ action: "render.voice-delete", target_type: "voice", target_id: VOICE_ID, status: "ok", after: null });
    });

    it("journals a server failure as an error line and keeps the 502", async () => {
      mocks.review.mockRejectedValue(new Error("Unable to review: boom"));
      const response = await patchFeedback(jsonRequest("http://localhost/api/admin/feedback", "PATCH", {
        feedbackId: 8,
        status: "rejected",
        notification: { id: "44444444-4444-4444-8444-444444444444", title: "Non", body: "Non merci" },
      }));
      expect(response.status).toBe(502);
      const [row] = auditRows(fetchMock);
      expect(row).toMatchObject({ action: "feedback.status", status: "error", target_id: "8" });
      expect(row.error).toContain("boom");
    });

    it("does not journal a rejected request (validation) nor a non-admin token", async () => {
      const invalid = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", { settings: [] }));
      expect(invalid.status).toBe(400);
      expect(auditCalls(fetchMock)).toHaveLength(0);

      const notAdmin = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody, runnerToken));
      expect(notAdmin.status).toBe(200);
      expect(auditCalls(fetchMock)).toHaveLength(0);

      const noToken = await putPartnerLinks(new NextRequest("http://localhost/api/admin/partner-links", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(partnerBody) }));
      expect(noToken.status).toBe(200);
      expect(auditCalls(fetchMock)).toHaveLength(0);
    });

    it("never breaks the route when the journal refuses, fails or hangs", async () => {
      fetchMock.mockImplementation(async (url: string) => {
        if (String(url).includes("admin_audit_log")) return new Response("relation does not exist", { status: 404 });
        return Response.json(settingsRows);
      });
      const refused = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(refused.status).toBe(200);
      expect(auditCalls(fetchMock)).toHaveLength(1);

      fetchMock.mockImplementation(async (url: string) => {
        if (String(url).includes("admin_audit_log")) throw new TypeError("fetch failed");
        return Response.json(settingsRows);
      });
      const failed = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(failed.status).toBe(200);
      expect((await failed.json()).settings).toHaveLength(2);

      // A hanging journal is cut after its short timeout (AbortSignal.timeout) and the route still answers.
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (!String(url).includes("admin_audit_log")) return Promise.resolve(Response.json(settingsRows));
        return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError"))));
      });
      const startedAt = Date.now();
      const slow = await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(slow.status).toBe(200);
      expect(Date.now() - startedAt).toBeLessThan(4_000);
    });

    it("writes nothing when the journal is disabled or the service role is missing", async () => {
      vi.stubEnv("ADMIN_AUDIT_LOG_DISABLED", "1");
      await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(auditCalls(fetchMock)).toHaveLength(0);

      vi.stubEnv("ADMIN_AUDIT_LOG_DISABLED", "");
      vi.stubEnv("SUPABASE_URL", "");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
      await putPartnerLinks(jsonRequest("http://localhost/api/admin/partner-links", "PUT", partnerBody));
      expect(auditCalls(fetchMock)).toHaveLength(0);
    });
  });

  describe("withAdminAudit", () => {
    const handler = vi.fn(async (_request: Request, _context?: { params: Promise<{ id: string }> }) => Response.json({ item: { id: "abc" }, ok: true }, { status: 201 }));
    const wrapped = withAdminAudit(handler, {
      action: "product.update",
      targetType: "product",
      summary: (context) => `Produit ${context.params.id} modifié`,
      skip: (context) => (context.body as { dryRun?: boolean } | null)?.dryRun === true,
      failed: (context) => ((context.response as { ok?: boolean }).ok === false ? "refusé" : null),
    });
    const call = (body: unknown, id = "p1") =>
      wrapped(jsonRequest("http://localhost/api/admin/products/p1", "PATCH", body), { params: Promise.resolve({ id }) });

    it("keeps the handler signature and response, reads the body from a clone and awaits async params", async () => {
      handler.mockImplementationOnce(async (request) => {
        expect(await request.json()).toEqual({ name: "Gel" });
        return Response.json({ item: { id: "abc" } }, { status: 201 });
      });
      const response = await call({ name: "Gel" });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ item: { id: "abc" } });
      const [row] = auditRows(fetchMock);
      expect(row).toMatchObject({ summary: "Produit p1 modifié", target_id: "p1", after: { name: "Gel" } });
    });

    it("skips a line the spec asks to skip and marks a 2xx failure the spec reports", async () => {
      await call({ dryRun: true });
      expect(auditCalls(fetchMock)).toHaveLength(0);
      handler.mockResolvedValueOnce(Response.json({ ok: false }));
      await call({ name: "x" });
      expect(auditRows(fetchMock)[0]).toMatchObject({ status: "error", error: "refusé" });
    });

    it("guesses the target from the note, the params, the body, then the response", () => {
      const base = { params: {}, body: null, response: null, note: {} };
      expect(guessAuditTargetId({ ...base, note: { targetId: 9 } })).toBe("9");
      expect(guessAuditTargetId({ ...base, params: { id: "p" }, body: { id: "b" } })).toBe("p");
      expect(guessAuditTargetId({ ...base, body: { userId: "u" } })).toBe("u");
      expect(guessAuditTargetId({ ...base, response: { post: { id: "r" } } })).toBe("r");
      expect(guessAuditTargetId(base)).toBeNull();
    });
  });

  it("recordAdminAction swallows every failure", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(recordAdminAction({ actorUserId: ADMIN_ID, action: "premium.grant", target: { type: "user", id: "u" }, summary: "x" })).resolves.toBeUndefined();
    await expect(recordAdminAction({ actorUserId: "bad", action: "premium.grant", target: { type: "user" }, summary: "x" })).resolves.toBeUndefined();
  });
});
