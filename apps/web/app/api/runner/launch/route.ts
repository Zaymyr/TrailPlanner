import { NextResponse } from "next/server";

import { getRunnerLaunchStatus } from "../../../../lib/runner-access";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAnonymousUser } from "../../../../lib/supabase";

export async function GET(request: Request) {
  const config = getSupabaseAnonConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!config || !token) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
  const user = await fetchSupabaseUser(token, config);
  if (!user?.id || isAnonymousUser(user)) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }
  try {
    return NextResponse.json(await getRunnerLaunchStatus(user.id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ message: "Launch configuration unavailable." }, { status: 503 });
  }
}
