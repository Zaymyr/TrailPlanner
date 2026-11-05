import { beforeEach, describe, expect, it, vi } from "vitest";

import { deliverAdminUserNotification, type AdminUserNotificationRow } from "./admin-user-notifications";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  sendPush: vi.fn(),
}));

vi.mock("./resend", () => ({ sendAdminUserNotificationEmail: mocks.sendEmail }));
vi.mock("./push", () => ({ sendAdminUserNotificationPush: mocks.sendPush }));

const serviceConfig = {
  supabaseUrl: "https://example.supabase.co",
  supabaseServiceRoleKey: "service-role",
};

function notification(overrides: Partial<AdminUserNotificationRow> = {}): AdminUserNotificationRow {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "11111111-1111-4111-8111-111111111111",
    created_by: "99999999-9999-4999-8999-999999999999",
    kind: "admin_message",
    title: "Message",
    body: "Contenu",
    email_requested: true,
    email_status: "sent",
    push_requested: true,
    push_status: "sent",
    push_sent_count: 1,
    created_at: "2026-11-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("deliverAdminUserNotification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("does not redeliver channels already marked as sent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(deliverAdminUserNotification(serviceConfig, notification())).resolves.toEqual({});

    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.sendPush).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("treats a deduplicated push event as an already successful delivery", async () => {
    mocks.sendPush.mockResolvedValue({
      disabledDeviceCount: 0,
      sentCount: 0,
      skippedDuplicateCount: 1,
      totalCandidateCount: 1,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deliverAdminUserNotification(serviceConfig, notification({
      email_requested: false,
      email_status: "not_requested",
      push_status: "pending",
      push_sent_count: 0,
    }));

    expect(result).toMatchObject({ push_status: "sent", push_sent_count: 1, push_error: null });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
