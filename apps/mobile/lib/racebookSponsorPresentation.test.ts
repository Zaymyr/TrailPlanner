import { describe, expect, it } from 'vitest';

import {
  EMPTY_RACEBOOK_SPONSORS,
  LEGACY_RACEBOOK_MODULES,
  normalizeRacebookSponsorPresentation,
} from './racebookSponsorPresentation';

const sponsor = (id: string) => ({
  id,
  name: `Sponsor ${id}`,
  logoUrl: `https://example.com/${id}.png`,
  clickUrl: id === 'one' ? null : `https://example.com/${id}`,
});

describe('normalizeRacebookSponsorPresentation', () => {
  it('falls back to the historical visible modules for absent rolling-deployment data', () => {
    expect(normalizeRacebookSponsorPresentation(null)).toEqual(EMPTY_RACEBOOK_SPONSORS);
    expect(normalizeRacebookSponsorPresentation({}).modules).toEqual(LEGACY_RACEBOOK_MODULES);
  });

  it('honors only explicit boolean module overrides', () => {
    const presentation = normalizeRacebookSponsorPresentation({
      modules: {
        equipment: false,
        sponsors: false,
        access: 'false',
        relay: 0,
      },
    });

    expect(presentation.modules).toEqual({
      ...LEGACY_RACEBOOK_MODULES,
      equipment: false,
      sponsors: false,
    });
  });

  it('filters malformed sponsors and enforces loading and banner limits', () => {
    const validSponsors = Array.from({ length: 12 }, (_, index) => sponsor(String(index)));
    const presentation = normalizeRacebookSponsorPresentation({
      loadingSponsors: [sponsor('one'), { ...sponsor('bad'), logoUrl: null }, sponsor('two'), sponsor('three')],
      bannerSponsors: [{ nope: true }, ...validSponsors],
    });

    expect(presentation.loadingSponsors.map(({ id }) => id)).toEqual(['one', 'two']);
    expect(presentation.bannerSponsors.map(({ id }) => id)).toEqual(validSponsors.slice(0, 10).map(({ id }) => id));
  });

  it('normalizes colors and keeps the dormant edition logo hidden', () => {
    const presentation = normalizeRacebookSponsorPresentation({
      branding: {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#abcdef',
        accentColor: 'orange',
      },
    });

    expect(presentation.branding).toEqual({
      logoUrl: null,
      primaryColor: '#ABCDEF',
      accentColor: '#B45309',
    });
  });
});
