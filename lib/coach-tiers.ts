import { z } from "zod";

import { getSupabaseServiceConfig } from "./supabase";

const coachTierRowSchema = z.array(
  z.object({
    name: z.string(),
    invite_limit: z.number(),
    plan_limit: z.number().nullable().optional(),
    favorite_limit: z.number().nullable().optional(),
    custom_product_limit: z.number().nullable().optional(),
    allow_export: z.boolean().nullable().optional(),
    allow_auto_fill: z.boolean().nullable().optional(),
    is_premium: z.boolean().nullable().optional(),
  })
);

export type CoachTierRow = z.infer<typeof coachTierRowSchema>[number];

export const fetchCoachTierByName = async (planName: string): Promise<CoachTierRow | null> => {
  const serviceConfig = getSupabaseServiceConfig();

  if (!serviceConfig) {
    console.error("Missing Supabase service configuration for coach tiers");
    return null;
  }

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/coach_tiers?name=eq.${encodeURIComponent(
        planName
      )}&select=name,invite_limit,plan_limit,favorite_limit,custom_product_limit,allow_export,allow_auto_fill,is_premium&limit=1`,
      {
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load coach tier", await response.text());
      return null;
    }

    return coachTierRowSchema.parse(await response.json())?.[0] ?? null;
  } catch (error) {
    console.error("Unexpected error while loading coach tier", error);
    return null;
  }
};
