import { describe, expect, it } from "vitest";

import { buildRunnerProfile, isSubscriptionActive, mapGrant, type RunnerProfileRows } from "./admin-runner-profile";

const NOW = new Date("2026-11-23T12:00:00.000Z");
const USER = "22222222-2222-4222-8222-222222222222";
const RACE = "33333333-3333-4333-8333-333333333333";

const baseRows = (patch: Partial<RunnerProfileRows> = {}): RunnerProfileRows => ({
  user: { id: USER, email: "camille@gmail.com", created_at: "2026-01-01T08:00:00.000Z", last_sign_in_at: "2026-11-20T08:00:00.000Z", app_metadata: { roles: ["user", "admin"] } },
  profile: null,
  subscriptions: [],
  grants: [],
  plans: [],
  planCount: 0,
  unlocks: [],
  subscriptionAccounts: [],
  support: [],
  messages: [],
  feedback: [],
  raceRequests: [],
  ...patch,
});

describe("mapGrant", () => {
  it("uses ends_at when set (revoked early), else the initial duration", () => {
    const revoked = mapGrant({ id: "g1", user_id: USER, starts_at: "2026-11-01T00:00:00.000Z", initial_duration_days: 60, reason: "support", ends_at: "2026-11-10T00:00:00.000Z" }, NOW);
    expect(revoked?.state).toBe("ended");
    expect(revoked?.remainingDurationDays).toBe(0);
    const running = mapGrant({ id: "g2", user_id: USER, starts_at: "2026-11-20T12:00:00.000Z", initial_duration_days: 10, reason: "marketing" }, NOW);
    expect(running).toMatchObject({ state: "active", remainingDurationDays: 7, endsAt: "2026-11-30T12:00:00.000Z" });
    expect(mapGrant({ id: "g3", user_id: USER, starts_at: "2026-12-01T00:00:00.000Z", initial_duration_days: 5, reason: "other" }, NOW)?.state).toBe("scheduled");
    expect(mapGrant({ id: "g4", user_id: USER, starts_at: "nope", initial_duration_days: 5, reason: "other" }, NOW)).toBeNull();
  });
});

describe("isSubscriptionActive", () => {
  it("follows the web rule: active/trialing, period end in the future or missing", () => {
    expect(isSubscriptionActive("active", null, NOW)).toBe(true);
    expect(isSubscriptionActive("TRIALING", "2026-12-01T00:00:00.000Z", NOW)).toBe(true);
    expect(isSubscriptionActive("active", "2026-11-01T00:00:00.000Z", NOW)).toBe(false);
    expect(isSubscriptionActive("canceled", "2027-01-01T00:00:00.000Z", NOW)).toBe(false);
  });
});

