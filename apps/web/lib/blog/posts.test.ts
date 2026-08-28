import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const react = await importOriginal<typeof import('react')>();

  return {
    ...react,
    cache: <Arguments extends unknown[], Result>(
      callback: (...arguments_: Arguments) => Result,
    ) => callback,
  };
});

import { BLOG_DIRECTORY, getAllPostMetadata, resolveBlogDirectory } from './posts';

const WEB_DIRECTORY = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const REPOSITORY_DIRECTORY = path.resolve(WEB_DIRECTORY, '..', '..');
const EXPECTED_BLOG_DIRECTORY = path.join(WEB_DIRECTORY, 'content', 'blog');
const UNRELATED_MODULE_DIRECTORY = path.parse(REPOSITORY_DIRECTORY).root;

describe('resolveBlogDirectory', () => {
  it('finds blog content when the process starts in the web workspace', () => {
    expect(resolveBlogDirectory(WEB_DIRECTORY, UNRELATED_MODULE_DIRECTORY)).toBe(
      EXPECTED_BLOG_DIRECTORY,
    );
  });

  it('finds blog content when the process starts at the monorepo root', () => {
    expect(resolveBlogDirectory(REPOSITORY_DIRECTORY, UNRELATED_MODULE_DIRECTORY)).toBe(
      EXPECTED_BLOG_DIRECTORY,
    );
  });

  it('finds blog content from a nested Next.js runtime directory', () => {
    expect(
      resolveBlogDirectory(
        path.join(WEB_DIRECTORY, '.next', 'server', 'app'),
        UNRELATED_MODULE_DIRECTORY,
      ),
    ).toBe(EXPECTED_BLOG_DIRECTORY);
  });
});

describe('blog metadata discovery', () => {
  it('loads the published MDX metadata from the resolved directory', async () => {
    const posts = await getAllPostMetadata();

    expect(BLOG_DIRECTORY).toBe(EXPECTED_BLOG_DIRECTORY);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.canonicalPath.startsWith('/blog/'))).toBe(true);
  });
});
