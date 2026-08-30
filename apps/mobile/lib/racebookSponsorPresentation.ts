export type RacebookSponsor = {
  id: string;
  name: string;
  logoUrl: string;
  clickUrl: string | null;
};

export type RacebookSponsorPresentation = {
  loadingSponsors: RacebookSponsor[];
  bannerSponsors: RacebookSponsor[];
};

export const EMPTY_RACEBOOK_SPONSORS: RacebookSponsorPresentation = {
  loadingSponsors: [],
  bannerSponsors: [],
};

export const RACEBOOK_SPONSOR_MINIMUM_MS = 2_500;

const isSponsor = (value: unknown): value is RacebookSponsor => {
  if (!value || typeof value !== 'object') return false;
  const sponsor = value as Partial<RacebookSponsor>;
  return (
    typeof sponsor.id === 'string' &&
    typeof sponsor.name === 'string' &&
    typeof sponsor.logoUrl === 'string' &&
    (typeof sponsor.clickUrl === 'string' || sponsor.clickUrl === null)
  );
};

export function normalizeRacebookSponsorPresentation(payload: unknown): RacebookSponsorPresentation {
  if (!payload || typeof payload !== 'object') return EMPTY_RACEBOOK_SPONSORS;
  const presentation = payload as Partial<RacebookSponsorPresentation>;
  return {
    loadingSponsors: Array.isArray(presentation.loadingSponsors)
      ? presentation.loadingSponsors.filter(isSponsor).slice(0, 2)
      : [],
    bannerSponsors: Array.isArray(presentation.bannerSponsors)
      ? presentation.bannerSponsors.filter(isSponsor).slice(0, 10)
      : [],
  };
}
