"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { BillingEdition } from "../../../../lib/admin-billing";
import { ORGANIZER_TIER_LABEL, ORGANIZER_TIER_PRICE_EUR, ORGANIZER_TIER_RANK } from "../../../../lib/organizer-modules";
import { callAdminRoute, currentParisDay, usePdfPreview } from "./billing-api";
import { EditionPicker } from "./EditionPicker";
import { EMPTY_INVOICE_CUSTOMER, InvoiceCustomerFields, isInvoiceCustomerComplete, type InvoiceCustomer } from "./InvoiceCustomerFields";

type PaidTier = "essential" | "complete" | "signature";
const PAID_TIERS: PaidTier[] = ["essential", "complete", "signature"];

const euro = (value: number) => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Body of `POST /api/admin/organizer-payments` (multipart, contract of the route and its tests). */
export const bankTransferFormData = (input: { editionId: string; tier: PaidTier; paidDate: string; customer: InvoiceCustomer }) => {
  const form = new FormData();
  form.set("editionId", input.editionId);
  form.set("tier", input.tier);
  form.set("paidDate", input.paidDate);
  form.set("customerLegalName", input.customer.legalName);
  form.set("customerBillingAddress", input.customer.billingAddress);
  form.set("customerSiren", input.customer.siren);
  form.set("customerVatNumber", input.customer.vatNumber);
  form.set("purchaseOrderNumber", input.customer.purchaseOrderNumber);
  return form;
};

/**
 * « Enregistrer un virement »: the screen of `POST /api/admin/organizer-payments` (route without a
 * screen until lot 4). The route derives the HT price of the pack (`ORGANIZER_TIER_PRICE_EUR`), records
 * zero VAT (art. 293 B CGI), writes the paid ledger row, recalculates the edition right and issues the
 * numbered invoice in one transaction (`record_admin_organizer_bank_transfer_invoice`). It refuses a
 * future date, a duplicate of an already paid tier or a downgrade of a paid tier (409).
 */
export function BankTransferDialog({ accessToken, open, defaultEditionId, editions, editionsLoading, editionsError, onClose, onRecorded }: {
  accessToken: string;
  open: boolean;
  defaultEditionId?: string | null;
  editions: BillingEdition[];
  editionsLoading?: boolean;
  editionsError?: string | null;
  onClose: () => void;
  onRecorded: (message: string) => void;
}) {
  const [editionId, setEditionId] = useState("");
  const [tier, setTier] = useState<PaidTier>("essential");
  const [paidDate, setPaidDate] = useState(currentParisDay);
  const [customer, setCustomer] = useState<InvoiceCustomer>(EMPTY_INVOICE_CUSTOMER);
  const [status, setStatus] = useState<"idle" | "previewing" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const pdf = usePdfPreview(accessToken);

  useEffect(() => {
    if (!open) return;
    setEditionId(defaultEditionId ?? "");
    setTier("essential");
    setPaidDate(currentParisDay());
    setCustomer(EMPTY_INVOICE_CUSTOMER);
    setError(null);
    setStatus("idle");
    pdf.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEditionId]);

  const edition = editions.find((candidate) => candidate.editionId === editionId) ?? null;
  const currentRank = edition?.tier ? ORGANIZER_TIER_RANK[edition.tier] : 0;
  const customerComplete = isInvoiceCustomerComplete(customer);
  const ready = Boolean(editionId) && Boolean(paidDate) && paidDate <= currentParisDay() && customerComplete;

  const close = () => {
    pdf.clear();
    onClose();
  };

  const preview = async () => {
    setStatus("previewing");
    setError(await pdf.preview("/api/admin/organizer-payments/preview", { editionId, tier, paidDate, customer }));
    setStatus("idle");
  };

  const record = async () => {
    setStatus("saving");
    setError(null);
    const result = await callAdminRoute(accessToken, "/api/admin/organizer-payments", { form: bankTransferFormData({ editionId, tier, paidDate, customer }) }, "Impossible d’enregistrer ce paiement par virement.");
    setStatus("idle");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const warning = result.status === 202 && typeof result.data?.warning === "string" ? result.data.warning : null;
    pdf.clear();
    onRecorded(warning ?? `Virement ${ORGANIZER_TIER_LABEL[tier]} enregistré : facture émise et pack activé.`);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enregistrer un virement</DialogTitle>
          <DialogDescription>
            Un virement reçu pour un pack : la facture acquittée est émise et le pack de l’édition est activé avec l’origine « Paiement par virement ».
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <EditionPicker editions={editions} value={editionId} onChange={setEditionId} loading={editionsLoading} error={editionsError} />
          {edition?.tier && edition.tier !== "visibility" ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">Pack actuel : {ORGANIZER_TIER_LABEL[edition.tier]}. Un virement ne peut ni dupliquer ni rétrograder un pack déjà payé.</p>
          ) : null}
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium leading-none">Pack payé</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {PAID_TIERS.map((candidate) => (
                <label
                  key={candidate}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                    tier === candidate ? "border-brand bg-brand/10 text-foreground ring-1 ring-brand" : "border-border bg-card text-muted-foreground hover:border-brand/60 hover:text-foreground"
                  }`}
                >
                  <input type="radio" name="bank-transfer-tier" value={candidate} checked={tier === candidate} onChange={() => setTier(candidate)} className="h-4 w-4 shrink-0" />
                  <span>{ORGANIZER_TIER_LABEL[candidate]}</span>
                  <span className="ml-auto text-xs font-medium">{ORGANIZER_TIER_PRICE_EUR[candidate]} € HT</span>
                </label>
              ))}
            </div>
            {edition && ORGANIZER_TIER_RANK[tier] < currentRank ? <p className="text-xs text-amber-800">Ce pack est inférieur au pack actuel : le serveur refusera s’il s’agit d’un pack déjà payé.</p> : null}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="bank-transfer-date">Date du paiement</Label>
            <Input id="bank-transfer-date" type="date" max={currentParisDay()} value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Montants</p>
            <p className="text-sm text-muted-foreground">
              HT {euro(ORGANIZER_TIER_PRICE_EUR[tier])} · TVA {euro(0)} · <span className="font-semibold text-foreground">Total à payer : {euro(ORGANIZER_TIER_PRICE_EUR[tier])}</span>
            </p>
            <p className="text-xs text-muted-foreground">TVA non applicable, art. 293 B du CGI. Prix du catalogue, calculé par le serveur.</p>
          </div>
          <InvoiceCustomerFields idPrefix="bank-transfer" value={customer} onChange={setCustomer} />
          {pdf.url ? <iframe title="Prévisualisation de la facture du virement" src={pdf.url} className="h-[32rem] w-full rounded-md border border-border sm:col-span-2" /> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Annuler</Button>
          <Button type="button" variant="outline" disabled={status !== "idle" || !ready} onClick={() => void preview()}>
            {status === "previewing" ? "Préparation…" : "Prévisualiser la facture PDF"}
          </Button>
          <Button type="button" disabled={status !== "idle" || !ready} onClick={() => void record()}>
            {status === "saving" ? "Enregistrement…" : "Émettre la facture et enregistrer le virement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
