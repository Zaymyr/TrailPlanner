import { z } from "zod";

import { createCarouselItemRepository } from "../../../../../../lib/carousels/carousel-automation";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });
const actionSchema = z.object({ action: z.enum(["exclude", "include"]) });

// Not while a step runs: planned, automatic skips, failed, or paused between steps.
const EXCLUDABLE = "or=(status.in.(planned,failed),and(status.eq.skipped,reason.in.(too_late,no_candidate,occupied,duplicate,ineligible)),and(status.eq.generating,locked_until.is.null))";

/** « Exclure » skips the slot for good (reason `excluded`); « Rétablir » plans it again. */
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Élément invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Action invalide.", 400);
  try {
    const items = createCarouselItemRepository(gate.value.supabase);
    const updated = parsed.data.action === "exclude"
      ? await items.update(params.data.id, { status: "skipped", reason: "excluded", step: null, locked_until: null, error: null }, EXCLUDABLE)
      : await items.update(params.data.id, { status: "planned", reason: null, step: null, attempts: 0, error: null, work: null }, "status=eq.skipped&reason=eq.excluded");
    if (!updated) return renderJsonError("Ce créneau est en cours ou a changé : recharge la page.", 409);
    return renderJson({ item: { id: updated.id, status: updated.status, reason: updated.reason } });
  } catch (error) {
    console.error("Carousel automation item update failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le créneau n’a pas pu être modifié.", 502);
  }
}
