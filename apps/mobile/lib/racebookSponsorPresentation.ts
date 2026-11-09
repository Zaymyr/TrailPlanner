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
  /** Presentation metadata is optional while older API responses are cached. */
  tier: RacebookSponsorTier;
  category: string | null;
  contextualPlacement: RacebookSponsorContextualPlacement;
};

export type RacebookSponsorTier = 'principal' | 'official' | 'service';
export type RacebookSponsorContextualPlacement = 'none' | 'aid_stations' | 'equipment' | 'access' | 'services';

export type RacebookSponsorImpression = {
  sponsorId: string;
  placement: 'loading' | 'hero' | Exclude<RacebookSponsorContextualPlacement, 'none'>;
  tier: RacebookSponsorTier;
};

export type RacebookSponsorImpressionReporter = (impression: RacebookSponsorImpression) => void;

export function isRacebookSponsorSurfaceViewable(y: number, height: number, viewportHeight: number) {
  if (height <= 0 || viewportHeight <= 0) return false;
  const visibleHeight = Math.max(0, Math.min(y + height, viewportHeight) - Math.max(y, 0));
  return visibleHeight >= Math.min(height * 0.5, 80);
}

export type RacebookPartnerSlotKey = 'equipment' | 'lodging';

/**
 * A partner slot shows the Pace Yourself affiliate card by default. An
 * organizer with the Signature sponsors option may replace it with their own
 * partner (counted redirect) or hide it.
 */
export type RacebookPartnerSlot =
  | { mode: 'affiliate' }
  | { mode: 'hidden' }
  | { mode: 'partner'; name: string; logoUrl: string; headline: string | null; clickUrl: string | null };

export const DEFAULT_RACEBOOK_PARTNER_SLOTS: Record<RacebookPartnerSlotKey, RacebookPartnerSlot> = {
  equipment: { mode: 'affiliate' },
  lodging: { mode: 'affiliate' },
};

export type RacebookSponsorPresentation = {
  loadingSponsors: RacebookSponsor[];
  bannerSponsors: RacebookSponsor[];
  /** Partners eligible for an in-context RaceBook section. */
  contextualSponsors: RacebookSponsor[];
  branding: RacebookBranding;
  modules: RacebookModuleVisibility;
  partnerSlots: Record<RacebookPartnerSlotKey, RacebookPartnerSlot>;
};

export type RacebookModuleVisibility = {
  equipment: boolean;
  bib_pickup: boolean;
  access: boolean;
  services: boolean;
  branding: boolean;
  sponsors: boolean;
  aid_stations: boolean;
  supporter_points: boolean;
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
  supporter_points: true,
  start_waves: true,
  awards: true,
  relay: true,
  official_products: true,
};

export const EMPTY_RACEBOOK_SPONSORS: RacebookSponsorPresentation = {
  loadingSponsors: [],
  bannerSponsors: [],
  contextualSponsors: [],
  branding: {
    logoUrl: null,
    primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR,
    accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR,
  },
  modules: LEGACY_RACEBOOK_MODULES,
  partnerSlots: DEFAULT_RACEBOOK_PARTNER_SLOTS,
};

export const RACEBOOK_SPONSOR_MINIMUM_MS = 2_500;

const isSponsor = (value: unknown): value is Omit<RacebookSponsor, 'tier' | 'category' | 'contextualPlacement'> & Partial<Pick<RacebookSponsor, 'tier' | 'category' | 'contextualPlacement'>> => {
  if (!value || typeof value !== 'object') return false;
  const sponsor = value as Partial<RacebookSponsor>;
  return (
    typeof sponsor.id === 'string' &&
    typeof sponsor.name === 'string' &&
    typeof sponsor.logoUrl === 'string' &&
    (typeof sponsor.clickUrl === 'string' || sponsor.clickUrl === null)
  );
};

function normalizeTier(value: unknown): RacebookSponsorTier {
  return value === 'principal' || value === 'service' ? value : 'official';
}

function normalizeContextualPlacement(value: unknown): RacebookSponsorContextualPlacement {
  return value === 'aid_stations' || value === 'equipment' || value === 'access' || value === 'services'
    ? value
    : 'none';
}

