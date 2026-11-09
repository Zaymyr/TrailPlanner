import { invalidateByTag } from "@vercel/functions";

const PREFIX = "racebook";

export const racebookRaceCacheTag = (raceId: string) => `${PREFIX}:race:${raceId}`;
export const racebookEditionCacheTag = (editionId: string) => `${PREFIX}:edition:${editionId}`;
export const racebookEventCacheTag = (eventId: string) => `${PREFIX}:event:${eventId}`;

export const racebookCacheTags = ({
  raceId,
  editionId,
  eventId,
}: {
  raceId?: string | null;
  editionId?: string | null;
  eventId?: string | null;
}) => [
  raceId ? racebookRaceCacheTag(raceId) : null,
  editionId ? racebookEditionCacheTag(editionId) : null,
  eventId ? racebookEventCacheTag(eventId) : null,
].filter((tag): tag is string => Boolean(tag));

export function setPublicRacebookCacheHeaders(
  response: Response,
  scope: { raceId: string; editionId?: string | null; eventId?: string | null },
) {
  response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  // One hour at the CDN: organizer writes and publications purge these tags
  // explicitly (invalidateRacebookCache), so the TTL only bounds staleness for
  // the few writers that do not purge (admin catalog GPX edits). A shorter TTL
  // multiplies function invocations, since the CDN cache is per region.
  response.headers.set(
    "Vercel-CDN-Cache-Control",
    "public, max-age=3600, stale-while-revalidate=86400, stale-if-error=86400",
  );
  response.headers.set("Vercel-Cache-Tag", racebookCacheTags(scope).join(","));
  return response;
}

export function setPrivateRacebookCacheHeaders(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function invalidateRacebookCache(
  scope: { raceId?: string | null; editionId?: string | null; eventId?: string | null },
) {
  const tags = racebookCacheTags(scope);
  if (tags.length === 0 || process.env.VERCEL !== "1") return;

  try {
    await invalidateByTag(tags);
  } catch (error) {
    // Cache invalidation must never roll back an organizer write. The CDN TTL
    // remains the bounded fallback if Vercel's invalidation service is unavailable.
    console.warn("Unable to invalidate RaceBook CDN cache", error);
  }
}
