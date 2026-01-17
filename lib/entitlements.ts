import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";
import { isTrialActive } from "./trial";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
};

type TrialRow = {
  trial_ends_at: string | null;
};

export type UserEntitlements = {
  isPremium: boolean;
  planLimit: number;
  favoriteLimit: number;
  customProductLimit: number;
  allowExport: boolean;
  allowAutoFill: boolean;
};

const subscriptionRowSchema = z.array(
  z.object({
    user_id: z.string(),
    stripe_customer_id: z.string().nullable().optional(),
    stripe_subscription_id: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    price_id: z.string().nullable().optional(),
    current_period_end: z.string().nullable().optional(),
  })
);

const trialRowSchema = z.array(
  z.object({
    trial_ends_at: z.string().nullable().optional(),
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
});

const getPremiumEntitlements = (): UserEntitlements => ({
  isPremium: true,
  planLimit: Number.POSITIVE_INFINITY,
  favoriteLimit: Number.POSITIVE_INFINITY,
  customProductLimit: Number.POSITIVE_INFINITY,
  allowExport: true,
  allowAutoFill: true,
});

export const getUserEntitlements = async (userId: string): Promise<UserEntitlements> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    console.error("Missing Supabase service configuration for entitlements");
    return getDefaultEntitlements();
  }

  try {
    const subscriptionResponse = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=user_id,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end&limit=1`,
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

    const trialResponse = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
        userId
      )}&select=trial_ends_at&limit=1`,
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

    if (!subscriptionActive && !trialActive) {
      return getDefaultEntitlements();
    }

    return getPremiumEntitlements();
  } catch (error) {
    console.error("Unexpected error while resolving entitlements", error);
    return getDefaultEntitlements();
  }
};
