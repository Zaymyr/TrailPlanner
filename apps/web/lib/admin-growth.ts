import type { SupabaseServiceConfig } from "./supabase";

/**
 * Growth metrics of the admin (`get_admin_growth_metrics`, Europe/Paris): one call per period, shared
 * by `GET /api/admin/growth` (Analytique) and `GET /api/admin/overview` (Vue d'ensemble). `end` is
 * exclusive. The organizer funnel step still named « RaceBook » in SQL is renamed « Livret coureur ».
 */

export const GROWTH_REPORTING_TIMEZONE = "Europe/Paris";

export const parisDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: GROWTH_REPORTING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export const shiftDateKey = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export const fetchGrowthMetrics = async (
  supabase: SupabaseServiceConfig,
  range: { start: string; end: string },
): Promise<Record<string, unknown>> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/get_admin_growth_metrics`, {
    method: "POST",
    headers: {
      apikey: supabase.supabaseServiceRoleKey,
      Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_start_date: range.start, p_end_date: range.end, p_timezone: GROWTH_REPORTING_TIMEZONE }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Growth metrics RPC failed (${response.status})`);
  const metrics = await response.json();
  if (Array.isArray(metrics?.organizers?.funnel)) {
    metrics.organizers.funnel = metrics.organizers.funnel.map((row: { step?: unknown }) => ({
      ...row,
      step: typeof row.step === "string" ? row.step.replaceAll("RaceBook", "Livret coureur") : row.step,
    }));
  }
  return metrics;
};
