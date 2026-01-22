import { z } from "zod";

import { fetchCoachTierByName, type CoachTierRow } from "./coach-tiers";
import { getSupabaseServiceConfig } from "./supabase";
import { isTrialActive } from "./trial";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  price_id: string | null;
  plan_name: string | null;
  current_period_end: string | null;
};

type TrialRow = {
  trial_ends_at: string | null;
  trial_expired_seen_at: string | null;
  is_coach?: boolean | null;
  coach_plan_name?: string | null;
};

export type UserEntitlements = {
  isPremium: boolean;
  planLimit: number;
  favoriteLimit: number;
  customProductLimit: number;
  allowExport: boolean;
  allowAutoFill: boolean;
  trialEndsAt: string | null;
  trialExpiredSeenAt: string | null;
  subscriptionStatus: string | null;
};

const subscriptionRowSchema = z.array(
  z.object({
    user_id: z.string(),
    stripe_customer_id: z.string().nullable().optional(),
    stripe_subscription_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    price_id: z.string().nullable().optional(),
    plan_name: z.string().nullable().optional(),
    current_period_end: z.string().nullable().optional(),
  })
);

const trialRowSchema = z.array(
  z.object({
    trial_ends_at: z.string().nullable().optional(),
    trial_expired_seen_at: z.string().nullable().optional(),
    is_coach: z.boolean().nullable().optional(),
    coach_plan_name: z.string().nullable().optional(),
  })
);

const isSubscriptionActive = (subscription: SubscriptionRow | null): boolean => {
  if (!subscription?.status) return false;

  const normalizedStatus = subscription.status.toLowerCase();
  const isActiveStatus = normalizedStatus === "active" || normalizedStatus === "trialing";

  if (!isActiveStatus) return false;

  if (!subscription.current_period_end) return true;

  const periodEnd = new Date(subscription.current_period_end);
  return Number.isFinite(periodEnd.getTime()) ? periodEnd.getTime() > Date.now() : false;
};

const getDefaultEntitlements = (): UserEntitlements => ({
  isPremium: false,
  planLimit: 1,
  favoriteLimit: Number.POSITIVE_INFINITY,
  customProductLimit: 1,
  allowExport: false,
  allowAutoFill: false,
  trialEndsAt: null,
  trialExpiredSeenAt: null,
  subscriptionStatus: null,
});

const getPremiumEntitlements = (): UserEntitlements => ({
  isPremium: true,
  planLimit: Number.POSITIVE_INFINITY,
  favoriteLimit: Number.POSITIVE_INFINITY,
  customProductLimit: Number.POSITIVE_INFINITY,
  allowExport: true,
  allowAutoFill: true,
  trialEndsAt: null,
  trialExpiredSeenAt: null,
  subscriptionStatus: null,
});

const getCoachTierEntitlements = (tier: CoachTierRow): UserEntitlements => ({
  isPremium: tier.is_premium ?? true,
  planLimit: tier.plan_limit ?? Number.POSITIVE_INFINITY,
  favoriteLimit: tier.favorite_limit ?? Number.POSITIVE_INFINITY,
  customProductLimit: tier.custom_product_limit ?? Number.POSITIVE_INFINITY,
  allowExport: tier.allow_export ?? true,
  allowAutoFill: tier.allow_auto_fill ?? true,
  trialEndsAt: null,
  trialExpiredSeenAt: null,
  subscriptionStatus: null,
});

const withTrialInfo = (
  entitlements: UserEntitlements,
  trialEndsAt: string | null,
  trialExpiredSeenAt: string | null,
  subscriptionStatus: string | null
): UserEntitlements => ({
  ...entitlements,
  trialEndsAt,
  trialExpiredSeenAt,
  subscriptionStatus,
});

export const getUserEntitlements = async (userId: string): Promise<UserEntitlements> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    console.error("Missing Supabase service configuration for entitlements");
    return getDefaultEntitlements();
  }

  try {
    const subscriptionResponse = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=user_id,stripe_customer_id,stripe_subscription_id,status,price_id,plan_name,current_period_end&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!subscriptionResponse.ok) {
      console.error("Unable to load subscription for entitlements", await subscriptionResponse.text());
      return getDefaultEntitlements();
    }

    const subscriptionRow = subscriptionRowSchema.parse(await subscriptionResponse.json())?.[
      0
    ] as SubscriptionRow | undefined;

    const subscriptionActive = isSubscriptionActive(subscriptionRow ?? null);
    const subscriptionPlanName = subscriptionRow?.plan_name ?? null;

    const trialResponse = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
        userId
      )}&select=trial_ends_at,trial_expired_seen_at,is_coach,coach_plan_name&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!trialResponse.ok) {
      console.error("Unable to load trial info for entitlements", await trialResponse.text());
      return subscriptionActive ? getPremiumEntitlements() : getDefaultEntitlements();
    }

    const trialRow = trialRowSchema.parse(await trialResponse.json())?.[0] as TrialRow | undefined;
    const trialActive = isTrialActive(trialRow?.trial_ends_at ?? null);
    const trialEndsAt = trialRow?.trial_ends_at ?? null;
    const trialExpiredSeenAt = trialRow?.trial_expired_seen_at ?? null;
    const subscriptionStatus = subscriptionRow?.status ?? null;
    const isCoach = Boolean(trialRow?.is_coach);
    const coachPlanName = isCoach ? trialRow?.coach_plan_name ?? null : null;

    if (!isCoach && subscriptionActive && subscriptionPlanName) {
      const coachTier = await fetchCoachTierByName(subscriptionPlanName);
      if (coachTier) {
        return withTrialInfo(getCoachTierEntitlements(coachTier), trialEndsAt, trialExpiredSeenAt, subscriptionStatus);
      }
    }

    if (coachPlanName) {
      const coachTier = await fetchCoachTierByName(coachPlanName);
      if (coachTier) {
        return withTrialInfo(getCoachTierEntitlements(coachTier), trialEndsAt, trialExpiredSeenAt, subscriptionStatus);
      }
    }

    if (isCoach) {
      return withTrialInfo(getDefaultEntitlements(), trialEndsAt, trialExpiredSeenAt, subscriptionStatus);
    }

    if (!subscriptionActive && !trialActive) {
      return withTrialInfo(getDefaultEntitlements(), trialEndsAt, trialExpiredSeenAt, subscriptionStatus);
    }

    return withTrialInfo(getPremiumEntitlements(), trialEndsAt, trialExpiredSeenAt, subscriptionStatus);
  } catch (error) {
    console.error("Unexpected error while resolving entitlements", error);
    return getDefaultEntitlements();
  }
};
