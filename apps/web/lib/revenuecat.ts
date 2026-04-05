import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";

export type RevenueCatProvider = "google" | "apple";
export const revenueCatProviderSchema = z.enum(["google", "apple"]);

type RevenueCatConfig = {
  secretApiKey: string | null;
  androidPublicApiKey: string | null;
  iosPublicApiKey: string | null;
  entitlementId: string | null;
  webhookAuthorization: string | null;
};

type RevenueCatSubscriptionSnapshot = {
  currentPeriodEnd: string | null;
  priceId: string | null;
  provider: RevenueCatProvider | null;
  status: "active" | "trialing" | "expired";
};

type RevenueCatSyncResult = {
  currentPeriodEnd: string | null;
  provider: RevenueCatProvider | null;
  status: "active" | "trialing" | "expired" | null;
  synced: boolean;
};

type ExistingSubscriptionRow = {
  current_period_end: string | null;
  price_id: string | null;
  provider: string | null;
  status: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  user_id: string;
};

const revenueCatSubscriberSchema = z.object({
  subscriber: z.object({
    entitlements: z
      .record(
        z.object({
          expires_date: z.string().nullable().optional(),
          product_identifier: z.string().nullable().optional(),
        })
      )
      .optional()
      .default({}),
    subscriptions: z
      .record(
        z.object({
          billing_issues_detected_at: z.string().nullable().optional(),
          expires_date: z.string().nullable().optional(),
          ownership_type: z.string().nullable().optional(),
          period_type: z.string().nullable().optional(),
          purchase_date: z.string().nullable().optional(),
          refunded_at: z.string().nullable().optional(),
          store: z.string().nullable().optional(),
          unsubscribe_detected_at: z.string().nullable().optional(),
        })
      )
      .optional()
      .default({}),
  }),
});

const webhookEnvelopeSchema = z.object({
  api_version: z.string().optional(),
  event: z
    .object({
      aliases: z.array(z.string()).optional(),
      app_user_id: z.string().optional(),
      original_app_user_id: z.string().optional(),
      store: z.string().nullable().optional(),
      transferred_from: z.array(z.string()).optional(),
      transferred_to: z.array(z.string()).optional(),
      type: z.string().optional(),
    })
    .optional(),
});

const userIdSchema = z.string().uuid();
const existingSubscriptionRowSchema = z.array(
  z.object({
    current_period_end: z.string().nullable().optional(),
    price_id: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    stripe_customer_id: z.string().nullable().optional(),
    stripe_subscription_id: z.string().nullable().optional(),
    user_id: z.string(),
  })
);

const getRevenueCatConfig = (): RevenueCatConfig => ({
  secretApiKey:
    process.env.REVENUECAT_SECRET_API_KEY?.trim() ||
    process.env.REVENUECAT_API_KEY?.trim() ||
    process.env.REVENUECAT_PUBLIC_API_KEY?.trim() ||
    null,
  androidPublicApiKey:
    process.env.REVENUECAT_ANDROID_SECRET_API_KEY?.trim() ||
    process.env.REVENUECAT_ANDROID_PUBLIC_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim() ||
    null,
  iosPublicApiKey:
    process.env.REVENUECAT_IOS_SECRET_API_KEY?.trim() ||
    process.env.REVENUECAT_IOS_PUBLIC_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim() ||
    null,
  entitlementId:
    process.env.REVENUECAT_ENTITLEMENT_ID?.trim() ||
    process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID?.trim() ||
    null,
  webhookAuthorization:
    process.env.REVENUECAT_WEBHOOK_AUTHORIZATION?.trim() ||
    process.env.REVENUECAT_WEBHOOK_AUTH?.trim() ||
    null,
});

const isUuid = (value: string): boolean => userIdSchema.safeParse(value).success;

const parseRevenueCatDate = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const isStillActive = (value: string | null | undefined): boolean => {
  const timestamp = parseRevenueCatDate(value);
  if (timestamp === null) return value === null;
  return timestamp > Date.now();
};

const mapRevenueCatStoreToProvider = (store: string | null | undefined): RevenueCatProvider | null => {
  const normalized = store?.trim().toUpperCase() ?? "";

  if (normalized === "PLAY_STORE") return "google";
  if (normalized === "APP_STORE" || normalized === "MAC_APP_STORE") return "apple";

  return null;
};

