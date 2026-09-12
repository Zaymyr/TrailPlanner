import type { RacebookCourseTab, RacebookPreviewMode, RacebookPrimaryTab } from "@pace-yourself/racebook-ui";

import type { OrganizerModuleKey } from "../../../../lib/organizer-modules";
import type { ProductFormValues, StationProduct } from "./types";

export function resolvePreviewRace<T>(addingFormat: boolean, activeRace: T | null, fallbackRace: T | null): T | null {
  return addingFormat ? null : activeRace ?? fallbackRace;
}

export function mergeDraftProductIntoPreview(
  stationProducts: StationProduct[],
  stationId: string | null,
  productForm: ProductFormValues,
  enabled: boolean,
): StationProduct[] {
  if (!enabled || !stationId) return stationProducts;
  const draftId = `draft-custom-product:${stationId}`;
  const orderIndex = stationProducts.reduce((highest, product) => Math.max(highest, product.orderIndex), -1) + 1;
  return [...stationProducts, {
    id: draftId,
    aidStationId: stationId,
    productId: draftId,
    notes: productForm.notes,
    orderIndex,
    product: {
      id: draftId,
      slug: draftId,
      name: productForm.name.trim() || "—",
      brand: productForm.brand.trim() || null,
      fuelType: productForm.fuelType,
      caloriesKcal: productForm.caloriesKcal,
      carbsGrams: productForm.carbsGrams,
      sodiumMg: productForm.sodiumMg,
      proteinGrams: productForm.proteinGrams,
      fatGrams: productForm.fatGrams,
    },
  }];
}

export function getDisplayedPreviewModuleKeys(
  previewMode: RacebookPreviewMode,
  tab: RacebookPrimaryTab,
  courseTab: RacebookCourseTab,
): OrganizerModuleKey[] {
  const visible = new Set<OrganizerModuleKey>(["branding", "sponsors"]);
  if (previewMode === "sponsor-loading") return [...visible];
  if (tab === "gear") visible.add("equipment");
  else if (tab === "bib") visible.add("bib_pickup");
  else if (tab === "access") visible.add("access");
  else if (tab === "services") visible.add("services");
  else if (courseTab === "start-waves") visible.add("start_waves");
  else if (courseTab === "aid-stations") {
    visible.add("aid_stations");
    visible.add("official_products");
  } else if (courseTab === "relay") visible.add("relay");
  else if (courseTab === "awards") visible.add("awards");
  return [...visible];
}
