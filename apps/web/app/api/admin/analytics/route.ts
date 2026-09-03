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

const REPORTING_TIMEZONE = "Europe/Paris";
const rangeSchema = z.enum(["today", "yesterday", "last7", "last30", "custom"]);
const analyticsResponseSchema = z.object({
  range: z.object({ key: rangeSchema, start: z.string(), end: z.string() }),
  totals: z.object({
    popupOpens: z.number(),
    clicks: z.number(),
    uniquePopupSessions: z.number(),
    uniqueClickSessions: z.number(),
    ctr: z.number().nullable(),
  }),
  productStats: z.array(z.object({
    productId: z.string(),
    productName: z.string().optional(),
    popupOpens: z.number(),
    clicks: z.number(),
    ctr: z.number().nullable(),
  })),
  recentEvents: z.array(z.object({
    id: z.string(),
    productId: z.string(),
    productName: z.string().optional(),
    eventType: z.enum(["popup_open", "click"]),
    countryCode: z.string().optional(),
    merchant: z.string().optional(),
    occurredAt: z.string(),
  })),
});

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
  return new Intl.DateTimeFormat("en-CA", { timeZone: REPORTING_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function parseRange(request: NextRequest) {
  const key = rangeSchema.catch("last30").parse(request.nextUrl.searchParams.get("range") ?? "last30");
  const today = parisDateKey(new Date());
  let start = shiftDate(today, -29);
  let end = shiftDate(today, 1);
  if (key === "today") start = today;
  if (key === "yesterday") { start = shiftDate(today, -1); end = today; }
  if (key === "last7") start = shiftDate(today, -6);
  if (key === "custom") {
    const customStart = request.nextUrl.searchParams.get("start");
    const customEnd = request.nextUrl.searchParams.get("end");
    if (customStart && customEnd && /^\d{4}-\d{2}-\d{2}$/.test(customStart) && /^\d{4}-\d{2}-\d{2}$/.test(customEnd) && customStart <= customEnd) {
      start = customStart;
      end = shiftDate(customEnd, 1);
    }
  }
  return { key, start, end };
}

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const range = parseRange(request);
    const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_admin_affiliate_metrics`, {
      method: "POST",
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_start_date: range.start, p_end_date: range.end, p_timezone: REPORTING_TIMEZONE }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("Unable to load affiliate metrics", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load analytics." }, { status: 502 }));
    }
    const metrics = await response.json();
    return withSecurityHeaders(NextResponse.json(analyticsResponseSchema.parse({ range, ...metrics })));
  } catch (error) {
    console.error("Unexpected error while building admin analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load analytics." }, { status: 500 }));
  }
}
