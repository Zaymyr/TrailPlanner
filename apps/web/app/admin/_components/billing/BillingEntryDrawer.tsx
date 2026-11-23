"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "../../../../components/ui/button";
import { Drawer } from "../../../../components/ui/Drawer";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  BILLING_METHOD_LABEL,
  BILLING_SOURCE_CONFIG,
  BILLING_STATUS_CONFIG,
  formatBillingAmount,
  formatBillingDate,
  UNTRACKED_AMOUNT_LABEL,
  type BillingEntry,
} from "../../../../lib/admin-billing";
import { callAdminRoute, currentParisDay, openInvoiceDownload } from "./billing-api";

/** Download route of an entry's invoice: admin route for manual invoices, the organizer route (admin allowed) for payments. */
export const invoiceDownloadUrl = (entry: BillingEntry) => {
  if (!entry.invoice) return null;
  return entry.invoice.kind === "manual"
    ? `/api/admin/organizer-invoices/${entry.invoice.id}/download`
    : `/api/organizer/invoices/${entry.invoice.id}/download`;
};

/** Regeneration route of a missing PDF (stored snapshot and original issue date). */
export const invoiceRegenerateUrl = (entry: BillingEntry) => {
  if (!entry.invoice) return null;
  return entry.invoice.kind === "manual"
    ? `/api/admin/organizer-invoices/${entry.invoice.id}/pdf`
    : `/api/admin/organizer-payments/${entry.invoice.id}/invoice`;
};

/** `paidAt` of a settlement: now for today, else noon UTC of the chosen day (never in the future). */
export const settlementPaidAt = (day: string, today = currentParisDay(), now = new Date()) =>
  day >= today ? now.toISOString() : `${day}T12:00:00.000Z`;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

const linkClass = "inline-flex min-h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-brand hover:bg-brand-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * Detail panel of a register line: every known fact, then the existing actions of its type
 * (download or regenerate the PDF, mark a manual invoice as settled, correct it, issue or upload the
 * invoice of a bank transfer) and the links (Stripe, edition, flyover orders).
 */
