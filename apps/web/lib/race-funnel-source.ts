import { canLoadAnalytics } from "./cookies/consent";

/**
 * Race attribution for the web runner funnel (race page -> estimate -> signup -> checkout).
 * `source_race` is always a public catalog race id (UUID), never a name, email or plan content.
 */
const STORAGE_KEY = "runner.funnelSourceRace";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function normalizeSourceRace(value: unknown): string | null {
  return typeof value === "string" && UUID_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/** Extracts the catalog race id carried by the runner return path (`/race-planner?catalogRaceId=...`). */
export function parseSourceRaceFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    const parsed = new URL(path, "https://pace-yourself.internal");
    return parsed.pathname === "/race-planner" ? normalizeSourceRace(parsed.searchParams.get("catalogRaceId")) : null;
  } catch {
    return null;
  }
}

/** Consent-gated: nothing is stored until analytics cookies are accepted. */
export function rememberFunnelSourceRace(raceId: string | null | undefined): void {
  const normalized = normalizeSourceRace(raceId);
  if (!normalized || typeof window === "undefined" || !canLoadAnalytics()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ raceId: normalized, expiresAt: Date.now() + TTL_MS }));
  } catch {
    // Attribution is best effort.
  }
}

export function readFunnelSourceRace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { raceId?: unknown; expiresAt?: unknown };
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalizeSourceRace(parsed.raceId);
  } catch {
    return null;
  }
}

export function isUpcomingRaceDate(date: string | null | undefined, now = new Date()): boolean | null {
  if (!date) return null;
  const day = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(day.getTime())) return null;
  return day.getTime() >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Page type and slug of a public race page from its pathname (fallback when the page passes no data). */
export function parseRacePagePath(pathname: string): { pageType: "format" | "event"; slug: string } | null {
  const event = /^\/courses\/evenements\/([^/]+)\/?$/.exec(pathname);
  if (event) return { pageType: "event", slug: decodeURIComponent(event[1]) };
  const format = /^\/courses\/([^/]+)\/?$/.exec(pathname);
  if (format && !["evenements", "distances", "supporter-guide"].includes(format[1])) {
    return { pageType: "format", slug: decodeURIComponent(format[1]) };
  }
  return null;
}

/** Maps a clicked link to an estimate CTA event, or null when it is not an estimate link. */
export function resolveEstimateClick(input: {
  href: string | null;
  placement?: string | null;
  inFormatList?: boolean;
}): { raceId: string; placement: "hero" | "sticky_bar" | "format_list" | "estimates_section" | "other" } | null {
  const raceId = parseSourceRaceFromPath(input.href);
  if (!raceId) return null;
  const known = ["hero", "sticky_bar", "format_list", "estimates_section"] as const;
  const declared = known.find((value) => value === input.placement);
  return { raceId, placement: declared ?? (input.inFormatList ? "format_list" : "other") };
}
