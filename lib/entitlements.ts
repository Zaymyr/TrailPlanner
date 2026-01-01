import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";

type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string | null;
  price_id: string | null;
  current_period_end: string | null;
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
  favoriteLimit: 2,
  customProductLimit: 0,
  allowExport: false,
  allowAutoFill: false,
});

export const getUserEntitlements = async (userId: string): Promise<UserEntitlements> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    console.error("Missing Supabase service configuration for entitlements");
    return getDefaultEntitlements();
  }

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=user_id,stripe_customer_id,stripe_subscription_id,status,price_id,current_period_end&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load subscription for entitlements", await response.text());
      return getDefaultEntitlements();
    }

    const row = subscriptionRowSchema.parse(await response.json())?.[0] as SubscriptionRow | undefined;

    const active = isSubscriptionActive(row ?? null);

    if (!active) {
      return getDefaultEntitlements();
    }

    return {
      isPremium: true,
      planLimit: Number.POSITIVE_INFINITY,
      favoriteLimit: Number.POSITIVE_INFINITY,
      customProductLimit: Number.POSITIVE_INFINITY,
      allowExport: true,
      allowAutoFill: true,
    };
  } catch (error) {
    console.error("Unexpected error while resolving entitlements", error);
    return getDefaultEntitlements();
  }
};
