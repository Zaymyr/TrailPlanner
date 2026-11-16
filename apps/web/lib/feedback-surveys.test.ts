import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ deliver: vi.fn() }));

vi.mock("./admin-user-notifications", async () => {
  const actual = await vi.importActual<typeof import("./admin-user-notifications")>("./admin-user-notifications");
  return { ...actual, deliverAdminUserNotification: mocks.deliver };
});

import {
  buildCampaignStats,
  extractSupabaseUserIds,
  isSupabaseUserId,
  parseRacebookAudiences,
  sendRacebookSurvey,
  surveyNotificationId,
  surveySendSchema,
} from "./feedback-surveys";

const serviceConfig = { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "service" };
const RUNNER_A = "11111111-1111-4111-8111-111111111111";
const RUNNER_B = "22222222-2222-4222-9222-222222222222";
const ADMIN_ID = "99999999-9999-4999-8999-999999999999";
const CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";
const POSTHOG_ANONYMOUS_ID = "01a1e4e6-c9a8-7b4e-96d4-4171a12be90c";

describe("feedback survey helpers", () => {
  it("keeps Supabase (v4) ids and drops PostHog anonymous (v7) ids", () => {
    expect(isSupabaseUserId(RUNNER_A)).toBe(true);
    expect(isSupabaseUserId(POSTHOG_ANONYMOUS_ID)).toBe(false);
    expect(isSupabaseUserId("not-an-id")).toBe(false);
    expect(
      extractSupabaseUserIds([
        { distinct_id: RUNNER_A },
        { distinct_id: RUNNER_A.toUpperCase() },
        { distinct_id: POSTHOG_ANONYMOUS_ID },
        { distinct_id: null },
      ])
    ).toEqual([RUNNER_A]);
  });

  it("derives one stable, valid notification id per campaign and runner", () => {
    const id = surveyNotificationId(CAMPAIGN_ID, RUNNER_A);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(surveyNotificationId(CAMPAIGN_ID, RUNNER_A)).toBe(id);
    expect(surveyNotificationId(CAMPAIGN_ID, RUNNER_B)).not.toBe(id);
  });

  it("parses PostHog audiences and falls back to the event id as name", () => {
    expect(
      parseRacebookAudiences([
        { event_id: "evt-1", event_name: "Bibracte", readers: 797, last_opened_at: "2026-11-01T00:00:00Z" },
        { event_id: "evt-2", event_name: "", readers: "3", last_opened_at: null },
        { event_id: "", event_name: "Ignored", readers: 1 },
      ])
    ).toEqual([
      { eventId: "evt-1", eventName: "Bibracte", readers: 797, lastOpenedAt: "2026-11-01T00:00:00Z" },
      { eventId: "evt-2", eventName: "evt-2", readers: 3, lastOpenedAt: null },
    ]);
  });

  it("builds campaign stats from the database counters", () => {
    expect(
      buildCampaignStats(321, {
        campaign_id: CAMPAIGN_ID,
        recipients: 321,
        read_count: 120,
        push_sent: 230,
        responses: 40,
        useful: 31,
      })
    ).toEqual({ recipients: 321, read: 120, pushSent: 230, responses: 40, useful: 31, notUseful: 9 });
    expect(buildCampaignStats(12, undefined)).toEqual({
      recipients: 12,
      read: 0,
      pushSent: 0,
      responses: 0,
      useful: 0,
      notUseful: 0,
    });
  });
});

describe("sendRacebookSurvey", () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let pendingReads = 0;

  beforeEach(() => {
    calls.length = 0;
    pendingReads = 0;
    vi.stubEnv("POSTHOG_API_KEY", "phx_test");
    vi.stubEnv("POSTHOG_PROJECT_ID", "176628");
    vi.stubEnv("POSTHOG_API_HOST", "https://eu.posthog.com");
    mocks.deliver.mockReset();
    mocks.deliver.mockResolvedValue({ push_status: "sent" });

    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });

      if (url.includes("posthog.com")) {
        return json({
          columns: ["distinct_id"],
          results: [[RUNNER_A], [RUNNER_B], [POSTHOG_ANONYMOUS_ID], [ADMIN_ID]],
        });
      }
      if (url.endsWith("/rpc/resolve_feedback_survey_recipients")) {
        // The database drops the admin account.
        return json([
          { user_id: RUNNER_A, has_email: true, has_push: true },
          { user_id: RUNNER_B, has_email: true, has_push: false },
        ]);
      }
      if (url.includes("/feedback_survey_campaigns?on_conflict=id")) return new Response(null, { status: 201 });
      if (url.includes("/feedback_survey_campaigns?id=eq.")) {
        return json([{
          title: "Ton avis",
          body: "Message",
          audience_event_id: "evt-1",
          audience_user_id: null,
          email_requested: false,
          push_requested: true,
        }]);
      }
      if (url.includes("/user_notifications?on_conflict=id")) return new Response(null, { status: 201 });
      if (url.includes("/user_notifications?") && init?.method === undefined) {
        pendingReads += 1;
        if (pendingReads > 1) return json([]);
        return json([RUNNER_A, RUNNER_B].map((userId) => ({
          id: surveyNotificationId(CAMPAIGN_ID, userId),
          user_id: userId,
          kind: "feedback_survey",
          title: "Ton avis",
          body: "Message",
          email_requested: false,
          email_status: "not_requested",
          push_requested: true,
          push_status: "pending",
          push_sent_count: 0,
          created_at: "2026-11-16T10:00:00Z",
        })));
      }
      return json({ message: `Unexpected ${url}` }, 500);
    }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("targets identified readers only, inserts idempotent survey messages, then delivers them", async () => {
    const result = await sendRacebookSurvey(serviceConfig, {
      campaignId: CAMPAIGN_ID,
      eventId: "evt-1",
      eventLabel: "Bibracte",
      title: "Ton avis",
      body: "Message",
      sendEmail: false,
      sendPush: true,
      adminId: ADMIN_ID,
    });

    const posthogCall = calls.find((call) => call.url.includes("posthog.com"));
    expect(posthogCall?.url).toBe("https://eu.posthog.com/api/environments/176628/query/");
    expect(JSON.parse(String(posthogCall?.init?.body)).query.values).toEqual({ event_id: "evt-1" });

    const resolveCall = calls.find((call) => call.url.endsWith("/rpc/resolve_feedback_survey_recipients"));
    expect(JSON.parse(String(resolveCall?.init?.body)).p_user_ids).toEqual([RUNNER_A, RUNNER_B, ADMIN_ID]);

    const insertCall = calls.find((call) => call.url.includes("/user_notifications?on_conflict=id"));
    const inserted = JSON.parse(String(insertCall?.init?.body)) as Array<Record<string, unknown>>;
    expect(inserted.map((row) => row.user_id)).toEqual([RUNNER_A, RUNNER_B]);
    expect(inserted[0]).toMatchObject({
      id: surveyNotificationId(CAMPAIGN_ID, RUNNER_A),
      kind: "feedback_survey",
      survey_campaign_id: CAMPAIGN_ID,
      push_status: "pending",
      email_status: "not_requested",
    });

    expect(mocks.deliver).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      audience: { identifiedReaders: 3, recipients: 2, withPush: 1, withEmail: 2 },
      delivery: { delivered: 2, pushSent: 2, pushUnavailable: 0, failed: 0 },
    });
  });

  it("refuses to reuse a campaign id for a different survey", async () => {
    await expect(
      sendRacebookSurvey(serviceConfig, {
        campaignId: CAMPAIGN_ID,
        eventId: "evt-1",
        title: "Autre titre",
        body: "Message",
        sendEmail: false,
        sendPush: true,
        adminId: ADMIN_ID,
      })
    ).rejects.toThrow("Campaign id is already used by a different survey.");
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});

