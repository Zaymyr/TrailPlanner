import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllPostMetadata, getPublicRaces } = vi.hoisted(() => ({
  getAllPostMetadata: vi.fn(),
  getPublicRaces: vi.fn(),
}));

vi.mock('../lib/blog/posts', () => ({ getAllPostMetadata }));
vi.mock('../lib/public-races', () => ({ getPublicRaces, PUBLIC_RACES_REVALIDATE_SECONDS: 900 }));

import { DEMO_EVENT_ID } from '../lib/demo-race';
import sitemap, { revalidate } from './sitemap';

const makeRace = (overrides: Record<string, unknown>) => ({
  id: String(overrides.slug),
  eventId: null,
  editionId: null,
  eventEditionSlug: null,
  eventSlug: null,
  eventName: null,
  date: '2026-12-12',
  distanceKm: 20,
  regionSlug: null,
  updatedAt: null,
  ...overrides,
});

describe('sitemap', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T10:00:00Z'));
    getPublicRaces.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shares the public race cache duration', () => {
    expect(revalidate).toBe(900);
  });

  it('includes every unique canonical blog URL with its last modification date', async () => {
    getAllPostMetadata.mockResolvedValue([
      {
        canonicalPath: '/blog/preparer-son-trail',
        date: '2026-01-10T00:00:00.000Z',
        updatedAt: '2026-02-12T00:00:00.000Z',
      },
      {
        canonicalPath: '/blog/nutrition-trail',
        date: '2026-03-15T00:00:00.000Z',
      },
      {
        canonicalPath: '/blog/preparer-son-trail',
        date: '2026-01-10T00:00:00.000Z',
      },
    ]);

    const entries = await sitemap();
    const blogEntries = entries.filter((entry) => entry.url.includes('/blog/'));

    expect(blogEntries).toEqual([
      {
        url: 'https://pace-yourself.com/blog/preparer-son-trail',
        lastModified: '2026-02-12T00:00:00.000Z',
      },
      {
        url: 'https://pace-yourself.com/blog/nutrition-trail',
        lastModified: '2026-03-15T00:00:00.000Z',
      },
    ]);
  });

  it('includes every indexable static product, partner, and support page', async () => {
    getAllPostMetadata.mockResolvedValue([]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual(expect.arrayContaining([
      'https://pace-yourself.com/premium',
      'https://pace-yourself.com/partenaires',
      'https://pace-yourself.com/en/partners',
      'https://pace-yourself.com/support',
    ]));
  });

  it('lists the event hub instead of its edition pages, with the latest format update', async () => {
    getAllPostMetadata.mockResolvedValue([]);
    getPublicRaces.mockResolvedValue([
      makeRace({ slug: 'trail-a', eventId: 'event-a', eventSlug: 'festival-a', eventEditionSlug: 'festival-a-2026', updatedAt: '2026-09-08T10:00:00.000Z' }),
      makeRace({ slug: 'trail-b', eventId: 'event-a', eventSlug: 'festival-a', eventEditionSlug: 'festival-a-2025', date: '2025-12-12', updatedAt: '2026-09-09T12:00:00.000Z' }),
      // No hub slug yet (column not deployed): the edition URL stays listed.
      makeRace({ slug: 'trail-c', eventId: 'event-c', eventEditionSlug: 'festival-c-2026', updatedAt: null }),
    ]);

    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(entries).toEqual(expect.arrayContaining([
      { url: 'https://pace-yourself.com/courses/trail-a', lastModified: '2026-09-08T10:00:00.000Z' },
      { url: 'https://pace-yourself.com/courses/evenements/festival-a', lastModified: '2026-09-09T12:00:00.000Z' },
      { url: 'https://pace-yourself.com/courses/evenements/festival-c-2026', lastModified: undefined },
    ]));
    expect(urls.some((url) => url.endsWith('/festival-a-2026') || url.endsWith('/festival-a-2025'))).toBe(false);
  });

  it('lists distance, region and month selections only from five upcoming formats, every page included', async () => {
    getAllPostMetadata.mockResolvedValue([]);
    const upcoming = Array.from({ length: 13 }, (_, index) => makeRace({
      slug: `trail-${index}`,
      date: '2027-05-10',
      regionSlug: 'bretagne',
      updatedAt: `2026-10-${String(10 + index).padStart(2, '0')}T00:00:00.000Z`,
    }));
    const past = Array.from({ length: 6 }, (_, index) => makeRace({ slug: `ancien-${index}`, date: '2026-05-10', regionSlug: 'corse' }));
    getPublicRaces.mockResolvedValue([...upcoming, ...past]);

    const entries = await sitemap();

    expect(entries).toEqual(expect.arrayContaining([
      { url: 'https://pace-yourself.com/courses/distances/trail-court', lastModified: '2026-10-22T00:00:00.000Z' },
      { url: 'https://pace-yourself.com/courses/distances/trail-court/page/2', lastModified: '2026-10-22T00:00:00.000Z' },
      { url: 'https://pace-yourself.com/courses/regions/bretagne', lastModified: '2026-10-22T00:00:00.000Z' },
      { url: 'https://pace-yourself.com/courses/mois/mai-2027', lastModified: '2026-10-22T00:00:00.000Z' },
    ]));
    const urls = entries.map((entry) => entry.url);
    expect(urls.some((url) => url.includes('/regions/corse') || url.includes('mai-2026'))).toBe(false);
    expect(urls).not.toContain('https://pace-yourself.com/courses/distances/trail-court/page/3');
  });

  it('leaves the Trail TST demo event, its hub and its edition out', async () => {
    getAllPostMetadata.mockResolvedValue([]);
    getPublicRaces.mockResolvedValue([
      makeRace({ slug: 'trail-a', eventId: 'other-event', eventEditionSlug: 'festival-a-2026' }),
      makeRace({ slug: 'ultra-des-cimes', eventId: DEMO_EVENT_ID, eventSlug: 'trail-tst', eventEditionSlug: 'trail-tst-2027' }),
    ]);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://pace-yourself.com/courses/trail-a');
    expect(urls.some((url) => url.includes('ultra-des-cimes') || url.includes('trail-tst'))).toBe(false);
  });
});
