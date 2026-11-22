import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllPostMetadata, getPublicRaces, getIndexableDistancePages } = vi.hoisted(() => ({
  getAllPostMetadata: vi.fn(),
  getPublicRaces: vi.fn(),
  getIndexableDistancePages: vi.fn(),
}));

vi.mock('../lib/blog/posts', () => ({ getAllPostMetadata }));
vi.mock('../lib/public-races', () => ({ getPublicRaces, PUBLIC_RACES_REVALIDATE_SECONDS: 900 }));
vi.mock('../lib/race-discovery', () => ({ getIndexableDistancePages }));

import { DEMO_EVENT_ID } from '../lib/demo-race';
import sitemap, { revalidate } from './sitemap';

describe('sitemap', () => {
  beforeEach(() => {
    getPublicRaces.mockResolvedValue([]);
    getIndexableDistancePages.mockReturnValue([]);
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

  it('includes accurate race and distance-page modification dates', async () => {
    getAllPostMetadata.mockResolvedValue([]);
    const races = [
      { slug: 'trail-a', eventEditionSlug: 'festival-a-2026', updatedAt: '2026-09-08T10:00:00.000Z' },
      { slug: 'trail-b', eventEditionSlug: 'festival-a-2026', updatedAt: '2026-09-09T12:00:00.000Z' },
    ];
    getPublicRaces.mockResolvedValue(races);
    getIndexableDistancePages.mockReturnValue([{ page: { slug: 'trail-court' }, races }]);

    const entries = await sitemap();

    expect(entries).toEqual(expect.arrayContaining([
      {
        url: 'https://pace-yourself.com/courses/trail-a',
        lastModified: '2026-09-08T10:00:00.000Z',
      },
      {
        url: 'https://pace-yourself.com/courses/distances/trail-court',
        lastModified: '2026-09-09T12:00:00.000Z',
      },
      {
        url: 'https://pace-yourself.com/courses/evenements/festival-a-2026',
        lastModified: '2026-09-09T12:00:00.000Z',
      },
    ]));
  });

  it('leaves the Trail TST demo event and its edition out', async () => {
    getAllPostMetadata.mockResolvedValue([]);
    getPublicRaces.mockResolvedValue([
      { slug: 'trail-a', eventId: 'other-event', eventEditionSlug: 'festival-a-2026', updatedAt: null },
      { slug: 'ultra-des-cimes', eventId: DEMO_EVENT_ID, eventEditionSlug: 'trail-tst-2027', updatedAt: null },
    ]);

    const urls = (await sitemap()).map((entry) => entry.url);

    expect(urls).toContain('https://pace-yourself.com/courses/trail-a');
    expect(urls.some((url) => url.includes('ultra-des-cimes') || url.includes('trail-tst'))).toBe(false);
    expect(getIndexableDistancePages).toHaveBeenCalledWith([expect.objectContaining({ slug: 'trail-a' })]);
  });
});
