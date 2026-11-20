import { z } from "zod";

import {
  createReelAutomationRepository,
  refreshReelPlan,
  toPublicAutomation,
} from "../../../../lib/reel-automation";
import { createReelAutomationDeps } from "../../../../lib/reel-generation";
import { parisToday } from "../../../../lib/reel-planner";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

export const dynamic = "force-dynamic";
// Recomputing the plan reads the catalog (a few hundred rows).
export const maxDuration = 60;

const load = async (supabase: Parameters<typeof createReelAutomationRepository>[0]) => {
  const repository = createReelAutomationRepository(supabase);
  const [settings, items] = await Promise.all([repository.getSettings(), repository.listItems()]);
  return toPublicAutomation(settings, items);
};

export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    return renderJson(await load(gate.value.supabase));
  } catch (error) {
    console.error("Reel automation read failed", error instanceof Error ? error.message : error);
    return renderJsonError("L’automatisation n’a pas pu être lue.", 502);
  }
}

const settingsSchema = z.object({
  generationEnabled: z.boolean().optional(),
  autoPublishEnabled: z.boolean().optional(),
  /** Required to turn on publication without review: the admin confirmed the warning. */
  confirmAutoPublish: z.literal(true).optional(),
}).strict();

/** The two switches. Publication auto needs generation and an explicit confirmation; turning generation off turns it off too. */
export async function PATCH(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Réglages invalides.", 400);

  try {
    const repository = createReelAutomationRepository(gate.value.supabase);
    const current = await repository.getSettings();
    const generation = parsed.data.generationEnabled ?? current.generation_enabled;
    let autoPublish = parsed.data.autoPublishEnabled ?? current.auto_publish_enabled;
    if (!generation) autoPublish = false;
    if (autoPublish && !current.auto_publish_enabled && parsed.data.confirmAutoPublish !== true) {
      return renderJsonError("Confirme la publication sans relecture avant de l’activer.", 409);
    }
    if (parsed.data.autoPublishEnabled && !generation) {
      return renderJsonError("Active d’abord la génération automatique.", 409);
    }
    await repository.updateSettings({ generation_enabled: generation, auto_publish_enabled: autoPublish, updated_by: gate.value.userId });
    return renderJson(await load(gate.value.supabase));
  } catch (error) {
    console.error("Reel automation settings failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les réglages n’ont pas pu être enregistrés.", 502);
  }
}

/** Recomputes the plan now (otherwise done by the hourly tick). Never generates anything. */
export async function POST(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = z.object({ action: z.literal("refresh") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Action invalide.", 400);
  try {
    const deps = createReelAutomationDeps(gate.value.supabase, request);
    const settings = await deps.repository.getSettings();
    await refreshReelPlan(deps, settings, parisToday());
    return renderJson(await load(gate.value.supabase));
  } catch (error) {
    console.error("Reel automation refresh failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le calendrier n’a pas pu être recalculé.", 502);
  }
}
