import { describe, expect, it } from 'vitest';

import {
  EMPTY_RACEBOOK_SPONSORS,
  LEGACY_RACEBOOK_MODULES,
  createRacebookSponsorImpressionReporter,
  isRacebookSponsorSurfaceViewable,
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
    expect(presentation.bannerSponsors[0]).toMatchObject({
      tier: 'official',
      category: null,
      contextualPlacement: 'none',
    });
    expect(presentation.contextualSponsors).toEqual(presentation.bannerSponsors);
  });

  it('normalizes colors and exposes the published edition logo', () => {
    const presentation = normalizeRacebookSponsorPresentation({
      branding: {
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#abcdef',
        accentColor: 'orange',
      },
    });

    expect(presentation.branding).toEqual({
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#ABCDEF',
      accentColor: '#B45309',
    });
  });

  it('preserves sponsor hierarchy and contextual placement metadata', () => {
    const presentation = normalizeRacebookSponsorPresentation({
      bannerSponsors: [{ ...sponsor('principal'), tier: 'principal', category: 'Partenaire titre', contextualPlacement: 'aid_stations' }],
    });

    expect(presentation.bannerSponsors[0]).toMatchObject({
      tier: 'principal',
      category: 'Partenaire titre',
      contextualPlacement: 'aid_stations',
    });
  });

  it('uses the dedicated contextual collection when the API provides it', () => {
    const presentation = normalizeRacebookSponsorPresentation({
      bannerSponsors: [sponsor('banner')],
      contextualSponsors: [{ ...sponsor('services'), tier: 'service', contextualPlacement: 'services' }],
    });

    expect(presentation.contextualSponsors).toMatchObject([{ id: 'services', tier: 'service', contextualPlacement: 'services' }]);
  });

  it('reports each sponsor placement once for aggregate-only instrumentation', () => {
    const reported: unknown[] = [];
    const report = createRacebookSponsorImpressionReporter((impression) => reported.push(impression));
    const normalizedSponsor = normalizeRacebookSponsorPresentation({ bannerSponsors: [sponsor('one')] }).bannerSponsors[0];

    report(normalizedSponsor, 'hero');
    report(normalizedSponsor, 'hero');
    report(normalizedSponsor, 'services');

    expect(reported).toEqual([
      { sponsorId: 'one', placement: 'hero', tier: 'official' },
      { sponsorId: 'one', placement: 'services', tier: 'official' },
    ]);
  });

  it('requires a materially visible sponsor surface', () => {
    expect(isRacebookSponsorSurfaceViewable(900, 160, 800)).toBe(false);
    expect(isRacebookSponsorSurfaceViewable(740, 160, 800)).toBe(false);
    expect(isRacebookSponsorSurfaceViewable(720, 160, 800)).toBe(true);
    expect(isRacebookSponsorSurfaceViewable(-40, 160, 800)).toBe(true);
  });
});
