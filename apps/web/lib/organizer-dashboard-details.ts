import { z } from "zod";

const nullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const nullableUrl = nullableText.refine((value) => !value || /^https?:\/\//i.test(value), {
  message: "Invalid URL.",
});

const nullableBoolean = z.union([z.boolean(), z.null(), z.undefined()]).transform((value) => value ?? null);

const nullableNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") return null;
    return value;
  },
  z.coerce.number().finite().nullable()
);

const equipmentItemSchema = z.object({
  id: nullableText,
  label: z.string().trim().min(1),
  required: z.boolean().default(true),
  note: nullableText,
});

export const organizerEventDetailsSchema = z.object({
  mandatoryEquipment: z
    .object({
      items: z.array(equipmentItemSchema).default([]),
      note: nullableText,
    })
    .default({ items: [], note: null }),
  bibPickup: z
    .object({
      location: nullableText,
      schedule: nullableText,
      requiredDocuments: nullableText,
      thirdPartyPickupAllowed: nullableBoolean,
      equipmentCheck: nullableBoolean,
      note: nullableText,
    })
    .default({
      location: null,
      schedule: null,
      requiredDocuments: null,
      thirdPartyPickupAllowed: null,
      equipmentCheck: null,
      note: null,
    }),
  access: z
    .object({
      startAddress: nullableText,
      finishAddress: nullableText,
      officialParkings: nullableText,
      shuttles: nullableText,
      shuttleSchedule: nullableText,
      roadRestrictions: nullableText,
      mapUrl: nullableUrl,
      note: nullableText,
    })
    .default({
      startAddress: null,
      finishAddress: null,
      officialParkings: null,
      shuttles: null,
      shuttleSchedule: null,
      roadRestrictions: null,
      mapUrl: null,
      note: null,
    }),
  services: z
    .object({
      supporters: nullableText,
      accommodations: nullableText,
      restaurants: nullableText,
      recovery: nullableText,
      partners: nullableText,
      lastMinuteMessage: nullableText,
      note: nullableText,
    })
    .default({
      supporters: null,
      accommodations: null,
      restaurants: null,
      recovery: null,
      partners: null,
      lastMinuteMessage: null,
      note: null,
    }),
});

export const organizerRaceDetailsSchema = z.object({
  schedule: z
    .object({
      startTime: nullableText,
      finishCutoffTime: nullableText,
      shuttleSchedule: nullableText,
      cutoffNote: nullableText,
      note: nullableText,
    })
    .default({
      startTime: null,
      finishCutoffTime: null,
      shuttleSchedule: null,
      cutoffNote: null,
      note: null,
    }),
});

export const aidStationTypeSchema = z.enum(["water", "solid", "assistance", "life_base", "other"]);

export const organizerAidStationDetailsSchema = z.object({
  stationType: aidStationTypeSchema.default("water"),
  cumulativeElevationGainM: nullableNumber,
  cumulativeElevationLossM: nullableNumber,
  altitudeM: nullableNumber,
  cutoffTime: nullableText,
  dropBagAvailable: z.boolean().default(false),
  organizerNote: nullableText,
});

export const defaultOrganizerEventDetails = organizerEventDetailsSchema.parse({});
export const defaultOrganizerRaceDetails = organizerRaceDetailsSchema.parse({});
export const defaultOrganizerAidStationDetails = organizerAidStationDetailsSchema.parse({});

export type OrganizerEventDetails = z.infer<typeof organizerEventDetailsSchema>;
export type OrganizerRaceDetails = z.infer<typeof organizerRaceDetailsSchema>;
export type OrganizerAidStationDetails = z.infer<typeof organizerAidStationDetailsSchema>;
export type AidStationType = z.infer<typeof aidStationTypeSchema>;

export const parseOrganizerEventDetails = (value: unknown): OrganizerEventDetails =>
  organizerEventDetailsSchema.catch(defaultOrganizerEventDetails).parse(value ?? {});

export const parseOrganizerRaceDetails = (value: unknown): OrganizerRaceDetails =>
  organizerRaceDetailsSchema.catch(defaultOrganizerRaceDetails).parse(value ?? {});

export const parseOrganizerAidStationDetails = (value: unknown): OrganizerAidStationDetails =>
  organizerAidStationDetailsSchema.catch(defaultOrganizerAidStationDetails).parse(value ?? {});
