import { NextResponse } from "next/server";

import { getSupabaseAnonConfig } from "../../../../lib/supabase";

export async function POST() {
  const supabaseConfig = getSupabaseAnonConfig();
  if (!supabaseConfig) {
    return NextResponse.json({ message: "Config missing." }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.access_token) {
      return NextResponse.json({ message: "Unable to create anonymous session." }, { status: 500 });
    }

    return NextResponse.json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      user_id: result.user?.id,
    });
  } catch (error) {
    console.error("Unexpected error during anonymous sign-in", error);
    return NextResponse.json({ message: "Unable to create anonymous session." }, { status: 500 });
  }
}
