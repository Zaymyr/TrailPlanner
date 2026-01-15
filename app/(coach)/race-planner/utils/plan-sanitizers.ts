import type { AidStation, ElevationPoint, FormValues, SegmentPlan, StationSupply } from "../types";

export function sanitizeSegmentPlan(plan?: unknown): SegmentPlan {
  if (!plan || typeof plan !== "object") return {};

  const segmentPlan = plan as Partial<SegmentPlan>;

  const toNonNegativeNumber = (value?: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
  const toFiniteNumber = (value?: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

  const segmentMinutesOverride = toNonNegativeNumber(segmentPlan.segmentMinutesOverride);
  const paceAdjustmentMinutesPerKm = toFiniteNumber(segmentPlan.paceAdjustmentMinutesPerKm);
  const pauseMinutes = toNonNegativeNumber(segmentPlan.pauseMinutes);
  const gelsPlanned = toNonNegativeNumber(segmentPlan.gelsPlanned);
  const pickupGels = toNonNegativeNumber(segmentPlan.pickupGels);
  const supplies: StationSupply[] = Array.isArray(segmentPlan.supplies)
    ? segmentPlan.supplies
        .map((supply) => {
          const productId = typeof supply?.productId === "string" ? supply.productId : null;
          const quantity = toNonNegativeNumber(supply?.quantity);
          if (!productId || quantity === undefined) return null;
          return { productId, quantity };
        })
        .filter((supply): supply is StationSupply => Boolean(supply))
    : [];

  return {
    ...(segmentMinutesOverride !== undefined ? { segmentMinutesOverride } : {}),
    ...(paceAdjustmentMinutesPerKm !== undefined ? { paceAdjustmentMinutesPerKm } : {}),
    ...(pauseMinutes !== undefined ? { pauseMinutes } : {}),
    ...(gelsPlanned !== undefined ? { gelsPlanned } : {}),
    ...(pickupGels !== undefined ? { pickupGels } : {}),
    ...(supplies.length ? { supplies } : {}),
  };
}

export function sanitizeAidStations(
  stations?: { name?: string; distanceKm?: number; waterRefill?: boolean; pauseMinutes?: number }[]
): AidStation[] {
  if (!stations?.length) return [];

  const sanitized: AidStation[] = [];

  stations.forEach((station) => {
    if (typeof station?.name !== "string" || typeof station?.distanceKm !== "number") return;

    const plan = sanitizeSegmentPlan(station);

    sanitized.push({
      name: station.name,
      distanceKm: station.distanceKm,
      waterRefill: station.waterRefill !== false,
      ...plan,
    });
  });

  return sanitized;
}

export function dedupeAidStations(stations: AidStation[]): AidStation[] {
  return stations
    .filter(
      (station, index, self) =>
        index ===
        self.findIndex((s) => s.name === station.name && Math.abs(s.distanceKm - station.distanceKm) < 0.01)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function sanitizePlannerValues(values?: Partial<FormValues>): Partial<FormValues> | undefined {
  if (!values) return undefined;

  const paceType = values.paceType === "speed" ? "speed" : "pace";
  const aidStations = sanitizeAidStations(values.aidStations);
  const finishPlan = sanitizeSegmentPlan(values.finishPlan);
  const startSupplies = sanitizeSegmentPlan({ supplies: values.startSupplies }).supplies;
  const waterBagLiters =
    typeof values.waterBagLiters === "number" && Number.isFinite(values.waterBagLiters) && values.waterBagLiters >= 0
      ? values.waterBagLiters
      : undefined;

  return {
    ...values,
    paceType,
    waterBagLiters,
    startSupplies,
    aidStations,
    finishPlan,
  };
}

export function sanitizeElevationProfile(profile?: ElevationPoint[]): ElevationPoint[] {
  if (!profile?.length) return [];

  return profile
    .map((point) => {
      const distanceKm = Number(point.distanceKm);
      const elevationM = Number(point.elevationM);
      if (!Number.isFinite(distanceKm) || !Number.isFinite(elevationM)) return null;
      return { distanceKm, elevationM };
    })
    .filter((point): point is ElevationPoint => Boolean(point));
}
