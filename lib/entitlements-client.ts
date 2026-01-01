import { z } from "zod";

import type { UserEntitlements } from "./entitlements";

const entitlementsResponseSchema = z.object({
  entitlements: z.object({
    isPremium: z.boolean(),
    planLimit: z.number(),
    favoriteLimit: z.number(),
    customProductLimit: z.number(),
    allowExport: z.boolean(),
    allowAutoFill: z.boolean(),
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

  if (!parsed.success) {
    throw new Error("Invalid entitlements response.");
  }

  return parsed.data.entitlements as UserEntitlements;
};

export const defaultEntitlements: UserEntitlements = {
  isPremium: false,
  planLimit: 1,
  favoriteLimit: 2,
  customProductLimit: 1,
  allowExport: false,
  allowAutoFill: false,
};
