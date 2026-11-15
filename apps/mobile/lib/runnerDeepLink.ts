export type RunnerDeepLinkRoute =
  | `/(app)/catalog?raceSlug=${string}`
  | '/(app)/plan/new'
  | `/(app)/plan/new?catalogRaceId=${string}`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveRunnerDeepLinkRoute(url: string): RunnerDeepLinkRoute | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isWebLink = parsed.protocol === 'https:' &&
    (parsed.hostname === 'pace-yourself.com' || parsed.hostname === 'www.pace-yourself.com');
  const isAppLink = parsed.protocol === 'paceyourself:';
  if (!isWebLink && !isAppLink) return null;

  const appPath = isAppLink && parsed.hostname
    ? `/${parsed.hostname}${parsed.pathname}`
    : parsed.pathname;
  const normalizedPath = appPath.replace(/\/+$/, '') || '/';

  if (normalizedPath === '/race-planner') {
    const raceId = parsed.searchParams.get('catalogRaceId');
    if (!raceId) return '/(app)/plan/new';
    return UUID_PATTERN.test(raceId) ? `/(app)/plan/new?catalogRaceId=${raceId}` : null;
  }

  const courseMatch = normalizedPath.match(/^\/courses\/([^/]+)$/);
  if (!courseMatch) return null;
  const slug = decodeURIComponent(courseMatch[1]).trim();
  return slug ? `/(app)/catalog?raceSlug=${encodeURIComponent(slug)}` : null;
}
