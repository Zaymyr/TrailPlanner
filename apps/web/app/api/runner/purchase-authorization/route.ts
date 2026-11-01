import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { getRunnerAdminMode, getRunnerMonetizationEnabled } from "../../../../lib/runner-access";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAnonymousUser } from "../../../../lib/supabase";

export async function GET(request: Request) {
  const anon = getSupabaseAnonConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!anon) return withSecurityHeaders(NextResponse.json({ allowed: false, message: "Server configuration is missing." }, { status: 500 }));
  if (!token) return withSecurityHeaders(NextResponse.json({ allowed: false, message: "Authentication required." }, { status: 401 }));
  const user = await fetchSupabaseUser(token, anon);
  if (!user?.id || isAnonymousUser(user)) return withSecurityHeaders(NextResponse.json({ allowed: false, message: "Authenticated account required." }, { status: 403 }));
  const provider = z.enum(["apple", "google"]).safeParse(new URL(request.url).searchParams.get("provider"));
  if (!provider.success) return withSecurityHeaders(NextResponse.json({ allowed: false, message: "Invalid provider." }, { status: 400 }));
  const [enabled, mode] = await Promise.all([getRunnerMonetizationEnabled(), getRunnerAdminMode(user, token)]);
  const allowed = enabled && mode === "real";
  const productId = provider.data === "apple"
    ? process.env.REVENUECAT_IOS_ANNUAL_PRODUCT_ID?.trim() || process.env.REVENUECAT_ANNUAL_PRODUCT_ID?.trim()
    : process.env.REVENUECAT_ANDROID_ANNUAL_PRODUCT_ID?.trim() || process.env.REVENUECAT_ANNUAL_PRODUCT_ID?.trim();
  if (!productId) return withSecurityHeaders(NextResponse.json({ allowed: false, message: "Annual product is not configured." }, { status: 503 }));
  return withSecurityHeaders(NextResponse.json({ allowed, mode, productId }, { status: allowed ? 200 : 409, headers: { "Cache-Control": "no-store" } }));
}
