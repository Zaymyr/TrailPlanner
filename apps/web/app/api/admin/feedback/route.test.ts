import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  identities: vi.fn(),
  replies: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../../../../lib/admin-user-notifications", () => ({
  deliverAdminUserNotification: mocks.deliver,
  loadAdminUserIdentities: mocks.identities,
  loadLatestReplies: mocks.replies,
  reviewAppFeedbackWithNotification: mocks.review,
}));
vi.mock("../../../../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/http")>("../../../../lib/http");
  return { ...actual, checkRateLimitAsync: () => Promise.resolve({ allowed: true }) };
});
vi.mock("../../../../lib/organizer", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/organizer")>("../../../../lib/organizer");
  return {
    ...actual,
    requireAdminAuth: () => Promise.resolve({
      user: { id: "99999999-9999-4999-8999-999999999999" },
      serviceConfig: { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" },
    }),
  };
});

const USER_ID = "11111111-1111-4111-8111-111111111111";

describe("/api/admin/feedback", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    mocks.review.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mocks.deliver.mockResolvedValue({});
    mocks.replies.mockResolvedValue(new Map([[7, { title: "Réponse", body: "Bonjour,", sentAt: "2026-11-02T10:00:00Z", readAt: "2026-11-02T11:00:00Z", deletedAt: null }]]));
    mocks.identities.mockResolvedValue({ names: new Map([[USER_ID, "Léa"]]), emails: new Map([[USER_ID, "lea@example.com"]]) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists one kind with the author and strips the stored [bug] prefix", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{
      id: 7,
      created_at: "2026-11-01T21:11:01Z",
      user_id: USER_ID,
      kind: "bug",
      source: "mobile",
      screen: "Plan",
      app_version: "1.1.1",
      subject: "[bug] Crash au chargement",
      detail: "Ça plante.",
      status: "pending",
      reviewed_at: null,
    }]), { status: 200, headers: { "content-range": "0-0/1" } }));

    const response = await GET(new NextRequest("http://localhost/api/admin/feedback?kind=bug&status=pending"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain("kind=eq.bug");
    expect(String(fetchMock.mock.calls[0][0])).toContain("status=eq.pending");
    expect(payload.items[0]).toMatchObject({ subject: "Crash au chargement", userName: "Léa", userEmail: "lea@example.com" });
    expect(payload.items[0].reply).toMatchObject({ readAt: "2026-11-02T11:00:00Z", deletedAt: null });
    expect(mocks.replies).toHaveBeenCalledWith(expect.anything(), "feedback_id", [7]);
    expect(payload.pagination.total).toBe(1);
  });

  it("rejects an unknown kind", async () => {
    const response = await GET(new NextRequest("http://localhost/api/admin/feedback?kind=spam"));
    expect(response.status).toBe(400);
  });

  it("replies through the atomic RPC before external delivery", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/admin/feedback", {
      method: "PATCH",
      body: JSON.stringify({
        feedbackId: 7,
        status: "completed",
        notification: { id: "22222222-2222-4222-8222-222222222222", title: "Bug corrigé", body: "Bonjour,\n\nC'est corrigé.", sendPush: true },
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);
    expect(mocks.review).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ feedbackId: 7, status: "completed", pushRequested: true }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only changes the status when no notification is sent", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await PATCH(new NextRequest("http://localhost/api/admin/feedback", {
      method: "PATCH",
      body: JSON.stringify({ feedbackId: 7, status: "rejected" }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.review).not.toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toContain("app_feedback?id=eq.7");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ status: "rejected", reviewed_by: "99999999-9999-4999-8999-999999999999" });
  });
});
