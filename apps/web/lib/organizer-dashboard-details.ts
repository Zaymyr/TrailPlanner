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

export const organizerEquipmentDetailsSchema = z
  .object({
    items: z.array(equipmentItemSchema).default([]),
    note: nullableText,
  })
  .default({ items: [], note: null });

export const organizerBibPickupDetailsSchema = z
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
  });

export const organizerAccessDetailsSchema = z
  .object({
    startAddress: nullableText,
    finishAddress: nullableText,
    officialParkings: nullableText,
    shuttles: nullableText,
    shuttleSchedule: nullableText,
    roadRestrictions: nullableText,
    mapUrl: nullableUrl,
    note: nullableText,
    enabledSections: z
      .object({
        officialParkings: z.boolean().default(true),
        shuttles: z.boolean().default(true),
        roadRestrictions: z.boolean().default(true),
        mapUrl: z.boolean().default(true),
        runnerInfo: z.boolean().default(true),
      })
      .default({
        officialParkings: true,
        shuttles: true,
        roadRestrictions: true,
        mapUrl: true,
        runnerInfo: true,
      }),
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
    enabledSections: {
      officialParkings: true,
      shuttles: true,
      roadRestrictions: true,
      mapUrl: true,
      runnerInfo: true,
    },
  });

export const organizerServicesDetailsSchema = z
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
  });

export const organizerRunnerInfoDetailsSchema = z
  .object({
    startArea: nullableText,
    briefing: nullableText,
    rules: nullableText,
    note: nullableText,
  })
  .default({
    startArea: null,
    briefing: null,
    rules: null,
    note: null,
  });

export const organizerEventDateRangeDetailsSchema = z
  .object({
    endDate: nullableText,
  })
  .default({
    endDate: null,
  });

