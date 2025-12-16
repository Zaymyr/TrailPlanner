import { NextResponse } from "next/server";

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
