import type { OverviewRangeKey } from "../../../../lib/admin-overview";

/**
 * Period of the « Vue d'ensemble » in the URL (pure): `?periode=aujourdhui|7j|30j|personnalise` and,
 * for a custom span, `&du=YYYY-MM-DD&au=YYYY-MM-DD`. 7 days is the default and stays out of the URL.
 */

export const OVERVIEW_PERIODS: Array<{ key: OverviewRangeKey; slug: string; label: string; compare: string }> = [
  { key: "today", slug: "aujourdhui", label: "Aujourd’hui", compare: "vs hier" },
  { key: "7d", slug: "7j", label: "7 jours", compare: "vs 7 jours précédents" },
  { key: "30d", slug: "30j", label: "30 jours", compare: "vs 30 jours précédents" },
  { key: "custom", slug: "personnalise", label: "Personnalisé", compare: "vs période précédente" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type OverviewPeriod = { key: OverviewRangeKey; from: string | null; to: string | null };

export const readOverviewPeriod = (search: string): OverviewPeriod => {
  const params = new URLSearchParams(search);
  const key = OVERVIEW_PERIODS.find((period) => period.slug === params.get("periode"))?.key ?? "7d";
  if (key !== "custom") return { key, from: null, to: null };
  const from = params.get("du");
  const to = params.get("au");
  return { key, from: from && DAY.test(from) ? from : null, to: to && DAY.test(to) ? to : null };
};

/** Search string of a period, keeping the other parameters of the URL. */
export const searchForPeriod = (search: string, period: OverviewPeriod): string => {
  const params = new URLSearchParams(search);
  params.delete("periode");
  params.delete("du");
  params.delete("au");
  if (period.key !== "7d") params.set("periode", OVERVIEW_PERIODS.find((entry) => entry.key === period.key)?.slug ?? "7j");
  if (period.key === "custom") {
    if (period.from) params.set("du", period.from);
    if (period.to) params.set("au", period.to);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
};

/** Query of `GET /api/admin/overview` for a period. */
export const overviewApiQuery = (period: OverviewPeriod) => {
  const params = new URLSearchParams({ range: period.key });
  if (period.key === "custom" && period.from && period.to) {
    params.set("from", period.from);
    params.set("to", period.to);
  }
  return params.toString();
};
