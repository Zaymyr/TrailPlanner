import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
  type SupabaseUser,
} from "../../../../lib/supabase";

type AdminClient = SupabaseClient;

type MergeGuestPayload = {
  sourceAccessToken: string;
  sourceRefreshToken?: string;
};

type UserProfileRow = {
  user_id: string;
  full_name: string | null;
  birth_date: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  water_bag_liters: number | null;
  utmb_index: number | null;
  comfortable_flat_pace_min_per_km: number | null;
  default_carbs_g_per_hour: number | null;
  default_water_ml_per_hour: number | null;
  default_sodium_mg_per_hour: number | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
};

const mergeGuestSchema = z.object({
  sourceAccessToken: z.string().trim().min(1),
  sourceRefreshToken: z.string().trim().min(1).optional(),
});

const profileSelect =
  "user_id, full_name, birth_date, age, weight_kg, height_cm, water_bag_liters, utmb_index, comfortable_flat_pace_min_per_km, default_carbs_g_per_hour, default_water_ml_per_hour, default_sodium_mg_per_hour, trial_started_at, trial_ends_at";

const createAdminClient = () => {
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseService) {
    return null;
  }

  return createClient(supabaseService.supabaseUrl, supabaseService.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

const isAnonymousUser = (user: SupabaseUser | null) =>
  user?.isAnonymous === true || user?.appMetadata?.provider === "anonymous";

async function refreshSupabaseAccessToken(
  refreshToken: string,
  supabaseService: SupabaseServiceConfig
) {
  const response = await fetch(`${supabaseService.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string }
    | null;

  if (!payload?.access_token) {
    return null;
  }

  return payload;
}

async function resolveSourceUser(
  payload: MergeGuestPayload,
  supabaseAnon: NonNullable<ReturnType<typeof getSupabaseAnonConfig>>,
  supabaseService: SupabaseServiceConfig
) {
  const firstUser = await fetchSupabaseUser(payload.sourceAccessToken, supabaseAnon);

  if (firstUser) {
    return {
      user: firstUser,
      accessToken: payload.sourceAccessToken,
    };
  }

  if (!payload.sourceRefreshToken) {
    return {
      user: null,
      accessToken: null,
    };
  }

  const refreshed = await refreshSupabaseAccessToken(payload.sourceRefreshToken, supabaseService);
  if (!refreshed?.access_token) {
    return {
      user: null,
      accessToken: null,
    };
  }

  const refreshedUser = await fetchSupabaseUser(refreshed.access_token, supabaseAnon);
  return {
    user: refreshedUser,
    accessToken: refreshed.access_token,
  };
}

async function mergeFavoriteProducts(adminClient: AdminClient, sourceUserId: string, targetUserId: string) {
  const sourceFavoritesResponse = await adminClient
    .from("user_favorite_products")
    .select("product_id")
    .eq("user_id", sourceUserId);

  if (sourceFavoritesResponse.error) {
    throw sourceFavoritesResponse.error;
  }

  const favoriteRows = (sourceFavoritesResponse.data ?? []).map((row) => ({
    user_id: targetUserId,
    product_id: row.product_id,
  }));

  if (favoriteRows.length > 0) {
    const { error: upsertError } = await adminClient
      .from("user_favorite_products")
      .upsert(favoriteRows, { onConflict: "user_id,product_id", ignoreDuplicates: true });

    if (upsertError) {
      throw upsertError;
    }
  }

  const { error: deleteError } = await adminClient
    .from("user_favorite_products")
    .delete()
    .eq("user_id", sourceUserId);

  if (deleteError) {
    throw deleteError;
  }
}

function pickMergedTrialEnd(
  targetTrialEnd: string | null,
  sourceTrialEnd: string | null
) {
  if (!targetTrialEnd) return sourceTrialEnd;
  if (!sourceTrialEnd) return targetTrialEnd;

  return new Date(sourceTrialEnd) > new Date(targetTrialEnd) ? sourceTrialEnd : targetTrialEnd;
}

function buildMergedProfile(
  targetUserId: string,
  targetProfile: UserProfileRow | null,
  sourceProfile: UserProfileRow | null
) {
  return {
    user_id: targetUserId,
    full_name: targetProfile?.full_name ?? sourceProfile?.full_name ?? null,
    birth_date: targetProfile?.birth_date ?? sourceProfile?.birth_date ?? null,
    age: targetProfile?.age ?? sourceProfile?.age ?? null,
    weight_kg: targetProfile?.weight_kg ?? sourceProfile?.weight_kg ?? null,
    height_cm: targetProfile?.height_cm ?? sourceProfile?.height_cm ?? null,
    water_bag_liters: targetProfile?.water_bag_liters ?? sourceProfile?.water_bag_liters ?? null,
    utmb_index: targetProfile?.utmb_index ?? sourceProfile?.utmb_index ?? null,
    comfortable_flat_pace_min_per_km:
      targetProfile?.comfortable_flat_pace_min_per_km ??
      sourceProfile?.comfortable_flat_pace_min_per_km ??
      null,
    default_carbs_g_per_hour:
      targetProfile?.default_carbs_g_per_hour ?? sourceProfile?.default_carbs_g_per_hour ?? null,
    default_water_ml_per_hour:
      targetProfile?.default_water_ml_per_hour ?? sourceProfile?.default_water_ml_per_hour ?? null,
    default_sodium_mg_per_hour:
      targetProfile?.default_sodium_mg_per_hour ?? sourceProfile?.default_sodium_mg_per_hour ?? null,
    trial_started_at: targetProfile?.trial_started_at ?? sourceProfile?.trial_started_at ?? null,
    trial_ends_at: pickMergedTrialEnd(
      targetProfile?.trial_ends_at ?? null,
      sourceProfile?.trial_ends_at ?? null
    ),
  };
}

async function mergeProfiles(adminClient: AdminClient, sourceUserId: string, targetUserId: string) {
  const [sourceProfileResponse, targetProfileResponse] = await Promise.all([
    adminClient.from("user_profiles").select(profileSelect).eq("user_id", sourceUserId).maybeSingle(),
    adminClient.from("user_profiles").select(profileSelect).eq("user_id", targetUserId).maybeSingle(),
  ]);

  if (sourceProfileResponse.error) {
    throw sourceProfileResponse.error;
  }

  if (targetProfileResponse.error) {
    throw targetProfileResponse.error;
  }

  const sourceProfile = (sourceProfileResponse.data as UserProfileRow | null) ?? null;
  const targetProfile = (targetProfileResponse.data as UserProfileRow | null) ?? null;

  const mergedProfile = buildMergedProfile(targetUserId, targetProfile, sourceProfile);

  const { error: upsertError } = await adminClient
    .from("user_profiles")
    .upsert(mergedProfile, { onConflict: "user_id" });

  if (upsertError) {
    throw upsertError;
  }
}

async function moveUserReference(
  adminClient: AdminClient,
  table: string,
  column: string,
  sourceUserId: string,
  targetUserId: string
) {
  const { error } = await adminClient.from(table).update({ [column]: targetUserId }).eq(column, sourceUserId);

  if (error) {
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const targetToken = extractBearerToken(request.headers.get("authorization"));

  if (!targetToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const parsedBody = mergeGuestSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid merge payload." }, { status: 400 }));
  }

  const targetUser = await fetchSupabaseUser(targetToken, supabaseAnon);

  if (!targetUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid target session." }, { status: 401 }));
  }

  const { user: sourceUser } = await resolveSourceUser(parsedBody.data, supabaseAnon, supabaseService);

  if (!sourceUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid guest session." }, { status: 401 }));
  }

  if (!isAnonymousUser(sourceUser)) {
    return withSecurityHeaders(
      NextResponse.json({ message: "The source session is not an anonymous account." }, { status: 400 })
    );
  }

  if (sourceUser.id === targetUser.id) {
    return withSecurityHeaders(NextResponse.json({ merged: false, sameUser: true }, { status: 200 }));
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  try {
    await mergeProfiles(adminClient, sourceUser.id, targetUser.id);
    await mergeFavoriteProducts(adminClient, sourceUser.id, targetUser.id);

    await moveUserReference(adminClient, "race_plans", "user_id", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "nutrition_plans", "user_id", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "races", "created_by", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "products", "created_by", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "race_requests", "user_id", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "affiliate_events", "user_id", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "coach_invites", "invitee_user_id", sourceUser.id, targetUser.id);
    await moveUserReference(adminClient, "traces", "owner_id", sourceUser.id, targetUser.id);

    const { error: deleteProfileError } = await adminClient
      .from("user_profiles")
      .delete()
      .eq("user_id", sourceUser.id);

    if (deleteProfileError) {
      throw deleteProfileError;
    }

    const { error: deleteSourceUserError } = await adminClient.auth.admin.deleteUser(sourceUser.id);

    if (deleteSourceUserError) {
      console.error("Unable to delete merged anonymous user", deleteSourceUserError);
    }

    return withSecurityHeaders(
      NextResponse.json({
        merged: true,
        sourceUserId: sourceUser.id,
        targetUserId: targetUser.id,
      })
    );
  } catch (error) {
    console.error("Unexpected error while merging guest data", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to merge guest data." }, { status: 500 }));
  }
}
