import {
  DEFAULT_RACEBOOK_ACCENT_COLOR,
  DEFAULT_RACEBOOK_PRIMARY_COLOR,
  resolveRacebookTheme,
  type RacebookBranding,
} from '@pace-yourself/design-system';

export type RacebookSponsor = {
  id: string;
  name: string;
  logoUrl: string;
  clickUrl: string | null;
};

export type RacebookSponsorPresentation = {
  loadingSponsors: RacebookSponsor[];
  bannerSponsors: RacebookSponsor[];
  branding: RacebookBranding;
};

export const EMPTY_RACEBOOK_SPONSORS: RacebookSponsorPresentation = {
  loadingSponsors: [],
  bannerSponsors: [],
  branding: {
    logoUrl: null,
    primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR,
    accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR,
  },
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
  const branding = resolveRacebookTheme(presentation.branding);
  return {
    loadingSponsors: Array.isArray(presentation.loadingSponsors)
      ? presentation.loadingSponsors.filter(isSponsor).slice(0, 2)
      : [],
    bannerSponsors: Array.isArray(presentation.bannerSponsors)
      ? presentation.bannerSponsors.filter(isSponsor).slice(0, 10)
      : [],
    branding: {
      logoUrl: branding.logoUrl,
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
    },
  };
}
