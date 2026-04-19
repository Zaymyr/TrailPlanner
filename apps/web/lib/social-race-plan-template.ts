import { z } from "zod";

import type { ElevationPoint, FormValues, SectionSegment, StationSupply } from "../app/(coach)/race-planner/types";
import { dedupeAidStations, sanitizeElevationProfile, sanitizePlannerValues } from "../app/(coach)/race-planner/utils/plan-sanitizers";
import { estimateEffortDurationSeconds, minutesPerKm, DEFAULT_FATIGUE_LEVEL } from "../app/(coach)/race-planner/utils/pacing";
import { buildSectionKey, getSectionSegments } from "../app/(coach)/race-planner/utils/section-segments";
import { recomputeSectionFromSubSections } from "../app/(coach)/race-planner/utils/section-recompute";
import { buildSegments } from "../app/(coach)/race-planner/utils/segments";
import { getElevationSlice } from "../app/(coach)/race-planner/utils/elevation-slice";
import type { FuelProduct } from "./product-types";

const nullableMetricSchema = z.number().finite().nonnegative().nullable();

const socialTemplateItemSchema = z.object({
  kind: z.enum(["product", "estimate"]),
  label: z.string(),
  productId: z.string().nullable(),
  quantity: z.number().int().positive().nullable(),
  carbsG: nullableMetricSchema,
  waterMl: nullableMetricSchema,
  sodiumMg: nullableMetricSchema,
  note: z.string().nullable(),
});

const socialTemplateItemsBlockSchema = z.object({
  items: z.array(socialTemplateItemSchema),
  fallbackUsed: z.boolean(),
});

const socialTemplateEtaSchema = z.object({
  minutes: nullableMetricSchema,
  label: z.string().nullable(),
});

const socialTemplateTargetTimeSchema = z.object({
  minutes: nullableMetricSchema,
  label: z.string().nullable(),
  source: z.enum(["computed", "missing"]),
});

export const socialRacePlanTemplateSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  plan: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  race: z.object({
    name: z.string(),
    distanceKm: nullableMetricSchema,
    elevationGainM: nullableMetricSchema,
    targetTime: socialTemplateTargetTimeSchema,
  }),
  averagesPerHour: z.object({
    carbsG: nullableMetricSchema,
    waterMl: nullableMetricSchema,
    sodiumMg: nullableMetricSchema,
  }),
  totals: z.object({
    carbsG: nullableMetricSchema,
    waterMl: nullableMetricSchema,
    sodiumMg: nullableMetricSchema,
    durationMinutes: nullableMetricSchema,
  }),
  startCarry: socialTemplateItemsBlockSchema,
  aidStations: z.array(
    z.object({
      name: z.string(),
      km: nullableMetricSchema,
      eta: socialTemplateEtaSchema,
      take: socialTemplateItemsBlockSchema,
    })
  ),
  assumptions: z.array(z.string()),
  disclaimer: z.string(),
  cta: z.string(),
  missingData: z.array(z.string()),
});

export type SocialRacePlanTemplate = z.infer<typeof socialRacePlanTemplateSchema>;

type SocialRacePlanBuilderInput = {
  plan: {
    id: string;
    name: string;
    plannerValues?: Partial<FormValues> | null;
    elevationProfile?: ElevationPoint[] | null;
    planCourseStats?: {
      distanceKm?: number | null;
      elevationGainM?: number | null;
    } | null;
    race?: {
      name?: string | null;
      distanceKm?: number | null;
      elevationGainM?: number | null;
    } | null;
  };
  products?: FuelProduct[];
  generatedAt?: string;
};

type ResolvedPlannerContext = {
  values: FormValues;
  elevationProfile: ElevationPoint[];
  averageTargets: {
    carbsG: number | null;
    waterMl: number | null;
    sodiumMg: number | null;
  };
  raceDistanceKm: number | null;
  elevationGainM: number | null;
  paceMinutesPerKm: number | null;
};

type SocialSection = {
  sectionIndex: number;
  fromName: string;
  toName: string;
  startKm: number;
  endKm: number;
  durationMinutes: number | null;
  etaMinutes: number | null;
};

