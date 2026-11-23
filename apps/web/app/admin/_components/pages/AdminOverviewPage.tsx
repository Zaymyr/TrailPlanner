"use client";

import { useEffect, useState } from "react";

import { cn } from "../../../../components/utils";
import { countedInboxTotal, countInboxByType } from "../../../../lib/admin-inbox";
import { summarizeHealthLine, type AdminOverviewResponse } from "../../../../lib/admin-overview";
import { replaceLocationSearch } from "../../admin-tabs";
import { useAdminInbox } from "../inbox/useAdminInbox";
import { ActivityCard, AgendaCard, FeedCard, FunnelCard, HealthCard, InboxCard, KpiRow, RevenueCard } from "../overview/OverviewCards";
import { OVERVIEW_PERIODS, readOverviewPeriod, searchForPeriod, type OverviewPeriod } from "../overview/overview-period";
import { useAdminOverview } from "../overview/useAdminOverview";
import { useAdminAccessToken } from "../shell/AdminAccess";

const todayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function PeriodSelector({ period, onChange }: { period: OverviewPeriod; onChange: (period: OverviewPeriod) => void }) {
  const [from, setFrom] = useState(period.from ?? "");
  const [to, setTo] = useState(period.to ?? "");
  useEffect(() => {
    setFrom(period.from ?? "");
    setTo(period.to ?? "");
  }, [period.from, period.to]);
  const compare = OVERVIEW_PERIODS.find((entry) => entry.key === period.key)?.compare ?? "";
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="radiogroup" aria-label="Période" className="inline-flex max-w-full overflow-x-auto rounded-[10px] bg-[#e9e6dd] p-[3px] dark:bg-muted">
          {OVERVIEW_PERIODS.map((entry) => {
            const selected = entry.key === period.key;
            return (
              <button
                key={entry.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ key: entry.key, from: entry.key === "custom" ? period.from : null, to: entry.key === "custom" ? period.to : null })}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  selected ? "bg-card font-semibold text-foreground shadow-sm" : "text-[#4a5140] hover:text-foreground dark:text-muted-foreground",
                )}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground">{compare}</span>
      </div>
      {period.key === "custom" ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (from && to) onChange({ key: "custom", from, to });
          }}
        >
          <label className="flex flex-col text-xs text-muted-foreground">
            Du
            <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="h-9 rounded-[10px] border border-[#e6e2d8] bg-card px-2 text-sm text-foreground dark:border-border" />
          </label>
          <label className="flex flex-col text-xs text-muted-foreground">
            Au
            <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="h-9 rounded-[10px] border border-[#e6e2d8] bg-card px-2 text-sm text-foreground dark:border-border" />
          </label>
          <button type="submit" disabled={!from || !to} className="h-9 rounded-[10px] bg-brand px-3 text-sm font-semibold text-brand-foreground disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            Appliquer
          </button>
        </form>
      ) : null}
    </div>
  );
}

const periodTitle = (overview: AdminOverviewResponse | undefined, period: OverviewPeriod) => {
  if (overview?.range.key === "custom") return `${overview.range.days} jours`;
  return OVERVIEW_PERIODS.find((entry) => entry.key === period.key)?.label.toLowerCase() ?? "7 jours";
};

/**
 * « Vue d'ensemble » (lot 2 of the admin console, ADR §5): in five seconds, whether everything works,
 * what moved and what is waiting. KPI, À traiter, systems health, 30-day activity, conversion, revenue
 * by source, next 7 days and recent activity; the period lives in `?periode=`. The detailed growth
 * section stays on /admin/analytics.
 */
export function AdminOverviewPage() {
  const accessToken = useAdminAccessToken();
  const [period, setPeriodState] = useState<OverviewPeriod>({ key: "7d", from: null, to: null });
  useEffect(() => setPeriodState(readOverviewPeriod(window.location.search)), []);
  const setPeriod = (next: OverviewPeriod) => {
    setPeriodState(next);
    replaceLocationSearch(searchForPeriod(window.location.search, next));
  };
  // A custom period without both days waits for « Appliquer ».
  const effective: OverviewPeriod = period.key === "custom" && !(period.from && period.to) ? { key: "7d", from: null, to: null } : period;
  const overviewQuery = useAdminOverview(accessToken, effective);
  const inboxQuery = useAdminInbox(accessToken);
  const overview = overviewQuery.data;
  const nowMs = overview ? Date.parse(overview.generatedAt) : Date.now();
  const inboxTotal = inboxQuery.data ? countedInboxTotal(countInboxByType(inboxQuery.data.items)) : null;
  const healthLine = overview?.health.status === "ok" ? summarizeHealthLine(overview.health.data.systems) : null;
  const label = periodTitle(overview, period);
  const blocks = overviewQuery.isError && !overview
    ? { status: "error" as const, message: overviewQuery.error instanceof Error ? overviewQuery.error.message : "La vue d’ensemble n’a pas pu être chargée." }
    : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-foreground">Bonjour</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {capitalize(todayFormat.format(new Date(nowMs)))}
            {inboxTotal !== null ? ` · ${inboxTotal} élément${inboxTotal > 1 ? "s" : ""} à traiter` : ""}
            {healthLine ? ` · ${healthLine}` : ""}
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <KpiRow block={blocks ?? overview?.kpis} loading={overviewQuery.isLoading} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <InboxCard
          inbox={inboxQuery.data}
          loading={inboxQuery.isLoading}
          error={inboxQuery.error instanceof Error ? inboxQuery.error.message : null}
          onRetry={() => inboxQuery.refetch()}
        />
        <HealthCard block={blocks ?? overview?.health} nowMs={nowMs} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <ActivityCard block={blocks ?? overview?.activity} />
        <FunnelCard block={blocks ?? overview?.funnel} periodLabel={label} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <RevenueCard block={blocks ?? overview?.revenue} periodLabel={label} />
        <AgendaCard block={blocks ?? overview?.agenda} />
        <FeedCard block={blocks ?? overview?.feed} nowMs={nowMs} />
      </div>
      {overviewQuery.isError && overview ? (
        <p role="status" className="mt-4 text-xs text-[#a54d0f]">
          La dernière mise à jour a échoué : les chiffres affichés datent de {new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(overview.generatedAt))}.
        </p>
      ) : null}
    </>
  );
}
