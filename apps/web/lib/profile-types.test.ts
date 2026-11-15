import { describe, expect, it } from "vitest";

import { isUserProfileReady, type UserProfile } from "./profile-types";

const completeProfile: UserProfile = {
  fullName: "Camille",
  comfortableFlatPaceMinPerKm: 6.5,
  waterBagLiters: 1.5,
  defaultCarbsGPerHour: 60,
  favoriteProducts: [],
};

describe("isUserProfileReady", () => {
  it("requires only the four estimate inputs", () => {
    expect(isUserProfileReady(completeProfile)).toBe(true);
  });

  it.each([
    ["first name", { fullName: "" }],
    ["pace", { comfortableFlatPaceMinPerKm: null }],
    ["water capacity", { waterBagLiters: null }],
    ["carbohydrate target", { defaultCarbsGPerHour: null }],
  ])("reports an incomplete profile without %s", (_label, missing) => {
    expect(isUserProfileReady({ ...completeProfile, ...missing })).toBe(false);
  });
});
