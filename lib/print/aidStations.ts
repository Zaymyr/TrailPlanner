import type { FuelProduct } from "../product-types";
import type { Segment } from "../../app/(coach)/race-planner/types";

export type PrintAidStationLineIcon = "gel" | "iso" | "water" | "salt" | "solid";
export type PrintAidStationLine = { icon: PrintAidStationLineIcon; label: string; value: string; note?: string };

export type PrintAidStationCard = {
  id: string;
  name: string;
  km: number;
  dPlusCum?: number;
  dMinusCum?: number;
  etaTimeOfDay?: string;
  etaElapsed: string;
  timeWindow?: string;
  toGive: PrintAidStationLine[];
  toRefill: string[];
  leaveWith: string[];
  nextLegSummary: string;
};

export type BuildPrintAidStationCardsOptions = {
  raceStartTimeIso?: string;
  defaultWindowMinutes?: number;
  flaskSizeMl?: number;
};

/**
 * Assistance print mapper.
 * Defaults:
 * - defaultWindowMinutes: ETA buffer (±15 by default)
 * - flaskSizeMl: softflask capacity shortcut (500ml by default)
 */
export function buildPrintAidStationCards(
  segments: Segment[],
  products: FuelProduct[],
  options: BuildPrintAidStationCardsOptions = {}
): PrintAidStationCard[] {
  const raceStartDate = options.raceStartTimeIso ? new Date(options.raceStartTimeIso) : null;
  const hasValidRaceStart = raceStartDate && !Number.isNaN(raceStartDate.getTime());
  const defaultWindowMinutes = options.defaultWindowMinutes ?? 15;
  const flaskSizeMl = options.flaskSizeMl ?? 500;

  const productById = new Map(products.map((product) => [product.id, product]));
  const bestGelProduct = products
    .filter((product) => product.fuelType === "gel" && product.carbsGrams > 0)
    .sort((a, b) => b.carbsGrams - a.carbsGrams)[0];

  let cumulativeDPlus = 0;
  let cumulativeDMinus = 0;

  return segments.map((segment, index) => {
    cumulativeDPlus += Math.max(0, segment.elevationGainM ?? 0);
    cumulativeDMinus += Math.max(0, segment.elevationLossM ?? 0);

    const suppliedGelCount = (segment.supplies ?? []).reduce((acc, supply) => {
      const product = productById.get(supply.productId);
      return product?.fuelType === "gel" ? acc + supply.quantity : acc;
    }, 0);

    const inferredGelCount =
      suppliedGelCount > 0
        ? suppliedGelCount
        : bestGelProduct
          ? Math.max(0, Math.ceil(segment.targetFuelGrams / bestGelProduct.carbsGrams))
          : null;

    const electrolytesCount = (segment.supplies ?? []).reduce((acc, supply) => {
      const product = productById.get(supply.productId);
      return product && (product.fuelType === "capsule" || product.fuelType === "electrolyte")
        ? acc + supply.quantity
        : acc;
    }, 0);

    const solids = (segment.supplies ?? [])
      .map((supply) => ({ supply, product: productById.get(supply.productId) }))
      .filter(({ product }) => product && ["bar", "real_food", "other"].includes(product.fuelType))
      .map(({ supply, product }) => `${supply.quantity}× ${product?.name}`);

    const isoMl = Math.round(segment.targetWaterMl * 0.5);
    const waterMl = Math.max(0, Math.round(segment.targetWaterMl - isoMl));

    const toGive: PrintAidStationLine[] = [
      {
        icon: "gel",
        label: "Gels",
        value: inferredGelCount === null ? "?" : `${inferredGelCount}`,
        note:
          suppliedGelCount > 0
            ? undefined
            : bestGelProduct
              ? `inferred (${Math.round(bestGelProduct.carbsGrams)}g carbs/gel)`
              : "no gel product selected",
      },
      { icon: "iso", label: "Isotonic", value: formatMlWithFlasks(isoMl, flaskSizeMl) },
      { icon: "water", label: "Water", value: formatMlWithFlasks(waterMl, flaskSizeMl) },
      {
        icon: "salt",
        label: "Electrolytes",
        value: electrolytesCount > 0 ? `${electrolytesCount} caps/tabs` : "-",
        note: electrolytesCount > 0 ? undefined : `${Math.round(segment.targetSodiumMg)}mg sodium target`,
      },
    ];

    if (solids.length > 0) {
      toGive.push({ icon: "solid", label: "Solid / extras", value: solids.join(", ") });
    }

    const nextSegment = segments[index + 1];

    return {
      id: `${segment.checkpoint}-${segment.distanceKm}-${index}`,
      name: segment.checkpoint,
      km: segment.distanceKm,
      dPlusCum: cumulativeDPlus,
      dMinusCum: cumulativeDMinus,
      etaTimeOfDay: hasValidRaceStart ? formatTimeOfDay(new Date((raceStartDate as Date).getTime() + segment.etaMinutes * 60000)) : undefined,
      etaElapsed: formatElapsed(segment.etaMinutes),
      timeWindow: `±${defaultWindowMinutes} min`,
      toGive,
      toRefill: [`2×${flaskSizeMl}ml`, "1 iso + 1 water"],
      leaveWith: [
        `Gels x${inferredGelCount === null ? "?" : inferredGelCount}`,
        `${formatMlWithFlasks(Math.round(segment.targetWaterMl), flaskSizeMl)} total fluids`,
      ],
      nextLegSummary: nextSegment ? `${formatElapsed(nextSegment.segmentMinutes)} · ${buildProfileTag(nextSegment)}` : "Finish",
    };
  });
}

function buildProfileTag(segment: Segment): "UP" | "DOWN" | "FLAT" {
  const gain = segment.elevationGainM ?? 0;
  const loss = segment.elevationLossM ?? 0;
  if (gain > loss + 60) return "UP";
  if (loss > gain + 60) return "DOWN";
  return "FLAT";
}

function formatElapsed(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  return `T+${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimeOfDay(value: Date): string {
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}

function formatMlWithFlasks(ml: number, flaskSizeMl: number): string {
  if (ml <= 0) return "0 ml";
  const flasks = ml / flaskSizeMl;
  if (Math.abs(flasks - Math.round(flasks)) < 0.01) {
    const rounded = Math.round(flasks);
    return `${ml} ml (${rounded} softflask${rounded > 1 ? "s" : ""})`;
  }
  return `${ml} ml`;
}
