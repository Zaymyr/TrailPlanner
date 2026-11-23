import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  fetchUser: vi.fn(),
  insert: vi.fn(),
  identities: vi.fn(),
}));

vi.mock("../../../../lib/admin-user-notifications", () => ({
  deliverAdminUserNotification: mocks.deliver,
  fetchAdminAuthUser: mocks.fetchUser,
  insertAdminUserNotification: mocks.insert,
  loadAdminUserIdentities: mocks.identities,
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

describe("POST /api/admin/user-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchUser.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111", email: "runner@example.com" });
    mocks.insert.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mocks.deliver.mockResolvedValue({ email_status: "sent" });
  });

  it("persists the in-app message before delivering optional channels", async () => {
    const response = await POST(new NextRequest("http://localhost/api/admin/user-notifications", {
      method: "POST",
      body: JSON.stringify({
        notificationId: "22222222-2222-4222-8222-222222222222",
        userId: "11111111-1111-4111-8111-111111111111",
        title: "Message",
        body: "Contenu",
        sendEmail: true,
        sendPush: false,
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.insert.mock.invocationCallOrder[0]).toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);
    expect(mocks.insert).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      emailRequested: true,
      pushRequested: false,
    }));
  });
});

describe("GET /api/admin/user-notifications", () => {
  const USER = "11111111-1111-4111-8111-111111111111";
  const urls: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    urls.length = 0;
    mocks.identities.mockResolvedValue({ names: new Map([[USER, "Camille"]]), emails: new Map([[USER, "camille@gmail.com"]]) });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input));
      urls.push(url);
      if (url.includes("/user_notifications?")) {
        return new Response(JSON.stringify([{
          id: "m1", user_id: USER, created_by: "admin", race_request_id: null, feedback_id: 5, kind: "admin_message", title: "Merci", body: "Corrigé",
          read_at: "2026-11-21T00:00:00.000Z", deleted_at: null, email_requested: true, email_status: "sent", push_requested: false, push_status: "not_requested",
          push_sent_count: 0, created_at: "2026-11-20T00:00:00.000Z",
        }]), { status: 200, headers: { "content-range": "0-0/41" } });
      }
      if (url.includes("/app_feedback?")) return Response.json([{ id: 5, kind: "bug" }]);
      return Response.json({ message: "unexpected" }, { status: 500 });
    }));
  });

  it("returns one page of the history with recipients, filters and pagination", async () => {
    const response = await GET(new NextRequest(`http://localhost/api/admin/user-notifications?recherche=merci&type=message&destinataire=${USER}&page=2`));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination).toEqual({ page: 2, pageSize: 30, total: 41, totalPages: 2 });
    expect(body.messages[0]).toMatchObject({ recipient: "Camille", recipientEmail: "camille@gmail.com", context: "Bug n° 5", readState: "read", href: "/admin/inbox?vue=bugs" });
    const listUrl = urls.find((url) => url.includes("/user_notifications?")) ?? "";
    expect(listUrl).toContain("kind=in.(admin_message)");
    expect(listUrl).toContain(`user_id=eq.${USER}`);
    expect(listUrl).toContain("or=(title.ilike.*merci*,body.ilike.*merci*)");
    expect(listUrl).toContain("offset=30");
    expect(listUrl).not.toContain("email_error");
  });

  it("answers 502 when the table cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    const response = await GET(new NextRequest("http://localhost/api/admin/user-notifications"));
    expect(response.status).toBe(502);
  });
});
