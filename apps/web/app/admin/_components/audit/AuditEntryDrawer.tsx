"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Drawer } from "../../../../components/ui/Drawer";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { cn } from "../../../../components/utils";
import {
  AUDIT_STATUS_LABEL,
  diffAuditValues,
  formatAuditDate,
  formatAuditRelative,
  type AuditDiffRow,
  type AuditEntry,
} from "../../../../lib/admin-audit";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

const KIND_LABEL: Record<AuditDiffRow["kind"], string> = { added: "Ajouté", removed: "Retiré", changed: "Modifié", same: "Inchangé" };
const KIND_CLASS: Record<AuditDiffRow["kind"], string> = {
  added: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
  removed: "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100",
  changed: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  same: "text-muted-foreground",
};

/** Before / after of a stored line, field by field (readable on mobile: each field is a block). */
export function AuditDiff({ before, after }: { before: unknown; after: unknown }) {
  const rows = diffAuditValues(before, after);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Aucune valeur enregistrée pour cette action.</p>;
  const hasBefore = before !== null && before !== undefined;
  return (
    <div>
      {!hasBefore ? <p className="mb-2 text-xs text-muted-foreground">L’état précédent n’est pas enregistré pour cette action : seules les valeurs envoyées sont affichées.</p> : null}
      <ul aria-label="Détail avant et après" className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map((row) => (
          <li key={row.path} className={cn("px-3 py-2 text-sm", KIND_CLASS[row.kind])}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="break-all font-mono text-xs font-semibold">{row.path}</span>
              <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{hasBefore ? KIND_LABEL[row.kind] : "Valeur"}</span>
            </div>
            {hasBefore && row.kind !== "same" ? (
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <p><span className="mr-1 text-xs opacity-70">Avant</span><span className={cn("break-words", row.before === null && "italic opacity-70")}>{row.before ?? "—"}</span></p>
                <p><span className="mr-1 text-xs opacity-70">Après</span><span className={cn("break-words", row.after === null && "italic opacity-70")}>{row.after ?? "—"}</span></p>
              </div>
            ) : (
              <p className="mt-1 break-words">{row.after ?? row.before ?? "—"}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Side panel of a journal line (`?entree=<id>`): who, when, what, on which object (link to its sheet),
 * the request, the error of a failure and the before / after diff.
 */
export function AuditEntryDrawer({ entry, missing, loading, now, onClose }: {
  entry: AuditEntry | null;
  /** The URL names a line the server did not find. */
  missing: boolean;
  loading: boolean;
  now: Date;
  onClose: () => void;
}) {
  if (!entry) {
    if (!missing && !loading) return null;
    return (
      <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={missing ? "Entrée introuvable" : "Chargement…"} widthClassName="w-full max-w-lg">
        <p className="px-5 pb-6 text-sm text-muted-foreground">{missing ? "Cette entrée n’existe plus (le journal garde 365 jours), ou le lien est incorrect." : "Lecture de l’entrée…"}</p>
      </Drawer>
    );
  }

  return (
    <Drawer
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={entry.actionLabel}
      description={`${formatAuditDate(entry.createdAt)} · ${entry.actorName}`}
      widthClassName="w-full max-w-lg"
    >
      <div className="space-y-5 px-5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={entry.status === "ok" ? "success" : "danger"}>{AUDIT_STATUS_LABEL[entry.status]}</StatusBadge>
          <StatusBadge tone={entry.familyTone} dot={false}>{entry.familyLabel}</StatusBadge>
        </div>
        <p className="text-sm font-medium text-foreground">{entry.summary}</p>
        {entry.status === "error" && entry.error ? (
          <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
            L’action a échoué : {entry.error}
          </p>
        ) : null}
        {entry.targetHref ? (
          <Link href={entry.targetHref as Route} className="inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-brand hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Ouvrir : {entry.targetTypeLabel} →
          </Link>
        ) : null}

        <dl className="divide-y divide-border border-y border-border">
          <Row label="Quand">{formatAuditDate(entry.createdAt)}<span className="block text-xs text-muted-foreground">{formatAuditRelative(entry.createdAt, now)}</span></Row>
          <Row label="Qui">{entry.actorName}<span className="block font-mono text-xs text-muted-foreground">{entry.actorUserId}</span></Row>
          <Row label="Action">{entry.actionLabel}<span className="block font-mono text-xs text-muted-foreground">{entry.action}</span></Row>
          <Row label="Cible">{entry.targetTypeLabel}{entry.targetId ? <span className="block break-all font-mono text-xs text-muted-foreground">{entry.targetId}</span> : null}</Row>
          <Row label="Requête"><span className="font-mono text-xs">{entry.requestPath ?? "—"}</span></Row>
          <Row label="Entrée"><span className="font-mono text-xs">{entry.id}</span></Row>
        </dl>

        <section aria-labelledby="audit-diff-title">
          <h3 id="audit-diff-title" className="mb-2 text-sm font-semibold">Modifications</h3>
          <AuditDiff before={entry.before} after={entry.after} />
          <p className="mt-2 text-xs text-muted-foreground">Le journal ne garde ni mot de passe, ni contenu de message, ni adresse e-mail complète : ces champs sont masqués.</p>
        </section>
      </div>
    </Drawer>
  );
}
