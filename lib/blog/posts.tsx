import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import React from 'react';
import { compileMDX } from 'next-mdx-remote/rsc';
import { cache, type ReactElement, type ReactNode } from 'react';

export const BLOG_DIRECTORY = path.join(process.cwd(), 'content', 'blog');
const WORDS_PER_MINUTE = 225;

const normalizeDate = (value: string): string => new Date(value).toISOString();

export type PostFrontmatter = {
  title: string;
  description?: string;
  date: string;
  updatedAt?: string;
  tags?: string[];
  canonical?: string;
  image?: string;
  imageAlt?: string;
};

export type ReadingTime = {
  words: number;
  minutes: number;
};

export type PostMeta = {
  slug: string;
  title: string;
  description?: string;
  date: string;
  updatedAt?: string;
  tags: string[];
  canonical?: string;
  image?: string;
  imageAlt?: string;
  readingTime: ReadingTime;
};

export type CompiledPost = {
  meta: PostMeta;
  content: ReactElement;
  body: string;
  headings: PostHeading[];
};

export type TagSummary = {
  tag: string;
  count: number;
};

export type PostHeading = {
  id: string;
  text: string;
  level: 2 | 3;
};

const discoverPosts = cache(async (): Promise<CompiledPost[]> => {
  const files = await discoverMdxFiles(BLOG_DIRECTORY);
  const posts = await Promise.all(files.map(loadPostFromFile));

  return posts.sort(
    (a, b) => new Date(b.meta.date).getTime() - new Date(a.meta.date).getTime(),
  );
});

export const getAllPosts = (): Promise<CompiledPost[]> => discoverPosts();

export const getAllPostMetadata = async (): Promise<PostMeta[]> => {
  const posts = await discoverPosts();
  return posts.map((post) => post.meta);
};

export const getAllTags = async (): Promise<TagSummary[]> => {
  const metas = await getAllPostMetadata();
  return aggregateTags(metas);
};

export const getPostBySlug = async (slug: string): Promise<CompiledPost | undefined> => {
  const posts = await discoverPosts();
  return posts.find((post) => post.meta.slug === slug);
};

