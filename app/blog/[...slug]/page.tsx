import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogLayout } from "../../../components/BlogLayout";
import { getAllPostMetadata, getPostBySlug, type PostMeta } from "../../../lib/blog/posts";
import { localeToOgLocale, SITE_URL } from "../../seo";

type PageProps = {
  params: {
    slug?: string[];
  };
};

export const dynamic = "force-static";

const buildCanonicalUrl = (meta: PostMeta): string => new URL(meta.canonicalPath, SITE_URL).toString();

const normalizeSlugParam = (slug?: string[]): string | undefined =>
  Array.isArray(slug) && slug.length > 0 ? slug.join("/") : undefined;

export async function generateStaticParams() {
  const metas = await getAllPostMetadata();
  const slugSet = new Set<string>();

  metas.forEach((meta) => {
    const canonicalSlug = meta.canonicalPath.replace(/^\/blog\//, "");
    slugSet.add(canonicalSlug);

    if (meta.slug !== canonicalSlug) {
      slugSet.add(meta.slug);
    }
  });

  return Array.from(slugSet).map((slug) => ({
    slug: slug.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const slug = normalizeSlugParam(params.slug);
  if (!slug) {
    return {};
  }

  const post = await getPostBySlug(slug);

  if (!post) {
    return {};
  }

  const canonicalUrl = buildCanonicalUrl(post.meta);
  const description = post.meta.description ?? "Insights from the Pace Yourself team.";
  const ogImage = post.meta.image ? new URL(post.meta.image, SITE_URL).toString() : undefined;

  return {
    metadataBase: new URL(SITE_URL),
    title: post.meta.title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: post.meta.title,
      description,
      url: canonicalUrl,
      siteName: "Pace Yourself",
      locale: localeToOgLocale("en"),
      type: "article",
      publishedTime: post.meta.date,
      modifiedTime: post.meta.updatedAt ?? post.meta.date,
      tags: post.meta.tags,
      images: ogImage
        ? [
            {
              url: ogImage,
              alt: post.meta.imageAlt ?? post.meta.title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta.title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const slug = normalizeSlugParam(params.slug);
  if (!slug) {
    notFound();
  }

  const post = await getPostBySlug(slug);
  if (!post) {
    notFound();
  }

  const canonicalUrl = buildCanonicalUrl(post.meta);

  return <BlogLayout post={post} canonicalUrl={canonicalUrl} />;
}
