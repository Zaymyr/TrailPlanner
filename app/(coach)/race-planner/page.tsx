"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../i18n-provider";
import React, { useMemo, useRef, useState } from "react";
import type { RacePlannerTranslations } from "../../../locales/types";

type AidStation = { name: string; distanceKm: number };

type FormValues = {
  raceDistanceKm: number;
  elevationGain: number;
  paceType: "pace" | "speed";
  paceMinutes: number;
  paceSeconds: number;
  speedKph: number;
  uphillEffort: number;
  downhillEffort: number;
  targetIntakePerHour: number;
  waterIntakePerHour: number;
  sodiumIntakePerHour: number;
  aidStations: AidStation[];
};

type Segment = {
  checkpoint: string;
  distanceKm: number;
  segmentKm: number;
  etaMinutes: number;
  segmentMinutes: number;
  fuelGrams: number;
  waterMl: number;
  sodiumMg: number;
};

type ElevationPoint = { distanceKm: number; elevationM: number };
type SpeedSample = { distanceKm: number; speedKph: number };
type GelOption = { name: string; carbs: number; sodium: number; url: string };

const gelOptions: GelOption[] = [
  {
    name: "Maurten Gel 100",
    carbs: 25,
    sodium: 85,
    url: "https://www.maurten.com/products/gel-100",
  },
  {
    name: "GU Energy Gel",
    carbs: 22,
    sodium: 60,
    url: "https://guenergy.com/products/energy-gel",
  },
  {
    name: "SIS GO Isotonic Gel",
    carbs: 22,
    sodium: 10,
    url: "https://www.scienceinsport.com/products/go-isotonic-energy-gel",
  },
];

type ParsedGpx = {
  distanceKm: number;
  aidStations: AidStation[];
  elevationProfile: ElevationPoint[];
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
  aidStations: [
    { name: formatAidStationName(copy.defaults.aidStationName, 1), distanceKm: 10 },
    { name: formatAidStationName(copy.defaults.aidStationName, 2), distanceKm: 20 },
    { name: formatAidStationName(copy.defaults.aidStationName, 3), distanceKm: 30 },
    { name: formatAidStationName(copy.defaults.aidStationName, 4), distanceKm: 40 },
    { name: copy.defaults.finalBottles, distanceKm: 45 },
  ],
});

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

