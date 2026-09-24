import { Image } from 'react-native';

import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';
import { fetchWithTimeout } from './fetchWithTimeout';
import {
  EMPTY_RACEBOOK_SPONSORS,
  normalizeRacebookSponsorPresentation,
  type RacebookSponsorImpression,
  type RacebookSponsorPresentation,
} from './racebookSponsorPresentation';

export * from './racebookSponsorPresentation';

const RACEBOOK_SPONSOR_PREFETCH_TTL_MS = 15_000;
const RACEBOOK_SPONSOR_LOGO_TIMEOUT_MS = 1_500;

type SponsorCacheEntry = {
  expiresAt: number;
  request: Promise<RacebookSponsorPresentation>;
};

const sponsorRequests = new Map<string, SponsorCacheEntry>();

export function createRacebookSponsorViewId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export async function reportRacebookSponsorImpression(
  raceId: string,
  viewId: string,
  impression: RacebookSponsorImpression,
) {
  await fetchWithTimeout(`${WEB_API_BASE_URL}/api/racebook-sponsors/impression`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      raceId,
      viewId,
      sponsorId: impression.sponsorId,
      placement: impression.placement,
    }),
  }, 2_500).catch(() => null);
}

export async function fetchRacebookSponsors(raceId: string): Promise<RacebookSponsorPresentation> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const accessScope = data.session?.user.id ?? 'public';
  const cacheKey = `${accessScope}:${raceId}`;
  const now = Date.now();
  const cached = sponsorRequests.get(cacheKey);

  if (cached && cached.expiresAt > now) return cached.request;
  if (cached) sponsorRequests.delete(cacheKey);

  const url = `${WEB_API_BASE_URL}/api/racebook-sponsors?raceId=${encodeURIComponent(raceId)}`;
  const request = fetchWithTimeout(url)
    .then(async (publicResponse) => {
      const response = publicResponse.ok || !token
        ? publicResponse
        : await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return EMPTY_RACEBOOK_SPONSORS;
      return normalizeRacebookSponsorPresentation(await response.json().catch(() => null));
    })
    .catch(() => EMPTY_RACEBOOK_SPONSORS);

  sponsorRequests.set(cacheKey, {
    expiresAt: now + RACEBOOK_SPONSOR_PREFETCH_TTL_MS,
    request,
  });

  return request;
}

export async function prefetchRacebookSponsors(raceId: string): Promise<RacebookSponsorPresentation> {
  const presentation = await fetchRacebookSponsors(raceId);

  await Promise.allSettled(
    [...presentation.loadingSponsors.map((sponsor) => sponsor.logoUrl), presentation.branding.logoUrl]
      .filter((url): url is string => Boolean(url))
      .map((url) =>
      Promise.race([
        Image.prefetch(url),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RACEBOOK_SPONSOR_LOGO_TIMEOUT_MS)),
      ]),
    ),
  );

  return presentation;
}
