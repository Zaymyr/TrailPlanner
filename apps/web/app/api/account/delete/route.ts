import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "../../../../lib/supabase";

type AdminClient = SupabaseClient;

type OwnedPlanRow = {
  plan_gpx_path: string | null;
};

type OwnedRaceRow = {
  id: string;
  gpx_storage_path: string | null;
};

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

const deleteOwnedRows = async (adminClient: AdminClient, table: string, column: string, userId: string) => {
  const { error } = await adminClient.from(table).delete().eq(column, userId);

  if (error) {
    throw error;
  }
};

const nullifyUserReference = async (
  adminClient: AdminClient,
  table: string,
  column: string,
  userId: string,
  payload: Record<string, null>
) => {
  const { error } = await adminClient.from(table).update(payload).eq(column, userId);

  if (error) {
    throw error;
  }
};

const deleteStorageObject = async (
  supabaseService: SupabaseServiceConfig,
  bucket: string,
  storagePath: string
) => {
  const normalizedPath = storagePath.trim();
  if (!normalizedPath) return;

  await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/${bucket}/${normalizedPath}`, {
    method: "DELETE",
    headers: {
      apikey: supabaseService.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
    },
    cache: "no-store",
  }).catch(() => null);
};

const deleteStorageObjects = async (
  supabaseService: SupabaseServiceConfig,
  bucket: string,
  storagePaths: Array<string | null | undefined>
) => {
  const uniquePaths = [...new Set(storagePaths.map((value) => value?.trim() ?? "").filter(Boolean))];

  for (const storagePath of uniquePaths) {
    await deleteStorageObject(supabaseService, bucket, storagePath);
  }
};

export async function DELETE(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const adminClient = createAdminClient();

  if (!adminClient) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  try {
    const ownedPlansResponse = await adminClient
      .from("race_plans")
      .select("plan_gpx_path")
      .eq("user_id", user.id);

    if (ownedPlansResponse.error) {
      throw ownedPlansResponse.error;
    }

    const ownedRacesResponse = await adminClient
      .from("races")
      .select("id, gpx_storage_path")
      .eq("created_by", user.id);

    if (ownedRacesResponse.error) {
      throw ownedRacesResponse.error;
    }

    const ownedRaceIds = ((ownedRacesResponse.data as OwnedRaceRow[] | null) ?? []).map((race) => race.id);

    if (ownedRaceIds.length > 0) {
      const unlinkPlansResponse = await adminClient
        .from("race_plans")
        .update({ race_id: null })
        .in("race_id", ownedRaceIds);

      if (unlinkPlansResponse.error) {
        throw unlinkPlansResponse.error;
      }
    }

    await deleteStorageObjects(
      supabaseService,
      "plan-gpx",
      ((ownedPlansResponse.data as OwnedPlanRow[] | null) ?? []).map((plan) => plan.plan_gpx_path)
    );

    await deleteStorageObjects(
      supabaseService,
      "race-gpx",
      ((ownedRacesResponse.data as OwnedRaceRow[] | null) ?? []).map((race) => race.gpx_storage_path)
    );

    await nullifyUserReference(adminClient, "race_plans", "coach_id", user.id, { coach_id: null });
    await deleteOwnedRows(adminClient, "race_plans", "user_id", user.id);
    await deleteOwnedRows(adminClient, "races", "created_by", user.id);
    await deleteOwnedRows(adminClient, "products", "created_by", user.id);
    await deleteOwnedRows(adminClient, "race_requests", "user_id", user.id);
    await deleteOwnedRows(adminClient, "affiliate_events", "user_id", user.id);
    await deleteOwnedRows(adminClient, "traces", "owner_id", user.id);
    await deleteOwnedRows(adminClient, "coach_invites", "invitee_user_id", user.id);
    await deleteOwnedRows(adminClient, "user_profiles", "user_id", user.id);

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error("Unable to delete Supabase user", deleteUserError);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to delete account." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unexpected error while deleting account", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete account." }, { status: 500 }));
  }
}
