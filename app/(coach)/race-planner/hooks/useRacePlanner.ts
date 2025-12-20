"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type React from "react";

import { useProductSelection } from "../../hooks/useProductSelection";
import { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_EMAIL_KEY } from "../../../lib/auth-storage";
import { MAX_SELECTED_PRODUCTS } from "../../../lib/product-preferences";
import type { FuelProduct } from "../../../lib/product-types";
import { RACE_PLANNER_URL } from "../../seo";
import type { RacePlannerTranslations } from "../../../locales/types";
import { useAffiliateEventLogger, useAffiliateSessionId } from "./useAffiliateEvents";
import type { AidStation, ElevationPoint, FormValues, Segment, SpeedSample } from "../types";

export type RaceTotals = {
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
  durationMinutes: number;
};

export type SavedPlan = {
  id: string;
  name: string;
  updatedAt: string;
  plannerValues: Partial<FormValues>;
  elevationProfile: ElevationPoint[];
};

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
  },
];

const formatAidStationName = (template: string, index: number) => template.replace("{index}", String(index));

const createAidStationSchema = (validation: RacePlannerTranslations["validation"]) =>
  z.object({
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
      aidStations: z.array(createAidStationSchema(copy.validation)).min(1, copy.validation.aidStationMin),
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
  aidStations: [
    { name: formatAidStationName(copy.defaults.aidStationName, 1), distanceKm: 10 },
    { name: formatAidStationName(copy.defaults.aidStationName, 2), distanceKm: 20 },
    { name: formatAidStationName(copy.defaults.aidStationName, 3), distanceKm: 30 },
    { name: formatAidStationName(copy.defaults.aidStationName, 4), distanceKm: 40 },
    { name: copy.defaults.finalBottles, distanceKm: 45 },
  ],
});

