"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../../components/ui/button";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { KpiTile } from "../../../../components/ui/KpiTile";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { useToast } from "../../../../components/ui/Toast";
import { cn } from "../../../../components/utils";
import {
  BILLING_METHOD_LABEL,
  BILLING_PERIOD_LABEL,
  BILLING_PERIODS,
  BILLING_SOURCE_CONFIG,
  BILLING_SOURCES,
  BILLING_STATUS_CONFIG,
  BILLING_STATUSES,
  billingCsvFileName,
  billingPeriodRange,
  buildBillingCsv,
  formatBillingAmount,
  formatBillingDate,
  NET_ESTIMATE_HINT,
  NET_ESTIMATE_LABEL,
  readBillingQuery,
  UNTRACKED_AMOUNT_LABEL,
  writeBillingQuery,
  type BillingEntry,
  type BillingQuery,
  type BillingSource,
  type BillingStatus,
} from "../../../../lib/admin-billing";
import { replaceLocationSearch } from "../../admin-tabs";
import { chipClass, InboxSkeletonRows } from "../inbox/InboxQueue";
import { AdminPageHeader } from "../shell/AdminPageHeader";
import { BankTransferDialog } from "./BankTransferDialog";
import { BillingEntryDrawer } from "./BillingEntryDrawer";
import { currentParisDay, fetchBillingExport, useBillingEditions, useBillingRegister } from "./billing-api";
import { HistoricalInvoiceDialog, type HistoricalInvoiceTarget } from "./HistoricalInvoiceDialog";
import { OrganizerInvoiceDialog, type OrganizerInvoiceTarget } from "./OrganizerInvoiceDialog";

const readSearch = () => (typeof window === "undefined" ? "" : window.location.search);

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

const toggle = <T,>(values: T[], value: T) => (values.includes(value) ? values.filter((candidate) => candidate !== value) : [...values, value]);

function AmountCell({ entry }: { entry: BillingEntry }) {
  if (!entry.amounts) return <span className="text-xs italic text-muted-foreground">{UNTRACKED_AMOUNT_LABEL}</span>;
  const { ht, tva, ttc } = entry.amounts;
  return (
    <span className="block text-right font-mono tabular-nums">
      <span className="block font-semibold text-foreground">{formatBillingAmount(ttc, entry.currency)}</span>
      {ht !== null ? <span className="block text-[11px] text-muted-foreground">HT {formatBillingAmount(ht, entry.currency)}{tva !== null ? ` · TVA ${formatBillingAmount(tva, entry.currency)}` : ""}</span> : <span className="block text-[11px] text-muted-foreground">TTC</span>}
      {entry.netEstimateMinor !== null ? <span className="block text-[11px] text-muted-foreground" title={NET_ESTIMATE_HINT}>{NET_ESTIMATE_LABEL} ≈ {formatBillingAmount(entry.netEstimateMinor, entry.currency)}</span> : null}
    </span>
  );
}

function StatusCell({ entry }: { entry: BillingEntry }) {
  const config = BILLING_STATUS_CONFIG[entry.status];
  return <StatusBadge tone={config.tone} title={entry.statusNote ?? undefined}>{config.label}</StatusBadge>;
}

/**
 * « Ventes & facturation » (lot 4): one register of every transaction (organizer packs by Stripe or
 * bank transfer, manual invoices, flyover orders, runner purchases), KPI of the period, filter chips in
 * the URL (`?periode|du|au`, `?source`, `?statut`, `?recherche`, `?edition`, `?page`, `?ligne`), a table
 * (cards on mobile), a side panel with the existing actions of each line, the invoice and bank-transfer
 * dialogs and the CSV export of the filtered view.
 */
