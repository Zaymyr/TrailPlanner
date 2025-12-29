"use client";
import { Analytics } from "@vercel/analytics/next";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import Script from "next/script";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../i18n-provider";
import { useProductSelection } from "../../hooks/useProductSelection";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RacePlannerTranslations } from "../../../locales/types";
import type {
  AidStation,
  ElevationPoint,
  FormValues,
  SavedPlan,
  Segment,
  SegmentPlan,
  StationSupply,
  SpeedSample,
} from "./types";
import { RACE_PLANNER_URL } from "../../seo";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY } from "../../../lib/auth-storage";
import { fuelProductSchema, type FuelProduct } from "../../../lib/product-types";
import { RacePlannerLayout } from "../../../components/race-planner/RacePlannerLayout";
import { CommandCenter } from "../../../components/race-planner/CommandCenter";
import { ActionPlan } from "../../../components/race-planner/ActionPlan";
import { SettingsPanel } from "../../../components/race-planner/SettingsPanel";
import { PlanManager } from "../../../components/race-planner/PlanManager";

const MessageCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-1.9 5.4 8.5 8.5 0 0 1-6.6 3.1 8.38 8.38 0 0 1-5.4-1.9L3 21l1.9-4.1a8.38 8.38 0 0 1-1.9-5.4 8.5 8.5 0 0 1 3.1-6.6 8.38 8.38 0 0 1 5.4-1.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  </svg>
);

type CardTitleWithTooltipProps = {
  title: string;
  description: string;
};

const CardTitleWithTooltip = ({ title, description }: CardTitleWithTooltipProps) => (
  <CardTitle className="flex items-center gap-2">
    <span>{title}</span>
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-200"
      title={description}
      aria-label={description}
    >
      ?
    </span>
  </CardTitle>
);

type FuelProductEstimate = FuelProduct & { count: number };

const productListSchema = z.object({ products: z.array(fuelProductSchema) });

const defaultFuelProducts: FuelProduct[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "maurten-gel-100",
    sku: "MAURTEN-GEL-100",
    name: "Maurten Gel 100",
    caloriesKcal: 100,
    carbsGrams: 25,
    sodiumMg: 85,
    proteinGrams: 0,
    fatGrams: 0,
    waterMl: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "gu-energy-gel",
    sku: "GU-ENERGY-GEL",
    name: "GU Energy Gel",
    caloriesKcal: 100,
    carbsGrams: 22,
    sodiumMg: 60,
    proteinGrams: 0,
    fatGrams: 0,
    waterMl: 0,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    slug: "sis-go-isotonic-gel",
    sku: "SIS-GO-ISOTONIC",
    name: "SIS GO Isotonic Gel",
    caloriesKcal: 87,
    carbsGrams: 22,
    sodiumMg: 10,
    proteinGrams: 0,
    fatGrams: 0,
    waterMl: 0,
  },
];

type ParsedGpx = {
  distanceKm: number;
  aidStations: AidStation[];
  elevationProfile: ElevationPoint[];
  plannerValues?: Partial<FormValues>;
};

const formatAidStationName = (template: string, index: number) =>
  template.replace("{index}", String(index));

const buildDefaultValues = (copy: RacePlannerTranslations): FormValues => ({
  raceDistanceKm: 50,
  elevationGain: 2200,
  paceType: "pace",
  paceMinutes: 6,
  paceSeconds: 30,
  speedKph: 9.2,
  uphillEffort: 50,
  downhillEffort: 50,
  targetIntakePerHour: 70,
  waterIntakePerHour: 500,
  sodiumIntakePerHour: 600,
  startSupplies: [],
  aidStations: [
    { name: formatAidStationName(copy.defaults.aidStationName, 1), distanceKm: 10 },
    { name: formatAidStationName(copy.defaults.aidStationName, 2), distanceKm: 20 },
    { name: formatAidStationName(copy.defaults.aidStationName, 3), distanceKm: 30 },
    { name: formatAidStationName(copy.defaults.aidStationName, 4), distanceKm: 40 },
    { name: copy.defaults.finalBottles, distanceKm: 45 },
  ],
  finishPlan: {},
});

const createSegmentPlanSchema = (validation: RacePlannerTranslations["validation"]) =>
  z.object({
    segmentMinutesOverride: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    gelsPlanned: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    pickupGels: z.coerce.number().nonnegative({ message: validation.nonNegative }).optional(),
    supplies: z
      .array(
        z.object({
          productId: z.string().min(1),
          quantity: z.coerce.number().positive({ message: validation.nonNegative }),
        })
      )
      .optional(),
  });

const createAidStationSchema = (validation: RacePlannerTranslations["validation"]) =>
  createSegmentPlanSchema(validation).extend({
    name: z.string().min(1, validation.required),
    distanceKm: z.coerce.number().nonnegative({ message: validation.nonNegative }),
  });

const createFormSchema = (copy: RacePlannerTranslations) =>
  z
    .object({
      raceDistanceKm: z.coerce.number().positive(copy.validation.raceDistance),
      elevationGain: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      paceType: z.enum(["pace", "speed"]),
      paceMinutes: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      paceSeconds: z.coerce
        .number()
        .min(0, { message: copy.validation.paceSecondsRange })
        .max(59, { message: copy.validation.paceSecondsRange }),
      speedKph: z.coerce.number().positive(copy.validation.speedPositive),
      uphillEffort: z.coerce.number().min(0).max(100),
      downhillEffort: z.coerce.number().min(0).max(100),
      targetIntakePerHour: z.coerce.number().positive(copy.validation.targetIntake),
      waterIntakePerHour: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      sodiumIntakePerHour: z.coerce.number().nonnegative({ message: copy.validation.nonNegative }),
      startSupplies: createSegmentPlanSchema(copy.validation).shape.supplies.optional(),
      aidStations: z.array(createAidStationSchema(copy.validation)).min(1, copy.validation.aidStationMin),
      finishPlan: createSegmentPlanSchema(copy.validation).optional(),
    })
    .superRefine((values, ctx) => {
      if (values.paceType === "pace" && values.paceMinutes === 0 && values.paceSeconds === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.validation.paceZero,
          path: ["paceMinutes"],
        });
      }
      if (values.paceType === "speed" && values.speedKph <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: copy.validation.speedPositive,
          path: ["speedKph"],
        });
      }
    });

function minutesPerKm(values: FormValues) {
  if (values.paceType === "speed") {
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
}

function paceToSpeedKph(paceMinutes: number, paceSeconds: number) {
  const totalMinutes = paceMinutes + paceSeconds / 60;
  if (totalMinutes <= 0) return null;
  return 60 / totalMinutes;
}

function speedToPace(speedKph: number) {
  if (speedKph <= 0) return null;
  const totalMinutes = 60 / speedKph;
  const minutes = Math.floor(totalMinutes);
  let seconds = Math.round((totalMinutes - minutes) * 60);
  if (seconds === 60) {
    return { minutes: minutes + 1, seconds: 0 };
  }
  return { minutes, seconds };
}

function getElevationAtDistance(profile: ElevationPoint[], distanceKm: number) {
  if (profile.length === 0) return 0;
  if (distanceKm <= profile[0].distanceKm) return profile[0].elevationM;

  for (let i = 1; i < profile.length; i += 1) {
    const prev = profile[i - 1];
    const next = profile[i];

    if (distanceKm <= next.distanceKm) {
      const ratio = (distanceKm - prev.distanceKm) / Math.max(next.distanceKm - prev.distanceKm, 1);
      return prev.elevationM + (next.elevationM - prev.elevationM) * ratio;
    }
  }

  return profile[profile.length - 1].elevationM;
}

function calculateSegmentElevation(
  profile: ElevationPoint[],
  startKm: number,
  endKm: number,
  totalElevationGain: number,
  raceDistanceKm: number
) {
  const segmentKm = Math.max(0, endKm - startKm);
  if (segmentKm === 0) return { ascent: 0, descent: 0 };

  if (profile.length < 2) {
    const distanceShare = raceDistanceKm > 0 ? segmentKm / raceDistanceKm : 0;
    const ascent = Math.max(0, totalElevationGain * distanceShare);
    const descent = ascent; // assume roughly equal climbing and descending when no profile is provided
    return { ascent, descent };
  }

  const distances = profile
    .filter((point) => point.distanceKm > startKm && point.distanceKm < endKm)
    .map((point) => point.distanceKm);

  distances.unshift(startKm);
  distances.push(endKm);

  let ascent = 0;
  let descent = 0;

  for (let i = 1; i < distances.length; i += 1) {
    const fromDistance = distances[i - 1];
    const toDistance = distances[i];
    const fromElevation = getElevationAtDistance(profile, fromDistance);
    const toElevation = getElevationAtDistance(profile, toDistance);
    const delta = toElevation - fromElevation;

    if (delta > 0) {
      ascent += delta;
    } else if (delta < 0) {
      descent += Math.abs(delta);
    }
  }

  return { ascent, descent };
}

function adjustedSegmentMinutes(
  baseMinutesPerKm: number,
  segmentKm: number,
  elevation: { ascent: number; descent: number },
  uphillEffort: number,
  downhillEffort: number
) {
  if (segmentKm === 0) return 0;

  const ascentPerKm = elevation.ascent / (segmentKm * 1000);
  const descentPerKm = elevation.descent / (segmentKm * 1000);
  const normalizedUphillSteepness = Math.min(ascentPerKm / 0.12, 1); // taper effect on very steep climbs
  const normalizedDownhillSteepness = Math.min(descentPerKm / 0.12, 1);
  const uphillIntensity = 1.35 - (uphillEffort / 100) * 0.7; // higher effort shrinks penalty
  const downhillIntensity = 0.5 + (downhillEffort / 100) * 0.9; // higher effort boosts benefit
  const uphillPenalty = ascentPerKm * 10 * uphillIntensity * (1 - 0.35 * normalizedUphillSteepness);
  const downhillBenefit = descentPerKm * 6 * downhillIntensity * (1 - 0.3 * normalizedDownhillSteepness);
  const adjustmentFactor = 1 + uphillPenalty - downhillBenefit;
  const safeAdjustment = Math.min(Math.max(0.6, adjustmentFactor), 1.6);

  return segmentKm * baseMinutesPerKm * safeAdjustment;
}

function slopeToColor(grade: number) {
  const clamped = Math.max(-0.25, Math.min(0.25, grade));
  const t = (clamped + 0.25) / 0.5;
  const start = { r: 59, g: 130, b: 246 }; // blue
  const end = { r: 239, g: 68, b: 68 }; // red
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);

  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
}

