import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const authorizeAdmin = async (request: NextRequest) => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return {
      error: withSecurityHeaders(
        NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
      ),
    };
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser || !isAdminUser(supabaseUser)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  }

  return { supabaseService };
};

const rpcUserRowSchema = z.object({
  user_id: z.string().uuid(),
  email: z.string().nullable().optional(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable().optional(),
  plan_count: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  has_profile: z.boolean(),
  subscription_status: z.string().nullable().optional(),
  subscription_period_end: z.string().nullable().optional(),
  grant_reason: z.string().nullable().optional(),
  app_metadata: z
    .object({
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
    })
    .partial()
    .nullable()
    .optional(),
});

const rpcMonthRowSchema = z.object({
  month: z.string(),
  count: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

const rpcDayRowSchema = z.object({
  day: z.string(),
  count: z.union([z.number(), z.string()]).transform((v) => Number(v)),
});

export const adminGrowthResponseSchema = z.object({
  userRows: z.array(
    z.object({
      userId: z.string(),
      email: z.string().nullable(),
      createdAt: z.string(),
      lastSignInAt: z.string().nullable(),
      planCount: z.number(),
      hasProfile: z.boolean(),
      subscriptionStatus: z.string().nullable(),
      subscriptionPeriodEnd: z.string().nullable(),
      grantReason: z.string().nullable(),
      isAdmin: z.boolean(),
    })
  ),
  signupsByMonth: z.array(z.object({ month: z.string(), count: z.number() })),
  signupsByDay: z.array(z.object({ day: z.string(), count: z.number() })),
  totals: z.object({
    users: z.number(),
    usersWithPlan: z.number(),
    usersWithProfile: z.number(),
    activeSubscriptions: z.number(),
    premiumGrants: z.number(),
  }),
});

export type AdminGrowthResponse = z.infer<typeof adminGrowthResponseSchema>;

const isSubscriptionActive = (status: string | null | undefined, periodEnd: string | null | undefined): boolean => {
  if (!status) return false;
  const normalized = status.toLowerCase();
  if (normalized !== "active" && normalized !== "trialing") return false;
  if (!periodEnd) return true;
  const end = new Date(periodEnd);
  return Number.isFinite(end.getTime()) ? end.getTime() > Date.now() : false;
};

const callRpc = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  rpcName: string
): Promise<unknown> => {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`RPC ${rpcName} failed`, payload);
    throw new Error(`RPC ${rpcName} failed`);
  }

  return payload;
};

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;

    const [userRowsPayload, signupsByMonthPayload, signupsByDayPayload] = await Promise.all([
      callRpc(supabaseUrl, supabaseServiceRoleKey, "get_admin_user_rows"),
      callRpc(supabaseUrl, supabaseServiceRoleKey, "get_signups_by_month"),
      callRpc(supabaseUrl, supabaseServiceRoleKey, "get_signups_by_day"),
    ]);

    const parsedUserRows = z.array(rpcUserRowSchema).safeParse(userRowsPayload);
    const parsedMonths = z.array(rpcMonthRowSchema).safeParse(signupsByMonthPayload);
    const parsedDays = z.array(rpcDayRowSchema).safeParse(signupsByDayPayload);

    if (!parsedUserRows.success) {
      console.error("Unable to parse user rows", parsedUserRows.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
    }

    if (!parsedMonths.success) {
      console.error("Unable to parse signups by month", parsedMonths.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
    }

    if (!parsedDays.success) {
      console.error("Unable to parse signups by day", parsedDays.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
    }

    const userRows = parsedUserRows.data.map((row) => ({
      userId: row.user_id,
      email: row.email ?? null,
      createdAt: row.created_at,
      lastSignInAt: row.last_sign_in_at ?? null,
      planCount: row.plan_count,
      hasProfile: row.has_profile,
      subscriptionStatus: row.subscription_status ?? null,
      subscriptionPeriodEnd: row.subscription_period_end ?? null,
      grantReason: row.grant_reason ?? null,
      isAdmin:
        row.app_metadata?.role === "admin" ||
        (Array.isArray(row.app_metadata?.roles) && (row.app_metadata.roles as string[]).includes("admin")),
    }));

    const signupsByMonth = parsedMonths.data.map((r) => ({ month: r.month, count: r.count }));
    const signupsByDay = parsedDays.data.map((r) => ({ day: r.day, count: r.count }));

    const totals = {
      users: userRows.length,
      usersWithPlan: userRows.filter((r) => r.planCount > 0).length,
      usersWithProfile: userRows.filter((r) => r.hasProfile).length,
      activeSubscriptions: userRows.filter((r) =>
        isSubscriptionActive(r.subscriptionStatus, r.subscriptionPeriodEnd)
      ).length,
      premiumGrants: userRows.filter((r) => r.grantReason !== null).length,
    };

    return withSecurityHeaders(
      NextResponse.json(adminGrowthResponseSchema.parse({ userRows, signupsByMonth, signupsByDay, totals }))
    );
  } catch (error) {
    console.error("Unexpected error while loading growth analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load growth data." }, { status: 500 }));
  }
}
