"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { ORGANIZER_TIER_LABEL } from "../../../../lib/organizer-modules";
import type { OrganizerPurchaseSummary } from "../../../../lib/organizer-payments";

type InvoiceSummary = OrganizerPurchaseSummary & { editionYear?: number };

const formatAmount = (amount: number | null, currency: string | null) => {
  if (amount === null || !currency) return "Montant non disponible";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
};

const paymentStatusLabel: Record<OrganizerPurchaseSummary["status"], string> = {
  pending: "En attente",
  paid: "Payé",
  failed: "Échoué",
  expired: "Expiré",
  refunded: "Remboursé",
  disputed: "Contesté",
};

export function OrganizerInvoicesDialog({
  open,
  onOpenChange,
  eventId,
  accessToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
  accessToken: string | null;
}) {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "downloading">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !eventId || !accessToken) return;
    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetch(`/api/organizer/invoices?eventId=${encodeURIComponent(eventId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => null) as { invoices?: InvoiceSummary[]; message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? "Impossible de charger les factures.");
      setInvoices(data?.invoices ?? []);
    }).catch((caught) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Impossible de charger les factures.");
    }).finally(() => {
      if (!controller.signal.aborted) setStatus("idle");
    });
    return () => controller.abort();
  }, [accessToken, eventId, open]);

  const download = async (paymentId: string) => {
    if (!accessToken) return;
    setStatus("downloading");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/invoices/${paymentId}/download`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => null) as { url?: string; message?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.message ?? "Impossible de télécharger cette facture.");
      window.location.assign(data.url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de télécharger cette facture.");
    } finally {
      setStatus("idle");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Factures</DialogTitle>
          <DialogDescription>Achats Stripe et virements de toutes les éditions de cet événement.</DialogDescription>
        </DialogHeader>
        {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {status === "loading" ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {status !== "loading" && invoices.length === 0 ? <p className="text-sm text-muted-foreground">Aucun achat facturé.</p> : null}
        <div className="space-y-2">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">Pack {ORGANIZER_TIER_LABEL[invoice.tier]}{invoice.editionYear ? ` · édition ${invoice.editionYear}` : ""}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.paymentChannel === "bank_transfer" ? "Virement bancaire" : "Stripe"}
                  {invoice.paidAt ? ` · ${new Date(invoice.paidAt).toLocaleDateString("fr-FR")}` : ""}
                  {` · ${formatAmount(invoice.amountTotal, invoice.currency)}`}
                </p>
                <p className={invoice.status === "paid" ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-amber-700"}>
                  Statut : {paymentStatusLabel[invoice.status]}
                </p>
              </div>
              <Button type="button" variant="outline" disabled={!invoice.hasInvoice || status === "downloading"} onClick={() => void download(invoice.id)}>
                {invoice.hasInvoice ? "Télécharger" : "Facture en attente"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
