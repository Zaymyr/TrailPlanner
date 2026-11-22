import { z } from "zod";

import { flyoverAdminActionSchema, planFlyoverAdminAction } from "../../../../../lib/flyover-admin";
import { createFlyoverOrderRepository } from "../../../../../lib/flyover-orders";
import { createSocialPostRepository } from "../../../../../lib/social-posts";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * One admin action on a flyover order: cancel (and take its scheduled Instagram post back to
 * draft), retry from the last step done, rewrite the text, or send the ready email again. Rules:
 * `planFlyoverAdminAction` (lib/flyover-admin.ts). The refund stays a Stripe dashboard action.
 */
export async function PATCH(request: Request, context: { params: { id: string } }) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return renderJsonError("Commande introuvable.", 404);
  const body = flyoverAdminActionSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return renderJsonError("Action inconnue.", 400);

  const { supabase } = gate.value;
  const orders = createFlyoverOrderRepository(supabase);
  try {
    const order = await orders.get(params.data.id);
    if (!order) return renderJsonError("Commande introuvable.", 404);
    const plan = planFlyoverAdminAction(order, body.data.action);
    if (!plan.ok) return renderJsonError(plan.message, 409);

    const updated = await orders.update(order.id, plan.patch, plan.guard);
    if (!updated) return renderJsonError("La commande a changé entre-temps : recharge la page.", 409);

    let postNote: string | null = null;
    if (plan.unschedulePostId) {
      // A scheduled collab publication goes back to draft; a published one stays (delete it on Instagram).
      const post = await createSocialPostRepository(supabase).update(plan.unschedulePostId, { status: "draft", scheduled_at: null }, "status=eq.scheduled").catch(() => null);
      postNote = post ? "Publication Instagram déprogrammée (brouillon dans l’onglet Reels)." : "Aucune publication programmée à retirer.";
    }
    console.info(`Flyover order ${order.id}: admin ${body.data.action} by ${gate.value.userId}`);
    return renderJson({ ok: true, status: updated.status, postNote });
  } catch (error) {
    console.error("Flyover order admin action failed", error instanceof Error ? error.message : error);
    return renderJsonError("L’action n’a pas pu être appliquée.", 502);
  }
}
