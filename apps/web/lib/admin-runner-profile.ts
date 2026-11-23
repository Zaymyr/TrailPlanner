import { z } from "zod";

import {
  billingEntrySchema,
  normalizeRunnerSubscription,
  normalizeRunnerSupport,
  normalizeRunnerUnlock,
  runnerSubscriptionRowSchema,
  runnerSupportRowSchema,
  runnerUnlockRowSchema,
  sortBillingEntries,
  type BillingLookups,
} from "./admin-billing";
import { adminMessageRowSchema, adminMessageSchema, mapAdminMessage } from "./admin-messages";

/**
 * Runner profile of the admin console (`GET /api/admin/users/[id]`, drawer of `/admin/runners`), pure
 * and tested: identity and roles (Auth `app_metadata`), activity and onboarding (`user_profiles`),
 * recent plans (`race_plans`), Premium access with the resolution order of premium-entitlement.md
 * (subscription, legacy trial, grants — every grant is listed, active or ended), purchases of the
 * runner ledgers normalised like the billing register (`normalizeRunner*`), the admin messages
 * (`user_notifications`) and what the runner sent (bugs and feedback, race requests).
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export const authUserRowSchema = z.object({
  id: z.string(),
  email: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  last_sign_in_at: z.string().nullable().optional(),
  app_metadata: z.object({ role: z.string().optional(), roles: z.array(z.string()).optional() }).partial().nullable().optional(),
});

export const profileRowSchema = z.object({
  user_id: z.string(),
  full_name: z.string().nullable().optional(),
  sign_in_count: z.number().int().nonnegative().nullable().optional(),
  first_sign_in_at: z.string().nullable().optional(),
  last_sign_in_at: z.string().nullable().optional(),
  trial_ends_at: z.string().nullable().optional(),
  onboarding_completed_at: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  water_bag_liters: z.number().nullable().optional(),
  utmb_index: z.number().nullable().optional(),
  comfortable_flat_pace_min_per_km: z.number().nullable().optional(),
});

export const subscriptionRowSchema = z.object({
  user_id: z.string(),
  status: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  current_period_end: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const grantRowSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  starts_at: z.string(),
  initial_duration_days: z.number(),
  reason: z.string(),
  ends_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
});

export const planRowSchema = z.object({ id: z.string(), name: z.string(), created_at: z.string(), updated_at: z.string().nullable().optional() });

export const feedbackRowSchema = z.object({
  id: z.coerce.number().int(),
  created_at: z.string(),
  kind: z.enum(["bug", "feedback"]),
  subject: z.string(),
  status: z.string(),
  source: z.string().nullable().optional(),
});

export const raceRequestRowSchema = z.object({
  id: z.coerce.number().int(),
  created_at: z.string(),
  race_name: z.string(),
  location: z.string().nullable().optional(),
  requested_date: z.string().nullable().optional(),
  status: z.string(),
});

export type RunnerProfileRows = {
  user: z.infer<typeof authUserRowSchema>;
  profile: z.infer<typeof profileRowSchema> | null;
  subscriptions: z.infer<typeof subscriptionRowSchema>[];
  grants: z.infer<typeof grantRowSchema>[];
  plans: z.infer<typeof planRowSchema>[];
  planCount: number;
  unlocks: z.infer<typeof runnerUnlockRowSchema>[];
  subscriptionAccounts: z.infer<typeof runnerSubscriptionRowSchema>[];
  support: z.infer<typeof runnerSupportRowSchema>[];
  raceNames?: ReadonlyMap<string, string>;
  messages: z.infer<typeof adminMessageRowSchema>[];
  feedback: z.infer<typeof feedbackRowSchema>[];
  raceRequests: z.infer<typeof raceRequestRowSchema>[];
};

const grantSchema = z.object({
  id: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  initialDurationDays: z.number(),
  remainingDurationDays: z.number(),
  reason: z.string(),
  state: z.enum(["active", "scheduled", "ended"]),
});

const feedbackItemSchema = z.object({
  id: z.string(),
  type: z.enum(["bug", "feedback", "race_request"]),
  typeLabel: z.string(),
  title: z.string(),
  detail: z.string().nullable(),
  createdAt: z.string(),
  status: z.enum(["pending", "completed", "rejected"]),
  statusLabel: z.string(),
  href: z.string(),
});

export const runnerProfileSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  fullName: z.string().nullable(),
  roles: z.array(z.string()),
  createdAt: z.string().nullable(),
  lastSignInAt: z.string().nullable(),
  signInCount: z.number().nullable(),
  onboarding: z.object({ completed: z.boolean(), completedAt: z.string().nullable() }),
  plans: z.object({ total: z.number().int().nonnegative(), recent: z.array(z.object({ id: z.string(), name: z.string(), createdAt: z.string(), updatedAt: z.string().nullable() })) }),
  access: z.object({
    isPremium: z.boolean(),
    /** Labels of what currently grants Premium, in resolution order. */
    activeSources: z.array(z.string()),
    subscription: z.object({ status: z.string(), provider: z.string().nullable(), currentPeriodEnd: z.string().nullable(), active: z.boolean() }).nullable(),
    trial: z.object({ endsAt: z.string(), remainingDays: z.number(), active: z.boolean() }).nullable(),
    grants: z.array(grantSchema),
  }),
  purchases: z.array(billingEntrySchema),
  messages: z.array(adminMessageSchema),
  feedback: z.array(feedbackItemSchema),
});
export type RunnerProfile = z.infer<typeof runnerProfileSchema>;

