import type { AidStationFormItem, Supply } from '../components/plan-form/contracts';

export type AutoFillShortage = {
  sectionLabel: string;
  carbsG: number;
  sodiumMg: number;
};

export type AutoFillResult = {
  startSupplies: Supply[];
  aidStations: AidStationFormItem[];
  unresolvedShortages: AutoFillShortage[];
};

export type AutoFillPreview = {
  totalUnits: number;
  productCount: number;
  locationCount: number;
  changedLocationCount: number;
  worstShortage: AutoFillShortage | null;
};

function supplySignature(supplies: Supply[] | undefined) {
  return [...(supplies ?? [])]
    .map((supply) => `${supply.productId}:${supply.quantity}`)
    .sort()
    .join('|');
}

function shortageScore(shortage: AutoFillShortage) {
  return shortage.carbsG + shortage.sodiumMg / 10;
}

export function buildAutoFillPreview(
  result: AutoFillResult,
  currentStartSupplies: Supply[],
  currentAidStations: AidStationFormItem[],
): AutoFillPreview {
  const locations = [result.startSupplies, ...result.aidStations.map((station) => station.supplies ?? [])];
  const currentLocations = [
    currentStartSupplies,
    ...currentAidStations.map((station) => station.supplies ?? []),
  ];
  const productIds = new Set<string>();
  let totalUnits = 0;
  let locationCount = 0;
  let changedLocationCount = 0;

  locations.forEach((supplies, index) => {
    if (supplies.length > 0) locationCount += 1;
    if (supplySignature(supplies) !== supplySignature(currentLocations[index])) {
      changedLocationCount += 1;
    }
    supplies.forEach((supply) => {
      productIds.add(supply.productId);
      totalUnits += Math.max(0, Math.floor(supply.quantity));
    });
  });

  const worstShortage = result.unresolvedShortages.reduce<AutoFillShortage | null>(
    (worst, shortage) => (!worst || shortageScore(shortage) > shortageScore(worst) ? shortage : worst),
    null,
  );

  return {
    totalUnits,
    productCount: productIds.size,
    locationCount,
    changedLocationCount,
    worstShortage,
  };
}
