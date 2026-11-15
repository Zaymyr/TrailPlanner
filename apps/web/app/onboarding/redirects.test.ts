import { describe, expect, it, vi } from "vitest";

const { permanentRedirect } = vi.hoisted(() => ({ permanentRedirect: vi.fn() }));

vi.mock("next/navigation", () => ({ permanentRedirect }));

const legacyPages = [
  () => import("./page"),
  () => import("./account/page"),
  () => import("./goal/page"),
  () => import("./improve/page"),
  () => import("./install/page"),
  () => import("./loading/page"),
  () => import("./nutrition/page"),
  () => import("./nutrition/food/page"),
  () => import("./race/page"),
  () => import("./result/page"),
];

describe("legacy runner onboarding routes", () => {
  it.each(legacyPages)("permanently redirects to the race planner", async (loadPage) => {
    permanentRedirect.mockClear();
    permanentRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    const page = await loadPage();

    expect(() => page.default()).toThrow("NEXT_REDIRECT");
    expect(permanentRedirect).toHaveBeenCalledWith("/race-planner");
  });
});
