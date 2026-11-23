"use client";

import type { Route } from "next";
import Link from "next/link";
import React, { useEffect, useState, type ReactNode } from "react";

import { Button } from "../../../../components/ui/button";
import { Drawer } from "../../../../components/ui/Drawer";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  describeRenderDuration,
  formatRenderDuration,
  formatRenderSize,
  isActiveRender,
  RENDER_STATUS_LABEL,
  RENDER_TYPE_LABEL,
  renderStatusTone,
  type AdminRenderEntry,
} from "../../../../lib/admin-renders";
import { formatParisDateTime } from "../../../../lib/social-posts";
import { callAdminRoute } from "../billing/billing-api";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

const linkClass = "inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-brand hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Side panel of a render (`?rendu=<id>`): status and stage, timings, format, the element it comes from
 * (post, plan item, flyover order), the signed MP4 download and the existing delete action
 * (`DELETE /api/admin/video-generator/render-jobs/<id>`, finished or failed reels only), confirmed in
 * the panel itself.
 */
export function RenderDrawer({ accessToken, entry, missing, nowMs, downloadsAvailable, onClose, onDeleted }: {
  accessToken: string;
  entry: AdminRenderEntry | null;
  /** The URL names a render the server did not find. */
  missing: boolean;
  nowMs: number;
  downloadsAvailable: boolean;
  onClose: () => void;
  /** After a deletion: message for the toast; the list reloads. */
  onDeleted: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirming(false);
    setBusy(false);
    setError(null);
  }, [entry?.id]);

  if (!entry) {
    if (!missing) return null;
    return (
      <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title="Rendu introuvable" widthClassName="w-full max-w-lg">
        <p className="px-5 pb-6 text-sm text-muted-foreground">Ce rendu n’existe plus : il a été supprimé, ou le lien est incorrect.</p>
      </Drawer>
    );
  }

  const active = isActiveRender(entry);
  const duration = describeRenderDuration(entry, nowMs);
  const total = entry.finishedAt ? formatRenderDuration(entry.createdAt, entry.finishedAt) : null;
  const size = formatRenderSize(entry.sizeBytes);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await callAdminRoute(accessToken, `/api/admin/video-generator/render-jobs/${entry.id}`, { method: "DELETE" }, "Le rendu n’a pas pu être supprimé.");
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDeleted(result.data?.filesDeleted === false ? "Rendu supprimé. Les fichiers seront effacés au bout de 30 jours." : "Rendu supprimé.");
  };

  return (
    <Drawer
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={entry.title}
      description={`${RENDER_TYPE_LABEL[entry.type]} · ${formatParisDateTime(entry.createdAt)}`}
      widthClassName="w-full max-w-lg"
    >
      <div className="space-y-5 px-5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={renderStatusTone(entry.status)} pulse={active}>{RENDER_STATUS_LABEL[entry.status]}</StatusBadge>
          <span className="text-sm text-muted-foreground">{entry.stage}</span>
        </div>

        {active && entry.progress !== null ? (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Avancement du rendu" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(entry.progress * 100)}>
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.max(2, Math.round(entry.progress * 100))}%` }} />
          </div>
        ) : null}

        {entry.status === "echec" && entry.message ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">{entry.message}</p>
        ) : null}
        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">{error}</p> : null}

        <section aria-label="Actions" className="flex flex-wrap gap-2">
          {entry.downloadUrl ? (
            <a className={linkClass} href={entry.downloadUrl}>Télécharger le MP4</a>
          ) : null}
          {entry.origin ? <Link className={linkClass} href={entry.origin.href as Route}>{entry.origin.label} →</Link> : null}
          {entry.post ? <Link className={linkClass} href={entry.post.href as Route}>{entry.post.label} →</Link> : null}
          {entry.canDelete && !confirming ? (
            <Button type="button" variant="outline" className="text-red-700 hover:text-red-800 dark:text-red-300" onClick={() => setConfirming(true)}>Supprimer</Button>
          ) : null}
        </section>

        {entry.status === "termine" && entry.source === "video" && !entry.downloadUrl ? (
          <p className="text-xs text-muted-foreground">
            {downloadsAvailable ? "Le lien de téléchargement n’a pas pu être créé : actualise la page." : "Google Cloud n’est pas configuré sur cet environnement : pas de lien de téléchargement."}
          </p>
        ) : null}
        {entry.source === "carousel" && entry.status === "termine" ? (
          <p className="text-xs text-muted-foreground">Les images du carrousel se voient et se téléchargent dans la publication liée.</p>
        ) : null}

        {confirming ? (
          <div role="group" aria-label="Confirmer la suppression" className="space-y-3 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/40">
            <p className="text-sm text-red-900 dark:text-red-100">
              Supprimer « {entry.title} »{entry.width && entry.height ? ` (${entry.width}×${entry.height})` : ""} ? Le MP4 ne pourra plus être téléchargé ni publié. Cette action est définitive.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} className="bg-red-700 text-white hover:bg-red-800" onClick={() => void remove()}>{busy ? "Suppression…" : "Supprimer définitivement"}</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Annuler</Button>
            </div>
          </div>
        ) : null}

        <dl className="divide-y divide-border border-y border-border">
          <Row label="Type">{RENDER_TYPE_LABEL[entry.type]}{entry.autoDraft ? <span className="block text-xs text-muted-foreground">Brouillon Instagram créé automatiquement à la fin du rendu.</span> : null}</Row>
          <Row label="Origine">{entry.origin ? <Link className="font-semibold text-brand underline-offset-4 hover:underline" href={entry.origin.href as Route}>{entry.origin.label}</Link> : <span className="text-muted-foreground">Lancé à la main, sans élément lié</span>}</Row>
          <Row label="Publication">{entry.post ? <Link className="font-semibold text-brand underline-offset-4 hover:underline" href={entry.post.href as Route}>{entry.post.label}</Link> : <span className="text-muted-foreground">Aucun brouillon lié</span>}</Row>
          {entry.width && entry.height ? <Row label="Format">{entry.width}×{entry.height}{size ? ` · ${size}` : ""}</Row> : null}
          {entry.slideCount ? <Row label="Images">{entry.slideCount}</Row> : null}
          <Row label="Créé">{formatParisDateTime(entry.createdAt)}</Row>
          <Row label="Démarré">{entry.startedAt ? formatParisDateTime(entry.startedAt) : "—"}</Row>
          <Row label="Terminé">{entry.finishedAt ? formatParisDateTime(entry.finishedAt) : "—"}</Row>
          <Row label="Durée">{duration ? `${duration}${active ? " (en cours)" : ""}${total && total !== duration ? ` · ${total} avec l’attente` : ""}` : "—"}</Row>
          <Row label="Identifiant"><span className="font-mono text-xs">{entry.id}</span></Row>
        </dl>
      </div>
    </Drawer>
  );
}
