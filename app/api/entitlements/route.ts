import { NextResponse } from "next/server";

import { getUserEntitlements } from "../../../lib/entitlements";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../lib/supabase";

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token." }, { status: 401 });
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return NextResponse.json({ message: "Invalid session." }, { status: 401 });
  }

  const entitlements = await getUserEntitlements(user.id);

  return NextResponse.json({ entitlements });
}
