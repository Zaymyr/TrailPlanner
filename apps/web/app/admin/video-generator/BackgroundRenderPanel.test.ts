import { describe, expect, it } from "vitest";

import { formatRenderDuration } from "./BackgroundRenderPanel";

describe("formatRenderDuration", () => {
  it("formats seconds, minutes and hours, and ignores missing or reversed times", () => {
    expect(formatRenderDuration("2026-11-05T10:00:00Z", "2026-11-05T10:00:42Z")).toBe("42 s");
    expect(formatRenderDuration("2026-11-05T10:00:00Z", "2026-11-05T10:06:12Z")).toBe("6 min 12 s");
    expect(formatRenderDuration("2026-11-05T10:00:00Z", "2026-11-05T11:05:00Z")).toBe("1 h 05 min");
    expect(formatRenderDuration(null, "2026-11-05T10:00:00Z")).toBeNull();
    expect(formatRenderDuration("2026-11-05T10:00:00Z", "2026-11-05T09:00:00Z")).toBeNull();
  });
});