export function BillingEntryDrawer({ accessToken, entry, onClose, onChanged, onCorrect, onIssuePaymentInvoice }: {
  accessToken: string;
  entry: BillingEntry | null;
  onClose: () => void;
  /** After a successful action: message for the toast; the register reloads. */
  onChanged: (message: string) => void;
  onCorrect: (entry: BillingEntry) => void;
  onIssuePaymentInvoice: (entry: BillingEntry) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settleDay, setSettleDay] = useState(currentParisDay);
  const [settleReference, setSettleReference] = useState("");
  const [settleOpen, setSettleOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setBusy(null);
    setError(null);
    setSettleDay(currentParisDay());
    setSettleReference("");
    setSettleOpen(false);
    setFile(null);
  }, [entry?.id]);

  if (!entry) return null;
  const status = BILLING_STATUS_CONFIG[entry.status];
  const has = (action: BillingEntry["actions"][number]) => entry.actions.includes(action);

  const run = async (key: string, task: () => Promise<string | null>, success: string | null) => {
    setBusy(key);
    setError(null);
    const failure = await task();
    setBusy(null);
    if (failure) setError(failure);
    else if (success) onChanged(success);
  };

  const download = () => run("download", async () => openInvoiceDownload(accessToken, invoiceDownloadUrl(entry) ?? ""), null);
  const regenerate = () => run("regenerate", async () => {
    const result = await callAdminRoute(accessToken, invoiceRegenerateUrl(entry) ?? "", {}, "Impossible de régénérer cette facture.");
    return result.ok ? null : result.message;
  }, "PDF régénéré.");
  const settle = () => run("settle", async () => {
    const result = await callAdminRoute(accessToken, `/api/admin/organizer-invoices/${entry.rowId}/settlement`, {
      json: { paidAt: settlementPaidAt(settleDay), paymentReference: settleReference.trim() || null },
    }, "Impossible de marquer cette facture comme réglée.");
    return result.ok ? null : result.message;
  }, "Facture marquée réglée. Les droits de l’édition ne changent pas.");
  const upload = () => run("upload", async () => {
    if (!file) return "Choisissez un PDF.";
    const form = new FormData();
    form.set("invoice", file);
    const result = await callAdminRoute(accessToken, `/api/admin/organizer-payments/${entry.rowId}/invoice`, { method: "PUT", form }, "Impossible d’ajouter cette facture.");
    return result.ok ? null : result.message;
  }, "Facture du virement enregistrée.");

  const amounts = entry.amounts;
  return (
    <Drawer
      open
      onOpenChange={(next) => { if (!next) onClose(); }}
      title={`${entry.object} · ${entry.client}`}
      description={`${BILLING_SOURCE_CONFIG[entry.source].label} · ${formatBillingDate(entry.date)}`}
      widthClassName="w-full max-w-lg"
    >
      <div className="space-y-5 px-5 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {entry.statusNote ? <span className="text-sm text-muted-foreground">{entry.statusNote}</span> : null}
        </div>

        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        <section aria-label="Actions" className="flex flex-wrap gap-2">
          {has("download_invoice") ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void download()}>
              {busy === "download" ? "Préparation…" : "Télécharger la facture"}
            </Button>
          ) : null}
          {has("regenerate_invoice") ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void regenerate()}>
              {busy === "regenerate" ? "Régénération…" : "Régénérer le PDF"}
            </Button>
          ) : null}
          {has("settle_invoice") && !settleOpen ? (
            <Button type="button" disabled={busy !== null} onClick={() => setSettleOpen(true)}>Marquer réglée</Button>
          ) : null}
          {has("correct_invoice") ? (
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => onCorrect(entry)}>Rectifier</Button>
          ) : null}
          {has("issue_payment_invoice") ? (
            <Button type="button" disabled={busy !== null} onClick={() => onIssuePaymentInvoice(entry)}>Générer une facture</Button>
          ) : null}
        </section>

        {settleOpen ? (
          <form
            className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void settle();
            }}
          >
            <p className="text-sm font-semibold">Règlement de la facture {entry.reference}</p>
            <p className="text-xs text-muted-foreground">Un seul règlement complet par facture ; il ne peut pas être annulé ici et ne modifie aucun droit.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="billing-settle-day">Date de réception</Label>
                <Input id="billing-settle-day" autoFocus type="date" max={currentParisDay()} value={settleDay} onChange={(event) => setSettleDay(event.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="billing-settle-reference">Référence du virement (facultatif)</Label>
                <Input id="billing-settle-reference" value={settleReference} maxLength={120} onChange={(event) => setSettleReference(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={busy !== null || !settleDay}>{busy === "settle" ? "Enregistrement…" : "Confirmer le règlement"}</Button>
              <Button type="button" variant="outline" onClick={() => setSettleOpen(false)}>Annuler</Button>
            </div>
          </form>
        ) : null}

        {has("upload_payment_invoice") ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label htmlFor="billing-invoice-file">{entry.invoice?.hasPdf ? "Remplacer la facture PDF du virement" : "Téléverser la facture PDF du virement"}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="billing-invoice-file" type="file" accept="application/pdf,.pdf" className="max-w-xs" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" disabled={!file || busy !== null} onClick={() => void upload()}>
                {busy === "upload" ? "Envoi…" : entry.invoice?.hasPdf ? "Remplacer" : "Ajouter"}
              </Button>
            </div>
          </div>
        ) : null}

        <dl className="divide-y divide-border rounded-lg border border-border px-3">
          <Row label="Date">{formatBillingDate(entry.date)}</Row>
          <Row label="Client">{entry.client}{entry.clientDetail ? <span className="block text-muted-foreground">{entry.clientDetail}</span> : null}</Row>
          <Row label="Objet">{entry.object}</Row>
          {entry.reference ? <Row label="Facture"><span className="font-mono">{entry.reference}</span></Row> : null}
          <Row label="Montant">
            {amounts ? (
              <span className="font-mono tabular-nums">
                {amounts.ht !== null ? <span className="block">HT {formatBillingAmount(amounts.ht, entry.currency)}</span> : null}
                {amounts.tva !== null ? <span className="block">TVA {formatBillingAmount(amounts.tva, entry.currency)}</span> : null}
                <span className="block font-semibold">TTC {formatBillingAmount(amounts.ttc, entry.currency)}</span>
                {amounts.ht === null ? <span className="block font-sans text-xs text-muted-foreground">HT et TVA non stockés (TVA calculée par Stripe).</span> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">{UNTRACKED_AMOUNT_LABEL[0].toUpperCase() + UNTRACKED_AMOUNT_LABEL.slice(1)} : le prix payé n’est pas enregistré en base.</span>
            )}
          </Row>
          <Row label="Moyen">{[BILLING_METHOD_LABEL[entry.method], entry.methodDetail].filter(Boolean).join(" · ")}</Row>
        </dl>

        <section aria-label="Liens" className="flex flex-wrap gap-2">
          {entry.pageHref ? <Link href={entry.pageHref as Route} className={linkClass}>{entry.pageLabel ?? "Ouvrir"} →</Link> : null}
          {entry.stripeUrl ? <a href={entry.stripeUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Voir dans Stripe ↗</a> : null}
        </section>
      </div>
    </Drawer>
  );
}