describe("sendRacebookSurvey to a single user", () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    calls.length = 0;
    mocks.deliver.mockReset();
    mocks.deliver.mockResolvedValue({ push_status: "sent" });
    let pendingReads = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status });
      if (url.endsWith("/rpc/resolve_feedback_survey_single_recipient")) {
        return json([{ user_id: ADMIN_ID, has_email: true, has_push: true }]);
      }
      if (url.includes("/feedback_survey_campaigns?on_conflict=id")) return new Response(null, { status: 201 });
      if (url.includes("/feedback_survey_campaigns?id=eq.")) {
        return json([{
          title: "Ton avis",
          body: "Message",
          audience_event_id: null,
          audience_user_id: ADMIN_ID,
          email_requested: false,
          push_requested: true,
        }]);
      }
      if (url.includes("/user_notifications?on_conflict=id")) return new Response(null, { status: 201 });
      if (url.includes("/user_notifications?") && init?.method === undefined) {
        pendingReads += 1;
        if (pendingReads > 1) return json([]);
        return json([{
          id: surveyNotificationId(CAMPAIGN_ID, ADMIN_ID),
          user_id: ADMIN_ID,
          kind: "feedback_survey",
          title: "Ton avis",
          body: "Message",
          email_requested: false,
          email_status: "not_requested",
          push_requested: true,
          push_status: "pending",
          push_sent_count: 0,
          created_at: "2026-11-16T10:00:00Z",
        }]);
      }
      return json({ message: `Unexpected ${url}` }, 500);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("skips PostHog, accepts an admin account and records a single_user campaign", async () => {
    const result = await sendRacebookSurvey(serviceConfig, {
      campaignId: CAMPAIGN_ID,
      userId: ADMIN_ID,
      userLabel: "admin@example.com",
      title: "Ton avis",
      body: "Message",
      sendEmail: false,
      sendPush: true,
      adminId: ADMIN_ID,
    });

    expect(calls.some((call) => call.url.includes("posthog"))).toBe(false);
    expect(calls.some((call) => call.url.endsWith("/rpc/resolve_feedback_survey_recipients"))).toBe(false);
    const campaignCall = calls.find((call) => call.url.includes("/feedback_survey_campaigns?on_conflict=id"));
    expect(JSON.parse(String(campaignCall?.init?.body))).toMatchObject({
      audience_kind: "single_user",
      audience_user_id: ADMIN_ID,
      audience_event_id: null,
      audience_label: "Test · admin@example.com",
      recipient_count: 1,
    });
    const insertCall = calls.find((call) => call.url.includes("/user_notifications?on_conflict=id"));
    expect((JSON.parse(String(insertCall?.init?.body)) as Array<{ user_id: string }>).map((row) => row.user_id))
      .toEqual([ADMIN_ID]);
    expect(result.audience).toEqual({ identifiedReaders: 1, recipients: 1, withPush: 1, withEmail: 1 });
    expect(mocks.deliver).toHaveBeenCalledTimes(1);
  });
});

describe("surveySendSchema", () => {
  it("requires an event or a user", () => {
    const base = { campaignId: CAMPAIGN_ID, title: "Ton avis", body: "Message" };
    expect(surveySendSchema.safeParse(base).success).toBe(false);
    expect(surveySendSchema.safeParse({ ...base, eventId: "evt-1" }).success).toBe(true);
    expect(surveySendSchema.safeParse({ ...base, userId: ADMIN_ID.toUpperCase() }).data?.userId).toBe(ADMIN_ID);
  });
});
