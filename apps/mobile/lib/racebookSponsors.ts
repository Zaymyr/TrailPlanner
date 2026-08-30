import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';
import {
  EMPTY_RACEBOOK_SPONSORS,
  normalizeRacebookSponsorPresentation,
  type RacebookSponsorPresentation,
} from './racebookSponsorPresentation';

export * from './racebookSponsorPresentation';

export async function fetchRacebookSponsors(raceId: string): Promise<RacebookSponsorPresentation> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const response = await fetch(`${WEB_API_BASE_URL}/api/racebook-sponsors?raceId=${encodeURIComponent(raceId)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) return EMPTY_RACEBOOK_SPONSORS;
  return normalizeRacebookSponsorPresentation(await response.json().catch(() => null));
}
