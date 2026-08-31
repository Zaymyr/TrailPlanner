import { Image } from 'react-native';

import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';
import {
  EMPTY_RACEBOOK_SPONSORS,
  normalizeRacebookSponsorPresentation,
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

export async function fetchRacebookSponsors(raceId: string): Promise<RacebookSponsorPresentation> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const accessScope = data.session?.user.id ?? 'public';
  const cacheKey = `${accessScope}:${raceId}`;
  const now = Date.now();
  const cached = sponsorRequests.get(cacheKey);

  if (cached && cached.expiresAt > now) return cached.request;
  if (cached) sponsorRequests.delete(cacheKey);

  const request = fetch(`${WEB_API_BASE_URL}/api/racebook-sponsors?raceId=${encodeURIComponent(raceId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
    .then(async (response) => {
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
    presentation.loadingSponsors.map((sponsor) =>
      Promise.race([
        Image.prefetch(sponsor.logoUrl),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RACEBOOK_SPONSOR_LOGO_TIMEOUT_MS)),
      ]),
    ),
  );

  return presentation;
}
