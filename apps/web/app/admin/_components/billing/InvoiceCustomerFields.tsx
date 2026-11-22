"use client";

import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";

export type InvoiceCustomer = {
  legalName: string;
  billingAddress: string;
  siren: string;
  vatNumber: string;
  purchaseOrderNumber: string;
};

export const EMPTY_INVOICE_CUSTOMER: InvoiceCustomer = { legalName: "", billingAddress: "", siren: "", vatNumber: "", purchaseOrderNumber: "" };

/** Legal name and billing address are mandatory (SIREN optional, nine digits when given: checked by the routes). */
export const isInvoiceCustomerComplete = (customer: InvoiceCustomer) =>
  customer.legalName.trim().length >= 2 && customer.billingAddress.trim().length >= 5;

export const toInvoiceCustomer = (customer: { legalName: string; billingAddress: string; siren?: string | null; vatNumber?: string | null; purchaseOrderNumber?: string | null } | null | undefined): InvoiceCustomer => ({
  legalName: customer?.legalName ?? "",
  billingAddress: customer?.billingAddress ?? "",
  siren: customer?.siren ?? "",
  vatNumber: customer?.vatNumber ?? "",
  purchaseOrderNumber: customer?.purchaseOrderNumber ?? "",
});

/**
 * Recipient of an organizer invoice, shared by the three invoice dialogs of « Ventes & facturation »
 * (manual invoice, bank transfer, historical bank-transfer invoice). Frozen in the invoice at issuance.
 */
export function InvoiceCustomerFields({ idPrefix, value, onChange, note }: {
  idPrefix: string;
  value: InvoiceCustomer;
  onChange: (next: InvoiceCustomer) => void;
  note?: string;
}) {
  const set = (key: keyof InvoiceCustomer) => (next: string) => onChange({ ...value, [key]: next });
  return (
    <>
      <div className="space-y-1.5 sm:col-span-2">
        <p className="text-sm font-semibold text-foreground">Destinataire de la facture</p>
        <p className="text-xs text-muted-foreground">{note ?? "Ces données sont figées dans la facture au moment de son émission."}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-customer-name`}>Raison sociale</Label>
        <Input id={`${idPrefix}-customer-name`} value={value.legalName} onChange={(event) => set("legalName")(event.target.value)} maxLength={160} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-customer-siren`}>SIREN (si l’organisation en possède un)</Label>
        <Input id={`${idPrefix}-customer-siren`} inputMode="numeric" value={value.siren} onChange={(event) => set("siren")(event.target.value)} placeholder="123 456 789" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-customer-address`}>Adresse de facturation</Label>
        <textarea
          id={`${idPrefix}-customer-address`}
          value={value.billingAddress}
          onChange={(event) => set("billingAddress")(event.target.value)}
          maxLength={500}
          rows={3}
          required
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-customer-vat`}>N° TVA intracommunautaire (si applicable)</Label>
        <Input id={`${idPrefix}-customer-vat`} value={value.vatNumber} onChange={(event) => set("vatNumber")(event.target.value)} maxLength={32} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-order-number`}>Bon de commande (si établi)</Label>
        <Input id={`${idPrefix}-order-number`} value={value.purchaseOrderNumber} onChange={(event) => set("purchaseOrderNumber")(event.target.value)} maxLength={80} />
      </div>
    </>
  );
}