function smoothSpeedSamples(samples: SpeedSample[], windowKm = 0.75): SpeedSample[] {
  if (samples.length <= 2) return samples;

  const halfWindow = windowKm / 2;
  let left = 0;
  let right = 0;
  let runningSum = 0;

  return samples.map((sample) => {
    const center = sample.distanceKm;

    while (left < samples.length && center - samples[left].distanceKm > halfWindow) {
      runningSum -= samples[left].speedKph;
      left += 1;
    }

    while (right < samples.length && samples[right].distanceKm - center <= halfWindow) {
      runningSum += samples[right].speedKph;
      right += 1;
    }

    const count = Math.max(right - left, 1);
    const average = runningSum / count;

    return { distanceKm: sample.distanceKm, speedKph: average };
  });
}

function buildSegments(
  values: FormValues,
  startLabel: string,
  finishLabel: string,
  elevationProfile: ElevationPoint[]
): Segment[] {
  const gelCarbs = defaultFuelProducts[0]?.carbsGrams ?? 25;
  const minPerKm = minutesPerKm(values);
  const stationsWithIndex: (AidStation & { originalIndex?: number; kind: "aid" | "finish" })[] = values.aidStations
    .map((station, index) => ({ ...station, originalIndex: index, kind: "aid" as const }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const checkpoints: (AidStation & {
    originalIndex?: number;
    kind: "start" | "aid" | "finish";
  })[] = [
    { name: startLabel, distanceKm: 0, kind: "start" as const },
    ...stationsWithIndex.filter((s) => s.distanceKm < values.raceDistanceKm),
    { name: finishLabel, distanceKm: values.raceDistanceKm, originalIndex: undefined, kind: "finish", ...(values.finishPlan ?? {}) },
  ];

  let elapsedMinutes = 0;

  return checkpoints.slice(1).map((station, index) => {
    const previous = checkpoints[index];
    const segmentKm = Math.max(0, station.distanceKm - previous.distanceKm);
    const elevation = calculateSegmentElevation(
      elevationProfile,
      previous.distanceKm,
      station.distanceKm,
      values.elevationGain,
      values.raceDistanceKm
    );
    const estimatedSegmentMinutes = adjustedSegmentMinutes(
      minPerKm,
      segmentKm,
      elevation,
      values.uphillEffort,
      values.downhillEffort
    );
    const overrideMinutes =
      typeof station.segmentMinutesOverride === "number" && station.segmentMinutesOverride >= 0
        ? station.segmentMinutesOverride
        : undefined;
    const segmentMinutes = overrideMinutes ?? estimatedSegmentMinutes;
    elapsedMinutes += segmentMinutes;
    const targetFuelGrams = (segmentMinutes / 60) * values.targetIntakePerHour;
    const targetWaterMl = (segmentMinutes / 60) * values.waterIntakePerHour;
    const targetSodiumMg = (segmentMinutes / 60) * values.sodiumIntakePerHour;
    const gelsPlanned = Math.max(0, Math.round((station.gelsPlanned ?? targetFuelGrams / gelCarbs) * 10) / 10);
    const recommendedGels = Math.max(0, targetFuelGrams / gelCarbs);
    const plannedFuelGrams = gelsPlanned * gelCarbs;
    const plannedWaterMl = targetWaterMl;
    const plannedSodiumMg = targetSodiumMg;
    const segment: Segment = {
      checkpoint: station.name,
      from: previous.name,
      startDistanceKm: previous.distanceKm,
      distanceKm: station.distanceKm,
      segmentKm,
      etaMinutes: elapsedMinutes,
      segmentMinutes,
      estimatedSegmentMinutes,
      fuelGrams: targetFuelGrams,
      waterMl: targetWaterMl,
      sodiumMg: targetSodiumMg,
      plannedFuelGrams,
      plannedWaterMl,
      plannedSodiumMg,
      targetFuelGrams,
      targetWaterMl,
      targetSodiumMg,
      gelsPlanned,
      recommendedGels,
      plannedMinutesOverride: overrideMinutes,
      pickupGels: station.pickupGels,
      supplies: station.supplies,
      aidStationIndex: station.kind === "aid" ? station.originalIndex : undefined,
      isFinish: station.kind === "finish",
    };
    return segment;
  });
}

function sanitizeSegmentPlan(plan?: unknown): SegmentPlan {
  if (!plan || typeof plan !== "object") return {};

  const segmentPlan = plan as Partial<SegmentPlan>;

  const toNumber = (value?: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

  const segmentMinutesOverride = toNumber(segmentPlan.segmentMinutesOverride);
  const gelsPlanned = toNumber(segmentPlan.gelsPlanned);
  const pickupGels = toNumber(segmentPlan.pickupGels);
  const supplies: StationSupply[] = Array.isArray(segmentPlan.supplies)
    ? segmentPlan.supplies
        .map((supply) => {
          const productId = typeof supply?.productId === "string" ? supply.productId : null;
          const quantity = toNumber(supply?.quantity);
          if (!productId || quantity === undefined) return null;
          return { productId, quantity };
        })
        .filter((supply): supply is StationSupply => Boolean(supply))
    : [];

  return {
    ...(segmentMinutesOverride !== undefined ? { segmentMinutesOverride } : {}),
    ...(gelsPlanned !== undefined ? { gelsPlanned } : {}),
    ...(pickupGels !== undefined ? { pickupGels } : {}),
    ...(supplies.length ? { supplies } : {}),
  };
}

function sanitizeAidStations(stations?: { name?: string; distanceKm?: number }[]): AidStation[] {
  if (!stations?.length) return [];

  return stations
    .map((station) => {
      if (typeof station?.name !== "string" || typeof station?.distanceKm !== "number") return null;

      const plan = sanitizeSegmentPlan(station);

      return {
        name: station.name,
        distanceKm: station.distanceKm,
        ...plan,
      };
    })
    .filter((station): station is AidStation => Boolean(station));
}

function dedupeAidStations(stations: AidStation[]): AidStation[] {
  return stations
    .filter(
      (station, index, self) =>
        index ===
        self.findIndex((s) => s.name === station.name && Math.abs(s.distanceKm - station.distanceKm) < 0.01)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

type PlannerStatePayload = {
  version?: number;
  values?: Partial<FormValues>;
  elevationProfile?: ElevationPoint[];
};

function decodePlannerState(xml: Document): { state: PlannerStatePayload | null; invalid: boolean } {
  const stateNode =
    xml.getElementsByTagName("trailplanner:state")[0] ?? xml.getElementsByTagName("plannerState")[0];
  const encoded = stateNode?.textContent?.trim();

  if (!encoded) {
    return { state: null, invalid: false };
  }

  try {
    const decodedJson = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(decodedJson) as PlannerStatePayload;
    return { state: payload, invalid: false };
  } catch (error) {
    console.error("Unable to parse planner state from GPX", error);
    return { state: null, invalid: true };
  }
}

function sanitizePlannerValues(values?: Partial<FormValues>): Partial<FormValues> | undefined {
  if (!values) return undefined;

  const paceType = values.paceType === "speed" ? "speed" : "pace";
  const aidStations = sanitizeAidStations(values.aidStations);
  const finishPlan = sanitizeSegmentPlan(values.finishPlan);
  const startSupplies = sanitizeSegmentPlan({ supplies: values.startSupplies }).supplies;

  return {
    ...values,
    paceType,
    startSupplies,
    aidStations,
    finishPlan,
  };
}

function sanitizeElevationProfile(profile?: ElevationPoint[]): ElevationPoint[] {
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

function mapSavedPlan(row: Record<string, unknown>): SavedPlan | null {
  const id = typeof row.id === "string" ? row.id : undefined;
  const name = typeof row.name === "string" ? row.name : undefined;
  const updatedAt = typeof row.updated_at === "string" ? row.updated_at : new Date().toISOString();

  if (!id || !name) return null;

  const plannerValues = sanitizePlannerValues(row.planner_values as Partial<FormValues>) ?? {};
  const elevationProfile = sanitizeElevationProfile(row.elevation_profile as ElevationPoint[]);

  return {
    id,
    name,
    updatedAt,
    plannerValues,
    elevationProfile,
  };
}

function encodePlannerState(values: FormValues, elevationProfile: ElevationPoint[]): string {
  const payload: PlannerStatePayload = {
    version: 1,
    values,
    elevationProfile,
  };

  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
}

function buildFlatElevationProfile(distanceKm: number): ElevationPoint[] {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return [];

  return [
    { distanceKm: 0, elevationM: 0 },
    { distanceKm: Number(distanceKm.toFixed(2)), elevationM: 0 },
  ];
}

function buildPlannerGpx(values: FormValues, elevationProfile: ElevationPoint[]) {
  const safeAidStations = sanitizeAidStations(values.aidStations);
  const safeFinishPlan = sanitizeSegmentPlan(values.finishPlan);
  const distanceKm = Number.isFinite(values.raceDistanceKm) ? values.raceDistanceKm : 0;
  const profile = elevationProfile.length > 0 ? elevationProfile : buildFlatElevationProfile(distanceKm);
  const plannerState = encodePlannerState({ ...values, aidStations: safeAidStations, finishPlan: safeFinishPlan }, profile);

  const escapeXml = (text: string) => text.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return char;
    }
  });

  const toPseudoCoordinates = (km: number) => ({ lat: 0, lon: km / 111 });

  const aidStationsXml = safeAidStations
    .map((station, index) => {
      const coord = toPseudoCoordinates(station.distanceKm);
      return `    <wpt lat="${coord.lat.toFixed(6)}" lon="${coord.lon.toFixed(6)}">\n      <name>${escapeXml(
        station.name
      )}</name>\n      <extensions>\n        <trailplanner:index>${index}</trailplanner:index>\n      </extensions>\n    </wpt>`;
    })
    .join("\n");

  const trackSegment = profile
    .map((point) => {
      const coord = toPseudoCoordinates(point.distanceKm);
      return `      <trkpt lat="${coord.lat.toFixed(6)}" lon="${coord.lon.toFixed(6)}">\n        <ele>${point.elevationM.toFixed(
        1
      )}</ele>\n        <extensions>\n          <trailplanner:distanceKm>${point.distanceKm.toFixed(3)}</trailplanner:distanceKm>\n        </extensions>\n      </trkpt>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="TrailPlanner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:trailplanner="https://trailplanner.app/gpx">
  <metadata>
    <link href="https://trailplanner.app">
      <text>TrailPlanner</text>
    </link>
    <time>${new Date().toISOString()}</time>
    <extensions>
      <trailplanner:state>${plannerState}</trailplanner:state>
    </extensions>
  </metadata>
  ${aidStationsXml}
  ${profile.length ? `<trk>\n    <name>${escapeXml(`${distanceKm.toFixed(1)} km plan`)}</name>\n    <trkseg>\n${trackSegment}\n    </trkseg>\n  </trk>` : ""}
</gpx>`;
}

function formatMinutes(totalMinutes: number, units: RacePlannerTranslations["units"]) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}${units.hourShort} ${minutes.toString().padStart(2, "0")}${units.minuteShort}`;
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseGpx(content: string, copy: RacePlannerTranslations): ParsedGpx {
  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "text/xml");
  const { state: plannerState, invalid } = decodePlannerState(xml);
  if (invalid) {
    throw new Error(copy.gpx.errors.invalidPlannerState);
  }

  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  let parsedTrack: Omit<ParsedGpx, "plannerValues"> | null = null;
  if (trkpts.length > 0) {
    const cumulativeTrack: { lat: number; lon: number; distance: number; elevation: number }[] = [];
    trkpts.forEach((pt, index) => {
      const lat = parseFloat(pt.getAttribute("lat") ?? "");
      const lon = parseFloat(pt.getAttribute("lon") ?? "");
      const elevation = parseFloat(pt.getElementsByTagName("ele")[0]?.textContent ?? "0");
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        throw new Error(copy.gpx.errors.invalidCoordinates);
      }

      if (index === 0) {
        cumulativeTrack.push({ lat, lon, distance: 0, elevation: Number.isFinite(elevation) ? elevation : 0 });
        return;
      }

      const prev = cumulativeTrack[index - 1];
      const distance = haversineDistanceMeters(prev.lat, prev.lon, lat, lon);
      cumulativeTrack.push({
        lat,
        lon,
        distance: prev.distance + distance,
        elevation: Number.isFinite(elevation) ? elevation : prev.elevation,
      });
    });

    const totalMeters = cumulativeTrack.at(-1)?.distance ?? 0;
    const wpts = Array.from(xml.getElementsByTagName("wpt"));

    const aidStations = wpts
      .map((wpt) => {
        const lat = parseFloat(wpt.getAttribute("lat") ?? "");
        const lon = parseFloat(wpt.getAttribute("lon") ?? "");
        if (Number.isNaN(lat) || Number.isNaN(lon)) {
          return null;
        }

        let closest = cumulativeTrack[0];
        let minDistance = Infinity;

        cumulativeTrack.forEach((point) => {
          const d = haversineDistanceMeters(lat, lon, point.lat, point.lon);
          if (d < minDistance) {
            minDistance = d;
            closest = point;
          }
        });

        const name =
          wpt.getElementsByTagName("name")[0]?.textContent?.trim() ||
          wpt.getElementsByTagName("desc")[0]?.textContent?.trim() ||
          copy.gpx.fallbackAidStation;

        return { name, distanceKm: Number(((closest?.distance ?? 0) / 1000).toFixed(1)) };
      })
      .filter(Boolean) as ParsedGpx["aidStations"];

    aidStations.push({ name: copy.defaults.finish, distanceKm: Number((totalMeters / 1000).toFixed(1)) });

    const elevationProfile: ElevationPoint[] = cumulativeTrack.map((point) => ({
      distanceKm: Number((point.distance / 1000).toFixed(2)),
      elevationM: Number(point.elevation.toFixed(1)),
    }));

    parsedTrack = {
      distanceKm: Number((totalMeters / 1000).toFixed(1)),
      aidStations: dedupeAidStations(aidStations),
      elevationProfile,
    };
  }

  if (!parsedTrack && !plannerState) {
    throw new Error(copy.gpx.errors.noTrackPoints);
  }

  const sanitizedPlannerValues = sanitizePlannerValues(plannerState?.values);
  const profileFromState = sanitizeElevationProfile(plannerState?.elevationProfile);
  const elevationProfile = profileFromState.length > 0 ? profileFromState : parsedTrack?.elevationProfile ?? [];
  const distanceFromProfile = elevationProfile.at(-1)?.distanceKm;
  const baseDistance =
    sanitizedPlannerValues?.raceDistanceKm ?? parsedTrack?.distanceKm ?? (distanceFromProfile ?? 0) ?? 0;

  const aidStationsFromState = sanitizedPlannerValues?.aidStations ?? [];
  const baseAidStations = aidStationsFromState.length > 0 ? aidStationsFromState : parsedTrack?.aidStations ?? [];

  const aidStationsWithFinish = dedupeAidStations([
    ...baseAidStations,
    { name: copy.defaults.finish, distanceKm: Number(baseDistance.toFixed(1)) },
  ]);

  return {
    distanceKm: Number(baseDistance.toFixed(1)),
    aidStations: aidStationsWithFinish,
    elevationProfile,
    plannerValues: sanitizedPlannerValues,
  };
}

export function RacePlannerPageContent({ enableMobileNav = true }: { enableMobileNav?: boolean }) {
  const { t } = useI18n();
  const racePlannerCopy = t.racePlanner;

  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: t.homeHero.heading,
      description: t.homeHero.description,
      url: RACE_PLANNER_URL,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: 0,
        priceCurrency: "USD",
      },
    }),
    [t.homeHero.description, t.homeHero.heading]
  );

  const formSchema = useMemo(() => createFormSchema(racePlannerCopy), [racePlannerCopy]);
  const defaultValues = useMemo(() => buildDefaultValues(racePlannerCopy), [racePlannerCopy]);
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<FormValues>({
    resolver,
    defaultValues,
    mode: "onChange",
  });
  const { register } = form;

  const sectionIds = {
    inputs: "race-inputs",
    timeline: "race-timeline",
    courseProfile: "course-profile",
    pacing: "pacing-section",
    intake: "intake-section",
  } as const;

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "aidStations" });
  const watchedValues = useWatch({ control: form.control, defaultValue: defaultValues });
  const uphillEffort = form.watch("uphillEffort") ?? defaultValues.uphillEffort;
  const downhillEffort = form.watch("downhillEffort") ?? defaultValues.downhillEffort;
  const startSupplies = form.watch("startSupplies") ?? [];
  const paceMinutesValue = form.watch("paceMinutes") ?? defaultValues.paceMinutes;
  const paceSecondsValue = form.watch("paceSeconds") ?? defaultValues.paceSeconds;
  const speedKphValue = form.watch("speedKph") ?? defaultValues.speedKph;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackDetail, setFeedbackDetail] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [planName, setPlanName] = useState("");
  const [session, setSession] = useState<{ accessToken: string; refreshToken?: string; email?: string } | null>(null);
  const [mobileView, setMobileView] = useState<"plan" | "settings">("plan");
  const [rightPanelTab, setRightPanelTab] = useState<"inputs" | "plans" | "fuel">("inputs");
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"idle" | "signingIn" | "signingUp" | "checking">("idle");
  const [planStatus, setPlanStatus] = useState<"idle" | "saving">("idle");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [fuelProducts, setFuelProducts] = useState<FuelProduct[]>(defaultFuelProducts);
  const [productsStatus, setProductsStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [productsError, setProductsError] = useState<string | null>(null);
  const { selectedProducts } = useProductSelection();

  useEffect(() => {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const isElectron = userAgent.includes("electron");
    const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

    setIsDesktopApp(isElectron || Boolean(isStandalone));
  }, []);

  const persistSession = useCallback(
    (accessToken: string, refreshToken?: string, email?: string) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) {
          window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
          window.localStorage.removeItem(REFRESH_TOKEN_KEY);
        }

        if (email) {
          window.localStorage.setItem(SESSION_EMAIL_KEY, email);
        } else {
          window.localStorage.removeItem(SESSION_EMAIL_KEY);
        }
      }

      setSession({ accessToken, refreshToken, email });
    },
    []
  );

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
      window.localStorage.removeItem(SESSION_EMAIL_KEY);
    }

    setSession(null);
    setSavedPlans([]);
    setActivePlanId(null);
  }, []);

  const refreshSavedPlans = useCallback(
    async (accessToken: string) => {
      try {
        const response = await fetch("/api/plans", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          setAccountError(racePlannerCopy.account.errors.fetchFailed);
          return;
        }

        const data = (await response.json()) as { plans?: Record<string, unknown>[] };
        const parsedPlans = (data.plans ?? [])
          .map((plan) => mapSavedPlan(plan))
          .filter((plan): plan is SavedPlan => Boolean(plan));
        setSavedPlans(parsedPlans);
      } catch (error) {
        console.error("Unable to fetch saved plans", error);
        setAccountError(racePlannerCopy.account.errors.fetchFailed);
      }
    },
    [racePlannerCopy.account.errors.fetchFailed]
  );

  const verifySession = useCallback(
    async (accessToken: string, emailHint?: string, refreshToken?: string) => {
      setAuthStatus("checking");
      setAccountError(null);

      try {
        const response = await fetch("/api/auth/session", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(refreshToken ? { "x-refresh-token": `Bearer ${refreshToken}` } : {}),
          },
          cache: "no-store",
        });

        if (!response.ok) {
          clearSession();
          setAuthStatus("idle");
          return;
        }

        const data = (await response.json()) as { user?: { email?: string } };
        const email = data.user?.email ?? emailHint;
        persistSession(accessToken, refreshToken, email ?? undefined);
        setAccountMessage(racePlannerCopy.account.messages.signedIn);
        await refreshSavedPlans(accessToken);
      } catch (error) {
        console.error("Unable to verify session", error);
        clearSession();
      } finally {
        setAuthStatus("idle");
      }
    },
    [clearSession, persistSession, racePlannerCopy.account.messages.signedIn, refreshSavedPlans]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
    const storedRefresh = window.localStorage.getItem(REFRESH_TOKEN_KEY) ?? undefined;
    const storedEmail = window.localStorage.getItem(SESSION_EMAIL_KEY) ?? undefined;

    if (storedToken) {
      verifySession(storedToken, storedEmail ?? undefined, storedRefresh ?? undefined);
    }
  }, [verifySession]);

  useEffect(() => {
    if (!session?.accessToken) {
      setFuelProducts(defaultFuelProducts);
      setProductsStatus("idle");
      setProductsError(null);
      return;
    }

    const abortController = new AbortController();
    setProductsStatus("loading");
    setProductsError(null);

    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products", {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          cache: "no-store",
          signal: abortController.signal,
        });

        const data = (await response.json().catch(() => null)) as unknown;

        if (!response.ok) {
          const message = (data as { message?: string } | null)?.message ?? racePlannerCopy.sections.gels.loadError;
          throw new Error(message);
        }

        const parsed = productListSchema.safeParse(data);

        if (!parsed.success) {
          throw new Error(racePlannerCopy.sections.gels.loadError);
        }

        if (!abortController.signal.aborted) {
          setFuelProducts(parsed.data.products);
          setProductsStatus("success");
        }
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error("Unable to load fuel products", error);
        setProductsError(error instanceof Error ? error.message : racePlannerCopy.sections.gels.loadError);
        setFuelProducts(defaultFuelProducts);
        setProductsStatus("error");
      }
    };

    void loadProducts();

    return () => {
      abortController.abort();
    };
  }, [racePlannerCopy.sections.gels.loadError, session?.accessToken]);
  const sanitizedWatchedAidStations = sanitizeAidStations(watchedValues?.aidStations);

  const parsedValues = useMemo(() => formSchema.safeParse(watchedValues), [formSchema, watchedValues]);
  const segments = useMemo(
    () =>
      parsedValues.success
        ? buildSegments(
            parsedValues.data,
            racePlannerCopy.defaults.start,
            racePlannerCopy.defaults.finish,
            elevationProfile
          )
        : [],
    [elevationProfile, parsedValues, racePlannerCopy.defaults.finish, racePlannerCopy.defaults.start]
  );
  const baseMinutesPerKm = useMemo(
    () => (parsedValues.success ? minutesPerKm(parsedValues.data) : null),
    [parsedValues]
  );

  const raceTotals = useMemo(() => {
    if (!parsedValues.success || segments.length === 0) return null;

    return segments.reduce(
      (totals, segment) => ({
        fuelGrams: totals.fuelGrams + segment.plannedFuelGrams,
        waterMl: totals.waterMl + segment.plannedWaterMl,
        sodiumMg: totals.sodiumMg + segment.plannedSodiumMg,
        durationMinutes: totals.durationMinutes + segment.segmentMinutes,
      }),
      { fuelGrams: 0, waterMl: 0, sodiumMg: 0, durationMinutes: 0 }
    );
  }, [parsedValues.success, segments]);

  const distanceForDuration =
    (parsedValues.success ? parsedValues.data.raceDistanceKm : watchedValues?.raceDistanceKm) ??
    defaultValues.raceDistanceKm;
  const projectedDurationMinutes =
    baseMinutesPerKm && Number.isFinite(distanceForDuration) && distanceForDuration > 0
      ? distanceForDuration * baseMinutesPerKm
      : null;
  const pacingOverviewDuration = raceTotals?.durationMinutes ?? projectedDurationMinutes ?? null;

  const formatDistanceWithUnit = (value: number) =>
    `${value.toFixed(1)} ${racePlannerCopy.sections.timeline.distanceWithUnit}`;

  const formatFuelAmount = (value: number) =>
    racePlannerCopy.sections.timeline.fuelLabel.replace("{amount}", value.toFixed(0));

  const formatWaterAmount = (value: number) =>
    racePlannerCopy.sections.timeline.waterLabel.replace("{amount}", value.toFixed(0));

  const formatSodiumAmount = (value: number) =>
    racePlannerCopy.sections.timeline.sodiumLabel.replace("{amount}", value.toFixed(0));

  const calculatePercentage = (value: number, total?: number) => {
    if (!total || total <= 0) return 0;
    return Math.min((value / total) * 100, 100);
  };

  const mergedFuelProducts = useMemo(() => {
    const productsById = new Map<string, FuelProduct>();
    fuelProducts.forEach((product) => productsById.set(product.id, product));

    selectedProducts.forEach((product) => {
      if (!productsById.has(product.id)) {
        productsById.set(product.id, {
          id: product.id,
          slug: product.slug,
          sku: product.sku ?? undefined,
          name: product.name,
          productUrl: product.productUrl ?? undefined,
          caloriesKcal: product.caloriesKcal ?? 0,
          carbsGrams: product.carbsGrams,
          sodiumMg: product.sodiumMg ?? 0,
          proteinGrams: 0,
          fatGrams: 0,
          waterMl: 0,
        });
      }
    });

    return Array.from(productsById.values());
  }, [fuelProducts, selectedProducts]);

  const fuelProductEstimates = useMemo<FuelProductEstimate[]>(
    () =>
      raceTotals
        ? mergedFuelProducts.map((product) => ({
            ...product,
            count: product.carbsGrams > 0 ? Math.ceil(raceTotals.fuelGrams / product.carbsGrams) : 0,
          }))
        : [],
    [mergedFuelProducts, raceTotals]
  );

  const favoriteProductEstimates = useMemo(() => {
    if (fuelProductEstimates.length === 0) return [];

    const selectionOrder = selectedProducts.map((product) => product.id);
    const productById = new Map(fuelProductEstimates.map((product) => [product.id, product] as const));

    return selectionOrder
      .map((id) => productById.get(id))
      .filter((product): product is FuelProductEstimate => Boolean(product));
  }, [fuelProductEstimates, selectedProducts]);

  const otherProductEstimates = useMemo(
    () =>
      fuelProductEstimates.filter((product) =>
        favoriteProductEstimates.every((favorite) => favorite.id !== product.id)
      ),
    [favoriteProductEstimates, fuelProductEstimates]
  );

  const scrollToSection = (sectionId: (typeof sectionIds)[keyof typeof sectionIds]) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ block: "start" });
    }
  };

  const focusSection = (sectionId: (typeof sectionIds)[keyof typeof sectionIds], view: "plan" | "settings") => {
    setMobileView(view);
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => scrollToSection(sectionId));
    } else {
      scrollToSection(sectionId);
    }
  };

  const handleSignOut = () => {
    setAccountMessage(null);
    setAccountError(null);
    clearSession();
    setPlanName("");
  };

  const handleSavePlan = async () => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(racePlannerCopy.account.errors.missingSession);
      return;
    }

    if (!parsedValues.success) {
      setAccountError(racePlannerCopy.account.errors.saveFailed);
      return;
    }

    setPlanStatus("saving");

    try {
      const trimmedName = planName.trim() || racePlannerCopy.account.plans.defaultName;
      const sanitizedAidStations = dedupeAidStations(sanitizeAidStations(parsedValues.data.aidStations));
      const sanitizedFinishPlan = sanitizeSegmentPlan(parsedValues.data.finishPlan);

      const plannerValues: FormValues = {
        ...parsedValues.data,
        aidStations: sanitizedAidStations,
        finishPlan: sanitizedFinishPlan,
        startSupplies: sanitizeSegmentPlan({ supplies: parsedValues.data.startSupplies }).supplies ?? [],
      };

      const existingPlanByName = savedPlans.find(
        (plan) => plan.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      const planIdToUpdate = existingPlanByName?.id ?? null;

      const payload = {
        name: trimmedName,
        plannerValues,
        elevationProfile: sanitizeElevationProfile(elevationProfile),
      };

      const response = await fetch("/api/plans", {
        method: planIdToUpdate ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(planIdToUpdate ? { ...payload, id: planIdToUpdate } : payload),
      });

      const data = (await response.json().catch(() => null)) as {
        plan?: Record<string, unknown> | null;
        message?: string;
      };

      if (!response.ok || !data?.plan) {
        setAccountError(data?.message ?? racePlannerCopy.account.errors.saveFailed);
        return;
      }

      const parsedPlan = mapSavedPlan(data.plan);

      if (parsedPlan) {
        setSavedPlans((previous) => [parsedPlan, ...previous.filter((plan) => plan.id !== parsedPlan.id)]);
        setPlanName(parsedPlan.name);
        setActivePlanId(parsedPlan.id);
      }

      setAccountMessage(racePlannerCopy.account.messages.savedPlan);
    } catch (error) {
      console.error("Unable to save plan", error);
      setAccountError(racePlannerCopy.account.errors.saveFailed);
    } finally {
      setPlanStatus("idle");
    }
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    const sanitizedAidStations = sanitizeAidStations(plan.plannerValues.aidStations) ?? [];
    const aidStations = sanitizedAidStations.length > 0 ? dedupeAidStations(sanitizedAidStations) : defaultValues.aidStations;
    const startSupplies = sanitizeSegmentPlan({ supplies: plan.plannerValues.startSupplies }).supplies ?? [];

    const mergedValues: FormValues = {
      ...defaultValues,
      ...plan.plannerValues,
      aidStations,
      startSupplies,
      finishPlan: plan.plannerValues.finishPlan ?? defaultValues.finishPlan,
    };

    form.reset(mergedValues, { keepDefaultValues: true });
    setElevationProfile(plan.elevationProfile);
    setPlanName(plan.name);
    setActivePlanId(plan.id);
    setAccountMessage(racePlannerCopy.account.messages.loadedPlan);
  };

  const handleDeletePlan = async (planId: string) => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(racePlannerCopy.account.errors.missingSession);
      return;
    }

    setDeletingPlanId(planId);

    try {
      const response = await fetch("/api/plans", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ id: planId }),
      });

      const data = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setAccountError(data?.message ?? racePlannerCopy.account.errors.deleteFailed);
        return;
      }

      setSavedPlans((previous) => previous.filter((plan) => plan.id !== planId));
      setAccountMessage(racePlannerCopy.account.messages.deletedPlan);
    } catch (error) {
      console.error("Unable to delete plan", error);
      setAccountError(racePlannerCopy.account.errors.deleteFailed);
    } finally {
      setDeletingPlanId(null);
      setActivePlanId((current) => (current === planId ? null : current));
    }
  };

  const handleRefreshPlans = () => {
    if (session?.accessToken) {
      refreshSavedPlans(session.accessToken);
    }
  };

  const handleMobileImport = () => {
    focusSection(sectionIds.inputs, "settings");
    const input = fileInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const mobileNavActions = [
    {
      key: "import",
      label: racePlannerCopy.mobileNav.importGpx,
      onClick: handleMobileImport,
    },
    {
      key: "timeline",
      label: racePlannerCopy.mobileNav.timeline,
      onClick: () => focusSection(sectionIds.timeline, "plan"),
    },
    {
      key: "pacing",
      label: racePlannerCopy.mobileNav.pacing,
      onClick: () => focusSection(sectionIds.pacing, "plan"),
    },
    {
      key: "intake",
      label: racePlannerCopy.mobileNav.intake,
      onClick: () => focusSection(sectionIds.intake, "plan"),
    },
  ];

  const handlePaceUpdate = useCallback(
    (minutes: number, seconds: number) => {
      const safeMinutes = Number.isFinite(minutes) && minutes >= 0 ? Math.floor(minutes) : 0;
      let safeSeconds = Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : 0;
      let normalizedMinutes = safeMinutes;
      if (safeSeconds >= 60) {
        normalizedMinutes += Math.floor(safeSeconds / 60);
        safeSeconds %= 60;
      }
      form.setValue("paceMinutes", normalizedMinutes, { shouldDirty: true, shouldValidate: true });
      form.setValue("paceSeconds", safeSeconds, { shouldDirty: true, shouldValidate: true });
      const convertedSpeed = paceToSpeedKph(normalizedMinutes, safeSeconds);
      if (convertedSpeed) {
        form.setValue("speedKph", Number(convertedSpeed.toFixed(2)), { shouldDirty: true, shouldValidate: true });
      }
      form.setValue("paceType", "pace", { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const handleSpeedUpdate = useCallback(
    (speed: number) => {
      const safeSpeed = Number.isFinite(speed) && speed >= 0 ? speed : 0;
      form.setValue("speedKph", safeSpeed, { shouldDirty: true, shouldValidate: true });
      const convertedPace = speedToPace(safeSpeed);
      if (convertedPace) {
        form.setValue("paceMinutes", convertedPace.minutes, { shouldDirty: true, shouldValidate: true });
        form.setValue("paceSeconds", convertedPace.seconds, { shouldDirty: true, shouldValidate: true });
      }
      form.setValue("paceType", "speed", { shouldDirty: true, shouldValidate: true });
    },
    [form]
  );

  const handleDurationUpdate = useCallback(
    (durationMinutes: number) => {
      if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return;
      const distance = form.getValues("raceDistanceKm") ?? defaultValues.raceDistanceKm;
      const safeDistance = Number.isFinite(distance) && distance > 0 ? distance : null;
      if (!safeDistance) return;
      const paceMinutesTotal = durationMinutes / safeDistance;
      const minutes = Math.floor(paceMinutesTotal);
      let seconds = Math.round((paceMinutesTotal - minutes) * 60);
      let normalizedMinutes = minutes;
      if (seconds === 60) {
        normalizedMinutes += 1;
        seconds = 0;
      }
      handlePaceUpdate(normalizedMinutes, seconds);
    },
    [defaultValues.raceDistanceKm, form, handlePaceUpdate]
  );

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsedGpx = parseGpx(content, racePlannerCopy);
      const fallbackDistance = parsedGpx.distanceKm || defaultValues.raceDistanceKm;
      const fallbackStations =
        parsedGpx.aidStations.length > 0
          ? parsedGpx.aidStations
          : [{ name: racePlannerCopy.defaults.finish, distanceKm: Number(fallbackDistance.toFixed(1)) }];

      if (parsedGpx.plannerValues) {
        const plannerAidStations = sanitizeAidStations(parsedGpx.plannerValues.aidStations);
        const mergedAidStations = plannerAidStations.length > 0 ? plannerAidStations : fallbackStations;
        const mergedValues: FormValues = {
          ...defaultValues,
          ...parsedGpx.plannerValues,
          raceDistanceKm: parsedGpx.plannerValues.raceDistanceKm ?? fallbackDistance,
          aidStations: mergedAidStations,
          finishPlan: parsedGpx.plannerValues.finishPlan ?? defaultValues.finishPlan,
        };
        form.reset(mergedValues, { keepDefaultValues: true });
      } else {
        form.setValue("raceDistanceKm", Number(fallbackDistance.toFixed(1)));
        form.setValue("aidStations", fallbackStations);
      }

      setElevationProfile(parsedGpx.elevationProfile);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : racePlannerCopy.gpx.errors.unableToImport);
    } finally {
      event.target.value = "";
    }
  };

  const handleExportGpx = () => {
    const currentValues = form.getValues();
    const sanitizedStations = sanitizeAidStations(currentValues.aidStations);
    const finishPlan = sanitizeSegmentPlan(currentValues.finishPlan);
    const raceDistanceKm =
      Number.isFinite(currentValues.raceDistanceKm) && currentValues.raceDistanceKm !== null
        ? currentValues.raceDistanceKm
        : defaultValues.raceDistanceKm;

    const values: FormValues = {
      ...defaultValues,
      ...currentValues,
      raceDistanceKm,
      aidStations:
        sanitizedStations.length > 0
          ? sanitizedStations
          : [{ name: racePlannerCopy.defaults.finish, distanceKm: Number(raceDistanceKm.toFixed(1)) }],
      finishPlan,
    };

    const gpxContent = buildPlannerGpx(values, elevationProfile);
    const blob = new Blob([gpxContent], { type: "application/gpx+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "trailplanner.gpx";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  const handleSubmitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const subject = feedbackSubject.trim();
    const detail = feedbackDetail.trim();

    if (!subject || !detail) {
      setFeedbackStatus("error");
      setFeedbackError(racePlannerCopy.sections.summary.feedback.required);
      return;
    }

    try {
      setFeedbackStatus("submitting");
      setFeedbackError(null);

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject, detail }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setFeedbackStatus("error");
        setFeedbackError(payload?.message ?? racePlannerCopy.sections.summary.feedback.error);
        return;
      }

      setFeedbackStatus("success");
      setFeedbackSubject("");
      setFeedbackDetail("");
    } catch (error) {
      console.error("Unable to send feedback", error);
      setFeedbackStatus("error");
      setFeedbackError(racePlannerCopy.sections.summary.feedback.error);
    }
  };

  const openFeedbackForm = () => {
    setFeedbackOpen(true);
    setFeedbackStatus("idle");
    setFeedbackError(null);
  };

  const closeFeedbackForm = () => {
    setFeedbackOpen(false);
    setFeedbackError(null);
    setFeedbackStatus("idle");
  };

  const pagePaddingClass = enableMobileNav ? "pb-28 xl:pb-6" : "pb-6 xl:pb-6";
  const feedbackButtonOffsetClass = enableMobileNav ? "bottom-20" : "bottom-6";
  const handleAddAidStation = useCallback(() => {
    append({
      name: formatAidStationName(racePlannerCopy.defaults.aidStationName, fields.length + 1),
      distanceKm: 0,
    });
  }, [append, fields.length, racePlannerCopy.defaults.aidStationName]);

  const handleSupplyDrop = useCallback(
    (aidStationIndex: number, productId: string, quantity = 1) => {
      const current = form.getValues(`aidStations.${aidStationIndex}.supplies`) ?? [];
      const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
      const existing = sanitized.find((supply) => supply.productId === productId);
      const nextSupplies: StationSupply[] = existing
        ? sanitized.map((supply) =>
            supply.productId === productId ? { ...supply, quantity: supply.quantity + quantity } : supply
          )
        : [...sanitized, { productId, quantity }];

      form.setValue(`aidStations.${aidStationIndex}.supplies`, nextSupplies, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleSupplyRemove = useCallback(
    (aidStationIndex: number, productId: string) => {
      const current = form.getValues(`aidStations.${aidStationIndex}.supplies`) ?? [];
      const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
      const filtered = sanitized.filter((supply) => supply.productId !== productId);

      form.setValue(`aidStations.${aidStationIndex}.supplies`, filtered, {
        shouldDirty: true,
        shouldValidate: true,
      });
    },
    [form]
  );

  const handleStartSupplyDrop = useCallback((productId: string, quantity = 1) => {
    const current = form.getValues("startSupplies") ?? [];
    const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
    const existing = sanitized.find((supply) => supply.productId === productId);
    const nextSupplies: StationSupply[] = existing
      ? sanitized.map((supply) =>
          supply.productId === productId ? { ...supply, quantity: supply.quantity + quantity } : supply
        )
      : [...sanitized, { productId, quantity }];

    form.setValue("startSupplies", nextSupplies, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const handleStartSupplyRemove = useCallback((productId: string) => {
    const current = form.getValues("startSupplies") ?? [];
    const sanitized = sanitizeSegmentPlan({ supplies: current }).supplies ?? [];
    const filtered = sanitized.filter((supply) => supply.productId !== productId);

    form.setValue("startSupplies", filtered, { shouldDirty: true, shouldValidate: true });
  }, [form]);

  const courseProfileSection = (
    <Card id={sectionIds.courseProfile}>
      <CardHeader className="space-y-0">
        <div className="flex items-center justify-between gap-3">
          <CardTitleWithTooltip
            title={racePlannerCopy.sections.courseProfile.title}
            description={racePlannerCopy.sections.courseProfile.description}
          />
        </div>
      </CardHeader>
      <CardContent className="-mx-4 -mb-2 px-4 pb-2 sm:-mx-6 sm:px-6">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-[220px] w-full">
            <ElevationProfileChart
              profile={elevationProfile}
              aidStations={parsedValues.success ? parsedValues.data.aidStations : sanitizedWatchedAidStations}
              totalDistanceKm={
                (parsedValues.success ? parsedValues.data.raceDistanceKm : watchedValues?.raceDistanceKm) ??
                defaultValues.raceDistanceKm
              }
              copy={racePlannerCopy}
              baseMinutesPerKm={baseMinutesPerKm}
              uphillEffort={uphillEffort}
              downhillEffort={downhillEffort}
            />
          </div>

          <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-50">{racePlannerCopy.sections.raceInputs.courseTitle}</p>
              <p className="text-xs text-slate-400">{racePlannerCopy.sections.raceInputs.description}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,application/gpx+xml"
                className="hidden"
                onChange={handleImportGpx}
              />
              <Button
                variant="outline"
                type="button"
                className="h-9 px-3 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                {racePlannerCopy.buttons.importGpx}
              </Button>
              <Button type="button" className="h-9 px-3 text-xs" onClick={handleExportGpx}>
                {racePlannerCopy.buttons.exportGpx}
              </Button>
            </div>
            {importError ? <p className="text-xs text-red-400">{importError}</p> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="raceDistanceKm" className="text-xs text-slate-200">
                  {racePlannerCopy.sections.raceInputs.fields.raceDistance}
                </Label>
                <Input
                  id="raceDistanceKm"
                  type="number"
                  step="0.5"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("raceDistanceKm", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="elevationGain" className="text-xs text-slate-200">
                  {racePlannerCopy.sections.raceInputs.fields.elevationGain}
                </Label>
                <Input
                  id="elevationGain"
                  type="number"
                  min="0"
                  step="50"
                  className="border-slate-800/70 bg-slate-950/80 text-sm"
                  {...register("elevationGain", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  const planPrimaryContent = (
    <div className="space-y-6">
      <CommandCenter
        copy={racePlannerCopy}
        sectionIds={{ pacing: sectionIds.pacing, intake: sectionIds.intake }}
        pacing={{
          durationMinutes: pacingOverviewDuration,
          paceMinutes: paceMinutesValue,
          paceSeconds: paceSecondsValue,
          speedKph: speedKphValue,
        }}
        register={register}
        onDurationChange={handleDurationUpdate}
        onPaceChange={handlePaceUpdate}
        onSpeedChange={handleSpeedUpdate}
        formatDuration={(totalMinutes) => formatMinutes(totalMinutes, racePlannerCopy.units)}
      />

      <ActionPlan
        copy={racePlannerCopy}
        segments={segments}
        raceTotals={raceTotals}
        sectionId={sectionIds.timeline}
        onPrint={handlePrint}
        onAddAidStation={handleAddAidStation}
        onRemoveAidStation={remove}
        register={form.register}
        formatDistanceWithUnit={formatDistanceWithUnit}
        formatMinutes={(minutes) => formatMinutes(minutes, racePlannerCopy.units)}
        formatFuelAmount={formatFuelAmount}
        formatWaterAmount={formatWaterAmount}
        formatSodiumAmount={formatSodiumAmount}
        calculatePercentage={calculatePercentage}
        fuelProducts={fuelProductEstimates}
        startSupplies={startSupplies}
        onStartSupplyDrop={handleStartSupplyDrop}
        onStartSupplyRemove={handleStartSupplyRemove}
        onSupplyDrop={handleSupplyDrop}
        onSupplyRemove={handleSupplyRemove}
      />

    </div>
  );

  const renderFuelProductCard = (product: FuelProductEstimate) => (
    <div
      key={product.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/trailplanner-product-id", product.id);
        event.dataTransfer.setData("text/trailplanner-product-qty", "1");
      }}
      className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 shadow-sm transition hover:border-emerald-400/60 hover:shadow-emerald-500/10 active:translate-y-[1px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-50">{product.name}</p>
          <p className="text-sm text-slate-400">
            {racePlannerCopy.sections.gels.nutrition
              .replace("{carbs}", product.carbsGrams.toString())
              .replace("{sodium}", product.sodiumMg.toString())}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm text-slate-200">
        <p>
          {racePlannerCopy.sections.gels.countLabel.replace(
            "{count}",
            Math.max(product.count, 0).toString()
          )}
        </p>
        <p className="text-xs text-slate-500">{product.carbsGrams} g</p>
      </div>
    </div>
  );

  const settingsContent = (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">{racePlannerCopy.sections.raceInputs.title}</CardTitle>
          <div className="flex items-center gap-2">
            {(
              [
                { key: "inputs", label: racePlannerCopy.sections.raceInputs.title },
                { key: "plans", label: racePlannerCopy.account.title },
                { key: "fuel", label: racePlannerCopy.sections.gels.title },
              ] satisfies { key: "inputs" | "plans" | "fuel"; label: string }[]
            ).map((tab) => {
              const isActive = rightPanelTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  className="h-9 px-3 text-sm"
                  aria-pressed={isActive}
                  onClick={() => setRightPanelTab(tab.key)}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className={rightPanelTab === "inputs" ? "space-y-6" : "hidden"}>
          <SettingsPanel
            copy={racePlannerCopy}
            sectionIds={{ inputs: sectionIds.inputs, pacing: sectionIds.pacing, intake: sectionIds.intake }}
            register={form.register}
          />
        </div>

        <div className={rightPanelTab === "plans" ? "space-y-6" : "hidden"}>
          <PlanManager
            copy={racePlannerCopy.account}
            planName={planName}
            planStatus={planStatus}
            accountMessage={accountMessage}
            accountError={accountError}
            savedPlans={savedPlans}
            deletingPlanId={deletingPlanId}
            sessionEmail={session?.email}
            authStatus={authStatus}
            onPlanNameChange={setPlanName}
            onSavePlan={handleSavePlan}
            onRefreshPlans={handleRefreshPlans}
            onLoadPlan={handleLoadPlan}
            onDeletePlan={handleDeletePlan}
          />
        </div>

        <div className={rightPanelTab === "fuel" ? "space-y-6" : "hidden"}>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-100">{racePlannerCopy.sections.gels.title}</p>
              <p className="text-xs text-slate-400">{racePlannerCopy.sections.gels.description}</p>
              {productsStatus === "loading" ? (
                <p className="text-xs text-slate-400">{racePlannerCopy.sections.gels.loading}</p>
              ) : null}
              {productsError ? <p className="text-xs text-red-300">{productsError}</p> : null}
            </div>
            {fuelProductEstimates.length === 0 ? (
              <p className="text-sm text-slate-400">{racePlannerCopy.sections.gels.empty}</p>
            ) : (
              <div className="space-y-4">
                {favoriteProductEstimates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      {racePlannerCopy.sections.gels.favoritesTitle}
                    </p>
                    <div className="space-y-3">
                      {favoriteProductEstimates.map((product) => renderFuelProductCard(product))}
                    </div>
                  </div>
                ) : null}
                {otherProductEstimates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                      {racePlannerCopy.sections.gels.allProductsTitle}
                    </p>
                    <div className="space-y-3">
                      {otherProductEstimates.map((product) => renderFuelProductCard(product))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Script id="software-application-ld" type="application/ld+json" strategy="afterInteractive">
        {JSON.stringify(structuredData)}
      </Script>

      <div className={`space-y-6 ${pagePaddingClass} print:hidden`}>
        {courseProfileSection}

        <RacePlannerLayout
          className="space-y-6"
          planContent={planPrimaryContent}
          settingsContent={settingsContent}
          mobileView={mobileView}
          onMobileViewChange={setMobileView}
          planLabel={racePlannerCopy.sections.summary.title}
          settingsLabel={racePlannerCopy.sections.raceInputs.title}
        />

        {enableMobileNav ? (
          <div className="fixed bottom-4 left-4 right-4 z-30 xl:hidden">
            <div className="rounded-full border border-slate-800 bg-slate-950/90 px-2 py-2 shadow-lg shadow-emerald-500/20 backdrop-blur">
              <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-slate-100">
                {mobileNavActions.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    className="flex items-center justify-center rounded-full px-3 py-2 text-center transition hover:bg-slate-800/80 active:translate-y-[1px]"
                    onClick={action.onClick}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {!isDesktopApp && (
          <Button
            type="button"
            className={`fixed ${feedbackButtonOffsetClass} left-6 z-20 inline-flex h-12 w-12 rounded-full shadow-lg`}
            aria-label={racePlannerCopy.sections.summary.feedback.open}
            onClick={openFeedbackForm}
          >
            <MessageCircleIcon className="h-5 w-5" />
          </Button>
        )}

        {feedbackOpen && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
              <Button
                type="button"
                variant="ghost"
                className="absolute right-2 top-2 h-8 w-8 p-0 text-lg text-slate-200"
                aria-label="Close feedback form"
                onClick={closeFeedbackForm}
              >
                ×
              </Button>
              <div className="mb-4 pr-8">
                <p className="text-lg font-semibold text-slate-50">
                  {racePlannerCopy.sections.summary.feedback.title}
                </p>
              </div>

              <form id="feedback-form" className="space-y-3" onSubmit={handleSubmitFeedback}>
                <div className="space-y-1">
                  <Label htmlFor="feedback-subject">{racePlannerCopy.sections.summary.feedback.subject}</Label>
                  <Input
                    id="feedback-subject"
                    value={feedbackSubject}
                    onChange={(event) => {
                      setFeedbackSubject(event.target.value);
                      setFeedbackStatus("idle");
                      setFeedbackError(null);
                    }}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="feedback-detail">{racePlannerCopy.sections.summary.feedback.detail}</Label>
                  <textarea
                    id="feedback-detail"
                    value={feedbackDetail}
                    onChange={(event) => {
                      setFeedbackDetail(event.target.value);
                      setFeedbackStatus("idle");
                      setFeedbackError(null);
                    }}
                    required
                    className="min-h-[120px] w-full rounded-md border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-50 shadow-sm transition placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                  />
                </div>
                {feedbackError && <p className="text-sm text-red-400">{feedbackError}</p>}
                {feedbackStatus === "success" && !feedbackError && (
                  <p className="text-sm text-emerald-400">{racePlannerCopy.sections.summary.feedback.success}</p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" className="w-full sm:w-auto" disabled={feedbackStatus === "submitting"}>
                    {racePlannerCopy.sections.summary.feedback.submit}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {segments.length > 0 ? (
        <div className="hidden rounded-lg border border-slate-300 bg-white p-4 text-slate-900 shadow-sm print:block">
          <div className="mb-3">
            <p className="text-sm font-semibold">{racePlannerCopy.sections.timeline.printView.title}</p>
            <p className="text-xs text-slate-600">{racePlannerCopy.sections.timeline.printView.description}</p>
          </div>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="min-w-full border-collapse text-xs leading-6">
              <thead className="bg-slate-50 text-slate-900">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">#</th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.from}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.checkpoint}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.distance}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.segment}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.eta}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.segmentTime}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.fuel}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.water}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.sodium}
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2 text-left font-semibold">
                    {racePlannerCopy.sections.timeline.printView.columns.pickup}
                  </th>
                </tr>
              </thead>
              <tbody>
                {segments.map((segment, index) => {
                  const rowBorder = index === segments.length - 1 ? "" : "border-b border-slate-200";
                  return (
                    <tr key={`${segment.checkpoint}-print-${segment.distanceKm}`} className="align-top">
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>{index + 1}</td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div className="font-semibold">{segment.from}</div>
                        <div className="text-[10px] text-slate-600">
                          {formatDistanceWithUnit(segment.startDistanceKm)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2`}>
                        <div className="font-semibold">{segment.checkpoint}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.segmentLabel.replace(
                            "{distance}",
                            segment.segmentKm.toFixed(1)
                          )}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatDistanceWithUnit(segment.distanceKm)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {racePlannerCopy.sections.timeline.segmentDistanceBetween.replace(
                          "{distance}",
                          segment.segmentKm.toFixed(1)
                        )}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatMinutes(segment.etaMinutes, racePlannerCopy.units)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {formatMinutes(segment.segmentMinutes, racePlannerCopy.units)}
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatFuelAmount(segment.plannedFuelGrams)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatFuelAmount(segment.targetFuelGrams)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatWaterAmount(segment.plannedWaterMl)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatWaterAmount(segment.targetWaterMl)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        <div>{formatSodiumAmount(segment.plannedSodiumMg)}</div>
                        <div className="text-[10px] text-slate-600">
                          {racePlannerCopy.sections.timeline.targetLabel}: {formatSodiumAmount(segment.targetSodiumMg)}
                        </div>
                      </td>
                      <td className={`${rowBorder} px-3 py-2 text-slate-700`}>
                        {segment.isFinish ? "–" : segment.pickupGels ?? "–"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

    </>
  );

  }

function ElevationProfileChart({
  profile,
  aidStations,
  totalDistanceKm,
  copy,
  baseMinutesPerKm,
  uphillEffort,
  downhillEffort,
}: {
  profile: ElevationPoint[];
  aidStations: AidStation[];
  totalDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
  uphillEffort: number;
  downhillEffort: number;
}) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setChartWidth(entry.contentRect.width);
    });

    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!profile.length || totalDistanceKm <= 0) {
    return <p className="text-sm text-slate-400">{copy.sections.courseProfile.empty}</p>;
  }

  const width = Math.max(Math.round(chartWidth), 480);
  const paddingX = 20;
  const paddingY = 14;
  const elevationAreaHeight = 150;
  const speedAreaHeight = 80;
  const verticalGap = 20;
  const height = paddingY + elevationAreaHeight + verticalGap + speedAreaHeight + paddingY;
  const elevationBottom = paddingY + elevationAreaHeight;
  const speedTop = elevationBottom + verticalGap;
  const speedBottom = speedTop + speedAreaHeight;
  const maxElevation = Math.max(...profile.map((p) => p.elevationM));
  const minElevation = Math.min(...profile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;
  const trackDistanceKm = Math.max(totalDistanceKm, profile.at(-1)?.distanceKm ?? 0, 1);

  const xScale = (distanceKm: number) =>
    paddingX +
    Math.min(Math.max(distanceKm, 0), trackDistanceKm) * ((width - paddingX * 2) / trackDistanceKm);
  const yScale = (elevation: number) =>
    elevationBottom - ((elevation - minElevation) / elevationRange) * elevationAreaHeight;

  const getElevationAtDistance = (distanceKm: number) => {
    if (profile.length === 0) return minElevation;
    const clamped = Math.min(Math.max(distanceKm, 0), totalDistanceKm);
    const nextIndex = profile.findIndex((point) => point.distanceKm >= clamped);
    if (nextIndex <= 0) return profile[0].elevationM;
    const prevPoint = profile[nextIndex - 1];
    const nextPoint = profile[nextIndex] ?? prevPoint;
    const ratio =
      nextPoint.distanceKm === prevPoint.distanceKm
        ? 0
        : (clamped - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
    return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
  };

  const path = profile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm)},${yScale(point.elevationM)}`)
    .join(" ");

  const areaPath = `${path} L${xScale(profile.at(-1)?.distanceKm ?? 0)},${elevationBottom} L${xScale(
    profile[0].distanceKm
  )},${elevationBottom} Z`;

  const slopeSegments = profile.slice(1).map((point, index) => {
    const prev = profile[index];
    const deltaDistanceKm = Math.max(point.distanceKm - prev.distanceKm, 0.0001);
    const grade = (point.elevationM - prev.elevationM) / (deltaDistanceKm * 1000);

    return {
      x1: xScale(prev.distanceKm),
      y1: yScale(prev.elevationM),
      x2: xScale(point.distanceKm),
      y2: yScale(point.elevationM),
      color: slopeToColor(grade),
    };
  });

  let cumulativeMinutes = 0;
  const speedSamples =
    !baseMinutesPerKm || baseMinutesPerKm <= 0
      ? []
      : profile.slice(1).reduce<SpeedSample[]>((samples, point, index) => {
          const prev = profile[index];
          const segmentKm = Math.max(point.distanceKm - prev.distanceKm, 0);
          if (segmentKm === 0) return samples;

          const ascent = Math.max(point.elevationM - prev.elevationM, 0);
          const descent = Math.max(prev.elevationM - point.elevationM, 0);
          const minutes = adjustedSegmentMinutes(
            baseMinutesPerKm,
            segmentKm,
            { ascent, descent },
            uphillEffort,
            downhillEffort
          );
          if (minutes <= 0) return samples;

          cumulativeMinutes += minutes;
          const cumulativeDistanceKm = point.distanceKm;
          const averageSpeedKph = cumulativeDistanceKm / (cumulativeMinutes / 60);

          return [...samples, { distanceKm: cumulativeDistanceKm, speedKph: averageSpeedKph }];
        }, []);
  const smoothedSpeedSamples = smoothSpeedSamples(speedSamples, 1.6);
  const maxSpeedKph = smoothedSpeedSamples.length > 0 ? Math.max(...smoothedSpeedSamples.map((s) => s.speedKph)) : 0;
  const minSpeedKph = smoothedSpeedSamples.length > 0 ? Math.min(...smoothedSpeedSamples.map((s) => s.speedKph)) : 0;
  const speedRange = Math.max(maxSpeedKph - minSpeedKph, 1);
  const speedYScale = (speedKph: number) =>
    speedBottom - ((speedKph - minSpeedKph) / speedRange) * speedAreaHeight;
  const speedPath = smoothedSpeedSamples
    .map((sample, index) => `${index === 0 ? "M" : "L"}${xScale(sample.distanceKm)},${speedYScale(sample.speedKph)}`)
    .join(" ");

  return (
    <div ref={chartContainerRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[220px] w-full"
        role="img"
        aria-label={copy.sections.courseProfile.ariaLabel}
      >
        <defs>
          <linearGradient id="elevationGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[scaledMin, scaledMax].map((tick) => (
          <g key={tick}>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#1f2937"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={paddingX - 8} y={yScale(tick) + 4} className="fill-slate-400 text-[10px]" textAnchor="end">
              {tick.toFixed(0)} {copy.units.meter}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#elevationGradient)" stroke="none" />
        {slopeSegments.map((segment, index) => (
          <line
            key={`${segment.x1}-${segment.x2}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {smoothedSpeedSamples.length > 1 && speedPath && (
          <>
            <rect
              x={paddingX}
              y={speedTop - 10}
              width={width - paddingX * 2}
              height={speedAreaHeight + 20}
              rx={10}
              className="fill-slate-900/40"
            />
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={speedBottom}
              y2={speedBottom}
              stroke="#0f172a"
              strokeWidth={1}
            />
            <path
              d={speedPath}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_1px_4px_rgba(34,211,238,0.3)]"
            />
            <g>
              <rect
                x={width - paddingX - 140}
                y={speedTop}
                width={120}
                height={20}
                rx={4}
                className="fill-slate-900/70"
              />
              <text
                x={width - paddingX - 80}
                y={speedTop + 14}
                className="fill-cyan-200 text-[10px]"
                textAnchor="middle"
              >
                {`${copy.sections.courseProfile.speedLabel} (${copy.sections.courseProfile.speedUnit})`}
              </text>
            </g>
            <text
              x={width - paddingX}
              y={speedYScale(maxSpeedKph) - 4}
              className="fill-cyan-100 text-[10px]"
              textAnchor="end"
            >
              {`${maxSpeedKph.toFixed(1)} ${copy.sections.courseProfile.speedUnit}`}
            </text>
            <text
              x={width - paddingX}
              y={speedYScale(minSpeedKph) + 12}
              className="fill-cyan-100 text-[10px]"
              textAnchor="end"
            >
              {`${minSpeedKph.toFixed(1)} ${copy.sections.courseProfile.speedUnit}`}
            </text>
          </>
        )}

        {aidStations.map((station) => {
          const x = xScale(station.distanceKm);
          const elevationAtPoint = getElevationAtDistance(station.distanceKm);
          const y = yScale(elevationAtPoint);
          return (
            <g key={`${station.name}-${station.distanceKm}`}>
              <line x1={x} x2={x} y1={y} y2={elevationBottom} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="2 3" />
              <circle cx={x} cy={y} r={4} fill="#fbbf24" />
              <text x={x} y={elevationBottom + 12} className="fill-slate-300 text-[10px]" textAnchor="middle">
                {station.name}
              </text>
            </g>
          );
        })}

        <text
          x={width / 2}
          y={height - 4}
          className="fill-slate-400 text-[10px]"
          textAnchor="middle"
        >
          {copy.sections.courseProfile.axisLabel}
        </text>
      </svg>
    </div>
  );
}
