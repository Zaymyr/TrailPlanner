import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllPostMetadata, getPublicRaces, getIndexableDistancePages } = vi.hoisted(() => ({
  getAllPostMetadata: vi.fn(),
  getPublicRaces: vi.fn(),
  getIndexableDistancePages: vi.fn(),
}));

vi.mock('../lib/blog/posts', () => ({ getAllPostMetadata }));
vi.mock('../lib/public-races', () => ({ getPublicRaces }));
vi.mock('../lib/race-discovery', () => ({ getIndexableDistancePages }));

import sitemap from './sitemap';

describe('sitemap', () => {
  beforeEach(() => {
    getPublicRaces.mockResolvedValue([]);
    getIndexableDistancePages.mockReturnValue([]);
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
});
