"use client";

import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { formatKpiDelta } from "../../../../components/ui/kpi-delta";
import { KpiTile } from "../../../../components/ui/KpiTile";
import { TimeSeriesLineChart } from "../../../../components/ui/TimeSeriesLineChart";
import { cn } from "../../../../components/utils";
import {
  countedInboxTotal,
  countInboxByType,
  INBOX_TYPE_CONFIG,
  INBOX_TYPES,
  type InboxResponse,
} from "../../../../lib/admin-inbox";
import {
  formatAgendaDay,
  formatMinor,
  formatRelativePast,
  type AgendaEvent,
  type FeedEvent,
  type HealthStatus,
  type OverviewAgenda,
  type OverviewBlock,
  type OverviewFeed,
  type OverviewHealth,
  type OverviewKpis,
  type OverviewRevenue,
} from "../../../../lib/admin-overview";
import { chipClass, InboxSkeletonRows, isHotType } from "../inbox/InboxQueue";
import { InboxRow } from "../inbox/InboxRow";

/** Cards of the « Vue d'ensemble » (ADR admin console §5 and its mock-up). Each card has its loading, empty and error state. */

const numberFormat = new Intl.NumberFormat("fr-FR");
const formatCount = (value: number) => numberFormat.format(value);

export function DashboardCard({ title, titleExtra, link, children, className, labelId }: {
  title: string;
  titleExtra?: ReactNode;
  link?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  labelId: string;
}) {
  return (
    <section aria-labelledby={labelId} className={cn("min-w-0 rounded-[14px] border border-[#e6e2d8] bg-card shadow-[0_1px_2px_rgba(28,33,19,.05),0_4px_16px_rgba(28,33,19,.04)] dark:border-border", className)}>
      <div className="flex items-center justify-between gap-2.5 px-4 pb-2.5 pt-3.5">
        <h2 id={labelId} className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          {title}
          {titleExtra}
        </h2>
        {link ? (
          <Link href={link.href as Route} className="shrink-0 rounded text-[12.5px] font-semibold text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            {link.label} <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CardError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-4 mb-4 rounded-lg bg-[#fdecec] px-3 py-2.5 text-sm text-[#9b2c2c] dark:bg-red-950/60 dark:text-red-100">
      {message}
      {onRetry ? (
        <button type="button" onClick={onRetry} className="ml-2 font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Réessayer
        </button>
      ) : null}
    </div>
  );
}

const SkeletonLines = ({ lines = 4 }: { lines?: number }) => (
  <div aria-hidden="true" className="space-y-2.5 px-4 pb-4">
    {Array.from({ length: lines }, (_, index) => <div key={index} className={cn("h-3.5 animate-pulse rounded bg-muted", index % 2 ? "w-2/3" : "w-full")} />)}
  </div>
);

export const Loading = ({ label, lines }: { label: string; lines?: number }) => (
  <div role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <SkeletonLines lines={lines} />
  </div>
);

// ---------------------------------------------------------------------------------------------
// KPI

export function KpiRow({ block, loading }: { block: OverviewBlock<OverviewKpis> | undefined; loading: boolean }) {
  if (!block) {
    return (
      <section aria-label="Indicateurs clés" aria-busy={loading} className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-[132px] animate-pulse rounded-[14px] border border-[#e6e2d8] bg-card dark:border-border" />)}
      </section>
    );
  }
  if (block.status === "error") {
    return <DashboardCard title="Indicateurs clés" labelId="kpi-error"><CardError message={block.message} /></DashboardCard>;
  }
  const kpis = block.data;
  const previousLabel = (value: number | null, format: (value: number) => string = formatCount) => (value === null ? undefined : format(value));
  const money = (value: number) => formatMinor(value, kpis.netRevenue.currency);
  return (
    <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile label="Coureurs actifs" value={formatCount(kpis.activeRunners.current)} current={kpis.activeRunners.current} previous={kpis.activeRunners.previous} previousLabel={previousLabel(kpis.activeRunners.previous)} series={kpis.activeRunners.series} />
      <KpiTile label="Nouveaux comptes" value={formatCount(kpis.newAccounts.current)} current={kpis.newAccounts.current} previous={kpis.newAccounts.previous} previousLabel={previousLabel(kpis.newAccounts.previous)} series={kpis.newAccounts.series} />
      <KpiTile label="Plans créés" value={formatCount(kpis.newPlans.current)} current={kpis.newPlans.current} previous={kpis.newPlans.previous} previousLabel={previousLabel(kpis.newPlans.previous)} series={kpis.newPlans.series} />
      <KpiTile
        label={kpis.netRevenue.partial ? "Revenus nets (partiel)" : "Revenus nets"}
        unit="TTC"
        value={money(kpis.netRevenue.current)}
        current={kpis.netRevenue.current}
        previous={kpis.netRevenue.previous}
        previousLabel={previousLabel(kpis.netRevenue.previous, money)}
      />
      <KpiTile label="Premium actifs" value={formatCount(kpis.activePremium.current)} current={kpis.activePremium.current} previous={kpis.activePremium.previous} previousLabel={previousLabel(kpis.activePremium.previous)} />
      <KpiTile label="Livrets publiés" value={formatCount(kpis.publishedRacebooks.current)} current={kpis.publishedRacebooks.current} previous={kpis.publishedRacebooks.previous} previousLabel={previousLabel(kpis.publishedRacebooks.previous)} deltaMode="absolute" />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// À traiter

export function InboxCard({ inbox, loading, error, onRetry }: { inbox: InboxResponse | undefined; loading: boolean; error: string | null; onRetry: () => void }) {
  const counts = inbox ? countInboxByType(inbox.items) : null;
  const total = counts ? countedInboxTotal(counts) : null;
  const nowMs = inbox ? Date.parse(inbox.generatedAt) : 0;
  const failed = inbox?.sources.filter((source) => !source.ok) ?? [];
  return (
    <DashboardCard
      title="À traiter"
      labelId="overview-inbox"
      titleExtra={total !== null ? <span className="rounded-full bg-[#fef1e6] px-2 py-0.5 font-mono text-xs font-semibold text-[#a54d0f] dark:bg-orange-950/60 dark:text-orange-100">{total}</span> : null}
      link={{ href: "/admin/inbox", label: "Tout voir" }}
    >
      {!inbox ? (
        loading ? <InboxSkeletonRows count={5} /> : <CardError message={error ?? "La file n’a pas pu être lue."} onRetry={onRetry} />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 px-4 pb-2.5" aria-label="Par type">
            {INBOX_TYPES.filter((type) => (counts?.[type] ?? 0) > 0).map((type) => (
              <Link key={type} href={`/admin/inbox?filtre=${INBOX_TYPE_CONFIG[type].slug}` as Route} className={chipClass(false, isHotType(type))}>
                {INBOX_TYPE_CONFIG[type].label} <b className="font-mono">{counts?.[type]}</b>
              </Link>
            ))}
          </div>
          {failed.length ? <p className="px-4 pb-2 text-xs text-[#a54d0f] dark:text-orange-200">Non lus : {failed.map((source) => source.label).join(", ")}.</p> : null}
          {inbox.items.length === 0 ? (
            <p className="border-t border-[#e6e2d8] px-4 py-6 text-center text-sm text-muted-foreground dark:border-border">Rien à traiter : tout est à jour.</p>
          ) : (
            <ul aria-label="Les 5 plus anciens" className="border-t border-[#e6e2d8] dark:border-border">
              {inbox.items.slice(0, 5).map((item, index) => <InboxRow key={item.id} item={item} nowMs={nowMs} today={inbox.today} primary={index === 0} />)}
            </ul>
          )}
        </>
      )}
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Santé

const STATUS_DOT: Record<HealthStatus, string> = {
  ok: "bg-[#3fa34d]",
  warning: "bg-[#f0873a]",
  error: "bg-[#e05252]",
  off: "bg-stone-400",
  unknown: "bg-stone-300",
  untracked: "bg-transparent border border-dashed border-stone-400",
};
const STATUS_LABEL: Record<HealthStatus, string> = { ok: "OK", warning: "Avertissement", error: "Erreur", off: "Coupé", unknown: "Non lu", untracked: "Non suivi" };

export function HealthCard({ block, nowMs }: { block: OverviewBlock<OverviewHealth> | undefined; nowMs: number }) {
  return (
    <DashboardCard title="Santé des systèmes" labelId="overview-health" link={{ href: "/admin/system/automation", label: "Automatisations" }}>
      {!block ? (
        <Loading label="Chargement de la santé des systèmes" lines={6} />
      ) : block.status === "error" ? (
        <CardError message={block.message} />
      ) : (
        <>
          <ul className="border-t border-[#e6e2d8] dark:border-border">
            {block.data.systems.map((system) => {
              const content = (
                <>
                  <span aria-hidden="true" className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(0,0,0,.04)]", STATUS_DOT[system.status])} />
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {system.label}
                      <span className="sr-only"> : {STATUS_LABEL[system.status]}</span>
                    </p>
                    <p className={cn("text-xs", system.status === "untracked" ? "italic text-muted-foreground" : "text-muted-foreground")}>{system.detail}</p>
                    {system.meter ? (
                      <div className="mt-1.5 h-1.5 w-36 overflow-hidden rounded-full bg-[#eeebe3] dark:bg-muted" role="meter" aria-valuemin={0} aria-valuemax={system.meter.total} aria-valuenow={system.meter.value} aria-label={`Quota utilisé : ${system.meter.value} sur ${system.meter.total}`}>
                        <i className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.round((system.meter.value / Math.max(1, system.meter.total)) * 100))}%` }} />
                      </div>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">{system.lastAt ? formatRelativePast(system.lastAt, nowMs) : ""}</span>
                </>
              );
              return (
                <li key={system.key} className="border-b border-[#e6e2d8] last:border-b-0 dark:border-border">
                  {system.href ? (
                    <Link href={system.href as Route} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-[11px] hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
                      {content}
                    </Link>
                  ) : (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-[11px]">{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {block.data.instagramDryRun ? (
            <p className="mx-4 mb-4 mt-3 flex gap-2 rounded-[10px] bg-[#fef1e6] px-3 py-2.5 text-[12.5px] text-[#8a3f0b] dark:bg-orange-950/60 dark:text-orange-100">
              <span aria-hidden="true">⚠</span>
              <span><b>Instagram en simulation</b> : rien n’est publié réellement, y compris les survols en collaboration.</span>
            </p>
          ) : null}
        </>
      )}
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Activité 30 jours + conversion

const ACTIVITY_SERIES = [
  { key: "activePlanUsers", label: "Coureurs actifs", color: "#2d5016" },
  { key: "newAccounts", label: "Nouveaux comptes", color: "#f0873a" },
  { key: "newPlans", label: "Plans créés", color: "#c8d44e" },
];

export function ActivityCard({ block }: { block: OverviewBlock<{ start: string; end: string; points: Array<{ date: string; activePlanUsers: number; newAccounts: number; newPlans: number }> }> | undefined }) {
  return (
    <DashboardCard title="Activité · 30 jours" labelId="overview-activity" link={{ href: "/admin/analytics", label: "Analytique" }}>
      <div className="px-4 pb-4">
        {!block ? (
          <div role="status" aria-label="Chargement de la courbe d’activité" className="h-[230px] animate-pulse rounded-lg bg-muted" />
        ) : block.status === "error" ? (
          <CardError message={block.message} />
        ) : (
          <TimeSeriesLineChart
            title="Activité sur 30 jours"
            description="Coureurs actifs, nouveaux comptes et plans créés par jour (heure de Paris)"
            points={block.data.points.map((point) => ({ date: point.date, values: { activePlanUsers: point.activePlanUsers, newAccounts: point.newAccounts, newPlans: point.newPlans } }))}
            series={ACTIVITY_SERIES}
            locale="fr-FR"
            framed={false}
            interactive
            minWidthClassName="min-w-[520px] md:min-w-0"
            emptyMessage="Pas encore d’activité sur 30 jours."
          />
        )}
      </div>
    </DashboardCard>
  );
}

type FunnelRow = { step: string; count: number; conversionFromPrevious: number | null };

function FunnelBars({ rows }: { rows: FunnelRow[] }) {
  const base = Math.max(1, rows[0]?.count ?? 0);
  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((row) => (
        <li key={row.step} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3.5rem] items-center gap-2.5 text-[12.5px]">
          <span className="leading-tight">{row.step}</span>
          <span className="relative h-[26px] overflow-hidden rounded-[7px] bg-[#dfe9cf] dark:bg-emerald-950/50">
            <i className="absolute inset-y-0 left-0 rounded-[7px] bg-brand" style={{ width: `${Math.max(row.count ? 4 : 0, Math.round((row.count / base) * 100))}%` }} />
            <span className={cn("absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs font-semibold", row.count / base > 0.18 ? "text-white" : "left-auto right-2.5 text-foreground")}>{formatCount(row.count)}</span>
          </span>
          <span className="text-right font-mono text-muted-foreground">{row.conversionFromPrevious === null ? "–" : `${numberFormat.format(row.conversionFromPrevious)} %`}</span>
        </li>
      ))}
    </ol>
  );
}

export function FunnelCard({ block, periodLabel }: { block: OverviewBlock<{ runners: FunnelRow[]; organizers: FunnelRow[] }> | undefined; periodLabel: string }) {
  return (
    <DashboardCard title={`Conversion · ${periodLabel}`} labelId="overview-funnel" link={{ href: "/admin/analytics", label: "Détail" }}>
      <div className="flex flex-col gap-4 px-4 pb-4">
        {!block ? (
          <SkeletonLines lines={5} />
        ) : block.status === "error" ? (
          <CardError message={block.message} />
        ) : (
          <>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Coureurs</h3>
              <FunnelBars rows={block.data.runners} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Organisateurs (cohorte d’événements)</h3>
              <FunnelBars rows={block.data.organizers} />
            </div>
            <p className="text-xs text-muted-foreground">Taux = étape / étape précédente. Source : fonction de croissance Supabase. Les visiteurs du planner (PostHog) ne sont pas encore repris ici.</p>
          </>
        )}
      </div>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------------------------
// Revenus, 7 prochains jours, activité récente

const REVENUE_COLORS = { organizers: "#2d5016", runners: "#3b82f6", flyovers: "#f0873a" } as const;

export function RevenueCard({ block, periodLabel }: { block: OverviewBlock<OverviewRevenue> | undefined; periodLabel: string }) {
  return (
    <DashboardCard title={`Revenus · ${periodLabel}`} labelId="overview-revenue" link={{ href: "/admin/billing", label: "Registre" }}>
      <div className="px-4 pb-4">
        {!block ? (
          <SkeletonLines lines={5} />
        ) : block.status === "error" ? (
          <CardError message={block.message} />
        ) : (() => {
          const revenue = block.data;
          const delta = revenue.previousTotalMinor !== null ? formatKpiDelta(revenue.totalMinor, revenue.previousTotalMinor) : null;
          const refunded = revenue.sources.reduce((total, source) => total + (source.refundedMinor ?? 0), 0);
          const refundedCount = revenue.sources.reduce((total, source) => total + (source.refundedCount ?? 0), 0);
          const tracked = revenue.sources.filter((source) => source.tracked && (source.amountMinor ?? 0) > 0);
          return (
            <>
              <p className="font-mono text-[28px] font-bold tracking-tight">
                {formatMinor(revenue.totalMinor, revenue.currency)}
                {delta ? (
                  <span className={cn("ml-2 text-[13px] font-semibold", delta.tone === "negative" ? "text-red-700 dark:text-red-300" : delta.tone === "positive" ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                    <span aria-hidden="true">{delta.label}</span>
                    <span className="sr-only">{delta.description}</span>
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                encaissé net TTC{refundedCount ? ` · ${refundedCount} remboursement${refundedCount > 1 ? "s" : ""} (${formatMinor(refunded, revenue.currency)})` : " · aucun remboursement"}
              </p>
              {revenue.totalMinor > 0 ? (
                <div aria-hidden="true" className="my-3 flex h-3 overflow-hidden rounded-full bg-muted">
                  {tracked.map((source) => <i key={source.key} style={{ width: `${((source.amountMinor ?? 0) / revenue.totalMinor) * 100}%`, background: REVENUE_COLORS[source.key] }} />)}
                </div>
              ) : <div className="my-3" />}
              <ul className="flex flex-col gap-2">
                {revenue.sources.map((source) => (
                  <li key={source.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="min-w-0">
                      <i aria-hidden="true" className="mr-2 inline-block h-[9px] w-[9px] rounded-[3px]" style={{ background: REVENUE_COLORS[source.key] }} />
                      {source.label}
                      {source.count ? <span className="text-muted-foreground"> ({source.count})</span> : null}
                    </span>
                    <b className={cn("whitespace-nowrap font-mono", (!source.tracked || source.amountMinor === null) && "font-normal italic text-muted-foreground")} title={source.error ?? undefined}>
                      {!source.tracked ? "non suivi" : source.amountMinor === null ? "non lu" : formatMinor(source.amountMinor, revenue.currency)}
                    </b>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </div>
    </DashboardCard>
  );
}

const TAG: Record<AgendaEvent["kind"], { label: string; className: string }> = {
  reel: { label: "Reel", className: "bg-[#eef3e6] text-[#2d5016] dark:bg-emerald-950/60 dark:text-emerald-200" },
  carousel: { label: "Carrousel", className: "bg-[#f6f8dc] text-[#6c7414] dark:bg-lime-950/60 dark:text-lime-200" },
  race: { label: "Course", className: "bg-[#eaf1fe] text-[#3b82f6] dark:bg-blue-950/60 dark:text-blue-200" },
};

const weekdayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" });

export function AgendaCard({ block }: { block: OverviewBlock<OverviewAgenda> | undefined }) {
  return (
    <DashboardCard title="7 prochains jours" labelId="overview-agenda" link={{ href: "/admin/content", label: "Calendrier" }}>
      <div className="px-4 pb-4">
        {!block ? (
          <SkeletonLines lines={6} />
        ) : block.status === "error" ? (
          <CardError message={block.message} />
        ) : (
          <>
            {block.data.days.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Rien de prévu sur les 7 prochains jours.</p> : null}
            <ol>
              {block.data.days.map((day, index) => (
                <li key={day.date} className={cn("grid grid-cols-[54px_minmax(0,1fr)] gap-2.5 py-2.5", index > 0 && "border-t border-[#e6e2d8] dark:border-border")}>
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground" aria-label={formatAgendaDay(day.date)}>
                    {weekdayFormat.format(new Date(`${day.date}T12:00:00Z`)).replace(".", "")}
                    <b className="block font-mono text-lg tracking-normal text-foreground">{Number(day.date.slice(8, 10))}</b>
                  </p>
                  <ul className="min-w-0 space-y-1">
                    {day.events.map((event, eventIndex) => (
                      <li key={`${event.kind}-${eventIndex}`}>
                        <Link href={event.href as Route} title={event.note ?? undefined} className="flex min-w-0 items-center gap-2 rounded py-0.5 text-[12.5px] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                          <span className={cn("shrink-0 rounded-[5px] px-1.5 py-px text-[10.5px] font-bold uppercase tracking-[0.04em]", TAG[event.kind].className)}>{TAG[event.kind].label}</span>
                          <span className="truncate">{event.title}{event.time ? <span className="text-muted-foreground"> · {event.time}</span> : null}{event.kind !== "race" && !event.scheduled ? <span className="text-muted-foreground"> · prévu</span> : null}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
            {block.data.errors.length ? <p className="mt-2 text-xs text-[#a54d0f] dark:text-orange-200">Non lus : {block.data.errors.join(", ")}.</p> : null}
          </>
        )}
      </div>
    </DashboardCard>
  );
}

const FEED_ICON: Record<FeedEvent["kind"], { glyph: string; className: string }> = {
  payment: { glyph: "€", className: "bg-[#eef3e6] text-[#2d5016]" },
  flyover_order: { glyph: "▶", className: "bg-[#fef1e6] text-[#f0873a]" },
  render_done: { glyph: "✓", className: "bg-[#eef3e6] text-[#2d5016]" },
  render_failed: { glyph: "✕", className: "bg-[#fdecec] text-[#e05252]" },
  post_published: { glyph: "✓", className: "bg-[#eef3e6] text-[#2d5016]" },
  accounts: { glyph: "+", className: "bg-[#eaf1fe] text-[#3b82f6]" },
  admin_action: { glyph: "✎", className: "bg-[#f1efe8] text-[#4a5140]" },
  admin_action_failed: { glyph: "✕", className: "bg-[#fdecec] text-[#e05252]" },
};

export function FeedCard({ block, nowMs }: { block: OverviewBlock<OverviewFeed> | undefined; nowMs: number }) {
  return (
    <DashboardCard title="Activité récente" labelId="overview-feed" link={{ href: "/admin/system/audit", label: "Journal" }}>
      {!block ? (
        <Loading label="Chargement de l’activité récente" lines={5} />
      ) : block.status === "error" ? (
        <CardError message={block.message} />
      ) : (
        <>
          {block.data.events.length === 0 ? <p className="px-4 pb-4 text-sm text-muted-foreground">Aucun événement récent.</p> : (
            <ul className="border-t border-[#e6e2d8] dark:border-border">
              {block.data.events.map((event, index) => {
                const inner = (
                  <>
                    <span aria-hidden="true" className={cn("grid h-[30px] w-[30px] place-items-center rounded-[9px] text-sm font-bold", FEED_ICON[event.kind].className)}>{FEED_ICON[event.kind].glyph}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{event.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatRelativePast(event.at, nowMs)}</span>
                  </>
                );
                return (
                  <li key={`${event.kind}-${index}`} className="border-b border-[#e6e2d8] last:border-b-0 dark:border-border">
                    {event.href ? (
                      <Link href={event.href as Route} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-[11px] hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">{inner}</Link>
                    ) : (
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-[11px]">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {block.data.errors.length ? <p className="px-4 pb-3 pt-1 text-xs text-[#a54d0f] dark:text-orange-200">Non lus : {block.data.errors.join(", ")}.</p> : null}
        </>
      )}
    </DashboardCard>
  );
}
