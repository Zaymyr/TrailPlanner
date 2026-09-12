import { describe, expect, it } from "vitest";

import { emptyProductForm } from "./constants";
import { getDisplayedPreviewModuleKeys, mergeDraftProductIntoPreview, resolvePreviewRace } from "./racebook-preview-state";

describe("RaceBook organizer preview state", () => {
  it("isolates a new format from the persisted fallback race", () => {
    const persistedRace = { id: "persisted-race" };
    expect(resolvePreviewRace(true, null, persistedRace)).toBeNull();
    expect(resolvePreviewRace(false, null, persistedRace)).toBe(persistedRace);
  });

  it("projects every local custom-product name and note before creation", () => {
    const firstDraft = mergeDraftProductIntoPreview([], "station-1", { ...emptyProductForm, notes: "Sans gluten" }, true);
    expect(firstDraft[0]).toMatchObject({ aidStationId: "station-1", notes: "Sans gluten", product: { name: "—" } });

    const nextDraft = mergeDraftProductIntoPreview([], "station-1", { ...emptyProductForm, name: "Gel citron", notes: "Sans gluten" }, true);
    expect(nextDraft[0]).toMatchObject({ aidStationId: "station-1", notes: "Sans gluten", product: { name: "Gel citron" } });
  });

  it("does not project a stale product form outside its active race scope", () => {
    expect(mergeDraftProductIntoPreview([], "station-1", { ...emptyProductForm, name: "Gel" }, false)).toEqual([]);
  });

  it("derives the offer warning from the module displayed in the phone", () => {
    expect(getDisplayedPreviewModuleKeys("content", "course", "awards")).toEqual(["branding", "sponsors", "awards"]);
    expect(getDisplayedPreviewModuleKeys("content", "services", "route")).toEqual(["branding", "sponsors", "services"]);
    expect(getDisplayedPreviewModuleKeys("sponsor-loading", "course", "route")).toEqual(["branding", "sponsors"]);
    expect(getDisplayedPreviewModuleKeys("content", "course", "aid-stations")).toEqual([
      "branding", "sponsors", "aid_stations", "official_products",
    ]);
  });
});
