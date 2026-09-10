import { describe, expect, it } from "vitest";

import { shouldOpenOrganizerOnboarding } from "./onboarding";

const baseState = {
  isAdmin: false,
  status: "idle" as const,
  hasCompletion: true,
  loadedEventId: "event-a",
  selectedEventId: "event-a",
  membershipEventId: "event-a",
  completedAt: null,
};

describe("shouldOpenOrganizerOnboarding", () => {
  it("opens for an organizer arriving on an unvisited event", () => {
    expect(shouldOpenOrganizerOnboarding(baseState)).toBe(true);
  });

  it("does not automatically open for admins", () => {
    expect(shouldOpenOrganizerOnboarding({ ...baseState, isAdmin: true })).toBe(false);
  });

  it("does not open after completion or skip", () => {
    expect(shouldOpenOrganizerOnboarding({
      ...baseState,
      completedAt: "2026-09-10T20:00:00.000Z",
    })).toBe(false);
  });

  it("waits for the selected event and its completion UI", () => {
    expect(shouldOpenOrganizerOnboarding({ ...baseState, status: "loading" })).toBe(false);
    expect(shouldOpenOrganizerOnboarding({ ...baseState, hasCompletion: false })).toBe(false);
    expect(shouldOpenOrganizerOnboarding({ ...baseState, loadedEventId: "event-b" })).toBe(false);
    expect(shouldOpenOrganizerOnboarding({ ...baseState, membershipEventId: "event-b" })).toBe(false);
  });
});
