import { NextResponse } from "next/server";

import { createFlyoverDeps, runFlyoverTick } from "../../../../lib/flyover-generation";
import { withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
// One step can write the text (two AI calls) or voice a whole narration and start its render.
export const maxDuration = 300;

/**
 * Every 10 minutes (pg_cron + pg_net, see 20261122100100_schedule_flyover_orders_cron.sql): the
 * renders of organizer flyover orders are followed, then one step of one paid order runs. Rules:
 * docs/03-business-rules/flyover-video-orders.md.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await runFlyoverTick(createFlyoverDeps(supabase, request));
    return withSecurityHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    console.error("Flyover orders tick failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to run the flyover orders." }, { status: 500 }));
  }
}

export const POST = GET;
