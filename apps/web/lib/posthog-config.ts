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

const UTM_QUERY_PARAM_NAMES = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const SEARCH_DOMAINS = ["google.", "bing.com", "duckduckgo.com", "ecosia.org", "yahoo."];
const SOCIAL_DOMAINS = ["facebook.com", "instagram.com", "linkedin.com", "tiktok.com", "x.com", "twitter.com", "youtube.com"];

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

function safeAnalyticsValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 200) : undefined;
}

export function getWebPageGroup(pathname: string) {
  if (pathname.startsWith("/onboarding")) return "onboarding";
  if (pathname.startsWith("/courses") || pathname.startsWith("/races")) return "courses";
  if (pathname.startsWith("/planner") || pathname.startsWith("/plans")) return "planner";
  if (pathname === "/organisateurs" || pathname === "/organizers") return "organizer_acquisition";
  if (pathname.startsWith("/organizer")) return "organizer_dashboard";
  if (pathname.startsWith("/account") || pathname.startsWith("/auth")) return "account";
  if (pathname.startsWith("/blog") || pathname.startsWith("/guides")) return "content";
  return pathname === "/" ? "landing" : "other";
}

export function buildWebAcquisitionProperties(
  searchParams?: URLSearchParams | null,
  referrer?: string | null,
  currentOrigin?: string | null,
) {
  const utm = Object.fromEntries(
    UTM_QUERY_PARAM_NAMES.flatMap((key) => {
      const value = safeAnalyticsValue(searchParams?.get(key) ?? null);
      return value ? [[key, value]] : [];
    }),
  ) as Partial<Record<(typeof UTM_QUERY_PARAM_NAMES)[number], string>>;

  let referringDomain: string | undefined;
  try {
    const referrerUrl = referrer ? new URL(referrer) : null;
    const currentHost = currentOrigin ? new URL(currentOrigin).hostname : null;
    if (referrerUrl && referrerUrl.hostname !== currentHost) {
      referringDomain = referrerUrl.hostname.toLowerCase().replace(/^www\./, "").slice(0, 200);
    }
  } catch {
    referringDomain = undefined;
  }

  const hasCampaign = Object.keys(utm).length > 0;
  const trafficChannel = hasCampaign
    ? "campaign"
    : !referringDomain
      ? "direct"
      : SEARCH_DOMAINS.some((domain) => referringDomain.includes(domain))
        ? "organic_search"
        : SOCIAL_DOMAINS.some((domain) => referringDomain === domain || referringDomain.endsWith(`.${domain}`))
          ? "social"
          : "referral";

  return {
    ...utm,
    traffic_channel: trafficChannel,
    traffic_source: utm.utm_source ?? referringDomain ?? "direct",
    traffic_medium: utm.utm_medium ?? (trafficChannel === "organic_search" ? "organic" : trafficChannel === "direct" ? "none" : "referral"),
    ...(utm.utm_campaign ? { traffic_campaign: utm.utm_campaign } : {}),
    ...(referringDomain ? { referring_domain: referringDomain } : {}),
  };
}
