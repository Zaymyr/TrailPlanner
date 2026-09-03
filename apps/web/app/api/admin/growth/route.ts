import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";
import { adminGrowthResponseSchema, growthRangeSchema } from "./schema";

const REPORTING_TIMEZONE = "Europe/Paris";

const authorizeAdmin = async (request: NextRequest) => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();
  if (!supabaseAnon || !supabaseService) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })) };
  }
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user || !isAdminUser(user)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  }
  return { supabaseService };
};

function parisDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORTING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseRange(request: NextRequest) {
  const key = growthRangeSchema.catch("last7").parse(request.nextUrl.searchParams.get("range") ?? "last7");
  const today = parisDateKey(new Date());
  let startDate = shiftDate(today, -6);
  let endDate = shiftDate(today, 1);

  if (key === "today") startDate = today;
  if (key === "yesterday") {
    startDate = shiftDate(today, -1);
    endDate = today;
  }
  if (key === "last30") startDate = shiftDate(today, -29);
  if (key === "custom") {
    const customStart = request.nextUrl.searchParams.get("start");
    const customEnd = request.nextUrl.searchParams.get("end");
    if (customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) && customStart <= customEnd) {
      startDate = customStart;
      endDate = shiftDate(customEnd, 1);
    }
  }

  return { key, start: startDate, end: endDate };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const range = parseRange(request);
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_admin_growth_metrics`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_start_date: range.start, p_end_date: range.end, p_timezone: REPORTING_TIMEZONE }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Growth metrics RPC failed (${response.status})`);

    const metrics = await response.json();
    const activationEligibleAccounts = Number(metrics?.overview?.activationEligibleAccounts ?? 0);
    const activatedUsers = Number(metrics?.overview?.activatedUsers ?? 0);
    const actions = [];
    if (Array.isArray(metrics?.organizers?.followUps) && metrics.organizers.followUps.length > 0) {
      actions.push({
        id: "organizer-follow-ups",
        audience: "organizers" as const,
        severity: metrics.organizers.followUps.some((item: { daysInactive?: number }) => (item.daysInactive ?? 0) >= 14) ? "critical" as const : "warning" as const,
        title: `${metrics.organizers.followUps.length} événement(s) organisateur à relancer`,
        detail: "Ces événements sont incomplets ou prêts à publier, mais leur organisateur ne s'est pas connecté récemment.",
      });
    }
    if (activationEligibleAccounts >= 5 && activatedUsers / activationEligibleAccounts < 0.3) {
      actions.push({
        id: "activation-24h",
        audience: "app" as const,
        severity: "warning" as const,
        title: "Peu de nouveaux comptes atteignent leur premier plan",
        detail: "Moins de 30 % des comptes dont la fenêtre est complète ont créé un plan dans les 24 heures.",
      });
    }

    return withSecurityHeaders(NextResponse.json(adminGrowthResponseSchema.parse({ range, ...metrics, actions })));
  } catch (error) {
    console.error("Unexpected error while loading growth analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
  }
}
