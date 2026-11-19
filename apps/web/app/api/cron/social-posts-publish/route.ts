import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { runPublishingTick } from "../../../../lib/instagram/publisher";
import { createPublisherDeps } from "../../../../lib/instagram/runtime";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Every 5 minutes (pg_cron + pg_net, see 20261119130100_schedule_social_posts_cron.sql): due
 * scheduled posts start publishing and in-flight posts advance one step of the state machine.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await runPublishingTick(createPublisherDeps(supabase, request));
    return withSecurityHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    console.error("Social posts publishing tick failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to advance social posts." }, { status: 500 }));
  }
}

export const POST = GET;
