import { NextResponse } from "next/server";

import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

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

  if (!user) {
    return NextResponse.json({ message: "Unable to validate session." }, { status: 401 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: user.roles,
    },
  });
}