const minutesPerKm = (values: FormValues) => {
  if (values.paceType === "speed") {
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
};

const paceToSpeedKph = (paceMinutes: number, paceSeconds: number) => {
  const totalMinutes = paceMinutes + paceSeconds / 60;
  if (totalMinutes <= 0) return null;
  return 60 / totalMinutes;
};

const speedToPace = (speedKph: number) => {
  if (speedKph <= 0) return null;
  const totalMinutes = 60 / speedKph;
  const minutes = Math.floor(totalMinutes);
  let seconds = Math.round((totalMinutes - minutes) * 60);
  if (seconds === 60) {
    return { minutes: minutes + 1, seconds: 0 };
  }
  return { minutes, seconds };
};

const getElevationAtDistance = (profile: ElevationPoint[], distanceKm: number) => {
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
};

const calculateSegmentElevation = (
  profile: ElevationPoint[],
  startKm: number,
  endKm: number,
  totalElevationGain: number,
  raceDistanceKm: number
) => {
  const segmentKm = Math.max(0, endKm - startKm);
  if (segmentKm === 0) return { ascent: 0, descent: 0 };

  if (profile.length < 2) {
    const distanceShare = raceDistanceKm > 0 ? segmentKm / raceDistanceKm : 0;
    const ascent = Math.max(0, totalElevationGain * distanceShare);
    const descent = ascent;
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
};

const adjustedSegmentMinutes = (
  baseMinutesPerKm: number,
  segmentKm: number,
  elevation: { ascent: number; descent: number },
  uphillEffort: number,
  downhillEffort: number
) => {
  if (segmentKm === 0) return 0;

  const ascentPerKm = elevation.ascent / (segmentKm * 1000);
  const descentPerKm = elevation.descent / (segmentKm * 1000);
  const normalizedUphillSteepness = Math.min(ascentPerKm / 0.12, 1);
  const normalizedDownhillSteepness = Math.min(descentPerKm / 0.12, 1);
  const uphillIntensity = 1.35 - (uphillEffort / 100) * 0.7;
  const downhillIntensity = 0.5 + (downhillEffort / 100) * 0.9;
  const uphillPenalty = ascentPerKm * 10 * uphillIntensity * (1 - 0.35 * normalizedUphillSteepness);
  const downhillBenefit = descentPerKm * 6 * downhillIntensity * (1 - 0.3 * normalizedDownhillSteepness);
  const adjustmentFactor = 1 + uphillPenalty - downhillBenefit;
  const safeAdjustment = Math.min(Math.max(0.6, adjustmentFactor), 1.6);

  return segmentKm * baseMinutesPerKm * safeAdjustment;
};

const slopeToColor = (grade: number) => {
  const clamped = Math.max(-0.25, Math.min(0.25, grade));
  const t = (clamped + 0.25) / 0.5;
  const start = { r: 59, g: 130, b: 246 };
  const end = { r: 239, g: 68, b: 68 };
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);

  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
};

const smoothSpeedSamples = (samples: SpeedSample[], windowKm = 0.75): SpeedSample[] => {
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
};

const buildSegments = (
  values: FormValues,
  finishLabel: string,
  elevationProfile: ElevationPoint[]
): Segment[] => {
  const minPerKm = minutesPerKm(values);
  const stations = [...values.aidStations].sort((a, b) => a.distanceKm - b.distanceKm);
  const checkpoints = [...stations.filter((s) => s.distanceKm < values.raceDistanceKm)];
  checkpoints.push({ name: finishLabel, distanceKm: values.raceDistanceKm });

  let elapsedMinutes = 0;
  let previousDistance = 0;

  return checkpoints.map((station) => {
    const segmentKm = Math.max(0, station.distanceKm - previousDistance);
    const elevation = calculateSegmentElevation(
      elevationProfile,
      previousDistance,
      station.distanceKm,
      values.elevationGain,
      values.raceDistanceKm
    );
    const segmentMinutes = adjustedSegmentMinutes(
      minPerKm,
      segmentKm,
      elevation,
      values.uphillEffort,
      values.downhillEffort
    );
    elapsedMinutes += segmentMinutes;
    const fuelGrams = (segmentMinutes / 60) * values.targetIntakePerHour;
    const waterMl = (segmentMinutes / 60) * values.waterIntakePerHour;
    const sodiumMg = (segmentMinutes / 60) * values.sodiumIntakePerHour;
    const segment: Segment = {
      checkpoint: station.name,
      distanceKm: station.distanceKm,
      segmentKm,
      etaMinutes: elapsedMinutes,
      segmentMinutes,
      fuelGrams,
      waterMl,
      sodiumMg,
    };
    previousDistance = station.distanceKm;
    return segment;
  });
};

const sanitizeAidStations = (stations?: { name?: string; distanceKm?: number }[]): AidStation[] => {
  if (!stations?.length) return [];

  return stations.filter((station): station is AidStation => {
    return typeof station?.name === "string" && typeof station?.distanceKm === "number";
  });
};

const dedupeAidStations = (stations: AidStation[]): AidStation[] =>
  stations
    .filter(
      (station, index, self) =>
        index === self.findIndex((s) => s.name === station.name && Math.abs(s.distanceKm - station.distanceKm) < 0.01)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

const sanitizePlannerValues = (values?: Partial<FormValues>): Partial<FormValues> | undefined => {
  if (!values) return undefined;

  const paceType = values.paceType === "speed" ? "speed" : "pace";
  const aidStations = sanitizeAidStations(values.aidStations);

  return {
    ...values,
    paceType,
    aidStations,
  };
};

const sanitizeElevationProfile = (profile?: ElevationPoint[]): ElevationPoint[] => {
  if (!profile?.length) return [];

  return profile
    .map((point) => {
      const distanceKm = Number(point.distanceKm);
      const elevationM = Number(point.elevationM);
      if (!Number.isFinite(distanceKm) || !Number.isFinite(elevationM)) return null;
      return { distanceKm, elevationM };
    })
    .filter((point): point is ElevationPoint => Boolean(point));
};

type PlannerStatePayload = {
  version?: number;
  values?: Partial<FormValues>;
  elevationProfile?: ElevationPoint[];
};

const decodePlannerState = (xml: Document): { state: PlannerStatePayload | null; invalid: boolean } => {
  const stateNode = xml.getElementsByTagName("trailplanner:state")[0] ?? xml.getElementsByTagName("plannerState")[0];
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
};

const mapSavedPlan = (row: Record<string, unknown>): SavedPlan | null => {
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
};

const encodePlannerState = (values: FormValues, elevationProfile: ElevationPoint[]): string => {
  const payload: PlannerStatePayload = {
    version: 1,
    values,
    elevationProfile,
  };

  const json = JSON.stringify(payload);
  return btoa(unescape(encodeURIComponent(json)));
};

const buildFlatElevationProfile = (distanceKm: number): ElevationPoint[] => {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return [];

  return [
    { distanceKm: 0, elevationM: 0 },
    { distanceKm: Number(distanceKm.toFixed(2)), elevationM: 0 },
  ];
};

const buildPlannerGpx = (values: FormValues, elevationProfile: ElevationPoint[]) => {
  const safeAidStations = sanitizeAidStations(values.aidStations);
  const distanceKm = Number.isFinite(values.raceDistanceKm) ? values.raceDistanceKm : 0;
  const profile = elevationProfile.length > 0 ? elevationProfile : buildFlatElevationProfile(distanceKm);
  const plannerState = encodePlannerState({ ...values, aidStations: safeAidStations }, profile);

  const escapeXml = (text: string) =>
    text.replace(/[&<>"']/g, (char) => {
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
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const haversineDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const parseGpx = (content: string, copy: RacePlannerTranslations) => {
  const parser = new DOMParser();
  const xml = parser.parseFromString(content, "text/xml");
  const { state: plannerState, invalid } = decodePlannerState(xml);
  if (invalid) {
    throw new Error(copy.gpx.errors.invalidPlannerState);
  }

  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  let parsedTrack: Omit<{ distanceKm: number; aidStations: AidStation[]; elevationProfile: ElevationPoint[] }, "plannerValues"> | null =
    null;
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
      .filter(Boolean) as AidStation[];

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
  const baseDistance = sanitizedPlannerValues?.raceDistanceKm ?? parsedTrack?.distanceKm ?? (distanceFromProfile ?? 0) ?? 0;

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
};

const formatMinutes = (totalMinutes: number, units: RacePlannerTranslations["units"]) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}${units.hourShort} ${minutes.toString().padStart(2, "0")}${units.minuteShort}`;
};

export const useRacePlanner = (copy: RacePlannerTranslations) => {
  const structuredData = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: copy.homeHero.heading,
      description: copy.homeHero.description,
      url: RACE_PLANNER_URL,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    }),
    [copy.homeHero.description, copy.homeHero.heading]
  );

  const formSchema = useMemo(() => createFormSchema(copy), [copy]);
  const defaultValues = useMemo(() => buildDefaultValues(copy), [copy]);
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<FormValues>({ resolver, defaultValues, mode: "onChange" });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "aidStations" });
  const watchedValues = useWatch({ control: form.control, defaultValue: defaultValues });
  const paceType = form.watch("paceType");
  const uphillEffort = form.watch("uphillEffort") ?? defaultValues.uphillEffort;
  const downhillEffort = form.watch("downhillEffort") ?? defaultValues.downhillEffort;

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
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"idle" | "signingIn" | "signingUp" | "checking">("idle");
  const [planStatus, setPlanStatus] = useState<"idle" | "saving">("idle");
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [activeAffiliateProduct, setActiveAffiliateProduct] = useState<{ slug: string; name: string } | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);

  const { selectedProducts, toggleProduct, replaceSelection } = useProductSelection();
  const affiliateSessionId = useAffiliateSessionId();
  const affiliateLogger = useAffiliateEventLogger({ accessToken: session?.accessToken });

  useEffect(() => {
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
    const isElectron = userAgent.includes("electron");
    const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches;

    setIsDesktopApp(isElectron || Boolean(isStandalone));
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const locale = navigator.language ?? "";
    const parts = locale.split("-");
    const inferredCountry = parts.length > 1 ? parts[1]?.toUpperCase() : null;
    if (inferredCountry) {
      setCountryCode(inferredCountry);
    }
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
  }, []);

  const refreshSavedPlans = useCallback(
    async (accessToken: string) => {
      try {
        const response = await fetch("/api/plans", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });

        if (!response.ok) {
          setAccountError(copy.account.errors.fetchFailed);
          return;
        }

        const data = (await response.json()) as { plans?: Record<string, unknown>[] };
        const parsedPlans = (data.plans ?? [])
          .map((plan) => mapSavedPlan(plan))
          .filter((plan): plan is SavedPlan => Boolean(plan));
        setSavedPlans(parsedPlans);
      } catch (error) {
        console.error("Unable to fetch saved plans", error);
        setAccountError(copy.account.errors.fetchFailed);
      }
    },
    [copy.account.errors.fetchFailed]
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
        setAccountMessage(copy.account.messages.signedIn);
        await refreshSavedPlans(accessToken);
      } catch (error) {
        console.error("Unable to verify session", error);
        clearSession();
      } finally {
        setAuthStatus("idle");
      }
    },
    [clearSession, copy.account.messages.signedIn, persistSession, refreshSavedPlans]
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

  const sanitizedWatchedAidStations = sanitizeAidStations(watchedValues?.aidStations);

  const parsedValues = useMemo(() => formSchema.safeParse(watchedValues), [formSchema, watchedValues]);
  const segments = useMemo(
    () => (parsedValues.success ? buildSegments(parsedValues.data, copy.defaults.finish, elevationProfile) : []),
    [copy.defaults.finish, elevationProfile, parsedValues]
  );
  const baseMinutesPerKm = useMemo(
    () => (parsedValues.success ? minutesPerKm(parsedValues.data) : null),
    [parsedValues]
  );

  const raceTotals = useMemo(() => {
    if (!parsedValues.success || segments.length === 0) return null;

    return segments.reduce(
      (totals, segment) => ({
        fuelGrams: totals.fuelGrams + segment.fuelGrams,
        waterMl: totals.waterMl + segment.waterMl,
        sodiumMg: totals.sodiumMg + segment.sodiumMg,
        durationMinutes: totals.durationMinutes + segment.segmentMinutes,
      }),
      { fuelGrams: 0, waterMl: 0, sodiumMg: 0, durationMinutes: 0 }
    );
  }, [parsedValues.success, segments]);

  const customFuelProducts = useMemo<FuelProduct[]>(
    () =>
      selectedProducts.map((product) => ({
        id: product.id,
        slug: product.slug,
        sku: product.sku ?? product.slug,
        name: product.name,
        productUrl: product.productUrl ?? undefined,
        caloriesKcal: product.caloriesKcal ?? 0,
        carbsGrams: product.carbsGrams,
        sodiumMg: product.sodiumMg ?? 0,
        proteinGrams: 0,
        fatGrams: 0,
      })),
    [selectedProducts]
  );

  const fuelProducts = useMemo<FuelProduct[]>(
    () => (customFuelProducts.length > 0 ? customFuelProducts.slice(0, MAX_SELECTED_PRODUCTS) : defaultFuelProducts),
    [customFuelProducts]
  );

  const selectedProductSlugs = useMemo(() => selectedProducts.map((product) => product.slug), [selectedProducts]);

  const productEstimates = useMemo(
    () =>
      raceTotals
        ? fuelProducts.map((product) => ({
            ...product,
            count: product.carbsGrams > 0 ? Math.ceil(raceTotals.fuelGrams / product.carbsGrams) : 0,
          }))
        : [],
    [fuelProducts, raceTotals]
  );

  const intakeTargets = useMemo(
    () => ({
      carbsPerHour: parsedValues.success ? parsedValues.data.targetIntakePerHour : null,
      waterPerHour: parsedValues.success ? parsedValues.data.waterIntakePerHour : null,
      sodiumPerHour: parsedValues.success ? parsedValues.data.sodiumIntakePerHour : null,
    }),
    [parsedValues]
  );

  const isUsingCustomProducts = customFuelProducts.length > 0;

  const formatDistanceWithUnit = (value: number) => `${value.toFixed(1)} ${copy.sections.timeline.distanceWithUnit}`;
  const formatFuelAmount = (value: number) => copy.sections.timeline.fuelLabel.replace("{amount}", value.toFixed(0));
  const formatWaterAmount = (value: number) =>
    copy.sections.timeline.waterLabel.replace("{amount}", value.toFixed(0));
  const formatSodiumAmount = (value: number) =>
    copy.sections.timeline.sodiumLabel.replace("{amount}", value.toFixed(0));

  const calculatePercentage = (value: number, total?: number) => {
    if (!total || total <= 0) return 0;
    return Math.min((value / total) * 100, 100);
  };

  const handleViewProduct = (product: { slug: string; name: string }) => {
    setActiveAffiliateProduct({ slug: product.slug, name: product.name });
  };

  const toggleProductSelection = (product: FuelProduct) => {
    toggleProduct(product);
  };

  const focusSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ block: "start" });
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
      setAccountError(copy.account.errors.missingSession);
      return;
    }

    if (!parsedValues.success) {
      setAccountError(copy.account.errors.saveFailed);
      return;
    }

    setPlanStatus("saving");

    try {
      const payload = {
        name: planName.trim() || copy.account.plans.defaultName,
        plannerValues: parsedValues.data,
        elevationProfile: sanitizeElevationProfile(elevationProfile),
      };

      const response = await fetch("/api/plans", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as {
        plan?: Record<string, unknown> | null;
        message?: string;
      };

      if (!response.ok || !data?.plan) {
        setAccountError(data?.message ?? copy.account.errors.saveFailed);
        return;
      }

      const parsedPlan = mapSavedPlan(data.plan);

      if (parsedPlan) {
        setSavedPlans((previous) => [parsedPlan, ...previous.filter((plan) => plan.id !== parsedPlan.id)]);
        setPlanName(parsedPlan.name);
      }

      setAccountMessage(copy.account.messages.savedPlan);
    } catch (error) {
      console.error("Unable to save plan", error);
      setAccountError(copy.account.errors.saveFailed);
    } finally {
      setPlanStatus("idle");
    }
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    const sanitizedAidStations = sanitizeAidStations(plan.plannerValues.aidStations) ?? [];
    const aidStations = sanitizedAidStations.length > 0 ? dedupeAidStations(sanitizedAidStations) : defaultValues.aidStations;

    const mergedValues: FormValues = {
      ...defaultValues,
      ...plan.plannerValues,
      aidStations,
    };

    form.reset(mergedValues, { keepDefaultValues: true });
    setElevationProfile(plan.elevationProfile);
    setPlanName(plan.name);
    setAccountMessage(copy.account.messages.loadedPlan);
  };

  const handleDeletePlan = async (planId: string) => {
    setAccountError(null);
    setAccountMessage(null);

    if (!session?.accessToken) {
      setAccountError(copy.account.errors.missingSession);
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
        setAccountError(data?.message ?? copy.account.errors.deleteFailed);
        return;
      }

      setSavedPlans((previous) => previous.filter((plan) => plan.id !== planId));
      setAccountMessage(copy.account.messages.deletedPlan);
    } catch (error) {
      console.error("Unable to delete plan", error);
      setAccountError(copy.account.errors.deleteFailed);
    } finally {
      setDeletingPlanId(null);
    }
  };

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsedGpx = parseGpx(content, copy);
      const fallbackDistance = parsedGpx.distanceKm || defaultValues.raceDistanceKm;
      const fallbackStations =
        parsedGpx.aidStations.length > 0
          ? parsedGpx.aidStations
          : [{ name: copy.defaults.finish, distanceKm: Number(fallbackDistance.toFixed(1)) }];

      if (parsedGpx.plannerValues) {
        const plannerAidStations = sanitizeAidStations(parsedGpx.plannerValues.aidStations);
        const mergedAidStations = plannerAidStations.length > 0 ? plannerAidStations : fallbackStations;
        const mergedValues: FormValues = {
          ...defaultValues,
          ...parsedGpx.plannerValues,
          raceDistanceKm: parsedGpx.plannerValues.raceDistanceKm ?? fallbackDistance,
          aidStations: mergedAidStations,
        };
        form.reset(mergedValues, { keepDefaultValues: true });
      } else {
        form.setValue("raceDistanceKm", Number(fallbackDistance.toFixed(1)));
        form.setValue("aidStations", fallbackStations);
      }

      setElevationProfile(parsedGpx.elevationProfile);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : copy.gpx.errors.unableToImport);
    } finally {
      event.target.value = "";
    }
  };

  const handleExportGpx = () => {
    const currentValues = form.getValues();
    const sanitizedStations = sanitizeAidStations(currentValues.aidStations);
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
          : [{ name: copy.defaults.finish, distanceKm: Number(raceDistanceKm.toFixed(1)) }],
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

  const handlePaceTypeChange = (nextType: FormValues["paceType"]) => {
    const currentType = form.getValues("paceType");
    if (currentType === nextType) return;

    if (nextType === "speed") {
      const currentMinutes = form.getValues("paceMinutes") ?? 0;
      const currentSeconds = form.getValues("paceSeconds") ?? 0;
      const convertedSpeed = paceToSpeedKph(currentMinutes, currentSeconds);
      const fallbackSpeed = form.getValues("speedKph") ?? defaultValues.speedKph;
      const nextSpeed = convertedSpeed ?? fallbackSpeed;
      form.setValue("speedKph", Number(nextSpeed.toFixed(2)), { shouldDirty: true, shouldValidate: true });
    } else {
      const currentSpeed = form.getValues("speedKph") ?? 0;
      const convertedPace = speedToPace(currentSpeed);
      if (convertedPace) {
        form.setValue("paceMinutes", convertedPace.minutes, { shouldDirty: true, shouldValidate: true });
        form.setValue("paceSeconds", convertedPace.seconds, { shouldDirty: true, shouldValidate: true });
      }
    }

    form.setValue("paceType", nextType, { shouldDirty: true, shouldValidate: true });
  };

  const handleAddAidStation = useCallback(() => {
    append({ name: formatAidStationName(copy.defaults.aidStationName, fields.length + 1), distanceKm: 0 });
  }, [append, copy.defaults.aidStationName, fields.length]);

  const handleImportFromMobileNav = () => {
    const input = fileInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.click();
    }
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
      setFeedbackError(copy.sections.summary.feedback.required);
      return;
    }

    try {
      setFeedbackStatus("submitting");
      setFeedbackError(null);

      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, detail }),
      });

      const payload = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        setFeedbackStatus("error");
        setFeedbackError(payload?.message ?? copy.sections.summary.feedback.error);
        return;
      }

      setFeedbackStatus("success");
      setFeedbackSubject("");
      setFeedbackDetail("");
    } catch (error) {
      console.error("Unable to send feedback", error);
      setFeedbackStatus("error");
      setFeedbackError(copy.sections.summary.feedback.error);
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

  const gelEstimates = useMemo(() => productEstimates, [productEstimates]);

  return {
    structuredData,
    form,
    fields,
    removeAidStation: remove,
    addAidStation: handleAddAidStation,
    watchedValues,
    paceType,
    importError,
    fileInputRef,
    handleImportGpx,
    handleExportGpx,
    handlePaceTypeChange,
    parsedValues,
    segments,
    raceTotals,
    baseMinutesPerKm,
    elevationProfile,
    setElevationProfile,
    sanitizedWatchedAidStations,
    formatMinutes: (minutes: number) => formatMinutes(minutes, copy.units),
    formatDistanceWithUnit,
    formatFuelAmount,
    formatWaterAmount,
    formatSodiumAmount,
    calculatePercentage,
    intakeTargets,
    productEstimates,
    gelEstimates,
    isUsingCustomProducts,
    handlePrint,
    handleImportFromMobileNav,
    handleSubmitFeedback,
    feedbackState: {
      open: feedbackOpen,
      subject: feedbackSubject,
      detail: feedbackDetail,
      status: feedbackStatus,
      error: feedbackError,
    },
    setFeedbackSubject,
    setFeedbackDetail,
    openFeedbackForm,
    closeFeedbackForm,
    isDesktopApp,
    planName,
    setPlanName,
    session,
    accountMessage,
    accountError,
    authStatus,
    planStatus,
    savedPlans,
    deletingPlanId,
    refreshSavedPlans,
    handleSavePlan,
    handleLoadPlan,
    handleDeletePlan,
    handleSignOut,
    activeAffiliateProduct,
    setActiveAffiliateProduct,
    handleViewProduct,
    toggleProductSelection,
    selectedProducts,
    selectedProductSlugs,
    replaceSelection,
    affiliateSessionId,
    affiliateLogger,
    countryCode,
    focusSection,
  };
};

export { slopeToColor, smoothSpeedSamples, adjustedSegmentMinutes };
