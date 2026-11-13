import { describe, expect, it } from "vitest";

import { isEventEditionPast } from "./event-edition-status";

describe("event edition status", () => {
  it("marks an edition as past only after its final day in France", () => {
    expect(isEventEditionPast("2026-11-12", new Date("2026-11-13T12:00:00Z"))).toBe(true);
    expect(isEventEditionPast("2026-11-13", new Date("2026-11-13T12:00:00Z"))).toBe(false);
    expect(isEventEditionPast("2026-11-14", new Date("2026-11-13T12:00:00Z"))).toBe(false);
  });

  it("uses the Europe/Paris calendar boundary", () => {
    expect(isEventEditionPast("2026-03-28", new Date("2026-03-28T23:30:00Z"))).toBe(true);
  });

  it("does not classify an invalid stored date as past", () => {
    expect(isEventEditionPast("unknown", new Date("2026-11-13T12:00:00Z"))).toBe(false);
  });
});
