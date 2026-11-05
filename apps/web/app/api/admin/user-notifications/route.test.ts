import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  fetchUser: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("../../../../lib/admin-user-notifications", () => ({
  deliverAdminUserNotification: mocks.deliver,
  fetchAdminAuthUser: mocks.fetchUser,
  insertAdminUserNotification: mocks.insert,
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
