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

type RevenueCatWebhookSnapshot = {
  currentPeriodEnd: string | null;
  priceId: string | null;
  provider: RevenueCatProvider | null;
  status: "active" | "trialing" | "expired";
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
      id: z.string().optional(),
      app_user_id: z.string().optional(),
      entitlement_id: z.string().nullable().optional(),
      entitlement_ids: z.array(z.string()).nullable().optional(),
      expiration_at_ms: z.union([z.number(), z.string()]).nullable().optional(),
      grace_period_expiration_at_ms: z.union([z.number(), z.string()]).nullable().optional(),
      original_app_user_id: z.string().optional(),
      period_type: z.string().nullable().optional(),
      product_id: z.string().nullable().optional(),
      store: z.string().nullable().optional(),
      transferred_from: z.array(z.string()).optional(),
      transferred_to: z.array(z.string()).optional(),
      type: z.string().optional(),
      transaction_id: z.string().nullable().optional(),
      original_transaction_id: z.string().nullable().optional(),
      purchased_at_ms: z.union([z.number(), z.string()]).nullable().optional(),
      event_timestamp_ms: z.union([z.number(), z.string()]).nullable().optional(),
    })
    .optional(),
});

const getRunnerCourseProductId = () =>
  process.env.REVENUECAT_COURSE_PRODUCT_ID?.trim() ||
  process.env.EXPO_PUBLIC_REVENUECAT_COURSE_PRODUCT_ID?.trim() ||
  null;

const getRevenueCatAnnualProductIds = () => new Set([
  process.env.REVENUECAT_ANNUAL_PRODUCT_ID?.trim(),
  process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID?.trim(),
  process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID?.trim(),
].filter((value): value is string => Boolean(value)));

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