const START_LABEL = "Depart";
const FINISH_LABEL = "Arrivee";

const STATIC_ASSUMPTIONS = [
  "Les ETA sont relatifs au depart et s'appuient sur l'allure, la fatigue et les sous-sections enregistrees dans le plan.",
  "Quand un ravito n'a pas de detail produit, le template bascule sur une estimation par section.",
];

const STATIC_DISCLAIMER =
  "Plan indicatif a ajuster selon la meteo, les sensations, la tolerance digestive et les ravitos reels du jour J.";

const STATIC_CTA = "Construis ton plan de course sur Pace Yourself.";

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNonNegativeNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  return parsed >= 0 ? parsed : null;
}

function toNullableRoundedNumber(value: number | null, digits = 0): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  if (digits === 0) return Math.round(value);
  return Number(value.toFixed(digits));
}

function firstNumber(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function formatDurationLabel(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes)) return null;
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return `${hours}h${String(remainingMinutes).padStart(2, "0")}`;
}

function sortMissingData(missingData: Set<string>) {
  return Array.from(missingData).sort((left, right) => left.localeCompare(right));
}

function buildResolvedPlannerContext(input: SocialRacePlanBuilderInput, missingData: Set<string>): ResolvedPlannerContext {
  const storedValues = sanitizePlannerValues(input.plan.plannerValues ?? {}) ?? {};
  const elevationProfile = sanitizeElevationProfile(input.plan.elevationProfile ?? []);
  const dedupedAidStations = dedupeAidStations(storedValues.aidStations ?? []);

  const raceDistanceKm = firstNumber(
    toNonNegativeNumber(storedValues.raceDistanceKm),
    toNonNegativeNumber(input.plan.planCourseStats?.distanceKm),
    toNonNegativeNumber(input.plan.race?.distanceKm)
  );
  const elevationGainM = firstNumber(
    toNonNegativeNumber(storedValues.elevationGain),
    toNonNegativeNumber(input.plan.planCourseStats?.elevationGainM),
    toNonNegativeNumber(input.plan.race?.elevationGainM)
  );
  const carbsPerHour = toNonNegativeNumber(storedValues.targetIntakePerHour);
  const waterMlPerHour = toNonNegativeNumber(storedValues.waterIntakePerHour);
  const sodiumMgPerHour = toNonNegativeNumber(storedValues.sodiumIntakePerHour);

  if (raceDistanceKm === null || raceDistanceKm <= 0) missingData.add("race_distance");
  if (elevationGainM === null) missingData.add("elevation_gain");
  if (carbsPerHour === null) missingData.add("carbs_per_hour");
  if (waterMlPerHour === null) missingData.add("water_per_hour");
  if (sodiumMgPerHour === null) missingData.add("sodium_per_hour");

  const values: FormValues = {
    raceDistanceKm: raceDistanceKm ?? 0,
    elevationGain: elevationGainM ?? 0,
    fatigueLevel: toNonNegativeNumber(storedValues.fatigueLevel) ?? DEFAULT_FATIGUE_LEVEL,
    paceType: storedValues.paceType === "speed" ? "speed" : "pace",
    paceMinutes: toNonNegativeNumber(storedValues.paceMinutes) ?? 0,
    paceSeconds: toNonNegativeNumber(storedValues.paceSeconds) ?? 0,
    speedKph: toNonNegativeNumber(storedValues.speedKph) ?? 0,
    targetIntakePerHour: carbsPerHour ?? 0,
    waterIntakePerHour: waterMlPerHour ?? 0,
    sodiumIntakePerHour: sodiumMgPerHour ?? 0,
    waterBagLiters: toNonNegativeNumber(storedValues.waterBagLiters) ?? 0,
    fuelTypes: Array.isArray(storedValues.fuelTypes)
      ? storedValues.fuelTypes.filter((value): value is string => typeof value === "string")
      : [],
    startSupplies: storedValues.startSupplies ?? [],
    aidStations: dedupedAidStations,
    finishPlan: storedValues.finishPlan ?? {},
    segments: storedValues.segments,
    sectionSegments: storedValues.sectionSegments ?? storedValues.segments,
  };

  const paceMinutesPerKm = minutesPerKm(values);
  const normalizedPaceMinutesPerKm =
    typeof paceMinutesPerKm === "number" && Number.isFinite(paceMinutesPerKm) && paceMinutesPerKm > 0
      ? paceMinutesPerKm
      : null;

  if (normalizedPaceMinutesPerKm === null) missingData.add("target_time");

  return {
    values,
    elevationProfile,
    averageTargets: {
      carbsG: carbsPerHour,
      waterMl: waterMlPerHour,
      sodiumMg: sodiumMgPerHour,
    },
    raceDistanceKm,
    elevationGainM,
    paceMinutesPerKm: normalizedPaceMinutesPerKm,
  };
}

