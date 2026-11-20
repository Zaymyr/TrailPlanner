import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { runReelAutomationTick } from "../../../../lib/reel-automation";
import { createReelAutomationDeps } from "../../../../lib/reel-generation";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
// One step can write the text (two AI calls in Parcours complet) or voice a whole narration.
export const maxDuration = 300;

/**
 * Hourly at :17 (pg_cron + pg_net, see 20261120140100_schedule_reel_automation_cron.sql): the reel
 * plan is recomputed, renders in flight are followed and, when generation is on, one step of one
 * due item runs. Rules: docs/05-integrations/reel-automation.md.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await runReelAutomationTick(createReelAutomationDeps(supabase, request));
    return withSecurityHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    console.error("Reel automation tick failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to run the reel automation." }, { status: 500 }));
  }
}

export const POST = GET;
