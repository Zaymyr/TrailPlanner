import { NextResponse } from "next/server";

import { getSupabaseServiceConfig } from "./supabase";

const DEFAULT_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export const withSecurityHeaders = (response: NextResponse): NextResponse => {
  Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
};

type RateLimitEntry = { count: number; resetAt: number };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimitStore = new Map<string, RateLimitEntry>();

export const checkRateLimit = (
  key: string,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): { allowed: boolean; retryAfter?: number; remaining: number } => {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, retryAfter: entry.resetAt - now, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count };
};

type RateLimitResult = { allowed: boolean; retryAfter?: number; remaining: number };

// DB-backed rate limiter — works correctly across serverless instances and cold starts.
// Falls back to the in-memory version if the Supabase service config is unavailable
// (e.g. in local dev without full env vars).
export const checkRateLimitAsync = async (
  key: string,
  limit = RATE_LIMIT_MAX,
  windowMs = RATE_LIMIT_WINDOW_MS
): Promise<RateLimitResult> => {
  const serviceConfig = getSupabaseServiceConfig();
  if (!serviceConfig) return checkRateLimit(key, limit, windowMs);

  try {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/rpc/check_and_increment_rate_limit`,
      {
        method: "POST",
        headers: {
          apikey: serviceConfig.supabaseServiceRoleKey,
          Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_key: key, p_limit: limit, p_window_ms: windowMs }),
        cache: "no-store",
      }
    );

    if (!response.ok) return checkRateLimit(key, limit, windowMs);

    const rows = (await response.json().catch(() => null)) as
      | { allowed: boolean; remaining: number; retry_after_ms: number }[]
      | null;
    const result = rows?.[0];
    if (!result) return checkRateLimit(key, limit, windowMs);

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfter: result.retry_after_ms > 0 ? result.retry_after_ms : undefined,
    };
  } catch {
    return checkRateLimit(key, limit, windowMs);
  }
};
