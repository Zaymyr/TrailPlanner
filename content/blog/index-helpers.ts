import { blogIndex, type BlogPostIndexEntry } from "./index";

export const getPostBySlug = (slug: string): BlogPostIndexEntry | undefined =>
  blogIndex.find((entry) => entry.slug === slug);

const sortByTitle = (a: BlogPostIndexEntry, b: BlogPostIndexEntry) => a.title.localeCompare(b.title);

const sortByUpdatedAt = (a: BlogPostIndexEntry, b: BlogPostIndexEntry) => {
  if (!a.updatedAt && !b.updatedAt) {
    return 0;
  }

  if (!a.updatedAt) {
    return 1;
  }

  if (!b.updatedAt) {
    return -1;
  }

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
};

export const getRelatedPosts = (slug: string, limit = 4): BlogPostIndexEntry[] => {
  const current = getPostBySlug(slug);
  if (!current) {
    return [];
  }

  if (current.related && current.related.length > 0) {
    const relatedEntries = current.related
      .map((relatedSlug) => getPostBySlug(relatedSlug))
      .filter((entry): entry is BlogPostIndexEntry => Boolean(entry));

    return relatedEntries.slice(0, limit);
  }

  const currentTopics = new Set(current.topics.map((topic) => topic.toLowerCase()));

  return blogIndex
    .filter((entry) => entry.slug !== current.slug)
    .map((entry) => {
      const sharedTopics = entry.topics.filter((topic) => currentTopics.has(topic.toLowerCase()));
      return { entry, sharedCount: sharedTopics.length };
    })
    .filter((result) => result.sharedCount > 0)
    .sort((a, b) => {
      if (b.sharedCount !== a.sharedCount) {
        return b.sharedCount - a.sharedCount;
      }

      const updatedAtSort = sortByUpdatedAt(a.entry, b.entry);
      if (updatedAtSort !== 0) {
        return updatedAtSort;
      }

      return sortByTitle(a.entry, b.entry);
    })
    .map((result) => result.entry)
    .slice(0, limit);
};

export const getPostsByTopic = (topic: string, limit = 12): BlogPostIndexEntry[] => {
  const normalized = topic.trim().toLowerCase();

  return blogIndex
    .filter((entry) => entry.topics.some((entryTopic) => entryTopic.toLowerCase() === normalized))
    .sort((a, b) => sortByUpdatedAt(a, b) || sortByTitle(a, b))
    .slice(0, limit);
};
