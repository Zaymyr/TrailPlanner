import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
} from "../../../lib/supabase";

const buildAuthHeaders = (key: string, token: string) => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
});

export async function GET(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
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

  try {
    const params = new URLSearchParams({
      select: "id,name,location_text,distance_km,elevation_gain_m,elevation_loss_m,is_public,created_by,gpx_storage_path",
      is_live: "eq.true",
      is_public: "eq.true",
      order: "name.asc",
    });
    const response = await fetch(
      `${supabaseAnon.supabaseUrl}/rest/v1/races?${params.toString()}`,
      {
        headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load races", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load races." }, { status: 502 }));
    }

    const races = await response.json();
    return withSecurityHeaders(NextResponse.json({ races }));
  } catch (error) {
    console.error("Error loading races", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load races." }, { status: 500 }));
  }
}

export async function POST() {
  return withSecurityHeaders(
    NextResponse.json(
      { message: "Personal race creation is no longer available." },
      { status: 410 }
    )
  );
}
