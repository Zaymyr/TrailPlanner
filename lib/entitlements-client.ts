import { z } from "zod";

import type { UserEntitlements } from "./entitlements";

const entitlementsResponseSchema = z.object({
  entitlements: z.object({
    isPremium: z.boolean(),
    planLimit: z.number().nullable().optional(),
    favoriteLimit: z.number().nullable().optional(),
    customProductLimit: z.number().nullable().optional(),
    allowExport: z.boolean().optional(),
    allowAutoFill: z.boolean().optional(),
    trialEndsAt: z.string().nullable().optional(),
    trialExpiredSeenAt: z.string().nullable().optional(),
    subscriptionStatus: z.string().nullable().optional(),
  }),
});

export const fetchEntitlements = async (accessToken: string, signal?: AbortSignal): Promise<UserEntitlements> => {
  const response = await fetch("/api/entitlements", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal,
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? "Unable to load entitlements.";
    throw new Error(message);
  }

  const parsed = entitlementsResponseSchema.safeParse(payload);

  if (!parsed.success || !parsed.data.entitlements) {
    console.error("Invalid entitlements response", payload);
    return defaultEntitlements;
  }

  const normalized: UserEntitlements = {
    isPremium: parsed.data.entitlements.isPremium,
    planLimit: parsed.data.entitlements.planLimit ?? (parsed.data.entitlements.isPremium ? Number.POSITIVE_INFINITY : 1),
    favoriteLimit: parsed.data.entitlements.favoriteLimit ?? Number.POSITIVE_INFINITY,
    customProductLimit:
      parsed.data.entitlements.customProductLimit ?? (parsed.data.entitlements.isPremium ? Number.POSITIVE_INFINITY : 1),
    allowExport: Boolean(parsed.data.entitlements.allowExport ?? parsed.data.entitlements.isPremium),
    allowAutoFill: Boolean(parsed.data.entitlements.allowAutoFill ?? parsed.data.entitlements.isPremium),
    trialEndsAt: parsed.data.entitlements.trialEndsAt ?? null,
    trialExpiredSeenAt: parsed.data.entitlements.trialExpiredSeenAt ?? null,
    subscriptionStatus: parsed.data.entitlements.subscriptionStatus ?? null,
  };

  return normalized;
};

export const defaultEntitlements: UserEntitlements = {
  isPremium: false,
  planLimit: 1,
  favoriteLimit: Number.POSITIVE_INFINITY,
  customProductLimit: 1,
  allowExport: false,
  allowAutoFill: false,
  trialEndsAt: null,
  trialExpiredSeenAt: null,
  subscriptionStatus: null,
};
