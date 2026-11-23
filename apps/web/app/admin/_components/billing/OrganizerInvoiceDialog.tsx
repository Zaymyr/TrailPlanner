"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { Button } from "../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../components/ui/dialog";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { BillingEdition } from "../../../../lib/admin-billing";
import { giftableOrganizerFeatures, type OrganizerFeatureKey } from "../../../../lib/organizer-features";
import { ORGANIZER_TIER_PRICE_EUR } from "../../../../lib/organizer-modules";
import { adminFetch } from "../../publications/publications-api";
import { callAdminRoute, currentParisDay, dayPlusDays, usePdfPreview } from "./billing-api";
import { EditionPicker } from "./EditionPicker";
import { EMPTY_INVOICE_CUSTOMER, InvoiceCustomerFields, isInvoiceCustomerComplete, toInvoiceCustomer, type InvoiceCustomer } from "./InvoiceCustomerFields";

type PaidTier = "essential" | "complete" | "signature";

/** What the dialog opens on: a known edition (optional), and the invoice to correct (optional). */
export type OrganizerInvoiceTarget = {
  editionId: string | null;
  eventName?: string | null;
  editionYear?: number | null;
  /** Active pack of the edition, used as the default billed pack. */
  currentTier?: string | null;
  /** The unpaid active invoice to correct (a new numbered corrective invoice replaces it). */
  invoice?: {
    id: string;
    tier: PaidTier;
    netTotal: number;
    serviceDate: string;
    dueDate: string;
    featureKeys: string[];
    customer: { legalName: string; billingAddress: string; siren?: string | null; vatNumber?: string | null; purchaseOrderNumber?: string | null } | null;
  } | null;
};

const catalogSchema = z.object({
  features: z.array(z.object({ feature_key: z.string(), is_active: z.boolean() }).passthrough()).default([]),
});

const isPaidTier = (tier: string | null | undefined): tier is PaidTier => tier === "essential" || tier === "complete" || tier === "signature";

/**
 * « Créer une facture » / « Rectifier la facture »: manual organizer invoice (`organizer_invoices`)
 * with PDF preview (`POST /api/admin/organizer-invoices/preview`) and issuance
 * (`POST /api/admin/organizer-invoices`). Issuing or correcting an invoice never changes a right.
 * Moved from the Organisateurs tab to « Ventes & facturation » (lot 4), behaviour unchanged; the
 * edition picker appears when the dialog is opened without an edition.
 */