const getCandidateApiKeys = (
  config: RevenueCatConfig,
  providerHint?: RevenueCatProvider | null
): Array<{ key: string; provider: RevenueCatProvider }> => {
  const candidates: Array<{ key: string; provider: RevenueCatProvider }> = [];

  if (config.secretApiKey) {
    candidates.push({
      key: config.secretApiKey,
      provider: providerHint ?? "apple",
    });
  }

  if (providerHint === "google" && config.androidPublicApiKey) {
    candidates.push({ key: config.androidPublicApiKey, provider: "google" });
  }

  if (providerHint === "apple" && config.iosPublicApiKey) {
    candidates.push({ key: config.iosPublicApiKey, provider: "apple" });
  }

  if (config.androidPublicApiKey && !candidates.some((item) => item.key === config.androidPublicApiKey)) {
    candidates.push({ key: config.androidPublicApiKey, provider: "google" });
  }

  if (config.iosPublicApiKey && !candidates.some((item) => item.key === config.iosPublicApiKey)) {
    candidates.push({ key: config.iosPublicApiKey, provider: "apple" });
  }

  return candidates;
};

const fetchExistingSubscription = async (userId: string): Promise<ExistingSubscriptionRow | null> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    return null;
  }

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(
        userId
      )}&select=user_id,provider,status,price_id,current_period_end,stripe_customer_id,stripe_subscription_id&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load existing subscription for RevenueCat sync", await response.text());
      return null;
    }

    return (existingSubscriptionRowSchema.parse(await response.json())?.[0] as ExistingSubscriptionRow | undefined) ?? null;
  } catch (error) {
    console.error("Unexpected error while loading existing subscription for RevenueCat sync", error);
    return null;
  }
};