function buildSocialSections(context: ResolvedPlannerContext): SocialSection[] {
  const { values, elevationProfile, paceMinutesPerKm } = context;
  const canComputeTime =
    paceMinutesPerKm !== null && Number.isFinite(values.raceDistanceKm) && values.raceDistanceKm > 0;

  const baseSegments = canComputeTime ? buildSegments(values, START_LABEL, FINISH_LABEL, elevationProfile) : [];
  const sortedElevationProfile = [...elevationProfile].sort((left, right) => left.distanceKm - right.distanceKm);
  const hasSectionSubSegments = Boolean(values.sectionSegments && Object.keys(values.sectionSegments).length > 0);

  let elapsedMinutes = 0;

  return baseSegments.map((segment, index) => {
    let movingDurationMinutes = segment.segmentMinutes;

    if (canComputeTime && hasSectionSubSegments && sortedElevationProfile.length > 0) {
      const sectionKey = buildSectionKey(index);
      const storedSegments = values.sectionSegments?.[sectionKey] ?? [];

      if (storedSegments.length > 0) {
        const normalizedSegments = normalizeSectionSegments(
          getSectionSegments({ sectionSegments: values.sectionSegments }, sectionKey, segment.segmentKm),
          segment.segmentKm
        );
        const sectionProfile = getElevationSlice(sortedElevationProfile, segment.startDistanceKm, segment.distanceKm);

        if (normalizedSegments.length > 0 && sectionProfile.length > 0) {
          const recomputed = recomputeSectionFromSubSections({
            segments: normalizedSegments,
            startDistanceKm: segment.startDistanceKm,
            elevationProfile: sectionProfile,
            paceModel: {
              secondsPerKm: paceMinutesPerKm * 60,
              estimateSeconds: ({ distKm, dPlus, dMinus, elapsedBeforeSeconds }) =>
                estimateEffortDurationSeconds(paceMinutesPerKm * 60, {
                  distKm,
                  dPlus,
                  dMinus,
                  elapsedBeforeSeconds,
                  fatigueLevel: values.fatigueLevel,
                }),
            },
            startElapsedSeconds: elapsedMinutes * 60,
          });

          movingDurationMinutes = recomputed.totals.etaSeconds / 60;
        }
      }
    }

    const pauseAtStart = index === 0 ? 0 : Math.max(0, values.aidStations[index - 1]?.pauseMinutes ?? 0);
    const durationMinutes = movingDurationMinutes + pauseAtStart;
    const etaMinutes = elapsedMinutes + movingDurationMinutes;

    elapsedMinutes += durationMinutes;

    return {
      sectionIndex: index,
      fromName: segment.from,
      toName: segment.checkpoint,
      startKm: segment.startDistanceKm,
      endKm: segment.distanceKm,
      durationMinutes,
      etaMinutes,
    };
  });
}

