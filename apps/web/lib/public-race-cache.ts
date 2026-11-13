import { revalidateTag } from "next/cache";

export const PUBLIC_RACES_CACHE_TAG = "public-races";

export const publicRaceCacheTag = (raceId: string) => `public-race:${raceId}`;
export const publicEventCacheTag = (eventId: string) => `public-event:${eventId}`;
export const publicEditionCacheTag = (editionId: string) => `public-edition:${editionId}`;

export const publicRaceCacheTags = ({
  raceId,
  editionId,
  eventId,
}: {
  raceId?: string | null;
  editionId?: string | null;
  eventId?: string | null;
} = {}) => [
  PUBLIC_RACES_CACHE_TAG,
  raceId ? publicRaceCacheTag(raceId) : null,
  editionId ? publicEditionCacheTag(editionId) : null,
  eventId ? publicEventCacheTag(eventId) : null,
].filter((tag): tag is string => Boolean(tag));

export function invalidatePublicRaceCache(
  scope: { raceId?: string | null; editionId?: string | null; eventId?: string | null } = {},
) {
  for (const tag of publicRaceCacheTags(scope)) {
    try {
      revalidateTag(tag);
    } catch (error) {
      // A successful source write must not be rolled back by a transient cache
      // invalidation failure. The 15-minute TTL remains the bounded fallback.
      if (process.env.NODE_ENV !== "test") console.warn("Unable to invalidate public race cache", tag, error);
    }
  }
}