export const organizerEventDetailsSchema = z.object({
  dateRange: organizerEventDateRangeDetailsSchema,
  mandatoryEquipment: organizerEquipmentDetailsSchema,
  bibPickup: organizerBibPickupDetailsSchema,
  access: organizerAccessDetailsSchema,
  services: organizerServicesDetailsSchema,
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
  mandatoryEquipment: organizerEquipmentDetailsSchema,
  bibPickup: organizerBibPickupDetailsSchema,
  access: organizerAccessDetailsSchema,
  runnerInfo: organizerRunnerInfoDetailsSchema,
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
export type RunnerOrganizerDetails = ReturnType<typeof buildRunnerOrganizerDetails>;
export type OrganizerEquipmentDetails = z.infer<typeof organizerEquipmentDetailsSchema>;
export type OrganizerEquipmentItem = OrganizerEquipmentDetails["items"][number];

export const parseOrganizerEventDetails = (value: unknown): OrganizerEventDetails =>
  organizerEventDetailsSchema.catch(defaultOrganizerEventDetails).parse(value ?? {});

export const parseOrganizerRaceDetails = (value: unknown): OrganizerRaceDetails => {
  const parsed = organizerRaceDetailsSchema.catch(defaultOrganizerRaceDetails).parse(value ?? {});

  return {
    ...parsed,
    access: {
      ...parsed.access,
      shuttleSchedule: parsed.access.shuttleSchedule ?? parsed.schedule.shuttleSchedule ?? null,
    },
    schedule: {
      ...parsed.schedule,
      shuttleSchedule: null,
    },
  };
};

export const parseOrganizerAidStationDetails = (value: unknown): OrganizerAidStationDetails =>
  organizerAidStationDetailsSchema.catch(defaultOrganizerAidStationDetails).parse(value ?? {});

const hasOverrideValue = (value: unknown) => {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
};

const mergePreferRace = <T extends Record<string, unknown>>(eventDetails: T, raceDetails: T): T => {
  const merged = { ...eventDetails };
  for (const [key, value] of Object.entries(raceDetails)) {
    if (hasOverrideValue(value)) {
      merged[key as keyof T] = value as T[keyof T];
    }
  }
  return merged;
};

const buildEquipmentKey = (item: Pick<OrganizerEquipmentItem, "label" | "required">) =>
  `${item.label.trim().toLocaleLowerCase("fr-FR")}::${item.required ? "required" : "recommended"}`;

export const dedupeEquipmentItems = (items: OrganizerEquipmentItem[]): OrganizerEquipmentItem[] => {
  const seen = new Set<string>();
  const uniqueItems: OrganizerEquipmentItem[] = [];

  items.forEach((item) => {
    const key = buildEquipmentKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    uniqueItems.push(item);
  });

  return uniqueItems;
};

export const mergeEquipmentItems = (...lists: OrganizerEquipmentItem[][]): OrganizerEquipmentItem[] =>
  dedupeEquipmentItems(lists.flat());

export const getRaceSpecificEquipment = (
  commonEquipment: OrganizerEquipmentDetails,
  raceEquipment: OrganizerEquipmentDetails
): OrganizerEquipmentDetails => {
  const commonKeys = new Set(commonEquipment.items.map((item) => buildEquipmentKey(item)));

  return {
    ...raceEquipment,
    items: dedupeEquipmentItems(raceEquipment.items).filter((item) => !commonKeys.has(buildEquipmentKey(item))),
  };
};

export const expandRaceEquipmentWithCommon = (
  commonEquipment: OrganizerEquipmentDetails,
  raceEquipment: OrganizerEquipmentDetails
): OrganizerEquipmentDetails => ({
  ...raceEquipment,
  items: mergeEquipmentItems(commonEquipment.items, raceEquipment.items),
});

export const applyCommonEquipmentToRace = (
  previousCommonEquipment: OrganizerEquipmentDetails,
  nextCommonEquipment: OrganizerEquipmentDetails,
  raceEquipment: OrganizerEquipmentDetails
): OrganizerEquipmentDetails => {
  const previousCommonKeys = new Set(previousCommonEquipment.items.map((item) => buildEquipmentKey(item)));
  const raceSpecificItems = dedupeEquipmentItems(raceEquipment.items).filter(
    (item) => !previousCommonKeys.has(buildEquipmentKey(item))
  );

  return {
    ...raceEquipment,
    items: mergeEquipmentItems(nextCommonEquipment.items, raceSpecificItems),
  };
};

export const deriveCommonEquipmentFromRaces = (
  races: Array<OrganizerRaceDetails | null | undefined>,
  fallback: OrganizerEquipmentDetails
): OrganizerEquipmentDetails => {
  if (races.length === 0) return fallback;

  const itemsByKey = new Map<string, OrganizerEquipmentItem>();
  let commonKeys: Set<string> | null = null;

  races.forEach((race) => {
    const raceItems = dedupeEquipmentItems(race?.mandatoryEquipment.items ?? []);
    const raceKeys = new Set(raceItems.map((item) => buildEquipmentKey(item)));

    raceItems.forEach((item) => {
      const key = buildEquipmentKey(item);
      if (!itemsByKey.has(key)) itemsByKey.set(key, item);
    });

    commonKeys = commonKeys
      ? new Set([...commonKeys].filter((key) => raceKeys.has(key)))
      : raceKeys;
  });

  return {
    ...fallback,
    items: [...(commonKeys ?? [])].map((key) => itemsByKey.get(key)).filter((item): item is OrganizerEquipmentItem => Boolean(item)),
  };
};

export function buildRunnerOrganizerDetails(eventDetails: OrganizerEventDetails, raceDetails?: OrganizerRaceDetails | null) {
  const race = raceDetails ?? defaultOrganizerRaceDetails;
  const commonEquipment = eventDetails.mandatoryEquipment;
  const expandedRaceEquipment = expandRaceEquipmentWithCommon(commonEquipment, race.mandatoryEquipment);
  const raceSpecificEquipment = getRaceSpecificEquipment(commonEquipment, expandedRaceEquipment);

  return {
    commonEquipment,
    raceEquipment: raceSpecificEquipment,
    equipment: {
      items: mergeEquipmentItems(commonEquipment.items, raceSpecificEquipment.items),
      note: [commonEquipment.note, race.mandatoryEquipment.note].filter(Boolean).join("\n") || null,
    },
    bibPickup: eventDetails.bibPickup,
    access: mergePreferRace(eventDetails.access, race.access),
    services: eventDetails.services,
    schedule: race.schedule,
    runnerInfo: race.runnerInfo,
  };
}
