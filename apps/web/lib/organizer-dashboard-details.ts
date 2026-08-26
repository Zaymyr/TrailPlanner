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

const nullableLocationSource = z.enum(["manual", "autocomplete"]).nullish().transform((value) => value ?? null);

export const organizerLocationSchema = z
  .object({
    label: nullableText,
    lat: nullableNumber,
    lng: nullableNumber,
    googleMapsUrl: nullableUrl,
    source: nullableLocationSource,
  })
  .default({
    label: null,
    lat: null,
    lng: null,
    googleMapsUrl: null,
    source: null,
  });

const equipmentItemSchema = z.object({
  id: nullableText,
  label: z.string().trim().min(1),
  required: z.boolean().default(true),
  cold: z.boolean().default(false),
  heat: z.boolean().default(false),
  note: nullableText,
});

export const organizerWeatherPlanSchema = z.enum(["normal", "cold", "heat"]);

export const organizerEquipmentDetailsSchema = z
  .object({
    overrideEnabled: z.boolean().optional(),
    weatherPlan: organizerWeatherPlanSchema.default("normal"),
    items: z.array(equipmentItemSchema).default([]),
    note: nullableText,
  })
  .default({ overrideEnabled: false, weatherPlan: "normal", items: [], note: null });

export const organizerBibPickupSlotSchema = z.object({
  date: nullableText,
  startTime: nullableText,
  endTime: nullableText,
});

export const organizerBibPickupLocationSchema = z.object({
  location: nullableText,
  locationDetails: organizerLocationSchema,
  slots: z.array(organizerBibPickupSlotSchema).default([]),
});

export const organizerBibPickupDetailsSchema = z
  .object({
    overrideEnabled: z.boolean().default(false),
    location: nullableText,
    locationDetails: organizerLocationSchema,
    schedule: nullableText,
    locations: z.array(organizerBibPickupLocationSchema).default([]),
    requiredDocuments: nullableText,
    thirdPartyPickupAllowed: nullableBoolean,
    equipmentCheck: nullableBoolean,
    note: nullableText,
  })
  .default({
    overrideEnabled: false,
    location: null,
    locationDetails: organizerLocationSchema.parse({}),
    schedule: null,
    locations: [],
    requiredDocuments: null,
    thirdPartyPickupAllowed: null,
    equipmentCheck: null,
    note: null,
  });

export const organizerAccessDetailsSchema = z
  .object({
    overrideEnabled: z.boolean().optional(),
    startAddress: nullableText,
    startLocation: organizerLocationSchema,
    finishAddress: nullableText,
    finishLocation: organizerLocationSchema,
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
    overrideEnabled: false,
    startAddress: null,
    startLocation: organizerLocationSchema.parse({}),
    finishAddress: null,
    finishLocation: organizerLocationSchema.parse({}),
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

export function normalizeOrganizerPhoneNumber(value: string): string {
  const trimmed = value.trim();
  let digits = trimmed.replace(/\D/g, "");

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("330") && digits.length === 12) digits = `33${digits.slice(3)}`;
  if (digits.startsWith("0") && digits.length === 10) digits = `33${digits.slice(1)}`;

  if (digits.startsWith("33") && digits.length === 11) {
    const nationalNumber = digits.slice(2);
    return `+33 ${nationalNumber[0]} ${nationalNumber.slice(1).match(/.{1,2}/g)?.join(" ") ?? ""}`.trim();
  }

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return digits.length > 0 ? `+${digits}` : trimmed;
  }

  if (digits.length <= 4) return digits || trimmed;
  return digits.length > 0 ? digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim() : trimmed;
}

const nullablePhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? normalizeOrganizerPhoneNumber(trimmed) : null;
  });

export const organizerEmergencyContactSchema = z
  .object({
    name: nullableText,
    phone: nullablePhone,
  })
  .default({
    name: null,
    phone: null,
  });

export const organizerEventDetailsSchema = z.object({
  officialWebsiteUrl: nullableUrl,
  emergencyContact: organizerEmergencyContactSchema,
  eventLocation: organizerLocationSchema,
  dateRange: organizerEventDateRangeDetailsSchema,
  mandatoryEquipment: organizerEquipmentDetailsSchema,
  bibPickup: organizerBibPickupDetailsSchema,
  access: organizerAccessDetailsSchema,
  services: organizerServicesDetailsSchema,
});

