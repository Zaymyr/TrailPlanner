import { z } from "zod";

const nullableText = z.string().trim().optional().nullable().transform((value) => value || null);
const nullableUrl = nullableText.refine((value) => !value || /^https?:\/\//i.test(value), "Invalid URL.");

export const editionServiceSchema = z.object({
  id: z.string().uuid().optional(),
  serviceType: z.enum(["restaurant", "accommodation", "recovery", "other"]),
  name: z.string().trim().min(1),
  description: nullableText,
  address: nullableText,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  googleMapsUrl: nullableUrl,
  websiteUrl: nullableUrl,
  phone: nullableText.refine((value) => !value || /^\+?[0-9][0-9 .()/-]{5,24}$/.test(value), "Invalid phone number."),
}).superRefine((value, context) => {
  if ((value.serviceType === "restaurant" || value.serviceType === "accommodation") && !value.address) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["address"], message: "Address is required." });
  }
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "Both coordinates are required." });
  }
  if ((value.serviceType === "restaurant" || value.serviceType === "accommodation") && (value.latitude == null || value.longitude == null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["latitude"], message: "A geocoded address is required." });
  }
});

export const startWaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  eligibilityType: z.enum(["all", "bib_range", "estimated_finish_time", "pace", "custom"]),
  bibNumberMin: z.number().int().nonnegative().nullable().optional(),
  bibNumberMax: z.number().int().nonnegative().nullable().optional(),
  finishMinutesMin: z.number().int().nonnegative().nullable().optional(),
  finishMinutesMax: z.number().int().nonnegative().nullable().optional(),
  paceSecondsMin: z.number().int().positive().nullable().optional(),
  paceSecondsMax: z.number().int().positive().nullable().optional(),
  eligibilityNote: nullableText,
}).superRefine((value, context) => {
  const range = (min: number | null | undefined, max: number | null | undefined, path: string) => {
    if (min == null || max == null || max < min) context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Invalid range." });
  };
  if (value.eligibilityType === "bib_range") range(value.bibNumberMin, value.bibNumberMax, "bibNumberMax");
  if (value.eligibilityType === "estimated_finish_time") range(value.finishMinutesMin, value.finishMinutesMax, "finishMinutesMax");
  if (value.eligibilityType === "pace") range(value.paceSecondsMin, value.paceSecondsMax, "paceSecondsMax");
  if (value.eligibilityType === "custom" && !value.eligibilityNote) context.addIssue({ code: z.ZodIssueCode.custom, path: ["eligibilityNote"], message: "Rule is required." });
});

export const raceAwardSchema = z.object({
  id: z.string().uuid().optional(),
  categoryKey: z.enum(["scratch", "u18", "u20", "u23", "senior", "master", "custom"]),
  categoryLabel: z.string().trim().min(1),
  audience: z.enum(["women", "men", "mixed"]),
  placeFrom: z.number().int().positive(),
  placeTo: z.number().int().positive(),
  podiumTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  podiumLocation: nullableText,
  rewardNote: nullableText,
}).refine((value) => value.placeTo >= value.placeFrom, { path: ["placeTo"], message: "Invalid place range." });

export type EditionService = z.infer<typeof editionServiceSchema>;
export type StartWave = z.infer<typeof startWaveSchema>;
export type RaceAward = z.infer<typeof raceAwardSchema>;

export const editionServicesPayloadSchema = z.object({ services: z.array(editionServiceSchema).max(100) });
export const startWavesPayloadSchema = z.object({ startWaves: z.array(startWaveSchema).max(50) });
export const raceAwardsPayloadSchema = z.object({ awards: z.array(raceAwardSchema).max(100) });

export const mapEditionServicePayload = (item: EditionService, index: number) => ({
  id: item.id, service_type: item.serviceType, name: item.name, description: item.description, address: item.address,
  latitude: item.latitude ?? null, longitude: item.longitude ?? null, google_maps_url: item.googleMapsUrl,
  website_url: item.websiteUrl, phone: item.phone, order_index: index,
});
export const mapStartWavePayload = (item: StartWave, index: number) => ({
  id: item.id, name: item.name, start_time: item.startTime, eligibility_type: item.eligibilityType,
  bib_number_min: item.eligibilityType === "bib_range" ? item.bibNumberMin : null,
  bib_number_max: item.eligibilityType === "bib_range" ? item.bibNumberMax : null,
  finish_minutes_min: item.eligibilityType === "estimated_finish_time" ? item.finishMinutesMin : null,
  finish_minutes_max: item.eligibilityType === "estimated_finish_time" ? item.finishMinutesMax : null,
  pace_seconds_min: item.eligibilityType === "pace" ? item.paceSecondsMin : null,
  pace_seconds_max: item.eligibilityType === "pace" ? item.paceSecondsMax : null,
  eligibility_note: item.eligibilityType === "custom" ? item.eligibilityNote : null, order_index: index,
});
export const mapRaceAwardPayload = (item: RaceAward, index: number) => ({
  id: item.id, category_key: item.categoryKey, category_label: item.categoryLabel, audience: item.audience,
  place_from: item.placeFrom, place_to: item.placeTo, podium_time: item.podiumTime,
  podium_location: item.podiumLocation, reward_note: item.rewardNote, order_index: index,
});
