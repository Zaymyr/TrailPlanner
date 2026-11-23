"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { billingTierLabel } from "../../../../lib/admin-billing";
import { callAdminRoute, usePdfPreview } from "./billing-api";
import { EMPTY_INVOICE_CUSTOMER, InvoiceCustomerFields, isInvoiceCustomerComplete, type InvoiceCustomer } from "./InvoiceCustomerFields";

export type HistoricalInvoiceTarget = {
  paymentId: string;
  label: string;
  tier: string;
  paidAt: string | null;
  amountSubtotal: number | null;
};

/**
 * « Générer une facture » for a historical paid bank transfer without invoice: preview
 * (`POST /api/admin/organizer-payments/preview` with `paymentId`) then issuance
 * (`POST /api/admin/organizer-payments/<id>/invoice`). Reads the stored tier, amount and date of the
 * ledger row; never inserts a payment nor recalculates the right. Moved from the Organisateurs tab.
 */
export function HistoricalInvoiceDialog({ accessToken, target, onClose, onIssued }: {
  accessToken: string;
  target: HistoricalInvoiceTarget | null;
  onClose: () => void;
  onIssued: (message: string) => void;
}) {
  const [customer, setCustomer] = useState<InvoiceCustomer>(EMPTY_INVOICE_CUSTOMER);
  const [status, setStatus] = useState<"idle" | "previewing" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const pdf = usePdfPreview(accessToken);

  useEffect(() => {
    if (!target) return;
    setCustomer(EMPTY_INVOICE_CUSTOMER);
    setError(null);
    setStatus("idle");
    pdf.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const close = () => {
    pdf.clear();
    setError(null);
    onClose();
  };
  const customerComplete = isInvoiceCustomerComplete(customer);

  const preview = async () => {
    if (!target) return;
    setStatus("previewing");
    setError(await pdf.preview("/api/admin/organizer-payments/preview", { paymentId: target.paymentId, customer }));
    setStatus("idle");
  };

  const issue = async () => {
    if (!target) return;
    setStatus("saving");
    setError(null);
    const result = await callAdminRoute(accessToken, `/api/admin/organizer-payments/${target.paymentId}/invoice`, { json: { customer } }, "Impossible de générer cette facture.");
    setStatus("idle");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    pdf.clear();
    onIssued("Facture du virement générée et disponible pour l’organisateur.");
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Générer une facture</DialogTitle>
          <DialogDescription>
            Émettez la facture du virement déjà enregistré pour {target?.label ?? "cette édition"}. Le paiement et les droits existants ne seront pas modifiés.
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm sm:col-span-2">
            <p className="font-medium text-foreground">
              Pack {billingTierLabel(target?.tier)} · {target?.paidAt ? new Date(target.paidAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "date inconnue"}
            </p>
            <p className="text-muted-foreground">
              Montant HT : {((target?.amountSubtotal ?? 0) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              {" · "}TVA : 0,00 € · facture acquittée
            </p>
          </div>
          <InvoiceCustomerFields idPrefix="historical-invoice" value={customer} onChange={setCustomer} note="Ces données seront figées avec le montant et la date du virement historique." />
          <div className="sm:col-span-2">
            <Button type="button" variant="outline" disabled={status !== "idle" || !customerComplete} onClick={() => void preview()}>
              {status === "previewing" ? "Préparation…" : "Prévisualiser la facture PDF"}
            </Button>
          </div>
          {pdf.url ? <iframe title="Prévisualisation de la facture historique" src={pdf.url} className="h-[32rem] w-full rounded-md border border-border sm:col-span-2" /> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Annuler</Button>
          <Button type="button" disabled={status !== "idle" || !customerComplete} onClick={() => void issue()}>
            {status === "saving" ? "Génération…" : "Générer et rendre disponible"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
