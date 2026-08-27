export const ORGANIZER_UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type OrganizerUtmKey = (typeof ORGANIZER_UTM_KEYS)[number];
export type OrganizerAttribution = Partial<Record<OrganizerUtmKey, string>>;

type SearchParamValue = string | string[] | undefined;
type SearchParamInput = URLSearchParams | Record<string, SearchParamValue> | null | undefined;

const DEFAULT_RETURN_PATH = "/race-planner";
const ALLOWED_RETURN_PATHS = new Set(["/organizers"]);

const readSearchParam = (input: SearchParamInput, key: OrganizerUtmKey): string | null => {
  if (!input) return null;
  if (input instanceof URLSearchParams) return input.get(key);

  const value = input[key];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
};

export function extractOrganizerAttribution(input: SearchParamInput): OrganizerAttribution {
  const attribution: OrganizerAttribution = {};

  ORGANIZER_UTM_KEYS.forEach((key) => {
    const value = readSearchParam(input, key)?.trim();
    if (value) attribution[key] = value.slice(0, 200);
  });

  return attribution;
}

export function buildOrganizerCreationHref(attribution: OrganizerAttribution): string {
  const params = new URLSearchParams();
  ORGANIZER_UTM_KEYS.forEach((key) => {
    const value = attribution[key];
    if (value) params.set(key, value);
  });

  const query = params.toString();
  return query ? `/organizers?${query}` : "/organizers";
}

export function normalizeInternalReturnPath(value: string | string[] | null | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DEFAULT_RETURN_PATH;
  }

  try {
    const parsed = new URL(candidate, "https://pace-yourself.internal");
    if (parsed.origin !== "https://pace-yourself.internal" || !ALLOWED_RETURN_PATHS.has(parsed.pathname)) {
      return DEFAULT_RETURN_PATH;
    }

    const attribution = extractOrganizerAttribution(parsed.searchParams);
    return buildOrganizerCreationHref(attribution);
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}

export function buildAuthHref(pathname: "/sign-in" | "/sign-up", returnPath: string): string {
  const params = new URLSearchParams({ next: normalizeInternalReturnPath(returnPath) });
  return `${pathname}?${params.toString()}`;
}

export function buildAuthCallbackPath(returnPath: string): string {
  const params = new URLSearchParams({ next: normalizeInternalReturnPath(returnPath) });
  return `/auth/callback?${params.toString()}`;
}