function normalizeSponsor(sponsor: ReturnType<typeof asSponsor>): RacebookSponsor {
  return {
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl,
    clickUrl: sponsor.clickUrl,
    tier: normalizeTier(sponsor.tier),
    category: typeof sponsor.category === 'string' && sponsor.category.trim() ? sponsor.category.trim() : null,
    contextualPlacement: normalizeContextualPlacement(sponsor.contextualPlacement),
  };
}

function asSponsor(value: unknown) {
  return value as Omit<RacebookSponsor, 'tier' | 'category' | 'contextualPlacement'> & Partial<Pick<RacebookSponsor, 'tier' | 'category' | 'contextualPlacement'>>;
}

/**
 * Returns a callback which emits each sponsor/placement pair once per mounted
 * surface. The caller may forward this to an aggregate-only endpoint; it must
 * not attach a runner identity or a direct destination URL.
 */
export function createRacebookSponsorImpressionReporter(report: RacebookSponsorImpressionReporter) {
  const reported = new Set<string>();
  return (sponsor: RacebookSponsor, placement: RacebookSponsorImpression['placement']) => {
    const key = `${placement}:${sponsor.id}`;
    if (reported.has(key)) return;
    reported.add(key);
    report({ sponsorId: sponsor.id, placement, tier: sponsor.tier });
  };
}

const isHttpsUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

function normalizePartnerSlot(value: unknown): RacebookPartnerSlot {
  if (!value || typeof value !== 'object') return { mode: 'affiliate' };
  const slot = value as Record<string, unknown>;
  if (slot.mode === 'hidden') return { mode: 'hidden' };
  if (slot.mode === 'partner' && typeof slot.name === 'string' && slot.name.trim() && isHttpsUrl(slot.logoUrl)) {
    return {
      mode: 'partner',
      name: slot.name.trim(),
      logoUrl: slot.logoUrl,
      headline: typeof slot.headline === 'string' && slot.headline.trim() ? slot.headline.trim() : null,
      clickUrl: typeof slot.clickUrl === 'string' && slot.clickUrl ? slot.clickUrl : null,
    };
  }
  return { mode: 'affiliate' };
}

/** Older payloads omit partner slots: every slot keeps its affiliate card. */
export function normalizeRacebookPartnerSlots(value: unknown): Record<RacebookPartnerSlotKey, RacebookPartnerSlot> {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    equipment: normalizePartnerSlot(raw.equipment),
    lodging: normalizePartnerSlot(raw.lodging),
  };
}

export function normalizeRacebookSponsorPresentation(payload: unknown): RacebookSponsorPresentation {
  if (!payload || typeof payload !== 'object') return EMPTY_RACEBOOK_SPONSORS;
  const presentation = payload as Partial<RacebookSponsorPresentation>;
  const branding = resolveRacebookTheme(presentation.branding);
  const rawModules = presentation.modules && typeof presentation.modules === 'object'
    ? presentation.modules as Partial<RacebookModuleVisibility>
    : null;
  const bannerSponsors = Array.isArray(presentation.bannerSponsors)
    ? presentation.bannerSponsors.filter(isSponsor).slice(0, 10).map((sponsor) => normalizeSponsor(asSponsor(sponsor)))
    : [];
  return {
    loadingSponsors: Array.isArray(presentation.loadingSponsors)
      ? presentation.loadingSponsors.filter(isSponsor).slice(0, 2).map((sponsor) => normalizeSponsor(asSponsor(sponsor)))
      : [],
    bannerSponsors,
    // Older public responses have no contextual collection; their banner rows
    // remain a safe fallback so a newly configured placement is not invisible.
    contextualSponsors: Array.isArray((presentation as { contextualSponsors?: unknown }).contextualSponsors)
      ? ((presentation as { contextualSponsors: unknown[] }).contextualSponsors).filter(isSponsor).slice(0, 10).map((sponsor) => normalizeSponsor(asSponsor(sponsor)))
      : bannerSponsors,
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
    partnerSlots: normalizeRacebookPartnerSlots((presentation as { partnerSlots?: unknown }).partnerSlots),
  };
}
