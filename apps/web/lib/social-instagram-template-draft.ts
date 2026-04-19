import { z } from "zod";

import type { SocialRacePlanTemplate } from "./social-race-plan-template";

export const socialInstagramTemplateAccentKeys = ["forest", "moss", "earth", "slate"] as const;

const socialInstagramTemplateAidStationSchema = z.object({
  name: z.string(),
  km: z.string(),
  eta: z.string(),
  take: z.string(),
});

export const socialInstagramTemplateDraftSchema = z.object({
  raceName: z.string(),
  raceSubtitle: z.string(),
  raceYear: z.string(),
  startDate: z.string(),
  raceLocation: z.string(),
  distanceKm: z.string(),
  elevationGainM: z.string(),
  targetTimeLabel: z.string(),
  totalCarbsG: z.string(),
  totalWaterL: z.string(),
  totalSodiumG: z.string(),
  avgCarbsG: z.string(),
  avgWaterMl: z.string(),
  avgSodiumMg: z.string(),
  carbsPerGelG: z.string(),
  sodiumPerCapMg: z.string(),
  flaskMl: z.string(),
  tagline: z.string(),
  ctaS1: z.string(),
  ctaS2: z.string(),
  ctaS4: z.string(),
  appHandle: z.string(),
  aidStations: z.array(socialInstagramTemplateAidStationSchema),
  accentKey: z.enum(socialInstagramTemplateAccentKeys),
  darkSlide1: z.boolean(),
});

const socialInstagramTemplateOverridesSchema = socialInstagramTemplateDraftSchema
  .omit({ aidStations: true })
  .partial()
  .extend({
    aidStations: z.array(socialInstagramTemplateAidStationSchema).optional(),
  });

export type SocialInstagramTemplateDraft = z.infer<typeof socialInstagramTemplateDraftSchema>;
export type SocialInstagramTemplateOverrides = z.infer<typeof socialInstagramTemplateOverridesSchema>;
export type SocialInstagramTemplateAidStation = z.infer<typeof socialInstagramTemplateAidStationSchema>;
export type SocialInstagramTemplateAccentKey = (typeof socialInstagramTemplateAccentKeys)[number];

const STORAGE_KEY_PREFIX = "pace-yourself.social-template.instagram.v1";

const DEFAULTS = {
  tagline: "Mieux vaut planifier son ravito avant de le subir en course.",
  ctaS1: "Swipe pour voir les chiffres cles.",
  ctaS2: "Maintenant, comment je mange tout ca jusqu'a l'arrivee ?",
  ctaS4: "Cree ton plan sur Pace Yourself",
  appHandle: "pace-yourself.app",
  carbsPerGelG: "25",
  sodiumPerCapMg: "300",
  flaskMl: "500",
  accentKey: "forest" as const,
  darkSlide1: true,
} as const;

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function formatRoundedNumber(value: number | null, digits = 0) {
  if (value === null || !Number.isFinite(value)) return "";
  return digits > 0 ? Number(value.toFixed(digits)).toString() : Math.round(value).toString();
}

function formatWaterLiters(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return Number((value / 1000).toFixed(value >= 10_000 ? 0 : 1)).toString();
}

function formatSodiumGrams(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return Number((value / 1000).toFixed(1)).toString();
}

function parseIsoDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, monthIndex, day));

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDisplayDate(value: string | null) {
  const date = parseIsoDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatMetricSummary(label: string, value: number | null, suffix: string) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${Math.round(value)}${suffix} ${label}`;
}

function summarizeItem(item: SocialRacePlanTemplate["aidStations"][number]["take"]["items"][number]) {
  if (item.kind === "product") {
    const quantity = item.quantity !== null ? `${item.quantity} x ` : "";
    return `${quantity}${item.label}`.trim();
  }

  const estimates = [
    formatMetricSummary("glucides", item.carbsG, "g"),
    formatMetricSummary("eau", item.waterMl, "ml"),
    formatMetricSummary("sodium", item.sodiumMg, "mg"),
  ].filter((value): value is string => Boolean(value));

  if (estimates.length > 0) return `~ ${estimates.join(" ; ")}`;
  return item.note?.trim() || item.label.trim();
}

function buildAidStationTakeSummary(station: SocialRacePlanTemplate["aidStations"][number]) {
  const summaries = station.take.items
    .map((item) => summarizeItem(item))
    .filter((value) => value.length > 0);

  if (summaries.length > 0) return summaries.join("; ");
  return station.take.fallbackUsed ? "A preciser" : "";
}

function areAidStationsEqual(left: SocialInstagramTemplateAidStation[], right: SocialInstagramTemplateAidStation[]) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildSocialInstagramTemplateDraft(template: SocialRacePlanTemplate): SocialInstagramTemplateDraft {
  const raceDate = parseIsoDate(template.race.dateIso);

  const draft = {
    raceName: template.race.name,
    raceSubtitle: template.race.subtitle ?? "",
    raceYear: raceDate ? String(raceDate.getUTCFullYear()) : "",
    startDate: formatDisplayDate(template.race.dateIso),
    raceLocation: template.race.location ?? "",
    distanceKm: formatRoundedNumber(template.race.distanceKm, 1),
    elevationGainM: formatRoundedNumber(template.race.elevationGainM),
    targetTimeLabel: template.race.targetTime.label ?? "",
    totalCarbsG: formatRoundedNumber(template.totals.carbsG),
    totalWaterL: formatWaterLiters(template.totals.waterMl),
    totalSodiumG: formatSodiumGrams(template.totals.sodiumMg),
    avgCarbsG: formatRoundedNumber(template.averagesPerHour.carbsG),
    avgWaterMl: formatRoundedNumber(template.averagesPerHour.waterMl),
    avgSodiumMg: formatRoundedNumber(template.averagesPerHour.sodiumMg),
    carbsPerGelG: DEFAULTS.carbsPerGelG,
    sodiumPerCapMg: DEFAULTS.sodiumPerCapMg,
    flaskMl: DEFAULTS.flaskMl,
    tagline: DEFAULTS.tagline,
    ctaS1: DEFAULTS.ctaS1,
    ctaS2: DEFAULTS.ctaS2,
    ctaS4: DEFAULTS.ctaS4,
    appHandle: DEFAULTS.appHandle,
    aidStations: template.aidStations.map((station) => ({
      name: station.name,
      km: station.km === null ? "" : String(station.km),
      eta: station.eta.label ?? "",
      take: buildAidStationTakeSummary(station),
    })),
    accentKey: DEFAULTS.accentKey,
    darkSlide1: DEFAULTS.darkSlide1,
  };

  return socialInstagramTemplateDraftSchema.parse(draft);
}

export function applySocialInstagramTemplateOverrides(
  defaults: SocialInstagramTemplateDraft,
  overrides: SocialInstagramTemplateOverrides | null | undefined
) {
  if (!overrides) return defaults;

  const parsedOverrides = socialInstagramTemplateOverridesSchema.safeParse(overrides);
  if (!parsedOverrides.success) return defaults;

  return socialInstagramTemplateDraftSchema.parse({
    ...defaults,
    ...parsedOverrides.data,
    aidStations: parsedOverrides.data.aidStations ?? defaults.aidStations,
  });
}

export function buildSocialInstagramTemplateOverrides(
  defaults: SocialInstagramTemplateDraft,
  draft: SocialInstagramTemplateDraft
): SocialInstagramTemplateOverrides {
  const overrides: SocialInstagramTemplateOverrides = {};

  (Object.keys(defaults) as Array<keyof SocialInstagramTemplateDraft>).forEach((key) => {
    if (key === "aidStations") return;

    if (draft[key] !== defaults[key]) {
      overrides[key] = draft[key] as never;
    }
  });

  if (!areAidStationsEqual(defaults.aidStations, draft.aidStations)) {
    overrides.aidStations = draft.aidStations;
  }

  return socialInstagramTemplateOverridesSchema.parse(overrides);
}

export function getSocialInstagramTemplateStorageKey(planId: string) {
  return `${STORAGE_KEY_PREFIX}.${planId}`;
}

export function readSocialInstagramTemplateOverrides(planId: string): SocialInstagramTemplateOverrides | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(getSocialInstagramTemplateStorageKey(planId));
  if (!raw) return null;

  try {
    const parsed = socialInstagramTemplateOverridesSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch (error) {
    console.error("Unable to parse social Instagram template overrides", error);
    return null;
  }
}

export function writeSocialInstagramTemplateOverrides(
  planId: string,
  defaults: SocialInstagramTemplateDraft,
  draft: SocialInstagramTemplateDraft
) {
  if (!isBrowser()) return;

  const overrides = buildSocialInstagramTemplateOverrides(defaults, draft);

  if (Object.keys(overrides).length === 0) {
    window.localStorage.removeItem(getSocialInstagramTemplateStorageKey(planId));
    return;
  }

  window.localStorage.setItem(getSocialInstagramTemplateStorageKey(planId), JSON.stringify(overrides));
}

export function resetSocialInstagramTemplateOverrides(planId: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(getSocialInstagramTemplateStorageKey(planId));
}