describe("buildRunnerProfile", () => {
  it("maps identity, roles, activity, onboarding and recent plans", () => {
    const profile = buildRunnerProfile(baseRows({
      profile: { user_id: USER, full_name: " Camille Martin ", sign_in_count: 12, first_sign_in_at: "2025-12-31T08:00:00.000Z", last_sign_in_at: "2026-11-22T08:00:00.000Z", onboarding_completed_at: "2026-01-02T08:00:00.000Z" },
      plans: Array.from({ length: 7 }, (_, index) => ({ id: `p${index}`, name: `Plan ${index}`, created_at: "2026-10-01T00:00:00.000Z", updated_at: null })),
      planCount: 9,
    }), NOW);
    expect(profile).toMatchObject({
      email: "camille@gmail.com",
      fullName: "Camille Martin",
      roles: ["user", "admin"],
      createdAt: "2025-12-31T08:00:00.000Z",
      lastSignInAt: "2026-11-22T08:00:00.000Z",
      signInCount: 12,
      onboarding: { completed: true, completedAt: "2026-01-02T08:00:00.000Z" },
    });
    expect(profile.plans.total).toBe(9);
    expect(profile.plans.recent).toHaveLength(5);
  });

  it("defaults to the user role and falls back to Auth dates", () => {
    const profile = buildRunnerProfile(baseRows({ user: { id: USER, email: null, created_at: "2026-01-01T08:00:00.000Z", app_metadata: null } }), NOW);
    expect(profile.roles).toEqual(["user"]);
    expect(profile.createdAt).toBe("2026-01-01T08:00:00.000Z");
    expect(profile.lastSignInAt).toBeNull();
    expect(profile.onboarding.completed).toBe(false);
    expect(profile.access).toMatchObject({ isPremium: false, activeSources: [], subscription: null, trial: null, grants: [] });
  });

  it("lists the Premium sources in resolution order and every grant newest first", () => {
    const profile = buildRunnerProfile(baseRows({
      profile: { user_id: USER, trial_ends_at: "2026-11-25T12:00:00.000Z" },
      subscriptions: [{ user_id: USER, status: "active", provider: "apple", current_period_end: "2027-01-01T00:00:00.000Z" }],
      grants: [
        { id: "old", user_id: USER, starts_at: "2026-01-01T00:00:00.000Z", initial_duration_days: 30, reason: "support" },
        { id: "new", user_id: USER, starts_at: "2026-11-20T00:00:00.000Z", initial_duration_days: 30, reason: "partner" },
      ],
    }), NOW);
    expect(profile.access.isPremium).toBe(true);
    expect(profile.access.activeSources).toEqual(["Abonnement", "Essai", "Attribution (Partenaire)"]);
    expect(profile.access.trial).toMatchObject({ remainingDays: 2, active: true });
    expect(profile.access.subscription).toMatchObject({ provider: "apple", active: true });
    expect(profile.access.grants.map((grant) => [grant.id, grant.state])).toEqual([["new", "active"], ["old", "ended"]]);
  });

  it("normalises runner purchases like the billing register (masked client, no amount)", () => {
    const profile = buildRunnerProfile(baseRows({
      unlocks: [{ id: "u1", user_id: USER, plan_key: `race:${RACE}:edition:e`, provider: "apple", provider_transaction_id: "1", status: "active", purchased_at: "2026-11-10T00:00:00.000Z" }],
      support: [{ id: "s1", user_id: USER, provider: "google", status: "refunded", purchased_at: "2026-11-12T00:00:00.000Z" }],
      raceNames: new Map([[RACE, "La Sainté-Lyon"]]),
    }), NOW);
    expect(profile.purchases.map((entry) => [entry.object, entry.status, entry.amounts])).toEqual([
      ["Soutien volontaire", "refunded", null],
      ["Plan · La Sainté-Lyon", "paid", null],
    ]);
    expect(profile.purchases[0].client).toBe("ca***@gmail.com");
  });

  it("maps messages and what the runner sent, newest first, with their console links", () => {
    const profile = buildRunnerProfile(baseRows({
      profile: { user_id: USER, full_name: "Camille" },
      messages: [{
        id: "m1", user_id: USER, created_by: "admin", feedback_id: 7, race_request_id: null, kind: "admin_message", title: "Merci", body: "Corrigé",
        read_at: null, deleted_at: null, email_requested: true, email_status: "sent", push_requested: false, push_status: "not_requested", push_sent_count: 0, created_at: "2026-11-21T00:00:00.000Z",
      }],
      feedback: [{ id: 7, created_at: "2026-11-19T00:00:00.000Z", kind: "bug", subject: "[bug] Écran blanc", status: "completed", source: "mobile" }],
      raceRequests: [{ id: 3, created_at: "2026-11-20T00:00:00.000Z", race_name: "Trail des Lacs", location: "Annecy", requested_date: "2027-05-01", status: "pending" }],
    }), NOW);
    expect(profile.messages[0]).toMatchObject({ recipient: "Camille", context: "Bug n° 7", readState: "unread", href: "/admin/inbox?vue=bugs" });
    expect(profile.messages[0].channels.map((channel) => channel.label)).toEqual(["Boîte de réception", "E-mail envoyé"]);
    expect(profile.feedback.map((item) => [item.typeLabel, item.title, item.statusLabel, item.href])).toEqual([
      ["Demande de course", "Trail des Lacs", "À traiter", "/admin/inbox?vue=demandes"],
      ["Bug", "Écran blanc", "Traité", "/admin/inbox?vue=bugs"],
    ]);
  });
});
