import { z } from "zod";

// Client-safe: the admin card imports this module, so only types come from the server module.
import type { FlyoverOrderRow, FlyoverStatus } from "./flyover-orders";
import { FLYOVER_MAX_ATTEMPTS } from "./flyover-shared";

/**
 * Admin actions on organizer flyover orders (Admin › Publications › Survols), pure: what each
 * action changes on the order, from which statuses. The routes apply the patch with a status guard,
 * so a tick running at the same time never sees a half-applied action.
 */

export const FLYOVER_ADMIN_ACTIONS = ["cancel", "retry", "rewrite", "resend_ready_email"] as const;
export type FlyoverAdminAction = (typeof FLYOVER_ADMIN_ACTIONS)[number];
export const flyoverAdminActionSchema = z.object({ action: z.enum(FLYOVER_ADMIN_ACTIONS) });

export const FLYOVER_STATUS_LABELS: Record<FlyoverStatus, string> = {
  pending_payment: "Paiement en attente",
  paid: "Payée · texte à écrire",
  scripted: "Texte écrit · voix et rendu à lancer",
  rendering: "Rendu en cours",
  ready: "Livrée",
  failed: "Échec",
  expired: "Non payée",
  refunded: "Remboursée",
  cancelled: "Annulée",
};

/** Statuses an admin may cancel: anything not already closed. */
const CANCELLABLE: FlyoverStatus[] = ["pending_payment", "paid", "scripted", "rendering", "ready", "failed"];
/** Statuses the pipeline can resume from (its paid steps start again). */
const RESUMABLE: FlyoverStatus[] = ["failed", "cancelled"];

export type FlyoverAdminPlan =
  | {
    ok: true;
    patch: Record<string, unknown>;
    /** PostgREST guard on the current status. */
    guard: string;
    /** Collab post to take back to draft (cancel of a scheduled publication). */
    unschedulePostId: string | null;
  }
  | { ok: false; message: string };

const guardOf = (statuses: FlyoverStatus[]) => `status=in.(${statuses.join(",")})`;

/** A paid order: cancelled after payment, it never was `pending_payment`. */
const wasPaid = (order: Pick<FlyoverOrderRow, "paid_at">) => Boolean(order.paid_at);

export const planFlyoverAdminAction = (
  order: Pick<FlyoverOrderRow, "status" | "work" | "paid_at" | "social_post_id" | "ready_at">,
  action: FlyoverAdminAction,
): FlyoverAdminPlan => {
  const resetPipeline = { attempts: 0, error: null, locked_until: null };
  switch (action) {
    case "cancel":
      if (!CANCELLABLE.includes(order.status)) return { ok: false, message: "Cette commande est déjà close." };
      return {
        ok: true,
        patch: { status: "cancelled", error: "Annulée depuis l’admin.", locked_until: null },
        guard: guardOf(CANCELLABLE),
        unschedulePostId: order.social_post_id,
      };
    case "retry":
      if (!RESUMABLE.includes(order.status)) return { ok: false, message: "Seule une commande en échec ou annulée peut être relancée." };
      if (!wasPaid(order)) return { ok: false, message: "Cette commande n’a jamais été payée." };
      // Resume from the last step done: the text is kept when it was written.
      return { ok: true, patch: { status: order.work ? "scripted" : "paid", ...resetPipeline, render_job_id: null, ready_at: null }, guard: guardOf(RESUMABLE), unschedulePostId: null };
    case "rewrite":
      if (![...RESUMABLE, "scripted"].includes(order.status)) return { ok: false, message: "Le texte ne peut être réécrit que sur une commande en échec, annulée ou pas encore rendue." };
      if (!wasPaid(order)) return { ok: false, message: "Cette commande n’a jamais été payée." };
      return { ok: true, patch: { status: "paid", work: null, ...resetPipeline, render_job_id: null, ready_at: null }, guard: guardOf([...RESUMABLE, "scripted"]), unschedulePostId: null };
    case "resend_ready_email":
      if (order.status !== "ready") return { ok: false, message: "La vidéo n’est pas encore livrée." };
      // The next tick sends it again (its idempotency key includes the row's update time).
      return { ok: true, patch: { ready_email_sent_at: null }, guard: guardOf(["ready"]), unschedulePostId: null };
  }
};

/** What the admin list shows of an order (no Stripe URL, no work JSON). */
export type FlyoverAdminView = {
  id: string;
  raceName: string;
  offer: FlyoverOrderRow["offer"];
  status: FlyoverStatus;
  statusLabel: string;
  contactEmail: string;
  instagramHandle: string | null;
  publishLocal: string | null;
  mapPreset: string;
  storyMode: string | null;
  distanceKm: number;
  aidStationCount: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  paidAt: string | null;
  readyAt: string | null;
  createdAt: string;
  readyEmailSent: boolean;
  renderJobId: string | null;
  renderStatus: string | null;
  renderProgress: number | null;
  socialPostId: string | null;
  orderUrl: string | null;
  downloadUrl: string | null;
  actions: FlyoverAdminAction[];
};

export const availableFlyoverActions = (order: Parameters<typeof planFlyoverAdminAction>[0]): FlyoverAdminAction[] =>
  FLYOVER_ADMIN_ACTIONS.filter((action) => planFlyoverAdminAction(order, action).ok);

export const toFlyoverAdminView = (
  order: FlyoverOrderRow,
  extra: { renderStatus: string | null; renderProgress: number | null; orderUrl: string | null; downloadUrl: string | null },
): FlyoverAdminView => ({
  id: order.id,
  raceName: order.race_name,
  offer: order.offer,
  status: order.status,
  statusLabel: FLYOVER_STATUS_LABELS[order.status],
  contactEmail: order.contact_email,
  instagramHandle: order.instagram_handle,
  publishLocal: order.publish_local,
  mapPreset: order.map_preset,
  storyMode: order.story_mode,
  distanceKm: order.distance_km,
  aidStationCount: order.aid_stations.length,
  attempts: order.attempts,
  maxAttempts: FLYOVER_MAX_ATTEMPTS,
  error: order.error,
  paidAt: order.paid_at,
  readyAt: order.ready_at,
  createdAt: order.created_at,
  readyEmailSent: Boolean(order.ready_email_sent_at),
  renderJobId: order.render_job_id,
  socialPostId: order.social_post_id,
  ...extra,
  actions: availableFlyoverActions(order),
});
