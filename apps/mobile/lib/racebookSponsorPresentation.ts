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
  modules: RacebookModuleVisibility;
};

export type RacebookModuleVisibility = {
  equipment: boolean;
  bib_pickup: boolean;
  access: boolean;
  services: boolean;
  branding: boolean;
  sponsors: boolean;
  aid_stations: boolean;
  start_waves: boolean;
  awards: boolean;
  relay: boolean;
  official_products: boolean;
};

export const LEGACY_RACEBOOK_MODULES: RacebookModuleVisibility = {
  equipment: true,
  bib_pickup: true,
  access: true,
  services: true,
  branding: true,
  sponsors: true,
  aid_stations: true,
  start_waves: true,
  awards: true,
  relay: true,
  official_products: true,
};

export const EMPTY_RACEBOOK_SPONSORS: RacebookSponsorPresentation = {
  loadingSponsors: [],
  bannerSponsors: [],
  branding: {
    logoUrl: null,
    primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR,
    accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR,
  },
  modules: LEGACY_RACEBOOK_MODULES,
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
  const rawModules = presentation.modules && typeof presentation.modules === 'object'
    ? presentation.modules as Partial<RacebookModuleVisibility>
    : null;
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
    modules: Object.fromEntries(
      Object.entries(LEGACY_RACEBOOK_MODULES).map(([key, legacyDefault]) => [
        key,
        typeof rawModules?.[key as keyof RacebookModuleVisibility] === 'boolean'
          ? rawModules[key as keyof RacebookModuleVisibility]
          : legacyDefault,
      ]),
    ) as RacebookModuleVisibility,
  };
}
