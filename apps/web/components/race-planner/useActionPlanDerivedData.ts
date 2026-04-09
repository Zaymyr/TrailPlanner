import { useMemo } from "react";

import type {
  ElevationPoint,
  SectionSegment,
  Segment,
  StationSupply,
} from "../../app/(coach)/race-planner/types";
import { buildSectionKey } from "../../app/(coach)/race-planner/utils/section-segments";
import { recomputeSectionFromSubSections } from "../../app/(coach)/race-planner/utils/section-recompute";
import type { FuelProduct } from "../../lib/product-types";

export type RenderItem = {
  id: string;
  title: string;
  distanceKm: number;
  etaMinutes: number;
  isStart?: boolean;
  isFinish?: boolean;
  aidStationIndex?: number;
  pickupGels?: number;
  checkpointSegment?: Segment;
  upcomingSegment?: Segment;
  upcomingSegmentIndex?: number;
};

const buildRenderItems = (segments: Segment[]): RenderItem[] => {
  if (segments.length === 0) return [];

  const items: RenderItem[] = [];
  const startSegment = segments[0];

  items.push({
    id: `point-${startSegment.from}-start`,
    title: startSegment.from,
    distanceKm: startSegment.startDistanceKm,
    etaMinutes: 0,
    isStart: true,
    upcomingSegment: startSegment,
    upcomingSegmentIndex: 0,
  });

  segments.forEach((segment, index) => {
    items.push({
      id: `point-${segment.checkpoint}-${segment.distanceKm}`,
      title: segment.checkpoint,
      distanceKm: segment.distanceKm,
      etaMinutes: segment.etaMinutes,
      isFinish: segment.isFinish,
      aidStationIndex: segment.aidStationIndex,
      pickupGels: segment.pickupGels,
      checkpointSegment: segment,
      upcomingSegment: segments[index + 1],
      upcomingSegmentIndex: index + 1,
    });
  });

  return items;
};

const summarizeSuppliesForProducts = (
  supplies: StationSupply[] | undefined,
  productById: Record<string, FuelProduct>
) => {
  const grouped: Record<string, { product: FuelProduct; quantity: number }> = {};
  supplies?.forEach((supply) => {
    const product = productById[supply.productId];
    if (!product) return;
    const safeQuantity = Number.isFinite(supply.quantity) ? supply.quantity : 0;
    if (safeQuantity <= 0) return;
    if (!grouped[product.id]) {
      grouped[product.id] = { product, quantity: 0 };
    }
    grouped[product.id].quantity += safeQuantity;
  });

  const items = Object.values(grouped).sort((a, b) => a.product.name.localeCompare(b.product.name));
  const totals = items.reduce(
    (acc, item) => ({
      carbs: acc.carbs + item.product.carbsGrams * item.quantity,
      water: acc.water + (item.product.waterMl ?? 0) * item.quantity,
      sodium: acc.sodium + item.product.sodiumMg * item.quantity,
    }),
    { carbs: 0, water: 0, sodium: 0 }
  );

  if (!items.length) return null;

  return { items, totals };
};

type UseActionPlanDerivedDataParams = {
  segments: Segment[];
  fuelProducts: FuelProduct[];
  startSupplies: StationSupply[];
  raceDurationMinutes: number | undefined;
  sectionSegmentsMap: Record<string, SectionSegment[]>;
  sortedElevationProfile: ElevationPoint[];
  normalizeSectionSegments: (sectionSegments: SectionSegment[], totalDistanceKm: number) => SectionSegment[];
  paceModel: Parameters<typeof recomputeSectionFromSubSections>[0]["paceModel"];
};