export const organizerRaceDetailsSchema = z.object({
  raceLocation: organizerLocationSchema,
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
export type OrganizerLocation = z.infer<typeof organizerLocationSchema>;
export type AidStationType = z.infer<typeof aidStationTypeSchema>;
export type RunnerOrganizerDetails = ReturnType<typeof buildRunnerOrganizerDetails>;
export type OrganizerEquipmentDetails = z.infer<typeof organizerEquipmentDetailsSchema>;
export type OrganizerEquipmentItem = OrganizerEquipmentDetails["items"][number];
export type OrganizerWeatherPlan = z.infer<typeof organizerWeatherPlanSchema>;
export type OrganizerBibPickupDetails = z.infer<typeof organizerBibPickupDetailsSchema>;
export type OrganizerBibPickupLocation = z.infer<typeof organizerBibPickupLocationSchema>;
export type OrganizerBibPickupSlot = z.infer<typeof organizerBibPickupSlotSchema>;

export function getOrganizerBibPickupLocations(details: OrganizerBibPickupDetails): OrganizerBibPickupLocation[] {
  if (details.locations.length > 0) return details.locations;

  const hasLegacyLocation = Boolean(
    details.location?.trim() ||
      details.locationDetails.label?.trim() ||
      details.locationDetails.googleMapsUrl ||
      (details.locationDetails.lat !== null && details.locationDetails.lng !== null)
  );

  return hasLegacyLocation
    ? [
        {
          location: details.location,
          locationDetails: details.locationDetails,
          slots: [],
        },
      ]
    : [];
}

export type RunnerEquipmentItem = OrganizerEquipmentItem & {
  active: boolean;
};

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
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasOverrideValue);
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

const hasRaceAccessContent = (access: OrganizerEventDetails["access"]) =>
  Boolean(
    access.startAddress?.trim() ||
      access.startLocation.label?.trim() ||
      access.startLocation.googleMapsUrl ||
      (access.startLocation.lat !== null && access.startLocation.lng !== null) ||
      access.finishAddress?.trim() ||
      access.finishLocation.label?.trim() ||
      access.finishLocation.googleMapsUrl ||
      (access.finishLocation.lat !== null && access.finishLocation.lng !== null) ||
      access.officialParkings?.trim() ||
      access.shuttles?.trim() ||
      access.shuttleSchedule?.trim() ||
      access.roadRestrictions?.trim() ||
      access.mapUrl?.trim() ||
      access.note?.trim() ||
      Object.values(access.enabledSections).some((enabled) => !enabled)
  );

export const hasRaceAccessOverride = (access: OrganizerEventDetails["access"]) =>
  access.overrideEnabled ?? hasRaceAccessContent(access);

export const expandRaceAccessWithEvent = (
  eventAccess: OrganizerEventDetails["access"],
  raceAccess: OrganizerEventDetails["access"]
): OrganizerEventDetails["access"] =>
  hasRaceAccessContent(raceAccess)
    ? raceAccess
    : {
        ...eventAccess,
        startLocation: { ...eventAccess.startLocation },
        finishLocation: { ...eventAccess.finishLocation },
        enabledSections: { ...eventAccess.enabledSections },
      };

const buildEquipmentKey = (item: Pick<OrganizerEquipmentItem, "label" | "required" | "cold" | "heat">) =>
  `${item.label.trim().toLocaleLowerCase("fr-FR")}::${item.required ? "required" : "recommended"}::${item.cold ? "cold" : "base"}::${item.heat ? "heat" : "base"}`;

export const isWeatherTaggedEquipment = (item: Pick<OrganizerEquipmentItem, "cold" | "heat">) => item.cold || item.heat;

export const isEquipmentItemActiveForWeatherPlan = (
  item: Pick<OrganizerEquipmentItem, "cold" | "heat">,
  weatherPlan: OrganizerWeatherPlan
) => {
  if (!isWeatherTaggedEquipment(item)) return true;
  if (weatherPlan === "cold") return item.cold;
  if (weatherPlan === "heat") return item.heat;
  return false;
};

export const decorateEquipmentItemsWithWeatherPlan = (
  items: OrganizerEquipmentItem[],
  weatherPlan: OrganizerWeatherPlan
): RunnerEquipmentItem[] =>
  items.map((item) => ({
    ...item,
    active: isEquipmentItemActiveForWeatherPlan(item, weatherPlan),
  }));

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

export const hasRaceEquipmentOverride = (
  commonEquipment: OrganizerEquipmentDetails,
  raceEquipment: OrganizerEquipmentDetails
) =>
  raceEquipment.overrideEnabled ??
  (getRaceSpecificEquipment(commonEquipment, raceEquipment).items.length > 0 ||
    Boolean(raceEquipment.note?.trim()));

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
  const equipmentOverride = race.mandatoryEquipment.overrideEnabled;
  const hasLegacyEquipmentOverride =
    equipmentOverride === undefined && hasRaceEquipmentOverride(commonEquipment, race.mandatoryEquipment);
  const raceSpecificEquipment =
    equipmentOverride === true || hasLegacyEquipmentOverride
      ? getRaceSpecificEquipment(commonEquipment, race.mandatoryEquipment)
      : defaultOrganizerRaceDetails.mandatoryEquipment;
  const weatherPlan = commonEquipment.weatherPlan;
  const resolvedEquipmentItems =
    equipmentOverride === true
      ? dedupeEquipmentItems(race.mandatoryEquipment.items)
      : hasLegacyEquipmentOverride
        ? mergeEquipmentItems(commonEquipment.items, raceSpecificEquipment.items)
        : commonEquipment.items;
  const resolvedEquipmentNote =
    equipmentOverride === true
      ? race.mandatoryEquipment.note
      : hasLegacyEquipmentOverride
        ? [commonEquipment.note, race.mandatoryEquipment.note].filter(Boolean).join("\n") || null
        : commonEquipment.note;
  const accessOverride = race.access.overrideEnabled;
  const hasLegacyAccessOverride = accessOverride === undefined && hasRaceAccessContent(race.access);
  const resolvedAccess =
    accessOverride === true
      ? race.access
      : hasLegacyAccessOverride
        ? mergePreferRace(eventDetails.access, race.access)
        : eventDetails.access;

  return {
    commonEquipment,
    raceEquipment: raceSpecificEquipment,
    equipment: {
      weatherPlan,
      items: resolvedEquipmentItems,
      note: resolvedEquipmentNote,
    },
    equipmentStatus: {
      weatherPlan,
      items: decorateEquipmentItemsWithWeatherPlan(resolvedEquipmentItems, weatherPlan),
      commonItems: decorateEquipmentItemsWithWeatherPlan(commonEquipment.items, weatherPlan),
      raceItems: decorateEquipmentItemsWithWeatherPlan(raceSpecificEquipment.items, weatherPlan),
    },
    bibPickup: race.bibPickup.overrideEnabled ? race.bibPickup : eventDetails.bibPickup,
    access: resolvedAccess,
    services: eventDetails.services,
    schedule: race.schedule,
    runnerInfo: race.runnerInfo,
  };
}