function minutesPerKm(values: FormValues) {
  if (values.paceType === "speed") {
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
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
    return { ascent: Math.max(0, totalElevationGain * distanceShare), descent: 0 };
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
  const uphillIntensity = 0.6 + (uphillEffort / 100) * 0.9; // 0.6x to 1.5x
  const downhillIntensity = 0.4 + (downhillEffort / 100) * 0.9; // 0.4x to 1.3x
  const uphillPenalty = ascentPerKm * 10 * uphillIntensity * (1 - 0.4 * normalizedUphillSteepness);
  const downhillBenefit = descentPerKm * 6 * downhillIntensity * (1 - 0.35 * normalizedDownhillSteepness);
  const adjustmentFactor = 1 + uphillPenalty - downhillBenefit;
  const safeAdjustment = Math.min(Math.max(0.65, adjustmentFactor), 1.6);

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

function buildSegments(values: FormValues, finishLabel: string, elevationProfile: ElevationPoint[]): Segment[] {
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
}

function sanitizeAidStations(stations?: { name?: string; distanceKm?: number }[]): AidStation[] {
  if (!stations?.length) return [];

  return stations.filter((station): station is AidStation => {
    return typeof station?.name === "string" && typeof station?.distanceKm === "number";
  });
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
  const trkpts = Array.from(xml.getElementsByTagName("trkpt"));

  if (trkpts.length === 0) {
    throw new Error(copy.gpx.errors.noTrackPoints);
  }

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

  const uniqueStations = aidStations
    .filter((station, index, self) =>
      index === self.findIndex((s) => s.name === station.name && Math.abs(s.distanceKm - station.distanceKm) < 0.01)
    )
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const elevationProfile: ElevationPoint[] = cumulativeTrack.map((point) => ({
    distanceKm: Number((point.distance / 1000).toFixed(2)),
    elevationM: Number(point.elevation.toFixed(1)),
  }));

  return {
    distanceKm: Number((totalMeters / 1000).toFixed(1)),
    aidStations: uniqueStations,
    elevationProfile,
  };
}

export default function RacePlannerPage() {
  const { t } = useI18n();
  const racePlannerCopy = t.racePlanner;

  const formSchema = useMemo(() => createFormSchema(racePlannerCopy), [racePlannerCopy]);
  const defaultValues = useMemo(() => buildDefaultValues(racePlannerCopy), [racePlannerCopy]);
  const resolver = useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<FormValues>({
    resolver,
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "aidStations" });
  const watchedValues = useWatch({ control: form.control, defaultValue: defaultValues });
  const paceType = form.watch("paceType");
  const uphillEffort = form.watch("uphillEffort") ?? defaultValues.uphillEffort;
  const downhillEffort = form.watch("downhillEffort") ?? defaultValues.downhillEffort;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([]);
  const sanitizedWatchedAidStations = sanitizeAidStations(watchedValues?.aidStations);

  const parsedValues = useMemo(() => formSchema.safeParse(watchedValues), [formSchema, watchedValues]);
  const segments = useMemo(
    () =>
      parsedValues.success
        ? buildSegments(parsedValues.data, racePlannerCopy.defaults.finish, elevationProfile)
        : [],
    [elevationProfile, parsedValues, racePlannerCopy.defaults.finish]
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

  const gelEstimates = useMemo(
    () =>
      raceTotals
        ? gelOptions.map((gel) => ({
            ...gel,
            count: raceTotals.fuelGrams > 0 ? Math.ceil(raceTotals.fuelGrams / gel.carbs) : 0,
          }))
        : [],
    [raceTotals]
  );

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

  const handleImportGpx = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsedGpx = parseGpx(content, racePlannerCopy);
      form.setValue("raceDistanceKm", Number(parsedGpx.distanceKm.toFixed(1)));
      form.setValue(
        "aidStations",
        parsedGpx.aidStations.length > 0
          ? parsedGpx.aidStations
          : [{ name: racePlannerCopy.defaults.finish, distanceKm: Number(parsedGpx.distanceKm.toFixed(1)) }]
      );
      setElevationProfile(parsedGpx.elevationProfile);
      setImportError(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : racePlannerCopy.gpx.errors.unableToImport);
    } finally {
      event.target.value = "";
    }
  };

    return (
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-4">
          <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader>
                <CardTitle>{racePlannerCopy.sections.summary.title}</CardTitle>
                <CardDescription>{racePlannerCopy.sections.summary.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {raceTotals ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{racePlannerCopy.sections.summary.items.duration}</p>
                      <p className="text-2xl font-semibold text-slate-50">
                        {formatMinutes(raceTotals.durationMinutes, racePlannerCopy.units)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{racePlannerCopy.sections.summary.items.carbs}</p>
                      <p className="text-2xl font-semibold text-slate-50">
                        {raceTotals.fuelGrams.toFixed(0)} {racePlannerCopy.units.grams}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{racePlannerCopy.sections.summary.items.water}</p>
                      <p className="text-2xl font-semibold text-slate-50">
                        {raceTotals.waterMl.toFixed(0)} {racePlannerCopy.units.milliliters}
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                      <p className="text-sm text-slate-400">{racePlannerCopy.sections.summary.items.sodium}</p>
                      <p className="text-2xl font-semibold text-slate-50">
                        {raceTotals.sodiumMg.toFixed(0)} {racePlannerCopy.units.milligrams}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">{racePlannerCopy.sections.summary.empty}</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 xl:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{racePlannerCopy.sections.courseProfile.title}</CardTitle>
                    <CardDescription>{racePlannerCopy.sections.courseProfile.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{racePlannerCopy.sections.gels.title}</CardTitle>
                <CardDescription>{racePlannerCopy.sections.gels.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {!raceTotals ? (
                  <p className="text-sm text-slate-400">{racePlannerCopy.sections.gels.empty}</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {gelEstimates.map((gel) => (
                      <div
                        key={gel.name}
                        className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-50">{gel.name}</p>
                            <p className="text-sm text-slate-400">
                              {racePlannerCopy.sections.gels.nutrition
                                .replace("{carbs}", gel.carbs.toString())
                                .replace("{sodium}", gel.sodium.toString())}
                            </p>
                          </div>
                          <a
                            href={gel.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-emerald-300 hover:text-emerald-200"
                          >
                            {racePlannerCopy.sections.gels.linkLabel}
                          </a>
                        </div>
                        <div className="flex items-center justify-between text-sm text-slate-200">
                          <p>
                            {racePlannerCopy.sections.gels.countLabel.replace(
                              "{count}",
                              Math.max(gel.count, 0).toString()
                            )}
                          </p>
                          <p className="text-xs text-slate-500">{gel.carbs} g</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle>{racePlannerCopy.sections.aidStations.title}</CardTitle>
                    <CardDescription>{racePlannerCopy.sections.aidStations.description}</CardDescription>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      append({
                        name: formatAidStationName(racePlannerCopy.defaults.aidStationName, fields.length + 1),
                        distanceKm: 0,
                      })
                    }
                  >
                    {racePlannerCopy.sections.aidStations.add}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1.2fr,0.8fr,auto] items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`aidStations.${index}.name`}>
                          {racePlannerCopy.sections.aidStations.labels.name}
                        </Label>
                        <Input
                          id={`aidStations.${index}.name`}
                          type="text"
                          {...form.register(`aidStations.${index}.name` as const)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`aidStations.${index}.distanceKm`}>
                          {racePlannerCopy.sections.aidStations.labels.distance}
                        </Label>
                        <Input
                          id={`aidStations.${index}.distanceKm`}
                          type="number"
                          step="0.5"
                          className="max-w-[140px]"
                          {...form.register(`aidStations.${index}.distanceKm` as const, { valueAsNumber: true })}
                        />
                      </div>
                      <Button type="button" variant="ghost" onClick={() => remove(index)}>
                        {racePlannerCopy.sections.aidStations.remove}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{racePlannerCopy.sections.timeline.title}</CardTitle>
                  <CardDescription>{racePlannerCopy.sections.timeline.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {segments.length === 0 ? (
                    <p className="text-sm text-slate-400">{racePlannerCopy.sections.timeline.empty}</p>
                  ) : (
                    <div className="space-y-4">
                      {segments.map((segment, index) => (
                        <div key={`${segment.checkpoint}-${segment.distanceKm}`} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
                                {index + 1}
                              </span>
                              <div>
                                <p className="font-semibold text-slate-50">{segment.checkpoint}</p>
                                <p className="text-xs text-slate-400">
                                  {formatDistanceWithUnit(segment.distanceKm)} · {racePlannerCopy.sections.timeline.etaLabel}{" "}
                                  {formatMinutes(segment.etaMinutes, racePlannerCopy.units)}
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="relative h-10 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-purple-600"
                                style={{ width: `${calculatePercentage(segment.fuelGrams, raceTotals?.fuelGrams)}%` }}
                              />
                              <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs font-semibold text-slate-50">
                                <span className="truncate">{racePlannerCopy.sections.summary.items.carbs}</span>
                                <span className="shrink-0">
                                  {formatFuelAmount(segment.fuelGrams)} ·
                                  {` ${calculatePercentage(segment.fuelGrams, raceTotals?.fuelGrams).toFixed(0)}%`}
                                </span>
                              </div>
                            </div>
                            <div className="relative h-10 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="absolute left-0 top-0 h-full bg-sky-500"
                                style={{ width: `${calculatePercentage(segment.waterMl, raceTotals?.waterMl)}%` }}
                              />
                              <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs font-semibold text-slate-50">
                                <span className="truncate">{racePlannerCopy.sections.summary.items.water}</span>
                                <span className="shrink-0">
                                  {formatWaterAmount(segment.waterMl)} ·
                                  {` ${calculatePercentage(segment.waterMl, raceTotals?.waterMl).toFixed(0)}%`}
                                </span>
                              </div>
                            </div>
                            <div className="relative h-10 overflow-hidden rounded-full bg-slate-800">
                              <div
                                className="absolute left-0 top-0 h-full bg-slate-500"
                                style={{ width: `${calculatePercentage(segment.sodiumMg, raceTotals?.sodiumMg)}%` }}
                              />
                              <div className="relative z-10 flex h-full items-center justify-between px-3 text-xs font-semibold text-slate-50">
                                <span className="truncate">{racePlannerCopy.sections.summary.items.sodium}</span>
                                <span className="shrink-0">
                                  {formatSodiumAmount(segment.sodiumMg)} ·
                                  {` ${calculatePercentage(segment.sodiumMg, raceTotals?.sodiumMg).toFixed(0)}%`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{racePlannerCopy.sections.raceInputs.title}</CardTitle>
                    <CardDescription>{racePlannerCopy.sections.raceInputs.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".gpx,application/gpx+xml"
                      className="hidden"
                      onChange={handleImportGpx}
                    />
                    <Button variant="outline" type="button" onClick={() => fileInputRef.current?.click()}>
                      {racePlannerCopy.buttons.importGpx}
                    </Button>
                  </div>
                </div>
                {importError && <p className="text-xs text-red-400">{importError}</p>}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 xl:grid-cols-1">
                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-slate-100">{racePlannerCopy.sections.raceInputs.courseTitle}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="raceDistanceKm">{racePlannerCopy.sections.raceInputs.fields.raceDistance}</Label>
                        <Input
                          id="raceDistanceKm"
                          type="number"
                          step="0.5"
                          {...form.register("raceDistanceKm", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="elevationGain">{racePlannerCopy.sections.raceInputs.fields.elevationGain}</Label>
                        <Input
                          id="elevationGain"
                          type="number"
                          min="0"
                          step="50"
                          {...form.register("elevationGain", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-slate-100">{racePlannerCopy.sections.raceInputs.pacingTitle}</p>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="paceType">{racePlannerCopy.sections.raceInputs.fields.paceType}</Label>
                        <input id="paceType" type="hidden" {...form.register("paceType")} />
                        <div className="grid grid-cols-2 gap-2">
                          {(
                            [
                              { value: "pace", label: racePlannerCopy.sections.raceInputs.paceOptions.pace },
                              { value: "speed", label: racePlannerCopy.sections.raceInputs.paceOptions.speed },
                            ] satisfies { value: FormValues["paceType"]; label: string }[]
                          ).map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                variant={paceType === option.value ? "default" : "outline"}
                                className="w-full justify-center"
                                aria-pressed={paceType === option.value}
                                onClick={() =>
                                  form.setValue("paceType", option.value, {
                                    shouldValidate: true,
                                    shouldDirty: true,
                                  })
                                }
                              >
                                {option.label}
                              </Button>
                            ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="uphillEffort">{racePlannerCopy.sections.raceInputs.fields.uphillEffort}</Label>
                        <Input
                          id="uphillEffort"
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          {...form.register("uphillEffort", { valueAsNumber: true })}
                        />
                        <p className="text-xs text-slate-400">{racePlannerCopy.sections.raceInputs.fields.uphillEffortHelp}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="downhillEffort">{racePlannerCopy.sections.raceInputs.fields.downhillEffort}</Label>
                        <Input
                          id="downhillEffort"
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          {...form.register("downhillEffort", { valueAsNumber: true })}
                        />
                        <p className="text-xs text-slate-400">{racePlannerCopy.sections.raceInputs.fields.downhillEffortHelp}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-slate-100">{racePlannerCopy.sections.raceInputs.nutritionTitle}</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="targetIntakePerHour">{racePlannerCopy.sections.raceInputs.fields.targetIntakePerHour}</Label>
                        <Input
                          id="targetIntakePerHour"
                          type="number"
                          step="1"
                          {...form.register("targetIntakePerHour", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="waterIntakePerHour">{racePlannerCopy.sections.raceInputs.fields.waterIntakePerHour}</Label>
                        <Input
                          id="waterIntakePerHour"
                          type="number"
                          step="50"
                          min="0"
                          {...form.register("waterIntakePerHour", { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sodiumIntakePerHour">{racePlannerCopy.sections.raceInputs.fields.sodiumIntakePerHour}</Label>
                        <Input
                          id="sodiumIntakePerHour"
                          type="number"
                          step="50"
                          min="0"
                          {...form.register("sodiumIntakePerHour", { valueAsNumber: true })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
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
  if (!profile.length || totalDistanceKm <= 0) {
    return <p className="text-sm text-slate-400">{copy.sections.courseProfile.empty}</p>;
  }

  const width = 900;
  const paddingX = 32;
  const paddingY = 20;
  const elevationAreaHeight = 200;
  const speedAreaHeight = 120;
  const verticalGap = 28;
  const height = paddingY + elevationAreaHeight + verticalGap + speedAreaHeight + paddingY;
  const elevationBottom = paddingY + elevationAreaHeight;
  const speedTop = elevationBottom + verticalGap;
  const speedBottom = speedTop + speedAreaHeight;
  const maxElevation = Math.max(...profile.map((p) => p.elevationM));
  const minElevation = Math.min(...profile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;

  const xScale = (distanceKm: number) =>
    paddingX + Math.min(Math.max(distanceKm, 0), totalDistanceKm) * ((width - paddingX * 2) / totalDistanceKm);
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
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-80 w-full"
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
