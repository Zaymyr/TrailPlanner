import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { checkRateLimitAsync } from "./http";

type AuthRateLimitScope = "signin" | "signup";

// Supabase Auth only sees Vercel egress IPs for these server-side proxies, so its own per-IP
// limits are ineffective here. Limits are deliberately conservative (shared NAT / race-day
// venues): per-IP is looser, per-email is tighter to slow credential stuffing on one account.
export const AUTH_RATE_LIMITS: Record<AuthRateLimitScope, { ip: Limit; email: Limit }> = {
  signin: { ip: { max: 30, windowMs: 15 * 60_000 }, email: { max: 10, windowMs: 15 * 60_000 } },
  signup: { ip: { max: 10, windowMs: 60 * 60_000 }, email: { max: 5, windowMs: 60 * 60_000 } },
};

type Limit = { max: number; windowMs: number };

export const AUTH_RATE_LIMIT_MESSAGE = "Trop de tentatives. Réessayez dans quelques minutes.";

const getClientIp = (request: Request): string =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

// Hash the normalized email so no address is stored in the rate-limit table.
const hashEmail = (email: string): string =>
  createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32);

export async function enforceAuthRateLimit(
  request: Request,
  scope: AuthRateLimitScope,
  email: string
): Promise<NextResponse | null> {
  const limits = AUTH_RATE_LIMITS[scope];
  const checks = [
    await checkRateLimitAsync(`auth-${scope}-ip:${getClientIp(request)}`, limits.ip.max, limits.ip.windowMs),
    await checkRateLimitAsync(`auth-${scope}-email:${hashEmail(email)}`, limits.email.max, limits.email.windowMs),
  ];
  const blocked = checks.filter((check) => !check.allowed);

  if (blocked.length === 0) return null;

  const retryAfterMs = Math.max(...blocked.map((check) => check.retryAfter ?? 0));

  return NextResponse.json(
    { code: "rate_limited", message: AUTH_RATE_LIMIT_MESSAGE },
    { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) } }
  );
}