/** Body of `GET /api/admin/users/[id]`: the profile and the sources that could not be read. */
export const runnerProfileResponseSchema = z.object({ profile: runnerProfileSchema, unavailable: z.array(z.string()) });
export type RunnerProfileResponse = z.infer<typeof runnerProfileResponseSchema>;
export type RunnerGrant = z.infer<typeof grantSchema>;

export const RECENT_PLAN_LIMIT = 5;

const time = (value: string | null | undefined) => {
  const ms = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Same rule as `GET /api/admin/premium`: explicit `ends_at`, else start + initial duration. */
export const mapGrant = (row: z.infer<typeof grantRowSchema>, now: Date): RunnerGrant | null => {
  const start = time(row.starts_at);
  if (start === null || row.initial_duration_days <= 0) return null;
  const end = time(row.ends_at) ?? start + row.initial_duration_days * DAY_MS;
  const state = now.getTime() < start ? "scheduled" : now.getTime() < end ? "active" : "ended";
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: new Date(end).toISOString(),
    initialDurationDays: row.initial_duration_days,
    remainingDurationDays: Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS)),
    reason: row.reason,
    state,
  };
};

/** `active` / `trialing` (case-insensitive) and a period end in the future or missing (web rule). */
export const isSubscriptionActive = (status: string | null | undefined, periodEnd: string | null | undefined, now: Date) => {
  const normalized = status?.toLowerCase();
  if (normalized !== "active" && normalized !== "trialing") return false;
  const end = time(periodEnd);
  return periodEnd ? end !== null && end > now.getTime() : true;
};

export const PREMIUM_GRANT_REASON_LABEL: Record<string, string> = {
  trial_extension: "Prolongation d’essai",
  support: "Support",
  marketing: "Marketing",
  partner: "Partenaire",
  other: "Autre",
};

const FEEDBACK_STATUS_LABEL = { pending: "À traiter", completed: "Traité", rejected: "Refusé" } as const;
const normalizeStatus = (status: string): "pending" | "completed" | "rejected" =>
  status === "completed" || status === "approved" ? "completed" : status === "rejected" ? "rejected" : "pending";

/** Bug / feedback subjects are stored with their `[bug] ` / `[feedback] ` client prefix. */
const stripKindPrefix = (subject: string) => subject.replace(/^\s*\[(bug|feedback)\]\s*/i, "").trim() || subject;

