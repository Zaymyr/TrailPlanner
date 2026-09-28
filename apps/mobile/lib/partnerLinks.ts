import { fetchWithTimeout } from './fetchWithTimeout';
import { WEB_API_BASE_URL } from './webApi';

export type PartnerKey = 'booking' | 'decathlon';

export type ResolvedPartnerLink = {
  partnerKey: PartnerKey;
  url: string;
  isAffiliate: boolean;
};

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeResolvedPartnerLinks(value: unknown): ResolvedPartnerLink[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { links?: unknown }).links)) return [];

  const seen = new Set<PartnerKey>();
  return (value as { links: unknown[] }).links.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const row = candidate as Record<string, unknown>;
    const partnerKey = row.partnerKey;
    if ((partnerKey !== 'booking' && partnerKey !== 'decathlon') || seen.has(partnerKey)) return [];
    if (!isHttpsUrl(row.url) || typeof row.isAffiliate !== 'boolean') return [];
    seen.add(partnerKey);
    return [{ partnerKey, url: row.url, isAffiliate: row.isAffiliate }];
  });
}

export async function fetchPartnerLinks(): Promise<ResolvedPartnerLink[]> {
  try {
    const response = await fetchWithTimeout(`${WEB_API_BASE_URL}/api/partner-links`);
    if (!response.ok) return [];
    return normalizeResolvedPartnerLinks(await response.json().catch(() => null));
  } catch {
    return [];
  }
}