const parseRevenueCatWebhookDateMs = (value: number | string | null | undefined): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const toIsoStringFromTimestamp = (value: number | null): string | null => {
  if (value === null || !Number.isFinite(value)) return null;

  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
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

export const extractRevenueCatWebhookSnapshot = (payload: unknown): RevenueCatWebhookSnapshot | null => {
  const parsed = webhookEnvelopeSchema.safeParse(payload);

  if (!parsed.success || !parsed.data.event) {
    return null;
  }

  const event = parsed.data.event;
  const provider = mapRevenueCatStoreToProvider(event.store);
  const effectiveEndTimestamp =
    parseRevenueCatWebhookDateMs(event.grace_period_expiration_at_ms) ??
    parseRevenueCatWebhookDateMs(event.expiration_at_ms);
  const currentPeriodEnd = toIsoStringFromTimestamp(effectiveEndTimestamp);
  const eventType = event.type?.trim().toUpperCase() ?? "";
  const periodType = event.period_type?.trim().toUpperCase() ?? "";
  const hasEntitlementSignal = Boolean(event.entitlement_id) || Boolean(event.entitlement_ids?.length);
  const priceId = event.product_id?.trim() || null;
  // Course unlocks are non-subscription purchases. They must be fulfilled by
  // the runner-plan purchase journal and must never create a Premium row.
  if (priceId && getRunnerCourseProductId() === priceId) return null;
  // Non-renewing purchases are never Premium subscriptions, even when the
  // course-product environment is missing or stale.
  if (eventType === "NON_RENEWING_PURCHASE") return null;
  const config = getRevenueCatConfig();
  const productAllowed = Boolean(priceId && getRevenueCatAnnualProductIds().has(priceId));
  const entitlementAllowed = Boolean(config.entitlementId && (event.entitlement_id === config.entitlementId || event.entitlement_ids?.includes(config.entitlementId)));
  const hasSubscriptionSignal = effectiveEndTimestamp !== null && (productAllowed || entitlementAllowed) && Boolean(priceId || hasEntitlementSignal);

  if (!hasSubscriptionSignal) {
    return null;
  }

  const isExplicitlyExpired = eventType === "EXPIRATION";
  const isActive = !isExplicitlyExpired && (effectiveEndTimestamp === null || effectiveEndTimestamp > Date.now());

  return {
    currentPeriodEnd,
    priceId,
    provider,
    status: isActive ? (periodType === "TRIAL" ? "trialing" : "active") : "expired",
  };
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
  const annualProductIds = getRevenueCatAnnualProductIds();
  const subscriptions = Object.entries(subscriber.subscriptions ?? {}).filter(([productId]) => productId !== getRunnerCourseProductId()).map(([productId, details]) => ({
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
      : null) ?? null;

  const matchedSubscription =
    (entitlementMatch?.details.product_identifier
      ? subscriptions.find(({ productId }) => productId === entitlementMatch.details.product_identifier)
      : null) ??
    activeSubscriptions.find(({ productId }) => annualProductIds.has(productId)) ??
    subscriptions.find(({ productId }) => annualProductIds.has(productId)) ??
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
    const ledgerId = `revenuecat:${payload.user_id}`;
    const ledgerResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/runner_subscription_accounts?on_conflict=provider,provider_subscription_id`, {
      method: "POST",
      headers: {
        apikey: serviceConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ user_id: payload.user_id, provider: payload.provider, provider_subscription_id: ledgerId, status: payload.current_period_end ? payload.status : "expired", current_period_end: payload.current_period_end }),
    });
    if (!ledgerResponse.ok) {
      console.error("Unable to upsert RevenueCat runner subscription ledger", await ledgerResponse.text());
      return false;
    }
    const existing = await fetchExistingSubscription(payload.user_id);
    if (existing?.provider === "web" || existing?.stripe_subscription_id || existing?.stripe_customer_id) return true;

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

const persistRevenueCatWebhookSnapshot = async (
  userId: string,
  snapshot: RevenueCatWebhookSnapshot
): Promise<RevenueCatSyncResult> => {
  if (snapshot.status === "expired") {
    return expireExistingRevenueCatSubscription(userId, {
      currentPeriodEnd: snapshot.currentPeriodEnd,
      priceId: snapshot.priceId,
      providerHint: snapshot.provider,
    });
  }

  if (!snapshot.provider) {
    return {
      currentPeriodEnd: snapshot.currentPeriodEnd,
      provider: null,
      status: snapshot.status,
      synced: false,
    };
  }

  const synced = await persistRevenueCatSubscription({
    user_id: userId,
    provider: snapshot.provider,
    status: snapshot.status,
    price_id: snapshot.priceId,
    plan_name: null,
    current_period_end: snapshot.currentPeriodEnd,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  });

  return {
    currentPeriodEnd: snapshot.currentPeriodEnd,
    provider: snapshot.provider,
    status: snapshot.status,
    synced,
  };
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

const journalRevenueCatCourseEvent = async (
  payload: unknown,
  event: NonNullable<z.infer<typeof webhookEnvelopeSchema>["event"]>,
  provider: RevenueCatProvider,
  transactionId: string,
  transactionStatus: "active" | "refunded" | "revoked",
) => {
  const service = getSupabaseServiceConfig();
  if (!service || !event.id) throw new Error("RevenueCat course webhook is missing its durable event id.");
  const purchasedTimestamp = parseRevenueCatWebhookDateMs(event.purchased_at_ms);
  const eventTimestamp = parseRevenueCatWebhookDateMs(event.event_timestamp_ms) ?? purchasedTimestamp ?? Date.now();
  const eventAt = new Date(eventTimestamp).toISOString();
  const purchasedAt = new Date(purchasedTimestamp ?? eventTimestamp).toISOString();
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_billing_events?on_conflict=provider,provider_event_id`, {
    method: "POST",
    headers: {
      apikey: service.supabaseServiceRoleKey,
      Authorization: `Bearer ${service.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ provider, provider_event_id: event.id, event_type: event.type, transaction_id: transactionId, transaction_status: transactionStatus, event_at: eventAt, payload, processing_error: null }),
  });
  if (!response.ok) throw new Error(`Unable to journal RevenueCat event: ${await response.text()}`);
  return { eventAt, purchasedAt };
};

const markRevenueCatCourseEventProcessed = async (provider: RevenueCatProvider, eventId: string) => {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");
  const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_billing_events?provider=eq.${provider}&provider_event_id=eq.${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: null }),
  });
  if (!response.ok) throw new Error(`Unable to finalize RevenueCat event journal: ${await response.text()}`);
};

export const syncRevenueCatWebhookPayload = async (
  payload: unknown
): Promise<{ providerHint: RevenueCatProvider | null; userIds: string[]; results: RevenueCatSyncResult[] }> => {
  const { providerHint, userIds } = extractRevenueCatWebhookUserIds(payload);

  const envelope = webhookEnvelopeSchema.safeParse(payload);
  const event = envelope.success ? envelope.data.event : null;
  const courseProduct = getRunnerCourseProductId();
  const transactionId = event?.transaction_id ?? event?.original_transaction_id ?? null;
  const eventType = event?.type?.toUpperCase() ?? "";
  const isCourseEvent = Boolean(event && courseProduct && event.product_id === courseProduct);
  if (isCourseEvent && !getSupabaseServiceConfig()) throw new Error("Supabase service configuration is required for RevenueCat course events.");
  if (event && eventType === "NON_RENEWING_PURCHASE" && isCourseEvent && transactionId && userIds[0] && providerHint) {
    const service = getSupabaseServiceConfig();
    if (service) {
      const headers = { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" };
      const { purchasedAt } = await journalRevenueCatCourseEvent(payload, event, providerHint, transactionId, "active");
      const intentResponse = await fetch(`${service.supabaseUrl}/rest/v1/runner_purchase_intents?user_id=eq.${encodeURIComponent(userIds[0])}&provider=eq.${providerHint}&status=eq.pending&product_id=eq.${encodeURIComponent(courseProduct!)}&created_at=lte.${encodeURIComponent(purchasedAt)}&expires_at=gte.${encodeURIComponent(purchasedAt)}&select=id,plan_id,plan_key&order=created_at.desc&limit=1`, { headers });
      if (!intentResponse.ok) throw new Error(`Unable to load RevenueCat purchase intent: ${await intentResponse.text()}`);
      const intent = ((await intentResponse.json()) as Array<{ id: string; plan_id: string | null; plan_key: string }>)[0];
      if (intent) {
        const claim = await fetch(`${service.supabaseUrl}/rest/v1/rpc/claim_runner_plan_unlock`, { method: "POST", headers, body: JSON.stringify({ p_user_id: userIds[0], p_plan_id: intent.plan_id, p_provider: providerHint, p_transaction_id: transactionId, p_product_id: courseProduct, p_purchased_at: purchasedAt, p_intent_id: intent.id }) });
        if (!claim.ok) throw new Error(`Unable to claim RevenueCat course purchase: ${await claim.text()}`);
        if ((await claim.json().catch(() => false)) !== true) throw new Error("RevenueCat course purchase claim was rejected.");
        await markRevenueCatCourseEventProcessed(providerHint, event.id!);
      }
    }
  }
  if (event && isCourseEvent && (eventType === "CANCELLATION" || eventType === "REFUND") && transactionId && providerHint) {
    const service = getSupabaseServiceConfig();
    if (service) {
      await journalRevenueCatCourseEvent(payload, event, providerHint, transactionId, "refunded");
      const revoke = await fetch(`${service.supabaseUrl}/rest/v1/rpc/revoke_runner_payment_transaction`, { method: "POST", headers: { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_provider: providerHint, p_transaction_id: transactionId, p_status: "refunded" }) });
      if (!revoke.ok || (await revoke.json().catch(() => false)) !== true) throw new Error("Unable to revoke RevenueCat course purchase.");
      await markRevenueCatCourseEventProcessed(providerHint, event.id!);
    }
  }
  if (event && isCourseEvent && eventType === "REFUND_REVERSED" && transactionId && providerHint) {
    const service = getSupabaseServiceConfig();
    if (service) {
      await journalRevenueCatCourseEvent(payload, event, providerHint, transactionId, "active");
      const restore = await fetch(`${service.supabaseUrl}/rest/v1/rpc/restore_runner_payment_transaction`, { method: "POST", headers: { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_provider: providerHint, p_transaction_id: transactionId }) });
      if (!restore.ok || (await restore.json().catch(() => false)) !== true) throw new Error("Unable to restore RevenueCat course purchase.");
      await markRevenueCatCourseEventProcessed(providerHint, event.id!);
    }
  }

  if (isCourseEvent) return { providerHint, userIds, results: [] };
  if (eventType === "NON_RENEWING_PURCHASE") return { providerHint, userIds, results: [] };

  if (userIds.length === 0) {
    return {
      providerHint,
      userIds,
      results: [],
    };
  }

  const snapshot = extractRevenueCatWebhookSnapshot(payload);

  if (!snapshot) {
    const results = await Promise.all(
      userIds.map((userId) => syncRevenueCatSubscriptionForUser(userId, { providerHint }))
    );

    return {
      providerHint,
      userIds,
      results,
    };
  }

  const results = await Promise.all(userIds.map((userId) => persistRevenueCatWebhookSnapshot(userId, snapshot)));

  return {
    providerHint,
    userIds,
    results,
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
