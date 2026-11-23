import { z } from "zod";

import { runnerProfileResponseSchema } from "../../../../../lib/admin-runner-profile";
import { loadRunnerProfile } from "../../../../../lib/admin-runner-profile-server";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

/**
 * Runner profile of the admin console (drawer of `/admin/runners?coureur=<id>`): identity, roles,
 * activity, onboarding, recent plans, Premium access (subscription, trial, every grant), runner
 * purchases, admin messages and what the runner sent. Read-only; admin session required; the
 * runner's e-mail is never logged.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const userId = z.string().uuid().safeParse(params.id);
  if (!userId.success) return renderJsonError("Identifiant de coureur invalide.", 400);
  try {
    const result = await loadRunnerProfile(gate.value.supabase, userId.data);
    if (!result) return renderJsonError("Coureur introuvable.", 404);
    return renderJson(runnerProfileResponseSchema.parse(result));
  } catch (error) {
    console.error("Admin runner profile failed", error instanceof Error ? error.message : "unknown error");
    return renderJsonError("La fiche du coureur n’a pas pu être chargée.", 502);
  }
}
