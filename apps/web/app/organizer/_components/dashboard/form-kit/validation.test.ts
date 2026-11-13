import { describe, expect, it } from "vitest";
import { hasSignificantDistanceMismatch, hasSuspiciousEqualElevation, isOutsideDateRange, isValidDraft, isValidInstagramUrl, normalizeInstagramUrl } from "./validation";

describe("organizer form-kit validation", () => {
  it("normalizes a handle and a host-only Instagram path", () => {
    expect(normalizeInstagramUrl("@paceyourself")).toBe("https://instagram.com/paceyourself");
    expect(normalizeInstagramUrl("instagram.com/paceyourself")).toBe("https://instagram.com/paceyourself");
  });

  it("accepts only Instagram HTTPS profile URLs while allowing an empty optional field", () => {
    expect(isValidInstagramUrl("")).toBe(true);
    expect(isValidInstagramUrl("@paceyourself")).toBe(true);
    expect(isValidInstagramUrl("http://instagram.com/paceyourself")).toBe(false);
    expect(isValidInstagramUrl("https://example.com/paceyourself")).toBe(false);
    expect(isValidInstagramUrl("pas une url")).toBe(false);
    expect(isValidInstagramUrl("instagram.com/pace-yourself")).toBe(false);
  });

  it("does not commit an invalid repeatable draft", () => {
    expect(isValidDraft({ name: "" }, (draft) => Boolean(draft.name))).toBe(false);
    expect(isValidDraft({ name: "Eau" }, (draft) => Boolean(draft.name))).toBe(true);
  });
});

describe("organizer coherence warnings", () => {
  it("detects dates outside an edition", () => {
    expect(isOutsideDateRange("2026-10-01", "2027-01-01", "2027-12-31")).toBe(true);
    expect(isOutsideDateRange("2027-06-01", "2027-01-01", "2027-12-31")).toBe(false);
  });

  it("detects material distance differences without flagging rounding", () => {
    expect(hasSignificantDistanceMismatch(82.3, 42.5)).toBe(true);
    expect(hasSignificantDistanceMismatch(42.7, 42.5)).toBe(false);
  });

  it("detects identical positive elevation gain and loss", () => {
    expect(hasSuspiciousEqualElevation(1500, 1500)).toBe(true);
    expect(hasSuspiciousEqualElevation(1500, 1490)).toBe(false);
  });
});
