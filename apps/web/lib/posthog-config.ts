const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

const SENSITIVE_QUERY_PARAM_NAMES = new Set([
  "access_token",
  "code",
  "email",
  "id_token",
  "invite_token",
  "refresh_token",
  "token",
]);

export const POSTHOG_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ||
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN?.trim() ||
  "";

export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;

export function isSensitiveAnalyticsQueryParam(name: string) {
  return SENSITIVE_QUERY_PARAM_NAMES.has(name.toLowerCase());
}

export function buildSanitizedAnalyticsPath(
  pathname: string,
  searchParams?: URLSearchParams | null,
) {
  if (!searchParams || searchParams.size === 0) {
    return pathname;
  }

  const sanitizedParams = new URLSearchParams();

  for (const [key, value] of searchParams.entries()) {
    if (isSensitiveAnalyticsQueryParam(key)) {
      continue;
    }

    sanitizedParams.append(key, value);
  }

  const sanitizedQuery = sanitizedParams.toString();
  return sanitizedQuery ? `${pathname}?${sanitizedQuery}` : pathname;
}
