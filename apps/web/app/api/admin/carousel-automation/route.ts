import { z } from "zod";

import { createCarouselItemRepository, refreshCarouselPlan, toPublicCarouselItems, weekMondaysFrom } from "../../../../lib/carousels/carousel-automation";
import { CarouselSkip, loadUpcomingRaces } from "../../../../lib/carousels/carousel-data";
import { createCarouselAutomationDeps, generateCarouselNow } from "../../../../lib/carousels/carousel-generation";
import { createReelAutomationRepository } from "../../../../lib/reel-automation";
import { parisToday } from "../../../../lib/reel-planner";
import type { SupabaseServiceConfig } from "../../../../lib/supabase";
import { authorizeVideoAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";
// « Générer maintenant » reads the race and writes the caption (one AI call) before the render starts.
export const maxDuration = 300;

const load = async (supabase: SupabaseServiceConfig) => {
  const today = parisToday();
  const [settings, items, races] = await Promise.all([
    createReelAutomationRepository(supabase).getSettings(),
    createCarouselItemRepository(supabase).list(),
    loadUpcomingRaces(supabase, today, 42),
  ]);
  return {
    // « Générer maintenant » choices: the next formats and the next Mondays.
    races,
    weeks: weekMondaysFrom(today),
    series: { plan: settings.plan_carousel_enabled, brief: settings.brief_carousel_enabled, week: settings.week_carousel_enabled },
    items: toPublicCarouselItems(items, settings),
  };
};

export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    return renderJson(await load(gate.value.supabase));
  } catch (error) {
    console.error("Carousel automation read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les carrousels n’ont pas pu être lus.", 502);
  }
}

const seriesSchema = z.object({ plan: z.boolean().optional(), brief: z.boolean().optional(), week: z.boolean().optional() }).strict();

/** The three series switches (stored with the reel automation settings). */
export async function PATCH(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = seriesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Réglages invalides.", 400);
  try {
    await createReelAutomationRepository(gate.value.supabase).updateSettings({
      ...(parsed.data.plan !== undefined ? { plan_carousel_enabled: parsed.data.plan } : {}),
      ...(parsed.data.brief !== undefined ? { brief_carousel_enabled: parsed.data.brief } : {}),
      ...(parsed.data.week !== undefined ? { week_carousel_enabled: parsed.data.week } : {}),
      updated_by: gate.value.userId,
    });
    return renderJson(await load(gate.value.supabase));
  } catch (error) {
    console.error("Carousel series settings failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les réglages n’ont pas pu être enregistrés.", 502);
  }
}

const actionSchema = z.union([
  z.object({ action: z.literal("refresh") }),
  z.object({ action: z.literal("generate"), series: z.enum(["plan", "brief"]), raceId: z.string().uuid() }),
  z.object({ action: z.literal("generate"), series: z.literal("week"), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
]);

/** « Recalculer » (never generates), or « Générer maintenant » for a chosen race or week (manual, outside the slots). */
export async function POST(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Action invalide.", 400);
  const { supabase, userId } = gate.value;
  const action = parsed.data;
  try {
    if (action.action === "refresh") {
      const deps = createCarouselAutomationDeps(supabase, request);
      await refreshCarouselPlan(deps, await deps.getSettings(), parisToday());
      return renderJson(await load(supabase));
    }
    let target: { series: "plan" | "brief"; raceId: string } | { series: "week"; weekStart: string };
    if ("weekStart" in action) {
      if (new Date(`${action.weekStart}T12:00:00Z`).getUTCDay() !== 1) return renderJsonError("La semaine doit commencer un lundi.", 400);
      target = { series: "week", weekStart: action.weekStart };
    } else {
      target = { series: action.series, raceId: action.raceId };
    }
    const job = await generateCarouselNow({ supabase, request, userId, target });
    return renderJson({ jobId: job.id, message: "Rendu lancé : le brouillon apparaîtra dans les publications dans quelques minutes." }, 202);
  } catch (error) {
    if (error instanceof CarouselSkip) return renderJsonError(`Carrousel impossible : ${error.message}`, 422);
    console.error("Carousel action failed", error instanceof Error ? error.message : error);
    return renderJsonError(describeRenderError(error, "Le carrousel n’a pas pu être généré."), 502);
  }
}