export function BillingRegister({ accessToken }: { accessToken: string }) {
  const toast = useToast();
  const [query, setQuery] = useState<BillingQuery | null>(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [invoiceTarget, setInvoiceTarget] = useState<OrganizerInvoiceTarget | null>(null);
  const [historicalTarget, setHistoricalTarget] = useState<HistoricalInvoiceTarget | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(readSearch());
    const initial = readBillingQuery(params);
    setQuery(initial);
    setSearchDraft(initial.search);
    setOpenEntryId(params.get("ligne"));
  }, []);

  const register = useBillingRegister(accessToken, query);
  const editions = useBillingEditions(accessToken, Boolean(invoiceTarget && !invoiceTarget.editionId) || transferOpen);
  const data = register.data;

  const writeUrl = (next: BillingQuery, entryId: string | null = openEntryId) => {
    const params = writeBillingQuery(next);
    if (entryId) params.set("ligne", entryId);
    const search = params.toString();
    replaceLocationSearch(search ? `?${search}` : "");
  };
  const update = (patch: Partial<BillingQuery>) => {
    if (!query) return;
    const next = { ...query, page: 1, ...patch };
    setQuery(next);
    writeUrl(next);
  };
  const openEntry = (entryId: string | null) => {
    setOpenEntryId(entryId);
    if (query) writeUrl(query, entryId);
  };

  // Search typed in the box applies after a short pause (one request per pause, not per key).
  useEffect(() => {
    if (!query || searchDraft.trim() === query.search) return;
    const timeout = window.setTimeout(() => update({ search: searchDraft.trim() }), 350);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const openEntryData = entries.find((entry) => entry.id === openEntryId) ?? null;
  const failedSources = data?.sources.filter((source) => !source.ok) ?? [];
  const summary = data?.summary;

  const afterChange = (message: string) => {
    toast.show({ message, tone: "success" });
    register.refetch();
  };

  const exportCsv = async () => {
    if (!query) return;
    setExporting(true);
    try {
      const all = await fetchBillingExport(accessToken, query);
      const blob = new Blob([buildBillingCsv(all.entries)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = billingCsvFileName(query);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.show({ message: `${plural(all.entries.length, "ligne")} exportée${all.entries.length > 1 ? "s" : ""}.`, tone: "success" });
    } catch (error) {
      toast.show({ message: error instanceof Error ? error.message : "L’export a échoué.", tone: "danger" });
    } finally {
      setExporting(false);
    }
  };

  const editionList = editions.data?.editions ?? [];
  const editionsError = editions.isError ? (editions.error instanceof Error ? editions.error.message : "Les éditions n’ont pas pu être chargées.") : null;

  return (
    <>
      <AdminPageHeader
        title="Ventes & facturation"
        description="Registre unique : packs organisateurs (Stripe et virements), factures manuelles, vidéos de survol et achats coureurs."
        actions={
          <>
            <Button type="button" variant="outline" disabled={exporting || !data} onClick={() => void exportCsv()}>{exporting ? "Export…" : "Exporter (CSV)"}</Button>
            <Button type="button" variant="outline" onClick={() => setTransferOpen(true)}>Enregistrer un virement</Button>
            <Button type="button" onClick={() => setInvoiceTarget({ editionId: query?.editionId ?? null, eventName: query?.editionId ? data?.edition?.label ?? null : null })}>Nouvelle facture</Button>
          </>
        }
      />

      {data?.paymentsHealth && data.paymentsHealth.status !== "ok" ? (
        <p role="status" className={cn("mb-4 rounded-lg px-3 py-2 text-sm", data.paymentsHealth.status === "error" ? "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-100" : "bg-[#fef1e6] text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100")}>
          Paiements Stripe : {data.paymentsHealth.detail}{" "}
          <Link href={data.paymentsHealth.href as Route} className="font-semibold underline underline-offset-4">Voir l’intégration Stripe</Link>
        </p>
      ) : null}

      <section aria-label="Indicateurs de la période" className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          label="Encaissé net"
          unit="TTC"
          value={summary ? formatBillingAmount(summary.collectedMinor, summary.currency) : "…"}
          hint={summary ? [
            `${plural(summary.collectedCount, "ligne")} payée${summary.collectedCount > 1 ? "s" : ""} ou réglée${summary.collectedCount > 1 ? "s" : ""}`,
            summary.storeCollectedCount
              ? `dont stores ${formatBillingAmount(summary.storeCollectedMinor, summary.currency)}${summary.storeCollectedCount > summary.storeNetUnknownCount ? ` (${NET_ESTIMATE_LABEL.toLowerCase()} ≈ ${formatBillingAmount(summary.storeNetEstimateMinor, summary.currency)}${summary.storeNetUnknownCount ? `, ${summary.storeNetUnknownCount} sans taux` : ""})` : ""}`
              : null,
          ].filter(Boolean).join(" · ") : undefined}
        />
        <KpiTile
          label="Remboursé"
          unit="TTC"
          value={summary ? formatBillingAmount(summary.refundedMinor, summary.currency) : "…"}
          hint={summary ? [plural(summary.refundedCount, "remboursement"), summary.disputedCount ? `${plural(summary.disputedCount, "litige")} (${formatBillingAmount(summary.disputedMinor, summary.currency)})` : null].filter(Boolean).join(" · ") : undefined}
        />
        <KpiTile
          label="À encaisser"
          unit="TTC"
          value={summary ? formatBillingAmount(summary.toCollectMinor, summary.currency) : "…"}
          hint={summary ? [`${plural(summary.toCollectCount, "facture")} ou virement${summary.toCollectCount > 1 ? "s" : ""}`, summary.overdueCount ? `${summary.overdueCount} en retard` : null].filter(Boolean).join(" · ") : undefined}
        />
        <KpiTile
          label="Transactions"
          value={summary ? String(summary.transactionCount) : "…"}
          hint={summary && (summary.untrackedCount || summary.otherCurrencyCount)
            ? [
              summary.untrackedCount ? `dont ${summary.untrackedCount} sans montant suivi (coureurs)` : null,
              summary.otherCurrencyCount ? `${summary.otherCurrencyCount} dans une autre devise (non additionnée${summary.otherCurrencyCount > 1 ? "s" : ""})` : null,
            ].filter(Boolean).join(" · ")
            : "sur la période et les sources choisies"}
        />
      </section>

      <section aria-labelledby="billing-register-title" className="rounded-[14px] border border-[#e6e2d8] bg-card shadow-sm dark:border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-2.5 pt-3.5">
          <h2 id="billing-register-title" className="text-[15px] font-semibold">
            Registre{data ? <span className="ml-2 font-mono text-sm font-medium text-muted-foreground">{data.total}</span> : null}
          </h2>
          <div className="flex items-center gap-2">
            <label htmlFor="billing-search" className="sr-only">Rechercher dans le registre</label>
            <input
              id="billing-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Course, client, n° de facture, e-mail…"
              className="h-9 w-[min(280px,60vw)] rounded-[10px] border border-[#e6e2d8] bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border"
            />
            <button type="button" onClick={() => register.refetch()} className="inline-flex h-9 items-center rounded-[10px] border border-[#e6e2d8] bg-card px-3 text-sm font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:border-border">
              Actualiser
            </button>
          </div>
        </div>

        {query ? (
          <div className="space-y-2 px-4 pb-3">
            <div role="group" aria-label="Période" className="flex flex-wrap items-center gap-1.5">
              {BILLING_PERIODS.map((period) => (
                <button key={period} type="button" aria-pressed={query.period === period} className={chipClass(query.period === period, false)} onClick={() => update({ period, ...billingPeriodRange(period, currentParisDay()) })}>
                  {BILLING_PERIOD_LABEL[period]}
                </button>
              ))}
              <span className="ml-1 inline-flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <label htmlFor="billing-from">du</label>
                <input id="billing-from" type="date" value={query.from ?? ""} max={query.to ?? undefined} onChange={(event) => update({ period: "personnalise", from: event.target.value || null })} className="h-8 rounded-md border border-[#e6e2d8] bg-card px-2 text-xs dark:border-border" />
                <label htmlFor="billing-to">au</label>
                <input id="billing-to" type="date" value={query.to ?? ""} min={query.from ?? undefined} onChange={(event) => update({ period: "personnalise", to: event.target.value || null })} className="h-8 rounded-md border border-[#e6e2d8] bg-card px-2 text-xs dark:border-border" />
              </span>
            </div>
            <div role="group" aria-label="Filtrer par source" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={query.sources.length === 0} className={chipClass(query.sources.length === 0, false)} onClick={() => update({ sources: [] })}>Toutes les sources</button>
              {BILLING_SOURCES.map((source: BillingSource) => (
                <button key={source} type="button" aria-pressed={query.sources.includes(source)} className={chipClass(query.sources.includes(source), false)} onClick={() => update({ sources: toggle(query.sources, source) })}>
                  {BILLING_SOURCE_CONFIG[source].short}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={query.statuses.length === 0} className={chipClass(query.statuses.length === 0, false)} onClick={() => update({ statuses: [] })}>Tous les statuts</button>
              {BILLING_STATUSES.map((status: BillingStatus) => (
                <button key={status} type="button" aria-pressed={query.statuses.includes(status)} className={chipClass(query.statuses.includes(status), status === "due" || status === "disputed" || status === "failed")} onClick={() => update({ statuses: toggle(query.statuses, status) })}>
                  {BILLING_STATUS_CONFIG[status].label}
                </button>
              ))}
            </div>
            {query.editionId ? (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-[#1f2a12] px-2.5 py-1 text-xs font-semibold text-white dark:bg-lime-200 dark:text-[#1f2a12]">Édition : {data?.edition?.label ?? "…"}</span>
                <button type="button" className="text-xs font-semibold text-brand underline-offset-4 hover:underline" onClick={() => update({ editionId: null })}>Toutes les éditions</button>
                <Link href={`/admin/organizers?edition=${query.editionId}` as Route} className="text-xs font-semibold text-brand underline-offset-4 hover:underline">Fiche de l’édition →</Link>
              </p>
            ) : null}
          </div>
        ) : null}

        {failedSources.length ? (
          <p role="status" className="mx-4 mb-3 rounded-lg bg-[#fef1e6] px-3 py-2 text-xs text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100">
            Sources non lues : {failedSources.map((source) => source.label).join(", ")}. Les totaux ne les comptent pas.
          </p>
        ) : null}

        <div className="border-t border-[#e6e2d8] dark:border-border">
          {register.isLoading && !data ? (
            <InboxSkeletonRows count={6} />
          ) : register.isError && !data ? (
            <div className="p-4">
              <EmptyState title="Le registre n’a pas pu être chargé" description={register.error instanceof Error ? register.error.message : undefined} action={<button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => register.refetch()}>Réessayer</button>} />
            </div>
          ) : entries.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Aucune transaction pour ces filtres"
                description="Élargis la période, change de source ou efface la recherche."
                action={<button type="button" className="text-sm font-semibold text-brand underline-offset-4 hover:underline" onClick={() => { setSearchDraft(""); update({ period: "tout", from: null, to: null, sources: [], statuses: [], search: "" }); }}>Tout afficher</button>}
              />
            </div>
          ) : (
            <>
              <table className="hidden w-full text-sm md:table">
                <caption className="sr-only">Transactions, de la plus récente à la plus ancienne. Activer une ligne ouvre son détail.</caption>
                <thead>
                  <tr className="border-b border-[#e6e2d8] text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-border">
                    <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Client</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Objet</th>
                    <th scope="col" className="px-2 py-2 text-right font-semibold">Montant</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Statut</th>
                    <th scope="col" className="px-4 py-2 font-semibold">Moyen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e6e2d8] dark:divide-border">
                  {entries.map((entry) => (
                    <tr key={entry.id} className={cn("cursor-pointer align-top transition hover:bg-muted/50", openEntryId === entry.id && "bg-muted/60")} onClick={() => openEntry(entry.id)}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">{formatBillingDate(entry.date)}</td>
                      <td className="max-w-[16rem] px-2 py-2.5">
                        <span className="block truncate font-medium text-foreground">{entry.client}</span>
                        <span className="block truncate text-xs text-muted-foreground">{entry.clientDetail ?? BILLING_SOURCE_CONFIG[entry.source].label}</span>
                      </td>
                      <td className="max-w-[16rem] px-2 py-2.5">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); openEntry(entry.id); }}
                          className="block max-w-full truncate text-left font-medium text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {entry.object}
                        </button>
                        <span className="block truncate text-xs text-muted-foreground">{entry.reference ?? BILLING_SOURCE_CONFIG[entry.source].label}</span>
                      </td>
                      <td className="px-2 py-2.5"><AmountCell entry={entry} /></td>
                      <td className="px-2 py-2.5"><StatusCell entry={entry} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">{BILLING_METHOD_LABEL[entry.method]}{entry.methodDetail && entry.method === "store" ? <span className="block">{entry.methodDetail}</span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <ul className="divide-y divide-[#e6e2d8] md:hidden dark:divide-border">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => openEntry(entry.id)} className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{entry.object}</span>
                        <span className="block truncate text-xs text-muted-foreground">{entry.client}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusCell entry={entry} />
                          <span>{BILLING_METHOD_LABEL[entry.method]}</span>
                          <span className="font-mono">{formatBillingDate(entry.date)}</span>
                        </span>
                      </span>
                      <span className="shrink-0"><AmountCell entry={entry} /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {data && data.pageCount > 1 ? (
          <nav aria-label="Pagination du registre" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e6e2d8] px-4 py-3 text-sm dark:border-border">
            <span className="text-muted-foreground">Page {data.page} sur {data.pageCount} · {data.pageSize} lignes par page</span>
            <span className="flex gap-2">
              <Button type="button" variant="outline" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })}>Précédente</Button>
              <Button type="button" variant="outline" disabled={data.page >= data.pageCount} onClick={() => update({ page: data.page + 1 })}>Suivante</Button>
            </span>
          </nav>
        ) : null}
      </section>

      <p className="mt-3 text-xs text-muted-foreground">
        Montants TTC stockés (packs : HT, TVA et TTC Stripe ou virement ; factures manuelles exonérées, art. 293 B du CGI ; survols : TTC seul). Les achats coureurs n’ont pas de montant en base : ils sont comptés, jamais additionnés. Les paiements Stripe abandonnés et les commandes de survol non payées ne sont pas listés.
      </p>

      <BillingEntryDrawer
        accessToken={accessToken}
        entry={openEntryData}
        onClose={() => openEntry(null)}
        onChanged={afterChange}
        onCorrect={(entry) => {
          openEntry(null);
          if (!entry.manualInvoice || !entry.editionId) return;
          setInvoiceTarget({
            editionId: entry.editionId,
            eventName: entry.eventName,
            editionYear: entry.editionYear,
            invoice: { id: entry.rowId, ...entry.manualInvoice },
          });
        }}
        onIssuePaymentInvoice={(entry) => {
          openEntry(null);
          if (!entry.payment) return;
          setHistoricalTarget({ paymentId: entry.rowId, label: entry.client, tier: entry.payment.tier, paidAt: entry.payment.paidAt, amountSubtotal: entry.payment.amountSubtotal });
        }}
      />

      <OrganizerInvoiceDialog
        accessToken={accessToken}
        target={invoiceTarget}
        editions={editionList}
        editionsLoading={editions.isLoading}
        editionsError={editionsError}
        onClose={() => setInvoiceTarget(null)}
        onIssued={(message) => {
          setInvoiceTarget(null);
          afterChange(message);
        }}
      />
      <HistoricalInvoiceDialog
        accessToken={accessToken}
        target={historicalTarget}
        onClose={() => setHistoricalTarget(null)}
        onIssued={(message) => {
          setHistoricalTarget(null);
          afterChange(message);
        }}
      />
      <BankTransferDialog
        accessToken={accessToken}
        open={transferOpen}
        defaultEditionId={query?.editionId ?? null}
        editions={editionList}
        editionsLoading={editions.isLoading}
        editionsError={editionsError}
        onClose={() => setTransferOpen(false)}
        onRecorded={(message) => {
          setTransferOpen(false);
          afterChange(message);
        }}
      />
    </>
  );
}
