import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

const savePlanSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(1),
  plannerValues: z.record(z.unknown()),
  elevationProfile: z
    .array(z.object({ distanceKm: z.number(), elevationM: z.number() }))
    .default([]),
});

export async function POST(request: Request) {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) {
    return NextResponse.json({ message: "Service config missing." }, { status: 500 });
  }

  const parsed = savePlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid payload." }, { status: 400 });
  }

  const { userId, name, plannerValues, elevationProfile } = parsed.data;

  try {
    const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceConfig.supabaseServiceRoleKey,
        Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: userId,
        name,
        planner_values: plannerValues,
        elevation_profile: elevationProfile,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.[0]) {
      console.error("Failed to save onboarding plan", result);
      return NextResponse.json({ message: "Unable to save plan." }, { status: 500 });
    }

    return NextResponse.json({ plan: result[0] }, { status: 201 });
  } catch (error) {
    console.error("Onboarding plan save error", error);
    return NextResponse.json({ message: "Unable to save plan." }, { status: 500 });
  }
}
