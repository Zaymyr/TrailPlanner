import { randomUUID } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../../lib/http";
import {
  buildSlug,
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireEventOrganizer,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import {
  buildOrganizerWebsiteImportPreview,
  computeOrganizerWebsiteImportPreviewHash,
  type OrganizerWebsiteImportPreview,
  type OrganizerWebsiteImportRace,
} from "../../../../../../lib/organizer-website-import";
import {
  organizerEventDetailsSchema,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../../../../../../lib/organizer-dashboard-details";
import {
  extractOrganizerDocument,
  reconcileOrganizerDocumentFindings,
  attachDocumentFindingsToFormats,
  ORGANIZER_DOCUMENT_MAX_COUNT,
  validateOrganizerDocument,
} from "../../../../../../lib/organizer-document-import";

const raceSelectionSchema = z.object({
  previewRaceKey: z.string().trim().min(1),
  mode: z.enum(["create", "update", "ignore"]),
  targetRaceId: z.string().uuid().nullable().optional(),
});
const MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE = 70;

const previewRequestSchema = z.object({
  action: z.literal("preview"),
  url: z.string().trim().url().optional().default(""),
  formatUrls: z.array(z.string().trim().url()).max(12).default([]),
  documentNames: z.array(z.string().trim().min(1)).max(8).default([]),
});

const parsePreviewRequest = async (request: NextRequest) => {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { parsed: previewRequestSchema.safeParse(await request.json().catch(() => null)), documents: [] as File[] };
  }

  const formData = await request.formData();
  const files = formData.getAll("documents").filter((value): value is File => value instanceof File);
  const documentError = files.length > ORGANIZER_DOCUMENT_MAX_COUNT ? "Ajoute au maximum 8 documents." : files.map(validateOrganizerDocument).find(Boolean);
  if (documentError) return { parsed: previewRequestSchema.safeParse({}), documents: files };

  let formatUrls: unknown = [];
  try {
    formatUrls = JSON.parse(String(formData.get("formatUrls") ?? "[]"));
  } catch {
    formatUrls = null;
  }

  return {
    parsed: previewRequestSchema.safeParse({
      action: formData.get("action"),
      url: formData.get("url"),
      formatUrls,
      documentNames: files.map((file) => file.name),
    }),
    documents: files,
  };
};

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

const applyRequestSchema = z.object({
  action: z.literal("apply"),
  url: z.string().trim().url(),
  formatUrls: z.array(z.string().trim().url()).max(12).default([]),
  previewHash: z.string().trim().min(16),
  eventRaceDate: isoDateSchema.optional(),
  eventEditionEndDate: isoDateSchema.optional(),
  selectedEditionYear: z.string().trim().optional(),
  raceSelections: z.array(raceSelectionSchema).default([]),
});

const emptyWebsitePreview = (): OrganizerWebsiteImportPreview => ({
  source: { provider: "generic", url: "", label: "Documents fournis" },
  event: {
    name: null,
    location: null,
    raceDate: null,
    officialWebsiteUrl: null,
    thumbnailUrl: null,
    logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
  },
  races: [],
  missingFields: [],
  warnings: [],
  canApply: false,
});

const eventContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  race_event_editions: z.array(z.object({
    id: z.string().uuid(),
    edition_year: z.number().int(),
    start_date: z.string(),
    end_date: z.string(),
    is_current: z.boolean(),
  })).nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        edition_id: z.string().uuid().nullable().optional(),
        edition_group_id: z.string().uuid(),
        series_name: z.string(),
        name: z.string(),
        race_date: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
        elevation_loss_m: z.number().nullable().optional(),
        external_site_url: z.string().nullable().optional(),
        location_text: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        gpx_storage_path: z.string().nullable().optional(),
        organizer_details: z.unknown().nullable().optional(),
        is_live: z.boolean(),
      })
    )
    .nullable()
    .optional(),
});

const aidStationCountSchema = z.object({ count: z.number().int().nonnegative() });

type EventContext = z.infer<typeof eventContextSchema>;
type EventRace = NonNullable<EventContext["races"]>[number];

const buildRestError = (message: string) =>
  withSecurityHeaders(
    NextResponse.json(
      { message },
      {
        status: 429,
      }
    )
  );

const normalizeComparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const datesShareYear = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left?.slice(0, 4) && right?.slice(0, 4) && left.slice(0, 4) === right.slice(0, 4));

const getEditionYear = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 4) : null;

