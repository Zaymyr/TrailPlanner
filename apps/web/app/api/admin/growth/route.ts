import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig, isAdminUser } from "../../../../lib/supabase";
import { adminGrowthResponseSchema, growthRangeSchema } from "./schema";

const rpcUserRowSchema = z.object({ user_id: z.string().uuid(), email: z.string().nullable().optional(), created_at: z.string(), last_sign_in_at: z.string().nullable().optional() });
const planRowSchema = z.object({ user_id: z.string().uuid(), created_at: z.string() });
const profileRowSchema = z.object({ user_id: z.string().uuid(), full_name: z.string().nullable().optional(), age: z.number().nullable().optional(), water_bag_liters: z.number().nullable().optional() });
const favoriteRowSchema = z.object({ user_id: z.string().uuid(), created_at: z.string() });

const authorizeAdmin = async (request: NextRequest) => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();
  if (!supabaseAnon || !supabaseService) return { error: withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })) };
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user || !isAdminUser(user)) return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  return { supabaseService };
};

const toIso = (d: Date) => d.toISOString();
const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const parseRange = (request: NextRequest) => {
  const u = request.nextUrl;
  const key = growthRangeSchema.catch("last7").parse(u.searchParams.get("range") ?? "last7");
  const now = new Date();
  const today = dayStart(now);
  let start = today;
  let end = new Date(today.getTime() + 24 * 3600 * 1000);
  if (key === "yesterday") { start = new Date(today.getTime() - 24 * 3600 * 1000); end = today; }
  if (key === "last7") start = new Date(today.getTime() - 6 * 24 * 3600 * 1000);
  if (key === "last30") start = new Date(today.getTime() - 29 * 24 * 3600 * 1000);
  if (key === "custom") {
    const s = u.searchParams.get("start"); const e = u.searchParams.get("end");
    if (s && e) { start = dayStart(new Date(s)); end = new Date(dayStart(new Date(e)).getTime() + 24 * 3600 * 1000); }
  }
  return { key, start: toIso(start), end: toIso(end) };
};
const between = (iso: string | null | undefined, start: string, end: string) => !!iso && iso >= start && iso < end;
const pct = (n: number, d: number) => (d > 0 ? Number(((n / d) * 100).toFixed(1)) : 0);

async function getRows<T>(url: string, key: string, path: string): Promise<T[]> {
  const r = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  const p = await r.json().catch(() => []);
  if (!r.ok) throw new Error(`Failed ${path}`);
  return p as T[];
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request); if ("error" in auth) return auth.error;
  try {
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
    const range = parseRange(request);
    const [usersRaw, plansRaw, profilesRaw, favoritesRaw] = await Promise.all([
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "rpc/get_admin_user_rows"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "race_plans?select=user_id,created_at"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "user_profiles?select=user_id,full_name,age,water_bag_liters"),
      getRows<unknown>(supabaseUrl, supabaseServiceRoleKey, "user_favorite_products?select=user_id,created_at"),
    ]);
    const users = z.array(rpcUserRowSchema).parse(usersRaw);
    const plans = z.array(planRowSchema).parse(plansRaw);
    const profiles = z.array(profileRowSchema).parse(profilesRaw);
    const favorites = z.array(favoriteRowSchema).parse(favoritesRaw);

    const newUsers = users.filter((u) => between(u.created_at, range.start, range.end));
    const anonymous = newUsers.filter((u) => !u.email).length;
    const accounts = newUsers.filter((u) => !!u.email).length;
    const newPlans = plans.filter((p) => between(p.created_at, range.start, range.end));
    const newPlanUsers = new Set(newPlans.map((p) => p.user_id));
    const returningUsersJ1 = users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() >= 24 * 3600 * 1000).length;
    const returningUsersJ7 = users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() >= 7 * 24 * 3600 * 1000).length;

    const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
    const profilesWithDetails = newUsers.filter((u) => {
      const p = profileByUser.get(u.user_id);
      return Boolean(p && (p.full_name || p.age !== null || p.water_bag_liters !== null));
    }).length;
    const usersWithFavoriteProduct = new Set(favorites.map((f) => f.user_id)).size;

    const response = {
      range,
      kpis: {
        newAnonymousUsers: anonymous,
        newRegisteredAccounts: accounts,
        newPlansCreated: newPlans.length,
        newPlansCompletedOrSaved: newPlans.length,
        conversionAnonymousToAccount: pct(accounts, anonymous),
        conversionAccountToPlanCreated: pct(newPlanUsers.size, accounts),
        conversionPlanCreatedToSavedOrCompleted: 100,
        returningUsersJ1,
        returningUsersJ7,
        profilesWithDetails,
        usersWithFavoriteProduct,
      },
      funnel: [
        { step: "Anonymous users", count: anonymous, conversionFromPrevious: null },
        { step: "Registered accounts", count: accounts, conversionFromPrevious: pct(accounts, anonymous) },
        { step: "Plans created", count: newPlanUsers.size, conversionFromPrevious: pct(newPlanUsers.size, accounts) },
        { step: "Plans saved/completed", count: newPlans.length, conversionFromPrevious: pct(newPlans.length, newPlanUsers.size) },
      ],
      bySource: [{ source: "unknown", campaign: "unknown", users: newUsers.length, accounts, plansCreated: newPlans.length }],
      todos: [
        "UTM/source attribution not available yet (utm_source, utm_campaign, landing page event missing).",
        "No explicit plan status for saved/completed; currently approximated with race_plans rows.",
      ],
    };

    return withSecurityHeaders(NextResponse.json(adminGrowthResponseSchema.parse(response)));
  } catch (error) {
    console.error("Unexpected error while loading growth analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
  }
}
