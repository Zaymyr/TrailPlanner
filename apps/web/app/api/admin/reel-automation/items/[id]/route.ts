import { withAdminAudit, auditBody, pickAuditFields } from "../../../../../../lib/admin-audit-log";
import { z } from "zod";

import { createReelAutomationRepository } from "../../../../../../lib/reel-automation";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });
const actionSchema = z.object({ action: z.enum(["exclude", "include"]) });

// Only items that are not being worked on: planned, skipped automatically, failed, or paused between steps.
const EXCLUDABLE = "or=(status.in.(planned,failed),and(status.eq.skipped,reason.in.(too_late,duplicate,ineligible)),and(status.eq.generating,locked_until.is.null))";

/**
 * « Exclure »: the item is skipped for good (reason `excluded`), the plan keeps it out and frees its
 * day. « Rétablir »: it is planned again and the next plan gives it a day (or « trop tard »).
 */
async function patchRoute(request: Request, context: { params: { id: string } }) {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Élément invalide.", 400);
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Action invalide.", 400);

  try {
    const repository = createReelAutomationRepository(gate.value.supabase);
    const updated = parsed.data.action === "exclude"
      ? await repository.updateItem(params.data.id, { status: "skipped", reason: "excluded", step: null, locked_until: null, error: null }, EXCLUDABLE)
      : await repository.updateItem(params.data.id, { status: "planned", reason: null, step: null, attempts: 0, error: null, work: null }, "status=eq.skipped&reason=eq.excluded");
    if (!updated) return renderJsonError("Cet élément est en cours ou a changé : recharge la page.", 409);
    return renderJson({ item: { id: updated.id, status: updated.status, reason: updated.reason } });
  } catch (error) {
    console.error("Reel automation item update failed", error instanceof Error ? error.message : error);
    return renderJsonError("L’élément n’a pas pu être modifié.", 502);
  }
}

export const PATCH = withAdminAudit(patchRoute, {
  action: "automation.reel-item",
  targetType: "automation",
  targetId: (c) => c.params.id,
  summary: (c) => (auditBody(c).action === "exclude" ? "Élément du plan des reels exclu" : "Élément du plan des reels rétabli"),
  after: (c) => pickAuditFields(c.body, ["action"]),
});