export const aggregateTags = (metas: PostMeta[]): TagSummary[] => {
  const counts = new Map<string, number>();

  metas.forEach((meta) => {
    meta.tags.forEach((tag) => {
      const normalized = tag.trim();
      if (!normalized) {
        return;
      }

      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
};

export const computeReadingTime = (content: string, wordsPerMinute = WORDS_PER_MINUTE): ReadingTime => {
  const words = (content.trim().match(/\S+/g) ?? []).length;
  const minutes = Math.max(1, Math.ceil(words / wordsPerMinute));

  return { words, minutes };
};

export const deriveSlugFromPath = (filePath: string): string => {
  const relativePath = path.relative(BLOG_DIRECTORY, filePath);
  const withoutExtension = relativePath.replace(/\\/g, '/').replace(/\.mdx?$/, '');

  return withoutExtension
    .split('/')
    .map((segment) => segment.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('/');
};

const discoverMdxFiles = async (directory: string): Promise<string[]> => {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const location = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return discoverMdxFiles(location);
        }

        if (entry.isFile() && /\.mdx?$/.test(entry.name) && entry.name.toLowerCase() !== "readme.md") {
          return [location];
        }

        return [];
      }),
    );

    return files.flat();
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};

const loadPostFromFile = async (filePath: string): Promise<CompiledPost> => {
  const source = await fs.readFile(filePath, 'utf8');
  const parsed = matter(source);
  const frontmatter = validateFrontmatter(parsed.data, filePath);
  const slug = deriveSlugFromPath(filePath);
  const readingTime = computeReadingTime(parsed.content);
  const tags = sanitizeTags(frontmatter.tags);
  const image = frontmatter.image?.trim() || undefined;
  const imageAlt = frontmatter.imageAlt?.trim() || frontmatter.title;
  const headingSlugger = createHeadingSlugger();
  const headings = extractHeadings(parsed.content, headingSlugger);
  const renderingSlugger = createHeadingSlugger();

  const { content } = await compileMDX({
    source: parsed.content,
    options: {
      parseFrontmatter: false,
    },
    components: {
      h2: createHeadingComponent('h2', renderingSlugger),
      h3: createHeadingComponent('h3', renderingSlugger),
    },
  });

  const meta: PostMeta = {
    slug,
    title: frontmatter.title,
    description: frontmatter.description,
    date: frontmatter.date,
    updatedAt: frontmatter.updatedAt,
    tags,
    canonical: frontmatter.canonical,
    image,
    imageAlt,
    readingTime,
  };

  return { meta, content, body: parsed.content, headings };
};

const sanitizeTags = (tags?: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
};

const validateFrontmatter = (data: Record<string, unknown>, filePath: string): PostFrontmatter => {
  const { title, description, date, updatedAt, tags, canonical, image, imageAlt } = data;

  if (typeof title !== 'string' || !title.trim()) {
    throw new Error(`Missing or invalid "title" in frontmatter for ${filePath}`);
  }

  if (typeof date !== 'string' || Number.isNaN(Date.parse(date))) {
    throw new Error(`Missing or invalid "date" in frontmatter for ${filePath}`);
  }

  if (typeof updatedAt !== 'undefined' && (typeof updatedAt !== 'string' || Number.isNaN(Date.parse(updatedAt)))) {
    throw new Error(`Invalid "updatedAt" date in frontmatter for ${filePath}`);
  }

  if (typeof description !== 'undefined' && typeof description !== 'string') {
    throw new Error(`Invalid "description" in frontmatter for ${filePath}`);
  }

  if (typeof canonical !== 'undefined' && typeof canonical !== 'string') {
    throw new Error(`Invalid "canonical" in frontmatter for ${filePath}`);
  }

  if (typeof image !== 'undefined' && typeof image !== 'string') {
    throw new Error(`Invalid "image" in frontmatter for ${filePath}`);
  }

  if (typeof imageAlt !== 'undefined' && typeof imageAlt !== 'string') {
    throw new Error(`Invalid "imageAlt" in frontmatter for ${filePath}`);
  }

  if (typeof tags !== 'undefined' && !Array.isArray(tags)) {
    throw new Error(`Invalid "tags" in frontmatter for ${filePath}`);
  }

  return {
    title: title.trim(),
    description,
    date: normalizeDate(date),
    updatedAt: updatedAt ? normalizeDate(updatedAt) : undefined,
    tags: tags as string[] | undefined,
    canonical,
    image,
    imageAlt,
  };
};

const HEADING_PATTERN = /^(#{2,3})\s+(.+)$/gm;

const createHeadingSlugger = () => {
  const counts = new Map<string, number>();

  return (text: string): string => {
    const base = slugifyHeading(text);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);

    return count === 0 ? base : `${base}-${count}`;
  };
};

const createHeadingComponent =
  (
    Tag: "h2" | "h3",
    slugger: (text: string) => string
  ): React.FC<React.HTMLAttributes<HTMLHeadingElement>> => {
    const Component: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
      children,
      ...props
    }) => {
      const text = extractHeadingText(children);
      const id = props.id ?? slugger(text);

      return (
        <Tag {...props} id={id}>
          {children}
        </Tag>
      );
    };

    Component.displayName = `Heading(${Tag})`;
    return Component;
  };


const extractHeadingText = (value: ReactNode): string => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(extractHeadingText).join('');
  }

  if (React.isValidElement(value)) {
    return extractHeadingText(value.props.children);
  }

  return '';
};

const extractHeadings = (markdown: string, slugger: (text: string) => string): PostHeading[] => {
  const headings: PostHeading[] = [];
  HEADING_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = HEADING_PATTERN.exec(markdown)) !== null) {
    const level = match[1].length === 2 ? 2 : 3;
    const rawText = match[2].replace(/#+\s*$/, '').trim();
    const id = slugger(rawText);

    headings.push({ id, text: rawText, level });
  }

  return headings;
};

const slugifyHeading = (text: string): string =>
  (text
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+[{\]}\\|;:'",<>/?]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section');