const fetchRevenueCatSubscriber = async (
  userId: string,
  providerHint?: RevenueCatProvider | null
) => {
  const config = getRevenueCatConfig();
  const candidates = getCandidateApiKeys(config, providerHint);

  if (candidates.length === 0) {
    return null;
  }

  let lastPayload: unknown = null;

  for (const candidate of candidates) {
    try {
      const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: {
          Authorization: `Bearer ${candidate.key}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        lastPayload = payload;
        continue;
      }

      const parsed = revenueCatSubscriberSchema.safeParse(payload);

      if (!parsed.success) {
        lastPayload = payload;
        continue;
      }

      return parsed.data.subscriber;
    } catch (error) {
      lastPayload = error;
    }
  }

  if (lastPayload) {
    console.warn("Unable to fetch RevenueCat subscriber", { userId, lastPayload });
  }

  return null;
};

const resolveRevenueCatSnapshot = (
  subscriber: z.infer<typeof revenueCatSubscriberSchema>["subscriber"],
  providerHint?: RevenueCatProvider | null
): RevenueCatSubscriptionSnapshot | null => {
  const config = getRevenueCatConfig();
  const subscriptions = Object.entries(subscriber.subscriptions ?? {}).map(([productId, details]) => ({
    details,
    productId,
  }));
  const activeSubscriptions = subscriptions.filter(
    ({ details }) => !details.refunded_at && isStillActive(details.expires_date)
  );

  const activeEntitlements = Object.entries(subscriber.entitlements ?? {})
    .map(([identifier, details]) => ({
      details,
      identifier,
    }))
    .filter(({ details }) => isStillActive(details.expires_date));

  const entitlementMatch =
    (config.entitlementId
      ? activeEntitlements.find(({ identifier }) => identifier === config.entitlementId)
      : null) ?? activeEntitlements[0] ?? null;

  const matchedSubscription =
    (entitlementMatch?.details.product_identifier
      ? subscriptions.find(({ productId }) => productId === entitlementMatch.details.product_identifier)
      : null) ??
    activeSubscriptions[0] ??
    subscriptions[0] ??
    null;

  if (!matchedSubscription && !entitlementMatch) {
    return null;
  }

  const provider =
    mapRevenueCatStoreToProvider(matchedSubscription?.details.store) ?? providerHint ?? null;
  const currentPeriodEnd =
    entitlementMatch?.details.expires_date ?? matchedSubscription?.details.expires_date ?? null;
  const productId =
    entitlementMatch?.details.product_identifier ?? matchedSubscription?.productId ?? null;

  const isActive = Boolean(entitlementMatch) || Boolean(matchedSubscription && isStillActive(matchedSubscription.details.expires_date));

  if (!isActive) {
    return {
      currentPeriodEnd,
      priceId: productId,
      provider,
      status: "expired",
    };
  }

  const periodType = matchedSubscription?.details.period_type?.trim().toUpperCase() ?? "";

  return {
    currentPeriodEnd,
    priceId: productId,
    provider,
    status: periodType === "TRIAL" ? "trialing" : "active",
  };
};

const persistRevenueCatSubscription = async (
  payload: {
    current_period_end: string | null;
    plan_name: null;
    price_id: string | null;
    provider: RevenueCatProvider;
    status: "active" | "trialing" | "expired";
    stripe_customer_id: null;
    stripe_subscription_id: null;
    user_id: string;
  }
): Promise<boolean> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    return false;
  }

  try {
    const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
      method: "POST",
      headers: {
        apikey: serviceConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("Unable to upsert RevenueCat subscription", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unexpected error while upserting RevenueCat subscription", error);
    return false;
  }
};

const upsertRevenueCatSubscription = async (
  userId: string,
  snapshot: RevenueCatSubscriptionSnapshot
): Promise<boolean> => {
  if (!snapshot.provider) {
    return false;
  }

  return persistRevenueCatSubscription({
    user_id: userId,
    provider: snapshot.provider,
    status: snapshot.status,
    price_id: snapshot.priceId,
    plan_name: null,
    current_period_end: snapshot.currentPeriodEnd,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  });
};

const expireExistingRevenueCatSubscription = async (
  userId: string,
  options?: { currentPeriodEnd?: string | null; priceId?: string | null; providerHint?: RevenueCatProvider | null }
): Promise<RevenueCatSyncResult> => {
  const existingSubscription = await fetchExistingSubscription(userId);
  const existingProvider = revenueCatProviderSchema.safeParse(existingSubscription?.provider ?? null);
  const provider = options?.providerHint ?? (existingProvider.success ? existingProvider.data : null);

  if (!provider) {
    return {
      currentPeriodEnd: options?.currentPeriodEnd ?? null,
      provider: null,
      status: "expired",
      synced: false,
    };
  }

  if (!existingSubscription && !options?.priceId && !options?.currentPeriodEnd) {
    return {
      currentPeriodEnd: null,
      provider,
      status: "expired",
      synced: false,
    };
  }

  if (existingSubscription && !existingProvider.success) {
    return {
      currentPeriodEnd: existingSubscription.current_period_end,
      provider: null,
      status: existingSubscription.status === "active" || existingSubscription.status === "trialing" ? null : "expired",
      synced: false,
    };
  }

  const synced = await persistRevenueCatSubscription({
    user_id: userId,
    provider,
    status: "expired",
    price_id: options?.priceId ?? existingSubscription?.price_id ?? null,
    plan_name: null,
    current_period_end: options?.currentPeriodEnd ?? existingSubscription?.current_period_end ?? null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  });

  return {
    currentPeriodEnd: options?.currentPeriodEnd ?? existingSubscription?.current_period_end ?? null,
    provider,
    status: "expired",
    synced,
  };
};

export const syncRevenueCatSubscriptionForUser = async (
  userId: string,
  options?: { providerHint?: RevenueCatProvider | null }
): Promise<RevenueCatSyncResult> => {
  const subscriber = await fetchRevenueCatSubscriber(userId, options?.providerHint);

  if (!subscriber) {
    return expireExistingRevenueCatSubscription(userId, {
      providerHint: options?.providerHint,
    });
  }

  const snapshot = resolveRevenueCatSnapshot(subscriber, options?.providerHint);

  if (!snapshot) {
    return expireExistingRevenueCatSubscription(userId, {
      providerHint: options?.providerHint,
    });
  }

  const synced =
    snapshot.status === "expired"
      ? (
          await expireExistingRevenueCatSubscription(userId, {
            currentPeriodEnd: snapshot.currentPeriodEnd,
            priceId: snapshot.priceId,
            providerHint: snapshot.provider ?? options?.providerHint ?? null,
          })
        ).synced
      : await upsertRevenueCatSubscription(userId, snapshot);

  return {
    currentPeriodEnd: snapshot.currentPeriodEnd,
    provider: snapshot.provider,
    status: snapshot.status,
    synced,
  };
};

export const getRevenueCatWebhookAuthorization = (): string | null => getRevenueCatConfig().webhookAuthorization;

export const extractRevenueCatWebhookUserIds = (
  payload: unknown
): { providerHint: RevenueCatProvider | null; userIds: string[] } => {
  const parsed = webhookEnvelopeSchema.safeParse(payload);

  if (!parsed.success || !parsed.data.event) {
    return { providerHint: null, userIds: [] };
  }

  const event = parsed.data.event;
  const providerHint = mapRevenueCatStoreToProvider(event.store);
  const rawIds = [
    event.app_user_id,
    event.original_app_user_id,
    ...(event.aliases ?? []),
    ...(event.transferred_from ?? []),
    ...(event.transferred_to ?? []),
  ].filter((value): value is string => Boolean(value));

  return {
    providerHint,
    userIds: [...new Set(rawIds.filter(isUuid))],
  };
};