function normalizeSectionSegments(segments: SectionSegment[], totalKm: number) {
  if (!segments.length) return [];

  const sanitized = segments
    .map((segment) => ({
      ...segment,
      segmentKm: Math.max(0, Number(segment.segmentKm.toFixed(3))),
    }))
    .filter((segment) => segment.segmentKm > 0);

  if (sanitized.length === 0 || !Number.isFinite(totalKm) || totalKm <= 0) return sanitized;

  const currentTotal = sanitized.reduce((sum, segment) => sum + segment.segmentKm, 0);
  const delta = Number((totalKm - currentTotal).toFixed(3));

  if (Math.abs(delta) < 0.01) return sanitized;

  const lastIndex = sanitized.length - 1;
  const lastSegment = sanitized[lastIndex];
  sanitized[lastIndex] = {
    ...lastSegment,
    segmentKm: Math.max(0.01, Number((lastSegment.segmentKm + delta).toFixed(3))),
  };

  return sanitized;
}

function buildProductItems(
  supplies: StationSupply[] | undefined,
  productsById: Map<string, FuelProduct>,
  missingData: Set<string>
) {
  const items =
    supplies
      ?.filter((supply) => Number.isFinite(supply.quantity) && supply.quantity > 0)
      .map((supply) => {
        const product = productsById.get(supply.productId);

        if (!product) {
          missingData.add("product_details");

          return {
            kind: "product" as const,
            label: "Produit inconnu",
            productId: supply.productId,
            quantity: Math.round(supply.quantity),
            carbsG: null,
            waterMl: null,
            sodiumMg: null,
            note: "Produit introuvable dans le catalogue actuel.",
          };
        }

        return {
          kind: "product" as const,
          label: product.name,
          productId: product.id,
          quantity: Math.round(supply.quantity),
          carbsG: toNullableRoundedNumber(product.carbsGrams * supply.quantity),
          waterMl: toNullableRoundedNumber((product.waterMl ?? 0) * supply.quantity),
          sodiumMg: toNullableRoundedNumber(product.sodiumMg * supply.quantity),
          note: null,
        };
      }) ?? [];

  return items;
}

function buildEstimateItem(section: SocialSection | undefined, note: string) {
  if (!section || section.durationMinutes === null) {
    return {
      kind: "estimate" as const,
      label: "Estimation indisponible",
      productId: null,
      quantity: null,
      carbsG: null,
      waterMl: null,
      sodiumMg: null,
      note,
    };
  }

  return {
    kind: "estimate" as const,
    label: `Estimation jusqu'a ${section.toName}`,
    productId: null,
    quantity: null,
    carbsG: null,
    waterMl: null,
    sodiumMg: null,
    note,
  };
}

function applyEstimateTargets(
  item: z.infer<typeof socialTemplateItemSchema>,
  section: SocialSection | undefined,
  averageTargets: ResolvedPlannerContext["averageTargets"]
) {
  if (!section || section.durationMinutes === null) return item;

  const durationHours = section.durationMinutes / 60;

  return {
    ...item,
    carbsG:
      averageTargets.carbsG !== null ? toNullableRoundedNumber(averageTargets.carbsG * durationHours) : null,
    waterMl:
      averageTargets.waterMl !== null ? toNullableRoundedNumber(averageTargets.waterMl * durationHours) : null,
    sodiumMg:
      averageTargets.sodiumMg !== null ? toNullableRoundedNumber(averageTargets.sodiumMg * durationHours) : null,
  };
}

function buildStartCarry(
  context: ResolvedPlannerContext,
  sections: SocialSection[],
  productsById: Map<string, FuelProduct>,
  missingData: Set<string>
) {
  const explicitItems = buildProductItems(context.values.startSupplies, productsById, missingData);

  if (explicitItems.length > 0) {
    return {
      items: explicitItems,
      fallbackUsed: false,
    };
  }

  missingData.add("start_carry_details");

  return {
    items: [
      applyEstimateTargets(
        buildEstimateItem(
          sections[0],
          "Aucun ravitaillement de depart detaille n'est enregistre dans ce plan."
        ),
        sections[0],
        context.averageTargets
      ),
    ],
    fallbackUsed: true,
  };
}

