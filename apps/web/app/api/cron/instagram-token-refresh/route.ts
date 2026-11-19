import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { refreshInstagramTokenIfDue } from "../../../../lib/instagram/accounts";
import { getSocialTokenKey } from "../../../../lib/instagram/crypto";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";

/** Daily (pg_cron): refresh the Instagram long-lived token once it is 50 days old. */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));
  const key = getSocialTokenKey();
  if (!key) return withSecurityHeaders(NextResponse.json({ ok: true, result: { status: "not_configured" } }));

  try {
    const result = await refreshInstagramTokenIfDue({ supabase, key });
    const status = result.status === "failed" ? 502 : 200;
    return withSecurityHeaders(NextResponse.json({ ok: status === 200, result }, { status }));
  } catch (error) {
    console.error("Instagram token refresh failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to refresh the Instagram token." }, { status: 500 }));
  }
}

export const POST = GET;