export function OrganizerInvoiceDialog({ accessToken, target, editions, editionsLoading, editionsError, onClose, onIssued }: {
  accessToken: string;
  target: OrganizerInvoiceTarget | null;
  editions?: BillingEdition[];
  editionsLoading?: boolean;
  editionsError?: string | null;
  onClose: () => void;
  onIssued: (message: string) => void;
}) {
  const open = Boolean(target);
  const correctedInvoiceId = target?.invoice?.id ?? null;
  const [editionId, setEditionId] = useState("");
  const [tier, setTier] = useState<PaidTier>("essential");
  const [net, setNet] = useState(String(ORGANIZER_TIER_PRICE_EUR.essential));
  const [serviceDate, setServiceDate] = useState(currentParisDay);
  const [dueDate, setDueDate] = useState(() => dayPlusDays(currentParisDay(), 30));
  const [features, setFeatures] = useState<OrganizerFeatureKey[]>([]);
  const [customer, setCustomer] = useState<InvoiceCustomer>(EMPTY_INVOICE_CUSTOMER);
  const [status, setStatus] = useState<"idle" | "previewing" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const pdf = usePdfPreview(accessToken);

  const catalog = useQuery({
    queryKey: ["admin", "organizer-feature-catalog", accessToken],
    staleTime: 5 * 60_000,
    enabled: open,
    queryFn: () => adminFetch(accessToken, "/api/admin/organizer-feature-catalog", catalogSchema, {}, "Le catalogue des fonctionnalités n’a pas pu être lu."),
  });
  const activeFeatureKeys = useMemo(() => new Set((catalog.data?.features ?? []).filter((item) => item.is_active).map((item) => item.feature_key)), [catalog.data]);
  const availableGiftableFeatures = (forTier: PaidTier) => giftableOrganizerFeatures(forTier).filter((feature) => activeFeatureKeys.has(feature.key));

  // Reset the form each time the dialog opens on a new target (same defaults as the former tab).
  useEffect(() => {
    if (!target) return;
    const today = currentParisDay();
    const invoice = target.invoice ?? null;
    const nextTier: PaidTier = invoice?.tier ?? (isPaidTier(target.currentTier) ? target.currentTier : "essential");
    setEditionId(target.editionId ?? "");
    setTier(nextTier);
    setNet(String((invoice?.netTotal ?? ORGANIZER_TIER_PRICE_EUR[nextTier] * 100) / 100));
    setServiceDate(invoice?.serviceDate ?? today);
    setDueDate(invoice?.dueDate ?? dayPlusDays(today, 30));
    setFeatures((invoice?.featureKeys ?? []) as OrganizerFeatureKey[]);
    setCustomer(toInvoiceCustomer(invoice?.customer));
    setError(null);
    setStatus("idle");
    pdf.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // Picking an edition from the list defaults the billed pack to its active pack.
  const pickEdition = (nextEditionId: string) => {
    setEditionId(nextEditionId);
    const picked = editions?.find((edition) => edition.editionId === nextEditionId);
    if (picked && isPaidTier(picked.tier) && !correctedInvoiceId) {
      setTier(picked.tier);
      setNet(String(ORGANIZER_TIER_PRICE_EUR[picked.tier]));
    }
  };

  const payload = () => ({
    editionId,
    tier,
    packNetCents: Math.round(Number(net.replace(",", ".")) * 100),
    giftedFeatures: features,
    serviceDate,
    dueDate,
    replacesInvoiceId: correctedInvoiceId,
    customer,
  });

  const close = () => {
    pdf.clear();
    onClose();
  };

  const preview = async () => {
    if (!editionId) return;
    setStatus("previewing");
    setError(null);
    setError(await pdf.preview("/api/admin/organizer-invoices/preview", payload()));
    setStatus("idle");
  };

  const issue = async () => {
    if (!editionId) return;
    setStatus("saving");
    setError(null);
    const result = await callAdminRoute(accessToken, "/api/admin/organizer-invoices", { json: payload() }, "Impossible d’émettre la facture.");
    setStatus("idle");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const warning = typeof result.data?.warning === "string" ? result.data.warning : null;
    pdf.clear();
    onIssued(warning ?? (correctedInvoiceId ? "Facture rectificative émise." : "Facture émise."));
  };

  const customerComplete = isInvoiceCustomerComplete(customer);
  const editionLabel = target?.eventName ? `${target.eventName}${target.editionYear ? ` · édition ${target.editionYear}` : ""}` : null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{correctedInvoiceId ? "Rectifier la facture" : "Créer une facture"}</DialogTitle>
          <DialogDescription>
            {editionLabel ? `${editionLabel}. ` : ""}Cette facture et son règlement ne modifient aucun droit d’accès. Les droits se gèrent séparément.
          </DialogDescription>
        </DialogHeader>
        {error ? <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {target && !target.editionId ? (
            <EditionPicker editions={editions ?? []} value={editionId} onChange={pickEdition} loading={editionsLoading} error={editionsError} />
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="manual-invoice-tier">Pack facturé</Label>
            <select id="manual-invoice-tier" className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm" value={tier} onChange={(event) => {
              const nextTier = event.target.value as PaidTier;
              setTier(nextTier);
              setNet(String(ORGANIZER_TIER_PRICE_EUR[nextTier]));
              setFeatures((current) => current.filter((key) => availableGiftableFeatures(nextTier).some((feature) => feature.key === key)));
            }}>
              <option value="essential">Essentiel</option><option value="complete">Complet</option><option value="signature">Signature</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="manual-invoice-net">Montant réellement facturé HT (€)</Label>
            <Input id="manual-invoice-net" inputMode="decimal" value={net} onChange={(event) => setNet(event.target.value)} />
            <p className="text-xs text-muted-foreground">Maximum catalogue : {ORGANIZER_TIER_PRICE_EUR[tier]} € HT.</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="manual-service-date">Date de prestation</Label><Input id="manual-service-date" type="date" value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="manual-due-date">Date d’échéance</Label><Input id="manual-due-date" type="date" min={serviceDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
          <fieldset className="space-y-2 rounded-lg border border-border p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-semibold">Fonctionnalités offertes</legend>
            {availableGiftableFeatures(tier).map((feature) => <label key={feature.key} className="flex items-center gap-3 text-sm">
              <input type="checkbox" checked={features.includes(feature.key)} onChange={(event) => setFeatures((current) => event.target.checked ? Array.from(new Set([...current, feature.key])) : current.filter((key) => key !== feature.key))} />
              <span>{feature.label} — OFFERT</span>
            </label>)}
            {availableGiftableFeatures(tier).length === 0 ? <p className="text-xs text-muted-foreground">Aucune fonctionnalité supplémentaire n’est disponible pour ce pack.</p> : null}
          </fieldset>
          <InvoiceCustomerFields idPrefix="manual-invoice" value={customer} onChange={setCustomer} />
          {pdf.url ? <iframe title="Prévisualisation de la facture manuelle" src={pdf.url} className="h-[32rem] w-full rounded-md border sm:col-span-2" /> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>Annuler</Button>
          <Button type="button" variant="outline" disabled={status !== "idle" || !customerComplete || !editionId} onClick={() => void preview()}>{status === "previewing" ? "Préparation…" : "Prévisualiser"}</Button>
          <Button type="button" disabled={status !== "idle" || !customerComplete || !serviceDate || !dueDate || !editionId} onClick={() => void issue()}>{status === "saving" ? "Émission…" : correctedInvoiceId ? "Émettre la rectificative" : "Émettre la facture"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