export const buildRunnerProfile = (rows: RunnerProfileRows, now = new Date()): RunnerProfile => {
  const { user, profile } = rows;
  const metadata = user.app_metadata ?? {};
  const roles = metadata.roles?.length ? metadata.roles : metadata.role ? [metadata.role] : ["user"];

  const subscription = [...rows.subscriptions].sort((left, right) => (time(right.updated_at) ?? 0) - (time(left.updated_at) ?? 0))[0] ?? null;
  const subscriptionActive = subscription ? isSubscriptionActive(subscription.status, subscription.current_period_end, now) : false;

  const trialEnd = time(profile?.trial_ends_at);
  const trial = profile?.trial_ends_at && trialEnd !== null
    ? { endsAt: profile.trial_ends_at, remainingDays: Math.max(0, Math.ceil((trialEnd - now.getTime()) / DAY_MS)), active: trialEnd > now.getTime() }
    : null;

  const grants = rows.grants
    .map((row) => mapGrant(row, now))
    .filter((grant): grant is RunnerGrant => grant !== null)
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt));
  const activeGrant = grants.find((grant) => grant.state === "active") ?? null;

  const activeSources = [
    subscriptionActive ? "Abonnement" : null,
    trial?.active ? "Essai" : null,
    activeGrant ? `Attribution (${PREMIUM_GRANT_REASON_LABEL[activeGrant.reason] ?? activeGrant.reason})` : null,
  ].filter((value): value is string => value !== null);

  const lookups: BillingLookups = { emailByUserId: new Map(user.email ? [[user.id, user.email]] : []), raceNameById: rows.raceNames };
  const purchases = sortBillingEntries([
    ...rows.unlocks.map((row) => normalizeRunnerUnlock(row, lookups)),
    ...rows.subscriptionAccounts.map((row) => normalizeRunnerSubscription(row, lookups)),
    ...rows.support.map((row) => normalizeRunnerSupport(row, lookups)),
  ]).map((item) => item.entry);

  const feedbackKindById = new Map(rows.feedback.map((row) => [row.id, row.kind]));
  const identity = { name: profile?.full_name ?? null, email: user.email ?? null };
  const messages = [...rows.messages]
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .map((row) => mapAdminMessage(row, identity, row.feedback_id ? feedbackKindById.get(row.feedback_id) ?? null : null));

  const feedback = [
    ...rows.feedback.map((row) => {
      const status = normalizeStatus(row.status);
      return {
        id: `${row.kind}:${row.id}`,
        type: row.kind,
        typeLabel: row.kind === "bug" ? "Bug" : "Retour",
        title: stripKindPrefix(row.subject),
        detail: row.source && row.source !== "unknown" ? (row.source === "mobile" ? "Application mobile" : "Site web") : null,
        createdAt: row.created_at,
        status,
        statusLabel: FEEDBACK_STATUS_LABEL[status],
        href: `/admin/inbox?vue=${row.kind === "bug" ? "bugs" : "feedback"}`,
      };
    }),
    ...rows.raceRequests.map((row) => {
      const status = normalizeStatus(row.status);
      return {
        id: `race_request:${row.id}`,
        type: "race_request" as const,
        typeLabel: "Demande de course",
        title: row.race_name,
        detail: [row.location, row.requested_date].filter(Boolean).join(" · ") || null,
        createdAt: row.created_at,
        status,
        statusLabel: FEEDBACK_STATUS_LABEL[status],
        href: "/admin/inbox?vue=demandes",
      };
    }),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const onboardingCompleted = Boolean(
    profile && (profile.onboarding_completed_at
      || profile.age != null || profile.water_bag_liters != null || profile.utmb_index != null || profile.comfortable_flat_pace_min_per_km != null),
  );

  return runnerProfileSchema.parse({
    id: user.id,
    email: user.email ?? null,
    fullName: profile?.full_name?.trim() || null,
    roles,
    createdAt: profile?.first_sign_in_at ?? user.created_at ?? null,
    lastSignInAt: profile?.last_sign_in_at ?? user.last_sign_in_at ?? null,
    signInCount: profile?.sign_in_count ?? null,
    onboarding: { completed: onboardingCompleted, completedAt: profile?.onboarding_completed_at ?? null },
    plans: {
      total: Math.max(rows.planCount, rows.plans.length),
      recent: rows.plans.slice(0, RECENT_PLAN_LIMIT).map((plan) => ({ id: plan.id, name: plan.name, createdAt: plan.created_at, updatedAt: plan.updated_at ?? null })),
    },
    access: {
      isPremium: activeSources.length > 0,
      activeSources,
      subscription: subscription
        ? { status: subscription.status ?? "inconnu", provider: subscription.provider ?? null, currentPeriodEnd: subscription.current_period_end ?? null, active: subscriptionActive }
        : null,
      trial,
      grants,
    },
    purchases,
    messages,
    feedback,
  });
};

export const SUBSCRIPTION_PROVIDER_LABEL: Record<string, string> = { web: "Stripe (web)", apple: "App Store", google: "Google Play" };
