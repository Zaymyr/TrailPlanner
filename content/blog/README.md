# Blog index

This folder includes the MDX posts **and** the editorial index used to drive related articles.

## Adding or updating a post entry

1. Open `content/blog/index.ts` and add/update a `BlogPostIndexEntry` that matches the MDX slug.
2. Keep `topics` lowercased and consistent (e.g. `"nutrition"`, `"hydration"`, `"trail"`).
3. Set `level` to `"beginner"`, `"intermediate"`, or `"advanced"`.
4. Optionally set `related` to a list of slugs (order matters). If omitted, related posts are inferred by shared topics.
5. Add `updatedAt` in ISO format if you want it to influence ordering.

## Related posts behavior

- If a post has `related`, those slugs are used (and limited) in the UI.
- Otherwise, related posts are suggested by shared topics, then sorted by shared topic count, updated date, and title.

## Validation

In development, the index logs warnings for duplicate slugs or related slugs that are missing from the index.
