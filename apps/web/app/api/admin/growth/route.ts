import { NextRequest, NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";
import { fetchGrowthMetrics, parisDateKey, shiftDateKey } from "../../../../lib/admin-growth";
import { adminGrowthResponseSchema, growthRangeSchema } from "./schema";

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

function parseRange(request: NextRequest) {
  const key = growthRangeSchema.catch("last7").parse(request.nextUrl.searchParams.get("range") ?? "last7");
  const today = parisDateKey(new Date());
  let startDate = shiftDateKey(today, -6);
  let endDate = shiftDateKey(today, 1);

  if (key === "today") startDate = today;
  if (key === "yesterday") {
    startDate = shiftDateKey(today, -1);
    endDate = today;
  }
  if (key === "last30") startDate = shiftDateKey(today, -29);
  if (key === "custom") {
    const customStart = request.nextUrl.searchParams.get("start");
    const customEnd = request.nextUrl.searchParams.get("end");
    if (customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) && customStart <= customEnd) {
      startDate = customStart;
      endDate = shiftDateKey(customEnd, 1);
    }
  }

  return { key, start: startDate, end: endDate };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const range = parseRange(request);
    const metrics = await fetchGrowthMetrics(auth.supabaseService, range) as Record<string, any>;
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