export function useActionPlanDerivedData({
  segments,
  fuelProducts,
  startSupplies,
  raceDurationMinutes,
  sectionSegmentsMap,
  sortedElevationProfile,
  normalizeSectionSegments,
  paceModel,
}: UseActionPlanDerivedDataParams) {
  const renderItems = useMemo(() => buildRenderItems(segments), [segments]);
  const collapsibleKeys = useMemo(() => {
    const keys = new Set<string>();
    renderItems.forEach((item) => {
      if (!item.upcomingSegment) return;
      if (item.isStart) {
        keys.add("start");
        return;
      }
      if (typeof item.aidStationIndex === "number" && !item.isFinish) {
        keys.add(String(item.aidStationIndex));
      }
    });
    return Array.from(keys);
  }, [renderItems]);

  const productById = useMemo(() => Object.fromEntries(fuelProducts.map((product) => [product.id, product])), [fuelProducts]);

  const finishSummary = useMemo(() => {
    if (segments.length === 0) return null;

    const finishDistanceKm = segments[segments.length - 1]?.distanceKm ?? 0;
    const totalPauseMinutes = segments.reduce((total, segment) => total + (segment.pauseMinutes ?? 0), 0);
    const totalMovingMinutes = raceDurationMinutes ?? 0;
    const totalTimeMinutes = totalMovingMinutes + totalPauseMinutes;
    const averagePaceMinPerKm = finishDistanceKm > 0 && totalTimeMinutes > 0 ? totalTimeMinutes / finishDistanceKm : null;
    const averageSpeedKph = finishDistanceKm > 0 && totalTimeMinutes > 0 ? finishDistanceKm / (totalTimeMinutes / 60) : null;
    const totalGels = segments.reduce((total, segment) => total + (segment.gelsPlanned ?? 0), 0);
    const totalElevationGain = segments.reduce((total, segment) => total + (segment.elevationGainM ?? 0), 0);
    const totalElevationLoss = segments.reduce((total, segment) => total + (segment.elevationLossM ?? 0), 0);
    const allSupplies = [...startSupplies, ...segments.flatMap((segment) => segment.supplies ?? [])];
    const totalCalories = allSupplies.reduce((total, supply) => {
      const product = productById[supply.productId];
      if (!product) return total;
      const quantity = Number.isFinite(supply.quantity) ? supply.quantity : 0;
      if (quantity <= 0) return total;
      return total + (product.caloriesKcal ?? 0) * quantity;
    }, 0);

    return {
      finishDistanceKm,
      totalPauseMinutes,
      totalMovingMinutes,
      totalTimeMinutes,
      averagePaceMinPerKm,
      averageSpeedKph,
      totalGels,
      totalElevationGain,
      totalElevationLoss,
      totalCalories,
    };
  }, [productById, raceDurationMinutes, segments, startSupplies]);

  const sectionComputationByItemId = useMemo(() => {
    const map = new Map<
      string,
      {
        sectionSegment: Segment | undefined;
        upcomingSegmentIndex: number | null;
        sectionKey: string | null;
        storedSectionSegments: SectionSegment[] | null;
        resolvedSectionSegments: SectionSegment[];
        hasStoredSubSections: boolean;
        sectionStats: ReturnType<typeof recomputeSectionFromSubSections> | null;
        sectionTotals: ReturnType<typeof recomputeSectionFromSubSections>["totals"] | null;
      }
    >();

    renderItems.forEach((item) => {
      const sectionSegment = item.upcomingSegment;
      const upcomingSegmentIndex =
        typeof item.upcomingSegmentIndex === "number" && item.upcomingSegmentIndex >= 0 ? item.upcomingSegmentIndex : null;
      const sectionKey = upcomingSegmentIndex !== null ? buildSectionKey(upcomingSegmentIndex) : null;
      const storedSectionSegments = sectionKey ? sectionSegmentsMap[sectionKey] ?? null : null;
      const resolvedSectionSegments =
        sectionSegment && sectionKey
          ? normalizeSectionSegments(storedSectionSegments ?? [{ segmentKm: sectionSegment.segmentKm }], sectionSegment.segmentKm)
          : [];
      const hasStoredSubSections = Boolean(storedSectionSegments && storedSectionSegments.length > 0);
      const sectionStats =
        sectionSegment && resolvedSectionSegments.length > 0
          ? recomputeSectionFromSubSections({
              segments: resolvedSectionSegments,
              startDistanceKm: sectionSegment.startDistanceKm,
              elevationProfile: sortedElevationProfile,
              paceModel,
              startElapsedSeconds: Math.max(
                0,
                ((sectionSegment.etaMinutes ?? 0) - (sectionSegment.segmentMinutes ?? 0)) * 60
              ),
            })
          : null;

      map.set(item.id, {
        sectionSegment,
        upcomingSegmentIndex,
        sectionKey,
        storedSectionSegments,
        resolvedSectionSegments,
        hasStoredSubSections,
        sectionStats,
        sectionTotals: hasStoredSubSections && sectionStats ? sectionStats.totals : null,
      });
    });

    return map;
  }, [normalizeSectionSegments, paceModel, renderItems, sectionSegmentsMap, sortedElevationProfile]);

  const summarizedSuppliesByItemId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeSuppliesForProducts>>();
    renderItems.forEach((item) => {
      const supplies = item.isStart ? startSupplies : item.checkpointSegment?.supplies;
      map.set(item.id, summarizeSuppliesForProducts(supplies, productById));
    });
    return map;
  }, [productById, renderItems, startSupplies]);

  const aidSuppliesByStationIndex = useMemo(() => {
    const map = new Map<number, StationSupply[]>();
    segments.forEach((segment) => {
      if (typeof segment.aidStationIndex !== "number") return;
      map.set(segment.aidStationIndex, segment.supplies ?? []);
    });
    return map;
  }, [segments]);

  return {
    renderItems,
    collapsibleKeys,
    productById,
    finishSummary,
    sectionComputationByItemId,
    summarizedSuppliesByItemId,
    aidSuppliesByStationIndex,
  };
}
