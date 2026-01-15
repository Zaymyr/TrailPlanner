import { defaultFuelProducts } from "../../../../lib/default-products";
import { minutesPerKm } from "./pacing";
import type { AidStation, ElevationPoint, FormValues, Segment } from "../types";

export function adjustedSegmentMinutes(baseMinutesPerKm: number, segmentKm: number) {
  if (segmentKm === 0) return 0;

  return segmentKm * baseMinutesPerKm;
}

export function buildSegments(
  values: FormValues,
  startLabel: string,
  finishLabel: string,
  elevationProfile: ElevationPoint[]
): Segment[] {
  const gelCarbs = defaultFuelProducts[0]?.carbsGrams ?? 25;
  const minPerKm = minutesPerKm(values);
  const sortedElevationProfile = [...elevationProfile].sort((a, b) => a.distanceKm - b.distanceKm);
  const trackDistanceKm = Math.max(values.raceDistanceKm, sortedElevationProfile.at(-1)?.distanceKm ?? 0);
  const getElevationAtDistance = (distanceKm: number) => {
    if (sortedElevationProfile.length === 0) return 0;
    const clamped = Math.min(Math.max(distanceKm, 0), trackDistanceKm);
    const nextIndex = sortedElevationProfile.findIndex((point) => point.distanceKm >= clamped);
    if (nextIndex <= 0) return sortedElevationProfile[0].elevationM;
    const prevPoint = sortedElevationProfile[nextIndex - 1];
    const nextPoint = sortedElevationProfile[nextIndex] ?? prevPoint;
    const ratio =
      nextPoint.distanceKm === prevPoint.distanceKm
        ? 0
        : (clamped - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
    return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
  };
  const getElevationDelta = (startKm: number, endKm: number) => {
    if (sortedElevationProfile.length === 0) return { gain: 0, loss: 0 };
    const start = Math.min(startKm, endKm);
    const end = Math.max(startKm, endKm);
    const points = [
      { distanceKm: start, elevationM: getElevationAtDistance(start) },
      ...sortedElevationProfile.filter((point) => point.distanceKm > start && point.distanceKm < end),
      { distanceKm: end, elevationM: getElevationAtDistance(end) },
    ].sort((a, b) => a.distanceKm - b.distanceKm);
    return points.slice(1).reduce(
      (acc, point, index) => {
        const delta = point.elevationM - points[index].elevationM;
        if (delta >= 0) {
          acc.gain += delta;
        } else {
          acc.loss += Math.abs(delta);
        }
        return acc;
      },
      { gain: 0, loss: 0 }
    );
  };
  const stationsWithIndex: (AidStation & { originalIndex?: number; kind: "aid" | "finish" })[] = values.aidStations
    .map((station, index) => ({
      ...station,
      originalIndex: index,
      kind: "aid" as const,
      waterRefill: station.waterRefill !== false,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const checkpoints: (AidStation & {
    originalIndex?: number;
    kind: "start" | "aid" | "finish";
    waterRefill?: boolean;
  })[] = [
    { name: startLabel, distanceKm: 0, kind: "start" as const, waterRefill: true },
    ...stationsWithIndex.filter((s) => s.distanceKm < values.raceDistanceKm),
    {
      name: finishLabel,
      distanceKm: values.raceDistanceKm,
      originalIndex: undefined,
      kind: "finish",
      waterRefill: true,
      ...(values.finishPlan ?? {}),
    },
  ];

  let elapsedMinutes = 0;
  const waterCapacityMl =
    typeof values.waterBagLiters === "number" && Number.isFinite(values.waterBagLiters)
      ? Math.max(0, values.waterBagLiters * 1000)
      : null;
  let availableWaterMl = waterCapacityMl ?? 0;

  const segments: Segment[] = checkpoints.slice(1).map((station, index) => {
    const previous = checkpoints[index];
    const elevationDelta = getElevationDelta(previous.distanceKm, station.distanceKm);
    const segmentKm = Math.max(0, station.distanceKm - previous.distanceKm);
    const estimatedSegmentMinutes = adjustedSegmentMinutes(minPerKm, segmentKm);
    const paceAdjustmentMinutesPerKm =
      typeof station.paceAdjustmentMinutesPerKm === "number" && Number.isFinite(station.paceAdjustmentMinutesPerKm)
        ? station.paceAdjustmentMinutesPerKm
        : undefined;
    const adjustedMinutesPerKm =
      paceAdjustmentMinutesPerKm !== undefined ? Math.max(0, minPerKm + paceAdjustmentMinutesPerKm) : minPerKm;
    const adjustedSegmentDurationMinutes = adjustedSegmentMinutes(adjustedMinutesPerKm, segmentKm);
    const overrideMinutes =
      typeof station.segmentMinutesOverride === "number" && station.segmentMinutesOverride >= 0
        ? station.segmentMinutesOverride
        : undefined;
    const segmentMinutes = overrideMinutes ?? adjustedSegmentDurationMinutes;
    elapsedMinutes += segmentMinutes;
    const pauseMinutes =
      typeof station.pauseMinutes === "number" && Number.isFinite(station.pauseMinutes) && station.pauseMinutes >= 0
        ? station.pauseMinutes
        : 0;
    const etaMinutes = elapsedMinutes;
    elapsedMinutes += pauseMinutes;
    const targetFuelGrams = (segmentMinutes / 60) * values.targetIntakePerHour;
    const targetWaterMl = (segmentMinutes / 60) * values.waterIntakePerHour;
    const targetSodiumMg = (segmentMinutes / 60) * values.sodiumIntakePerHour;
    const gelsPlanned = Math.max(0, Math.round((station.gelsPlanned ?? targetFuelGrams / gelCarbs) * 10) / 10);
    const recommendedGels = Math.max(0, targetFuelGrams / gelCarbs);
    const plannedFuelGrams = gelsPlanned * gelCarbs;
    const plannedSodiumMg = targetSodiumMg;
    const segmentWaterAvailable = Math.max(0, availableWaterMl);
    const remainingWater = segmentWaterAvailable - targetWaterMl;
    const waterShortfallMl = remainingWater < 0 ? Math.abs(remainingWater) : undefined;

    const segment: Segment = {
      checkpoint: station.name,
      from: previous.name,
      startDistanceKm: previous.distanceKm,
      distanceKm: station.distanceKm,
      segmentKm,
      etaMinutes,
      segmentMinutes,
      estimatedSegmentMinutes,
      paceAdjustmentMinutesPerKm,
      fuelGrams: targetFuelGrams,
      waterMl: targetWaterMl,
      sodiumMg: targetSodiumMg,
      plannedFuelGrams,
      plannedWaterMl: segmentWaterAvailable,
      plannedSodiumMg,
      targetFuelGrams,
      targetWaterMl,
      targetSodiumMg,
      gelsPlanned,
      recommendedGels,
      plannedMinutesOverride: overrideMinutes,
      pauseMinutes,
      elevationGainM: Math.round(elevationDelta.gain),
      elevationLossM: Math.round(elevationDelta.loss),
      pickupGels: station.pickupGels,
      supplies: station.supplies,
      aidStationIndex: station.kind === "aid" ? station.originalIndex : undefined,
      isFinish: station.kind === "finish",
      waterCapacityMl: waterCapacityMl ?? undefined,
      waterShortfallMl,
    };

    availableWaterMl = Math.max(0, remainingWater);

    const canRefillAtArrival = station.kind === "finish" ? true : station.waterRefill !== false;
    if (canRefillAtArrival && waterCapacityMl !== null) {
      availableWaterMl = waterCapacityMl;
    }

    return segment;
  });

  return segments;
}
