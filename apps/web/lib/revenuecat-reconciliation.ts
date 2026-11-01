import { z } from "zod";

import { syncRevenueCatSubscriptionForUser } from "./revenuecat";
import { getSupabaseServiceConfig } from "./supabase";

const authUsersPageSchema = z.object({
  users: z.array(z.object({ id: z.string().uuid() })),
});

export type RevenueCatReconciliationResult = {
  scanned: number;
  synced: number;
  unchanged: number;
  failed: number;
};

const reconcileUsers = async (userIds: string[], concurrency: number) => {
  const outcomes: Array<boolean | null> = [];

  for (let index = 0; index < userIds.length; index += concurrency) {
    const batch = userIds.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async (userId) => {
        try {
          const result = await syncRevenueCatSubscriptionForUser(userId);
          if (result.synced) return true;
          return result.reason === "provider_unavailable" ? null : false;
        } catch (error) {
          console.error("Unable to reconcile a RevenueCat subscriber.", error);
          return null;
        }
      })
    );
    outcomes.push(...results);
  }

  return outcomes;
};

export async function reconcileRevenueCatSubscriptions(options?: {
  concurrency?: number;
  perPage?: number;
  maxUsers?: number;
}): Promise<RevenueCatReconciliationResult> {
  const service = getSupabaseServiceConfig();
  if (!service) throw new Error("Supabase service configuration is missing.");

  const concurrency = Math.min(Math.max(options?.concurrency ?? 8, 1), 20);
  const perPage = Math.min(Math.max(options?.perPage ?? 500, 1), 1000);
  const maxUsers = Math.min(Math.max(options?.maxUsers ?? 10_000, 1), 50_000);
  const result: RevenueCatReconciliationResult = { scanned: 0, synced: 0, unchanged: 0, failed: 0 };

  for (let page = 1; result.scanned < maxUsers; page += 1) {
    const response = await fetch(
      `${service.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          apikey: service.supabaseServiceRoleKey,
          Authorization: `Bearer ${service.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to list Supabase Auth users (${response.status}).`);
    }

    const parsed = authUsersPageSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Supabase Auth users response is invalid.");

    const userIds = parsed.data.users.slice(0, maxUsers - result.scanned).map(({ id }) => id);
    if (userIds.length === 0) break;

    const outcomes = await reconcileUsers(userIds, concurrency);
    result.scanned += userIds.length;
    result.synced += outcomes.filter((outcome) => outcome === true).length;
    result.unchanged += outcomes.filter((outcome) => outcome === false).length;
    result.failed += outcomes.filter((outcome) => outcome === null).length;

    if (parsed.data.users.length < perPage) break;
  }

  return result;
}
