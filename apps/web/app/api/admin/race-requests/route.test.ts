import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  deliver: vi.fn(),
  review: vi.fn(),
}));
vi.mock("../../../../lib/admin-user-notifications", () => ({
  deliverAdminUserNotification: mocks.deliver,
  loadAdminUserIdentities: vi.fn(),
  loadLatestReplies: vi.fn(),
  reviewRaceRequestWithNotification: mocks.review,
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

describe("PATCH /api/admin/race-requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.review.mockResolvedValue({ id: "22222222-2222-4222-8222-222222222222" });
    mocks.deliver.mockResolvedValue({ push_status: "unavailable" });
  });

  it("uses the atomic review RPC result before external delivery", async () => {
    const response = await PATCH(new NextRequest("http://localhost/api/admin/race-requests", {
      method: "PATCH",
      body: JSON.stringify({
        requestId: 42,
        notificationId: "22222222-2222-4222-8222-222222222222",
        status: "completed",
        title: "Demande terminée",
        body: "La course est disponible.",
        sendPush: true,
      }),
    }));

    expect(response.status).toBe(200);
    expect(mocks.review.mock.invocationCallOrder[0]).toBeLessThan(mocks.deliver.mock.invocationCallOrder[0]);
    expect(mocks.review).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      requestId: 42,
      status: "completed",
      pushRequested: true,
    }));
  });
});