function buildAidStationSummary(
  context: ResolvedPlannerContext,
  sections: SocialSection[],
  productsById: Map<string, FuelProduct>,
  missingData: Set<string>
) {
  return context.values.aidStations.map((station, index) => {
    const explicitItems = buildProductItems(station.supplies, productsById, missingData);
    const upcomingSection = sections[index + 1];

    const take =
      explicitItems.length > 0
        ? {
            items: explicitItems,
            fallbackUsed: false,
          }
        : {
            items: [
              applyEstimateTargets(
                buildEstimateItem(
                  upcomingSection,
                  "Aucun detail de reprise n'est enregistre pour ce ravito."
                ),
                upcomingSection,
                context.averageTargets
              ),
            ],
            fallbackUsed: true,
          };

    if (take.fallbackUsed) {
      missingData.add("aid_station_take_details");
    }

    return {
      name: station.name,
      km: toNullableRoundedNumber(toNonNegativeNumber(station.distanceKm), 1),
      eta: {
        minutes: toNullableRoundedNumber(sections[index]?.etaMinutes ?? null),
        label: formatDurationLabel(toNullableRoundedNumber(sections[index]?.etaMinutes ?? null)),
      },
      take,
    };
  });
}

function buildProductsById(products: FuelProduct[] | undefined) {
  return new Map((products ?? []).map((product) => [product.id, product]));
}

function buildTotals(sections: SocialSection[], averageTargets: ResolvedPlannerContext["averageTargets"]) {
  const totalDurationMinutes = sections.reduce((sum, section) => sum + (section.durationMinutes ?? 0), 0);

  if (!Number.isFinite(totalDurationMinutes) || totalDurationMinutes <= 0) {
    return {
      carbsG: null,
      waterMl: null,
      sodiumMg: null,
      durationMinutes: null,
    };
  }

  const durationHours = totalDurationMinutes / 60;

  return {
    carbsG:
      averageTargets.carbsG !== null ? toNullableRoundedNumber(averageTargets.carbsG * durationHours) : null,
    waterMl:
      averageTargets.waterMl !== null ? toNullableRoundedNumber(averageTargets.waterMl * durationHours) : null,
    sodiumMg:
      averageTargets.sodiumMg !== null ? toNullableRoundedNumber(averageTargets.sodiumMg * durationHours) : null,
    durationMinutes: toNullableRoundedNumber(totalDurationMinutes),
  };
}

export function buildSocialRacePlanTemplate(input: SocialRacePlanBuilderInput): SocialRacePlanTemplate {
  const missingData = new Set<string>();
  const context = buildResolvedPlannerContext(input, missingData);
  const sections = buildSocialSections(context);
  const totals = buildTotals(sections, context.averageTargets);
  const productsById = buildProductsById(input.products);
  const raceName = input.plan.race?.name?.trim() || input.plan.name.trim();
  const targetTimeMinutes = totals.durationMinutes;

  if (targetTimeMinutes === null) {
    missingData.add("target_time");
  }

  const template = {
    schemaVersion: 1 as const,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    plan: {
      id: input.plan.id,
      name: input.plan.name,
    },
    race: {
      name: raceName,
      distanceKm: toNullableRoundedNumber(context.raceDistanceKm, 1),
      elevationGainM: toNullableRoundedNumber(context.elevationGainM),
      targetTime: {
        minutes: targetTimeMinutes,
        label: formatDurationLabel(targetTimeMinutes),
        source: targetTimeMinutes === null ? ("missing" as const) : ("computed" as const),
      },
    },
    averagesPerHour: {
      carbsG: toNullableRoundedNumber(context.averageTargets.carbsG),
      waterMl: toNullableRoundedNumber(context.averageTargets.waterMl),
      sodiumMg: toNullableRoundedNumber(context.averageTargets.sodiumMg),
    },
    totals,
    startCarry: buildStartCarry(context, sections, productsById, missingData),
    aidStations: buildAidStationSummary(context, sections, productsById, missingData),
    assumptions: STATIC_ASSUMPTIONS,
    disclaimer: STATIC_DISCLAIMER,
    cta: STATIC_CTA,
    missingData: sortMissingData(missingData),
  };

  return socialRacePlanTemplateSchema.parse(template);
}
