import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("../../../../lib/feedback-surveys", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/feedback-surveys")>("../../../../lib/feedback-surveys");
  return { ...actual, sendRacebookSurvey: mocks.send };
});
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

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/admin/feedback-surveys", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/admin/feedback-surveys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({
      audience: { identifiedReaders: 3, recipients: 2, withPush: 1, withEmail: 2 },
      delivery: { delivered: 2, pushSent: 1, pushUnavailable: 1, failed: 0 },
    });
  });

  it("rejects an incomplete survey", async () => {
    const response = await post({ campaignId: "33333333-3333-4333-8333-333333333333", eventId: "evt-1", title: "" });
    expect(response.status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("sends the survey as the authenticated admin with push on by default", async () => {
    const response = await post({
      campaignId: "33333333-3333-4333-8333-333333333333",
      eventId: "evt-1",
      eventLabel: "Bibracte",
      title: "Ton avis",
      body: "Message",
    });

    expect(response.status).toBe(201);
    expect(mocks.send).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      adminId: "99999999-9999-4999-8999-999999999999",
      eventId: "evt-1",
      sendPush: true,
      sendEmail: false,
    }));
  });
});
