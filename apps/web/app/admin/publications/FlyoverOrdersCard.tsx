"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { FLYOVER_ADMIN_ACTIONS, type FlyoverAdminAction } from "../../../lib/flyover-admin";
import { formatParisDateTime, parisLocalToUtc } from "../../../lib/social-posts";
import { adminFetch } from "./publications-api";

const orderViewSchema = z.object({
  id: z.string(),
  raceName: z.string(),
  offer: z.enum(["collab", "download"]),
  status: z.string(),
  statusLabel: z.string(),
  contactEmail: z.string(),
  instagramHandle: z.string().nullable(),
  publishLocal: z.string().nullable(),
  mapPreset: z.string(),
  storyMode: z.string().nullable(),
  distanceKm: z.number(),
  aidStationCount: z.number(),
  attempts: z.number(),
  maxAttempts: z.number(),
  error: z.string().nullable(),
  paidAt: z.string().nullable(),
  readyAt: z.string().nullable(),
  createdAt: z.string(),
  readyEmailSent: z.boolean(),
  renderJobId: z.string().nullable(),
  renderStatus: z.string().nullable(),
  renderProgress: z.number().nullable(),
  socialPostId: z.string().nullable(),
  orderUrl: z.string().nullable(),
  downloadUrl: z.string().nullable(),
  actions: z.array(z.enum(FLYOVER_ADMIN_ACTIONS)),
});
type OrderView = z.infer<typeof orderViewSchema>;
const listSchema = z.object({ orders: z.array(orderViewSchema) });
const actionResponseSchema = z.object({ ok: z.boolean(), status: z.string(), postNote: z.string().nullable() });

const ACTION_LABELS: Record<FlyoverAdminAction, { label: string; confirm: string | null }> = {
  cancel: { label: "Annuler", confirm: "Annuler cette commande ? Elle ne sera plus traitée, une publication programmée repasse en brouillon. Le remboursement se fait dans Stripe." },
  retry: { label: "Relancer", confirm: null },
  rewrite: { label: "Réécrire le texte", confirm: "Réécrire le texte ? Le récit actuel est jeté, la commande repart de l’étape texte." },
  resend_ready_email: { label: "Renvoyer l’e-mail", confirm: null },
};

const STATUS_TONE: Record<string, string> = {
  pending_payment: "bg-muted text-muted-foreground",
  paid: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  scripted: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  rendering: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
  expired: "bg-muted text-muted-foreground",
  refunded: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  cancelled: "bg-muted text-muted-foreground",
};

const ACTIVE = new Set(["paid", "scripted", "rendering"]);
const FILTERS = [
  { id: "open", label: "En cours et à traiter" },
  { id: "all", label: "Toutes" },
] as const;

const publishLabel = (local: string | null) => {
  const at = local ? parisLocalToUtc(local) : null;
  return at ? formatParisDateTime(at.toISOString()) : null;
};

/**
 * Admin › Publications › Survols: organizer flyover orders (/survol), their pipeline state and the
 * admin actions (cancel, retry, rewrite, resend the ready email). Refreshed every 15 s while one runs.
 */
