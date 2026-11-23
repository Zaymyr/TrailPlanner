import type { Route } from "next";
import Link from "next/link";

import { formatBillingAmount, writeBillingQuery } from "../../../../lib/admin-billing";

type SummaryInvoice = { document_status: "active" | "replaced"; net_total: number; paid_at: string | null; due_date: string };
type SummaryPayment = { status: string; amount_total?: number | null; currency?: string | null };

/** `/admin/billing` filtered on one edition, over its whole history. */
export const editionBillingHref = (editionId: string) =>
  `/admin/billing?${writeBillingQuery({ period: "tout", editionId }).toString()}`;

/** Counts of an edition's invoices and payments, as shown in Organisateurs (pure, tested). */
export const summarizeEditionBilling = (invoices: SummaryInvoice[], payments: SummaryPayment[], today: string) => {
  const active = invoices.filter((invoice) => invoice.document_status === "active");
  const due = active.filter((invoice) => !invoice.paid_at && invoice.net_total > 0);
  const paid = payments.filter((payment) => payment.status === "paid");
  return {
    invoiceCount: active.length,
    dueCount: due.length,
    dueMinor: due.reduce((total, invoice) => total + invoice.net_total, 0),
    overdueCount: due.filter((invoice) => invoice.due_date < today).length,
    paidCount: paid.length,
    paidMinor: paid.reduce((total, payment) => total + (payment.amount_total ?? 0), 0),
  };
};

const parisToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/**
 * Compact billing line of an edition in Organisateurs › Publier le livret (lot 4): invoices and
 * payments are handled in « Ventes & facturation », reached already filtered on the edition.
 */
export function EditionBillingSummary({ event }: { event: { editionId: string | null; invoices: SummaryInvoice[]; payments: SummaryPayment[] } }) {
  if (!event.editionId) return null;
  const summary = summarizeEditionBilling(event.invoices, event.payments, parisToday());
  const parts = [
    summary.paidCount ? `${summary.paidCount} paiement${summary.paidCount > 1 ? "s" : ""} (${formatBillingAmount(summary.paidMinor)})` : null,
    summary.invoiceCount ? `${summary.invoiceCount} facture${summary.invoiceCount > 1 ? "s" : ""} manuelle${summary.invoiceCount > 1 ? "s" : ""}` : null,
    summary.dueCount ? `${summary.dueCount} à régler (${formatBillingAmount(summary.dueMinor)})` : null,
    summary.overdueCount ? `${summary.overdueCount} en retard` : null,
  ].filter(Boolean);
  return (
    <div className="rounded-md border border-border p-2 text-xs">
      <p className={summary.overdueCount ? "font-medium text-amber-800" : "text-muted-foreground"}>
        {parts.length ? parts.join(" · ") : "Aucune facture ni paiement"}
      </p>
      <Link href={editionBillingHref(event.editionId) as Route} className="mt-1 inline-block font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Voir dans Ventes & facturation →
      </Link>
    </div>
  );
}
