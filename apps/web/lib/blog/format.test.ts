import { describe, expect, it } from "vitest";

import { formatBlogDate } from "./format";

describe("formatBlogDate", () => {
  it("formats French dates by default without shifting the day", () => {
    expect(formatBlogDate("2026-03-17")).toBe("17 mars 2026");
    expect(formatBlogDate("2026-08-20T00:00:00.000Z", "fr")).toBe("20 août 2026");
  });

  it("keeps English formatting for English posts", () => {
    expect(formatBlogDate("2026-01-09", "en")).toBe("January 9, 2026");
  });
});