const alignRaceDateToEditionRange = (
  raceDate: string | null,
  editionStartDate: string | null | undefined,
  editionEndDate?: string | null
) => {
  const startYear = getEditionYear(editionStartDate);
  if (!startYear) return raceDate;
  if (!raceDate) return editionStartDate ?? null;

  const endDate = editionEndDate && editionEndDate >= editionStartDate! ? editionEndDate : editionStartDate!;
  const candidateYears = Array.from(new Set([startYear, getEditionYear(endDate)].filter((year): year is string => Boolean(year))));
  const alignedDate = candidateYears
    .map((year) => `${year}${raceDate.slice(4)}`)
    .find((candidate) => {
      const parsed = new Date(`${candidate}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate && candidate >= editionStartDate! && candidate <= endDate;
    });
  return alignedDate ?? editionStartDate ?? raceDate;
};

const alignRaceToEventDate = (
  race: OrganizerWebsiteImportRace,
  eventRaceDate: string | null | undefined,
  eventEditionEndDate?: string | null
): OrganizerWebsiteImportRace => {
  const raceDate = alignRaceDateToEditionRange(race.raceDate, eventRaceDate, eventEditionEndDate);
  return {
    ...race,
    raceDate,
    missingFields: raceDate ? race.missingFields.filter((field) => field !== "Date format") : race.missingFields,
  };
};

const buildPreviewWarnings = (preview: OrganizerWebsiteImportPreview, event: EventContext) => {
  const warnings = [...preview.warnings];
  if (preview.event.name && normalizeComparableName(preview.event.name) !== normalizeComparableName(event.name)) {
    warnings.push("Le nom detecte ne correspond pas exactement a l'evenement claimé. Verifie avant validation.");
  }
  if (preview.event.raceDate && event.race_date && !datesShareYear(preview.event.raceDate, event.race_date)) {
    warnings.push("La date detectee semble pointer vers une autre edition que celle actuellement selectionnee.");
  }
  return warnings;
};

const buildRaceWarnings = (previewRace: OrganizerWebsiteImportRace, eventRace: EventRace | null) => {
  const warnings = [...(previewRace.missingFields.length > 0 ? ["Format partiellement incomplet."] : [])];
  if (!eventRace) return warnings;
  const nameMismatch =
    normalizeComparableName(previewRace.seriesName || previewRace.name) !== normalizeComparableName(eventRace.series_name || eventRace.name);
  if (nameMismatch) warnings.push("Le format cible suggere un libelle different.");
  if (previewRace.raceDate && eventRace.race_date && !datesShareYear(previewRace.raceDate, eventRace.race_date)) {
    warnings.push("La date detectee ne correspond pas a l'edition actuelle de ce format.");
  }
  return warnings;
};

const findMatchingSeriesRace = (previewRace: OrganizerWebsiteImportRace, races: EventRace[]) => {
  const targetName = normalizeComparableName(previewRace.seriesName || previewRace.name);
  const exactName = races.find(
    (race) =>
      normalizeComparableName(race.series_name || race.name) === targetName ||
      normalizeComparableName(race.name) === normalizeComparableName(previewRace.name)
  );
  if (exactName) return exactName;

  if (previewRace.distanceKm !== null) {
    const byDistance = races.find(
      (race) =>
        Math.abs(race.distance_km - previewRace.distanceKm!) <= 1 &&
        (!previewRace.raceDate || !race.race_date || datesShareYear(previewRace.raceDate, race.race_date))
    );
    if (byDistance) return byDistance;
  }

  return null;
};

const findSuggestedRace = (
  previewRace: OrganizerWebsiteImportRace,
  races: EventRace[],
  targetEditionYear: string | null,
  targetEditionId?: string | null
) =>
  findMatchingSeriesRace(
    previewRace,
    targetEditionId
      ? races.filter((race) => race.edition_id === targetEditionId || (!race.edition_id && getEditionYear(race.race_date) === targetEditionYear))
      : targetEditionYear ? races.filter((race) => getEditionYear(race.race_date) === targetEditionYear) : races
  );

const buildAugmentedPreview = (preview: OrganizerWebsiteImportPreview, event: EventContext) => ({
  ...preview,
  warnings: buildPreviewWarnings(preview, event),
  races: preview.races.map((race) => {
    const targetEventDate = preview.event.raceDate ?? event.race_date ?? null;
    const targetEditionYear = getEditionYear(targetEventDate);
    const targetEdition = (event.race_event_editions ?? []).find((edition) => String(edition.edition_year) === targetEditionYear) ?? null;
    const alignedRace = alignRaceToEventDate(race, targetEventDate, targetEdition?.end_date);
    const suggested = findSuggestedRace(alignedRace, event.races ?? [], targetEditionYear, targetEdition?.id);
    return {
      key: race.key,
      name: race.name,
      seriesName: race.seriesName,
      raceDate: alignedRace.raceDate,
      locationText: race.locationText,
      distanceKm: race.distanceKm,
      elevationGainM: race.elevationGainM,
      elevationLossM: race.elevationLossM,
      externalSiteUrl: race.externalSiteUrl,
      thumbnailUrl: race.thumbnailUrl,
      missingFields: alignedRace.missingFields,
      warnings: buildRaceWarnings(race, suggested),
      suggestedTargetRaceId: suggested?.id ?? null,
      canCreate:
        alignedRace.missingFields.length === 0 &&
        (!race.assessment || race.assessment.score >= MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE),
      hasReliableGpx: race.hasReliableGpx,
      detectedAidStationCount: race.aidStations.length,
      assessment: race.assessment ?? null,
    };
  }),
});

const loadEventContext = async (serviceConfig: ReturnType<typeof serviceHeaders> extends never ? never : Parameters<typeof serviceHeaders>[0], eventId: string) => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_date,organizer_details,race_event_editions(id,edition_year,start_date,end_date,is_current),races(id,edition_id,edition_group_id,series_name,name,race_date,distance_km,elevation_gain_m,elevation_loss_m,external_site_url,location_text,thumbnail_url,gpx_storage_path,is_live)&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer event import context", await response.text());
    return null;
  }

  return z.array(eventContextSchema).parse(await response.json())[0] ?? null;
};

const updateEventFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  event: EventContext,
  preview: OrganizerWebsiteImportPreview
) => {
  const currentDetails = parseOrganizerEventDetails(event.organizer_details);
  const logistics = preview.event.logistics ?? { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null };
  const updatePayload: Record<string, unknown> = {
    name: preview.event.name ?? event.name,
    location: preview.event.location ?? event.location ?? null,
    organizer_details: {
      ...currentDetails,
      officialWebsiteUrl: preview.event.officialWebsiteUrl ?? currentDetails.officialWebsiteUrl ?? null,
      mandatoryEquipment:
        currentDetails.mandatoryEquipment.items.length > 0 || logistics.mandatoryEquipment.length === 0
          ? currentDetails.mandatoryEquipment
          : {
              ...currentDetails.mandatoryEquipment,
              items: logistics.mandatoryEquipment.map((label, index) => ({
                id: `website-import-${index}`,
                label,
                required: true,
                cold: false,
                heat: false,
                note: null,
              })),
            },
      access: {
        ...currentDetails.access,
        startAddress: currentDetails.access.startAddress ?? logistics.startAddress,
        shuttles: currentDetails.access.shuttles ?? logistics.shuttles,
        officialParkings: currentDetails.access.officialParkings ?? logistics.officialParkings,
      },
    },
  };

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${event.id}`, {
    method: "PATCH",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(updatePayload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to update organizer event from website import", await response.text());
    throw new Error("Unable to update event.");
  }
};

const uploadRaceGpx = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  eventId: string,
  raceId: string,
  race: OrganizerWebsiteImportRace
) => {
  if (!race.gpxContent) return null;
  const storagePath = `organizer/${eventId}/${raceId}/website-import-${Date.now()}.gpx`;
  const uploadResponse = await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      "Content-Type": "application/gpx+xml",
      "x-upsert": "true",
    },
    body: race.gpxContent,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    console.error("Unable to upload organizer website import GPX", await uploadResponse.text());
    throw new Error("Unable to upload GPX.");
  }

  return storagePath;
};

const hydrateAidStationsIfEmpty = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  raceId: string,
  race: OrganizerWebsiteImportRace
) => {
  if (race.aidStations.length === 0) return 0;

  const countResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=count`,
    {
      headers: { ...serviceHeaders(serviceConfig, ""), Prefer: "count=exact", Range: "0-0" },
      cache: "no-store",
    }
  );

  if (!countResponse.ok) {
    console.error("Unable to inspect race aid stations before website import", await countResponse.text());
    return 0;
  }

  const countHeader = countResponse.headers.get("content-range");
  const existingCount = countHeader ? Number(countHeader.split("/")[1] ?? "0") : 0;
  if (Number.isFinite(existingCount) && existingCount > 0) return 0;

  const insertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(
      race.aidStations.map((station, index) => ({
        race_id: raceId,
        name: station.name,
        km: station.distanceKm,
        water_available: station.waterRefill,
        solid_available: true,
        assistance_allowed: true,
        order_index: index,
      }))
    ),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to hydrate aid stations from website import", await insertResponse.text());
    return 0;
  }

  return race.aidStations.length;
};

const createRaceFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  eventId: string,
  race: OrganizerWebsiteImportRace,
  editionGroupId: string | null,
  editionId: string
) => {
  if (race.missingFields.length > 0 || !race.raceDate || race.distanceKm === null || race.elevationGainM === null) {
    throw new Error("Incomplete race preview.");
  }

  const raceId = randomUUID();
  const gpxStoragePath = race.gpxContent ? await uploadRaceGpx(serviceConfig, eventId, raceId, race) : null;
  // `gpx_path` is a legacy required column, while `gpx_storage_path` accurately signals whether a GPX was imported.
  const legacyGpxPath = gpxStoragePath ?? `organizer/${eventId}/${raceId}.gpx`;
  const insertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: raceId,
      event_id: eventId,
      edition_id: editionId,
      edition_group_id: editionGroupId ?? raceId,
      slug: buildSlug(race.name, "organizer"),
      series_name: race.seriesName || race.name,
      name: race.name,
      race_date: race.raceDate,
      distance_km: race.distanceKm,
      elevation_gain_m: race.elevationGainM,
      elevation_loss_m: race.elevationLossM ?? 0,
      location_text: race.locationText,
      external_site_url: race.externalSiteUrl,
      thumbnail_url: race.thumbnailUrl,
      gpx_path: legacyGpxPath,
      gpx_hash: gpxStoragePath ? `website-import:${raceId}` : `manual:${raceId}`,
      gpx_storage_path: gpxStoragePath,
      gpx_sha256: gpxStoragePath ? null : null,
      is_live: true,
      is_public: true,
      created_by: null,
      organizer_details: null,
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create organizer race from website import", await insertResponse.text());
    throw new Error("Unable to create race.");
  }

  const createdRace = z
    .array(z.object({ id: z.string().uuid() }))
    .parse(await insertResponse.json())[0];
  const createdAidStations = await hydrateAidStationsIfEmpty(serviceConfig, createdRace.id, race);

  return { raceId: createdRace.id, gpxUploaded: Boolean(gpxStoragePath), createdAidStations };
};

const ensureEventEdition = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  event: EventContext,
  startDate: string,
  endDate: string
) => {
  const editionYear = Number(startDate.slice(0, 4));
  const existing = (event.race_event_editions ?? []).find((edition) => edition.edition_year === editionYear) ?? null;
  const normalizedEndDate = endDate >= startDate ? endDate : startDate;
  const response = await fetch(
    existing
      ? `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${existing.id}`
      : `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions`,
    {
      method: existing ? "PATCH" : "POST",
      headers: { ...serviceHeaders(serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify(
        existing
          ? { start_date: startDate, end_date: normalizedEndDate }
          : {
              event_id: event.id,
              edition_year: editionYear,
              start_date: startDate,
              end_date: normalizedEndDate,
              is_current: !(event.race_event_editions ?? []).some((edition) => edition.is_current),
            }
      ),
      cache: "no-store",
    }
  );
  if (!response.ok) throw new Error("Unable to persist event edition.");
  return z.array(z.object({ id: z.string().uuid(), start_date: z.string(), end_date: z.string() })).parse(await response.json())[0] ?? null;
};

const updateRaceFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  existingRace: EventRace,
  race: OrganizerWebsiteImportRace,
  editionId: string
) => {
  const updatePayload: Record<string, unknown> = {
    edition_id: editionId,
    series_name: race.seriesName || existingRace.series_name,
    name: race.name || existingRace.name,
    race_date: race.raceDate ?? existingRace.race_date ?? null,
    location_text: race.locationText ?? existingRace.location_text ?? null,
    external_site_url: race.externalSiteUrl ?? existingRace.external_site_url ?? null,
    distance_km: race.distanceKm ?? existingRace.distance_km,
    elevation_gain_m: race.elevationGainM ?? existingRace.elevation_gain_m,
    elevation_loss_m: race.elevationLossM ?? existingRace.elevation_loss_m ?? null,
    thumbnail_url: existingRace.thumbnail_url ?? race.thumbnailUrl ?? null,
  };

  let gpxUploaded = false;
  if (!existingRace.gpx_storage_path && race.gpxContent) {
    const gpxStoragePath = await uploadRaceGpx(serviceConfig, existingRace.id, existingRace.id, race);
    updatePayload.gpx_path = gpxStoragePath;
    updatePayload.gpx_hash = gpxStoragePath ? `website-import:${existingRace.id}` : null;
    updatePayload.gpx_storage_path = gpxStoragePath;
    updatePayload.gpx_sha256 = null;
    gpxUploaded = Boolean(gpxStoragePath);
  }

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${existingRace.id}`, {
    method: "PATCH",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(updatePayload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to update organizer race from website import", await response.text());
    throw new Error("Unable to update race.");
  }

  const createdAidStations = await hydrateAidStationsIfEmpty(serviceConfig, existingRace.id, race);
  return { raceId: existingRace.id, gpxUploaded, createdAidStations };
};

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const organizer = await requireEventOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if (organizer !== true) return organizer.error;

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  const rawBody = isMultipart ? null : await request.json().catch(() => null);
  const isApply = rawBody?.action === "apply";
  const previewRequest = isMultipart ? await parsePreviewRequest(request) : { parsed: previewRequestSchema.safeParse(rawBody), documents: [] as File[] };
  const parsedBody = isApply ? applyRequestSchema.safeParse(rawBody) : previewRequest.parsed;
  if (!parsedBody.success) return jsonError("Invalid import request.", 400);

  const rateLimit = await checkRateLimitAsync(`organizer-website-import:${auth.user.id}:${parsedParams.data.id}`, 6, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const event = await loadEventContext(auth.serviceConfig, parsedParams.data.id);
  if (!event) return jsonError("Unable to load event.", 502);

  try {
    const preview = parsedBody.data.url
      ? await buildOrganizerWebsiteImportPreview(parsedBody.data.url, { formatUrls: parsedBody.data.formatUrls })
      : emptyWebsitePreview();
    const previewHash = computeOrganizerWebsiteImportPreviewHash(preview);
    const augmentedPreview = buildAugmentedPreview(preview, event);

    if (parsedBody.data.action === "preview") {
      const formatCandidates = [
        ...(event.races ?? []).map((race) => ({
          name: race.name,
          distanceKm: race.distance_km,
          elevationGainM: race.elevation_gain_m,
          elevationLossM: race.elevation_loss_m ?? null,
          startTime: parseOrganizerRaceDetails(race.organizer_details).schedule.startTime,
          bibPickup: parseOrganizerRaceDetails(race.organizer_details).bibPickup.locations.map((location) => location.location ?? "").join(" ") || parseOrganizerRaceDetails(race.organizer_details).bibPickup.schedule,
          cutoff: parseOrganizerRaceDetails(race.organizer_details).schedule.finishCutoffTime,
        })),
        ...preview.races.map((race) => ({
          name: race.name,
          distanceKm: race.distanceKm,
          elevationGainM: race.elevationGainM,
          elevationLossM: race.elevationLossM,
        })),
      ];
      const formatNames = formatCandidates.map((race) => race.name);
      const documents = await Promise.all(
        previewRequest.documents.map(async (file, index) => {
          const document = await extractOrganizerDocument(file, `document:${index}:${file.name}`);
          const findings = attachDocumentFindingsToFormats(document.findings, formatNames);
                  return { ...document, findings: reconcileOrganizerDocumentFindings(findings, formatCandidates) };
        })
      );
      const documentWarnings = documents.map((document) =>
        document.status === "extracted"
          ? `Document analysé : ${document.fileName} (${document.pageCount ?? 0} page(s), texte extrait).`
          : `${document.fileName} : ${document.message ?? "Document en attente d'extraction."}`
      );
      return withSecurityHeaders(
        NextResponse.json({
          preview: {
            ...augmentedPreview,
            warnings: [...augmentedPreview.warnings, ...documentWarnings],
            documents: documents.map(({ text: _text, ...document }) => document),
            previewHash,
          },
        })
      );
    }

    if (previewHash !== parsedBody.data.previewHash) {
      return jsonError("The preview is outdated. Run the analysis again before applying.", 409);
    }

    const previewRaceMap = new Map(preview.races.map((race) => [race.key, race]));
    const eventRaceMap = new Map((event.races ?? []).map((race) => [race.id, race]));
    const actionableSelections = parsedBody.data.raceSelections.filter((selection) => selection.mode !== "ignore");
    const eventPreview = parsedBody.data.eventRaceDate
      ? { ...preview, event: { ...preview.event, raceDate: parsedBody.data.eventRaceDate } }
      : preview;
    const targetEventDate = eventPreview.event.raceDate ?? event.race_date ?? null;
    const targetEditionYear = getEditionYear(targetEventDate);
    const hasEventUpdate =
      Boolean(eventPreview.event.name?.trim()) ||
      Boolean(eventPreview.event.location?.trim()) ||
      Boolean(eventPreview.event.raceDate?.trim()) ||
      Boolean(eventPreview.event.officialWebsiteUrl?.trim());

    if (!hasEventUpdate && actionableSelections.length === 0) {
      return jsonError("No applicable changes selected.", 400);
    }

    if (!targetEventDate) return jsonError("Ajoute une date d'édition avant l'import.", 409);
    const existingTargetEdition = (event.race_event_editions ?? []).find((edition) => String(edition.edition_year) === targetEditionYear) ?? null;
    const targetEdition = await ensureEventEdition(
      auth.serviceConfig,
      event,
      targetEventDate,
      parsedBody.data.eventEditionEndDate ?? existingTargetEdition?.end_date ?? targetEventDate
    );
    if (!targetEdition) return jsonError("Unable to persist event edition.", 502);

    await updateEventFromPreview(auth.serviceConfig, event, eventPreview);

    let createdRaces = 0;
    let updatedRaces = 0;
    let gpxUploads = 0;
    let hydratedAidStations = 0;

    for (const selection of actionableSelections) {
      const previewRace = previewRaceMap.get(selection.previewRaceKey);
      if (!previewRace) return jsonError("Incoherent preview selection.", 409);
      if (previewRace.assessment && previewRace.assessment.score < MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE) {
        return jsonError("This format score is too low to import. Analyse a more specific format page.", 400);
      }

      const alignedRace = alignRaceToEventDate(previewRace, targetEdition.start_date, targetEdition.end_date);
      const existingEdition = findSuggestedRace(alignedRace, event.races ?? [], targetEditionYear, targetEdition.id);
      const seriesReference = findMatchingSeriesRace(alignedRace, event.races ?? []);

      if (selection.mode === "create") {
        const result = existingEdition
          ? await updateRaceFromPreview(auth.serviceConfig, existingEdition, alignedRace, targetEdition.id)
          : await createRaceFromPreview(
              auth.serviceConfig,
              parsedParams.data.id,
              alignedRace,
              seriesReference?.edition_group_id ?? null,
              targetEdition.id
            );
        if (existingEdition) updatedRaces += 1;
        else createdRaces += 1;
        gpxUploads += result.gpxUploaded ? 1 : 0;
        hydratedAidStations += result.createdAidStations;
        continue;
      }

      const selectedTargetRace = selection.targetRaceId ? eventRaceMap.get(selection.targetRaceId) ?? null : null;
      const targetRace =
        selectedTargetRace && (selectedTargetRace.edition_id === targetEdition.id || (!selectedTargetRace.edition_id && getEditionYear(selectedTargetRace.race_date) === targetEditionYear))
          ? selectedTargetRace
          : existingEdition;
      const result = targetRace
        ? await updateRaceFromPreview(auth.serviceConfig, targetRace, alignedRace, targetEdition.id)
        : await createRaceFromPreview(
            auth.serviceConfig,
            parsedParams.data.id,
            alignedRace,
            seriesReference?.edition_group_id ?? null,
            targetEdition.id
          );
      if (targetRace) updatedRaces += 1;
      else createdRaces += 1;
      gpxUploads += result.gpxUploaded ? 1 : 0;
      hydratedAidStations += result.createdAidStations;
    }

    return withSecurityHeaders(
      NextResponse.json({
        applied: {
          eventUpdated: true,
          createdRaces,
          updatedRaces,
          gpxUploads,
          hydratedAidStations,
        },
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid website import payload.", 400);
    }
    if (error instanceof Error && "code" in error) {
      const code = (error as { code?: string }).code;
      const status =
        code === "INVALID_URL"
          ? 400
          : code === "AUTH_REQUIRED"
            ? 403
            : code === "AUTH_FAILED"
              ? 401
              : code === "FETCH_FAILED"
                ? 502
                : 422;
      return jsonError(error.message, status);
    }
    console.error("Unexpected organizer website import error", error);
    return jsonError("Unable to import this website.", 500);
  }
}
