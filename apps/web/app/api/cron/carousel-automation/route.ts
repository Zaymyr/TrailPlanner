import { NextResponse } from "next/server";

import { runCarouselAutomationTick } from "../../../../lib/carousels/carousel-automation";
import { createCarouselAutomationDeps } from "../../../../lib/carousels/carousel-generation";
import { withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
// The content step reads the race and makes one AI call.
export const maxDuration = 300;

/**
 * Hourly at :47 (pg_cron + pg_net, see 20261120180100_schedule_carousel_automation_cron.sql): the
 * carousel slots are recomputed, renders in flight are followed and, when generation is on, one
 * step of one due slot runs. Rules: docs/05-integrations/instagram-carousels.md.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }
  const supabase = getSupabaseServiceConfig();
  if (!supabase) return withSecurityHeaders(NextResponse.json({ message: "Supabase service configuration is missing." }, { status: 500 }));

  try {
    const result = await runCarouselAutomationTick(createCarouselAutomationDeps(supabase, request));
    return withSecurityHeaders(NextResponse.json({ ok: true, ...result }));
  } catch (error) {
    console.error("Carousel automation tick failed.", error instanceof Error ? error.message : error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to run the carousel automation." }, { status: 500 }));
  }
}

export const POST = GET;
