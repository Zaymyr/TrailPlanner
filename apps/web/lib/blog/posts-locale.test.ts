import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const react = await importOriginal<typeof import("react")>();

  return { ...react, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});

import { getPostBySlug } from "./posts";

describe("blog post locale", () => {
  it("defaults French editorial content to French without guessing from its wording", async () => {
    const post = await getPostBySlug("marathon-mont-blanc-preparation");

    expect(post?.meta.locale).toBe("fr");
  });
});