export function FlyoverOrdersCard({ accessToken }: { accessToken: string }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const query = useQuery({
    queryKey: ["admin", "flyover-orders", accessToken],
    queryFn: () => adminFetch(accessToken, "/api/admin/flyover-orders", listSchema, {}, "Les commandes de survol n’ont pas pu être chargées."),
  });
  // Poll every 15 s while an order is being written, voiced or rendered.
  const hasActive = query.data?.orders.some((order) => ACTIVE.has(order.status)) ?? false;
  const refetch = query.refetch;
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => void refetch(), 15_000);
    return () => window.clearInterval(timer);
  }, [hasActive, refetch]);
  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: FlyoverAdminAction }) =>
      adminFetch(accessToken, `/api/admin/flyover-orders/${id}`, actionResponseSchema, { method: "PATCH", body: { action } }, "L’action n’a pas pu être appliquée."),
    onSuccess: (result, variables) => {
      setNotice({ tone: "ok", text: `${ACTION_LABELS[variables.action].label} : fait.${result.postNote ? ` ${result.postNote}` : ""}` });
      void queryClient.invalidateQueries({ queryKey: ["admin", "flyover-orders"] });
    },
    onError: (error) => setNotice({ tone: "error", text: error instanceof Error ? error.message : "L’action a échoué." }),
  });

  const run = (order: OrderView, action: FlyoverAdminAction) => {
    const confirmText = ACTION_LABELS[action].confirm;
    if (confirmText && !window.confirm(`${order.raceName}\n\n${confirmText}`)) return;
    setNotice(null);
    mutation.mutate({ id: order.id, action });
  };

  const orders = (query.data?.orders ?? []).filter((order) => filter === "all" || !["expired", "cancelled", "refunded"].includes(order.status) && !(order.status === "ready" && order.readyEmailSent));

  return (
    <Card className="h-fit">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Vidéos de survol commandées</CardTitle>
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Filtrer les commandes">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${filter === entry.id ? "bg-brand text-brand-foreground" : "text-muted-foreground"}`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
        <CardDescription>
          Commandes de /survol, traitées toutes les 10 min (texte, puis voix et rendu). « Relancer » reprend à la dernière étape faite ; le remboursement se fait dans Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {notice ? <p role="status" className={notice.tone === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}>{notice.text}</p> : null}
        {query.error instanceof Error ? <p className="text-red-600 dark:text-red-300">{query.error.message}</p> : null}
        {query.isLoading ? <p className="text-muted-foreground">Chargement…</p> : null}
        {!query.isLoading && orders.length === 0 ? <p className="text-muted-foreground">{filter === "open" ? "Aucune commande en cours ni à traiter." : "Aucune commande."}</p> : null}
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const publishAt = publishLabel(order.publishLocal);
            return (
              <li key={order.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="min-w-0 font-semibold text-foreground">{order.raceName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[order.status] ?? "bg-muted"}`}>{order.statusLabel}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {order.offer === "collab" ? `Collaboration @${order.instagramHandle ?? "?"}${publishAt ? ` · publication ${publishAt}` : ""}` : "MP4 à télécharger"}
                  {" · "}{order.distanceKm.toFixed(1).replace(".", ",")} km · {order.aidStationCount} ravito{order.aidStationCount > 1 ? "s" : ""}
                  {" · "}{order.storyMode === "highlights" ? "Temps forts" : order.storyMode === "full" ? "Parcours complet" : "format auto"} · {order.mapPreset}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.contactEmail} · {order.paidAt ? `payée ${formatParisDateTime(order.paidAt)}` : `créée ${formatParisDateTime(order.createdAt)}`}
                  {order.readyAt ? ` · livrée ${formatParisDateTime(order.readyAt)}${order.readyEmailSent ? "" : " (e-mail non envoyé)"}` : ""}
                </p>
                {order.status === "rendering" && order.renderProgress !== null ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(order.renderProgress * 100)}>
                    <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, Math.round(order.renderProgress * 100))}%` }} />
                  </div>
                ) : null}
                {order.error ? <p className="text-xs text-red-600 dark:text-red-300">{order.error}{order.attempts > 0 ? ` (tentative ${order.attempts}/${order.maxAttempts})` : ""}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  {order.actions.map((action) => (
                    <Button key={action} type="button" className="h-8 px-3 text-xs" variant={action === "cancel" ? "outline" : "default"} disabled={mutation.isPending} onClick={() => run(order, action)}>
                      {ACTION_LABELS[action].label}
                    </Button>
                  ))}
                  {order.downloadUrl ? <a className="text-xs font-medium text-brand underline-offset-4 hover:underline dark:text-emerald-300" href={order.downloadUrl}>Télécharger le MP4</a> : null}
                  {order.orderUrl ? <a className="text-xs font-medium text-brand underline-offset-4 hover:underline dark:text-emerald-300" href={order.orderUrl} target="_blank" rel="noreferrer">Page client</a> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
