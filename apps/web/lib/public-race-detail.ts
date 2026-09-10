import "server-only";

import { z } from "zod";

import { parseGpx } from "./gpx/parseGpx";
import {
  buildRunnerOrganizerDetails,
  getOrganizerBibPickupLocations,
  parseOrganizerAidStationDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "./organizer-dashboard-details";
import { loadOrganizerEditionEntitlement } from "./organizer-entitlements";
import { effectiveOrganizerModules, loadOrganizerModuleSettings } from "./organizer-module-settings";
import { ORGANIZER_MODULES, type OrganizerModuleKey } from "./organizer-modules";
import type { PublicRace } from "./public-races";
import { getSupabaseServiceConfig, type SupabaseServiceConfig } from "./supabase";

const detailRaceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable(),
  edition_id: z.string().uuid().nullable().optional(),
  elevation_loss_m: z.number().nullable().optional(),
  min_alt_m: z.number().nullable().optional(),
  max_alt_m: z.number().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  participation_mode: z.enum(["solo", "relay", "solo_and_relay"]).nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  racebook_is_live: z.boolean().optional().default(false),
});

const detailEventSchema = z.object({
  id: z.string().uuid(),
  is_live: z.boolean(),
  organizer_details: z.unknown().nullable().optional(),
});

const detailEditionSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  end_date: z.string(),
  is_visible: z.boolean(),
});

const aidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean().optional().default(true),
  solid_available: z.boolean().optional().default(true),
  assistance_allowed: z.boolean().optional().default(true),
  notes: z.string().nullable().optional(),
  order_index: z.number().optional().default(0),
  organizer_details: z.unknown().nullable().optional(),
});

export type PublicRaceRoutePoint = {
  distanceKm: number;
  elevationM: number | null;
  lat: number;
  lon: number;
};

export type PublicRaceRoutePreview = {
  points: PublicRaceRoutePoint[];
  stats: {
    distanceKm: number;
    gainM: number;
    lossM: number;
    minAltM: number | null;
    maxAltM: number | null;
  };
};

export type PublicRaceAidStation = {
  id: string;
  name: string;
  distanceKm: number;
  altitudeM: number | null;
  cumulativeElevationGainM: number | null;
  cumulativeElevationLossM: number | null;
  cutoffTime: string | null;
  waterAvailable: boolean;
  solidAvailable: boolean;
  assistanceAllowed: boolean;
  dropBagAvailable: boolean;
  note: string | null;
};

type PublicLocation = { label: string | null; googleMapsUrl: string | null };

export type PublicRaceDetail = PublicRace & {
  elevationLossM: number | null;
  minAltitudeM: number | null;
  maxAltitudeM: number | null;
  participationMode: "solo" | "relay" | "solo_and_relay" | null;
  eventEndDate: string | null;
  officialWebsiteUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  routePreview: PublicRaceRoutePreview | null;
  aidStations: PublicRaceAidStation[];
  practical: {
    schedule: {
      startTime: string | null;
      finishCutoffTime: string | null;
      cutoffNote: string | null;
      note: string | null;
    };
    equipment: {
      items: Array<{ label: string; required: boolean; note: string | null }>;
      note: string | null;
    };
    bibPickup: {
      locations: Array<{
        label: string | null;
        location: PublicLocation;
        slots: Array<{ date: string | null; startTime: string | null; endTime: string | null }>;
      }>;
      schedule: string | null;
      requiredDocuments: string | null;
      thirdPartyPickupAllowed: boolean | null;
      equipmentCheck: boolean | null;
      note: string | null;
    };
    access: {
      startAddress: string | null;
      startLocation: PublicLocation;
      finishAddress: string | null;
      finishLocation: PublicLocation;
      officialParkings: string | null;
      shuttles: string | null;
      shuttleSchedule: string | null;
      roadRestrictions: string | null;
      mapUrl: string | null;
      note: string | null;
    };
    runnerInfo: { startArea: string | null; briefing: string | null; rules: string | null; note: string | null };
    services: {
      supporters: string | null;
      accommodations: string | null;
      restaurants: string | null;
      recovery: string | null;
      partners: string | null;
      note: string | null;
    };
  };
};

const serviceHeaders = (config: SupabaseServiceConfig) => ({
  apikey: config.supabaseServiceRoleKey,
  Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
});

const fetchServiceRows = async <T>(config: SupabaseServiceConfig, path: string, schema: z.ZodType<T>) => {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: serviceHeaders(config),
    next: { revalidate: 3600 },
  });
  if (!response.ok) throw new Error(`Supabase detail read failed (${response.status})`);
  return z.array(schema).parse(await response.json());
};

const toPublicLocation = (location: { label: string | null; googleMapsUrl: string | null }): PublicLocation => ({
  label: location.label,
  googleMapsUrl: location.googleMapsUrl,
});

export function buildPublicRaceRoutePreview(gpxContent: string, maxPoints = 600): PublicRaceRoutePreview {
  const parsed = parseGpx(gpxContent);
  const step = Math.max(1, Math.ceil(parsed.points.length / maxPoints));
  const selected = parsed.points.filter(
    (_point, index) => index === 0 || index === parsed.points.length - 1 || index % step === 0,
  );

  return {
    points: selected.map((point) => ({
      distanceKm: point.distKmCum,
      elevationM: point.ele ?? null,
      lat: point.lat,
      lon: point.lng,
    })),
    stats: {
      distanceKm: parsed.stats.distanceKm,
      gainM: parsed.stats.gainM,
      lossM: parsed.stats.lossM,
      minAltM: parsed.stats.minAltM,
      maxAltM: parsed.stats.maxAltM,
    },
  };
}

const emptyDetail = (race: PublicRace): PublicRaceDetail => ({
  ...race,
  elevationLossM: null,
  minAltitudeM: null,
  maxAltitudeM: null,
  participationMode: null,
  eventEndDate: null,
  officialWebsiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  routePreview: null,
  aidStations: [],
  practical: {
    schedule: { startTime: null, finishCutoffTime: null, cutoffNote: null, note: null },
    equipment: { items: [], note: null },
    bibPickup: {
      locations: [],
      schedule: null,
      requiredDocuments: null,
      thirdPartyPickupAllowed: null,
      equipmentCheck: null,
      note: null,
    },
    access: {
      startAddress: null,
      startLocation: { label: null, googleMapsUrl: null },
      finishAddress: null,
      finishLocation: { label: null, googleMapsUrl: null },
      officialParkings: null,
      shuttles: null,
      shuttleSchedule: null,
      roadRestrictions: null,
      mapUrl: null,
      note: null,
    },
    runnerInfo: { startArea: null, briefing: null, rules: null, note: null },
    services: {
      supporters: null,
      accommodations: null,
      restaurants: null,
      recovery: null,
      partners: null,
      note: null,
    },
  },
});

async function loadRoutePreview(config: SupabaseServiceConfig, storagePath: string | null | undefined) {
  if (!storagePath) return null;
  try {
    const response = await fetch(`${config.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
      headers: serviceHeaders(config),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    return buildPublicRaceRoutePreview(await response.text());
  } catch (error) {
    console.error("Unable to build public race GPX preview", error);
    return null;
  }
}

export async function getPublicRaceDetail(race: PublicRace): Promise<PublicRaceDetail | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return emptyDetail(race);

  try {
    const rows = await fetchServiceRows(
      config,
      `races?id=eq.${encodeURIComponent(race.id)}&is_live=eq.true&is_public=eq.true&select=id,event_id,edition_id,elevation_loss_m,min_alt_m,max_alt_m,gpx_storage_path,participation_mode,organizer_details,racebook_is_live&limit=1`,
      detailRaceSchema,
    );
    const sourceRace = rows[0];
    if (!sourceRace) return null;

    const events = sourceRace.event_id
      ? await fetchServiceRows(
          config,
          `race_events?id=eq.${encodeURIComponent(sourceRace.event_id)}&is_live=eq.true&select=id,is_live,organizer_details&limit=1`,
          detailEventSchema,
        )
      : [];
    if (sourceRace.event_id && !events[0]) return null;

    const editions = sourceRace.edition_id
      ? await fetchServiceRows(
          config,
          `race_event_editions?id=eq.${encodeURIComponent(sourceRace.edition_id)}&is_visible=eq.true&select=id,event_id,end_date,is_visible&limit=1`,
          detailEditionSchema,
        )
      : [];
    if (sourceRace.edition_id && (!editions[0] || editions[0].event_id !== sourceRace.event_id)) return null;

    const racebookIsLive = sourceRace.racebook_is_live === true;
    const publicModules: Record<OrganizerModuleKey, boolean> = sourceRace.edition_id && racebookIsLive
      ? await Promise.all([
          loadOrganizerModuleSettings(config, sourceRace.edition_id, [sourceRace.id]),
          loadOrganizerEditionEntitlement(config, sourceRace.edition_id),
        ]).then(([settings, entitlement]) => effectiveOrganizerModules(
          entitlement?.status === "active" ? entitlement.tier : "visibility",
          settings,
          sourceRace.id,
        ))
      : Object.fromEntries(ORGANIZER_MODULES.map((module) => [module.key, !sourceRace.edition_id && racebookIsLive])) as Record<OrganizerModuleKey, boolean>;

    const eventDetails = parseOrganizerEventDetails(events[0]?.organizer_details);
    const raceDetails = parseOrganizerRaceDetails(sourceRace.organizer_details);
    const runner = buildRunnerOrganizerDetails(eventDetails, raceDetails);
    const [stationRows, routePreview] = await Promise.all([
      publicModules.aid_stations ? fetchServiceRows(
        config,
        `race_aid_stations?race_id=eq.${encodeURIComponent(race.id)}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details&order=order_index.asc,km.asc`,
        aidStationSchema,
      ).catch((error) => {
        console.error("Unable to load public race aid stations", error);
        return [];
      }) : Promise.resolve([]),
      loadRoutePreview(config, sourceRace.gpx_storage_path),
    ]);

    const enabled = runner.access.enabledSections;
    return {
      ...race,
      elevationLossM: sourceRace.elevation_loss_m ?? null,
      minAltitudeM: sourceRace.min_alt_m ?? routePreview?.stats.minAltM ?? null,
      maxAltitudeM: sourceRace.max_alt_m ?? routePreview?.stats.maxAltM ?? null,
      participationMode: sourceRace.participation_mode ?? null,
      eventEndDate: editions[0]?.end_date ?? (!sourceRace.edition_id ? eventDetails.dateRange.endDate : null),
      officialWebsiteUrl: eventDetails.officialWebsiteUrl,
      instagramUrl: eventDetails.instagramUrl,
      facebookUrl: eventDetails.facebookUrl,
      routePreview,
      aidStations: stationRows.map((station) => {
        const details = parseOrganizerAidStationDetails(station.organizer_details);
        return {
          id: station.id,
          name: station.name,
          distanceKm: station.km,
          altitudeM: details.altitudeM,
          cumulativeElevationGainM: details.cumulativeElevationGainM,
          cumulativeElevationLossM: details.cumulativeElevationLossM,
          cutoffTime: details.cutoffTime,
          waterAvailable: station.water_available ?? true,
          solidAvailable: station.solid_available ?? true,
          assistanceAllowed: station.assistance_allowed ?? true,
          dropBagAvailable: details.dropBagAvailable,
          note: details.organizerNote ?? station.notes ?? null,
        };
      }),
      practical: {
        schedule: {
          startTime: publicModules.aid_stations ? runner.schedule.startTime : null,
          finishCutoffTime: publicModules.aid_stations ? runner.schedule.finishCutoffTime : null,
          cutoffNote: publicModules.aid_stations ? runner.schedule.cutoffNote : null,
          note: publicModules.aid_stations ? runner.schedule.note : null,
        },
        equipment: {
          items: publicModules.equipment ? runner.equipmentStatus.items
            .filter((item) => item.active)
            .map((item) => ({ label: item.label, required: item.required, note: item.note })) : [],
          note: publicModules.equipment ? runner.equipment.note : null,
        },
        bibPickup: {
          locations: publicModules.bib_pickup ? getOrganizerBibPickupLocations(runner.bibPickup).map((location) => ({
            label: location.location,
            location: toPublicLocation(location.locationDetails),
            slots: location.slots,
          })) : [],
          schedule: publicModules.bib_pickup ? runner.bibPickup.schedule : null,
          requiredDocuments: publicModules.bib_pickup ? runner.bibPickup.requiredDocuments : null,
          thirdPartyPickupAllowed: publicModules.bib_pickup ? runner.bibPickup.thirdPartyPickupAllowed : null,
          equipmentCheck: publicModules.bib_pickup ? runner.bibPickup.equipmentCheck : null,
          note: publicModules.bib_pickup ? runner.bibPickup.note : null,
        },
        access: {
          startAddress: publicModules.access ? runner.access.startAddress : null,
          startLocation: publicModules.access ? toPublicLocation(runner.access.startLocation) : { label: null, googleMapsUrl: null },
          finishAddress: publicModules.access ? runner.access.finishAddress : null,
          finishLocation: publicModules.access ? toPublicLocation(runner.access.finishLocation) : { label: null, googleMapsUrl: null },
          officialParkings: publicModules.access && enabled.officialParkings ? runner.access.officialParkings : null,
          shuttles: publicModules.access && enabled.shuttles ? runner.access.shuttles : null,
          shuttleSchedule: publicModules.access && enabled.shuttles ? runner.access.shuttleSchedule : null,
          roadRestrictions: publicModules.access && enabled.roadRestrictions ? runner.access.roadRestrictions : null,
          mapUrl: publicModules.access && enabled.mapUrl ? runner.access.mapUrl : null,
          note: publicModules.access ? runner.access.note : null,
        },
        runnerInfo: publicModules.access && enabled.runnerInfo
          ? runner.runnerInfo
          : { startArea: null, briefing: null, rules: null, note: null },
        services: {
          supporters: publicModules.services ? runner.services.supporters : null,
          accommodations: publicModules.services ? runner.services.accommodations : null,
          restaurants: publicModules.services ? runner.services.restaurants : null,
          recovery: publicModules.services ? runner.services.recovery : null,
          partners: publicModules.services ? runner.services.partners : null,
          note: publicModules.services ? runner.services.note : null,
        },
      },
    };
  } catch (error) {
    console.error("Unable to load public race detail", error);
    return emptyDetail(race);
  }
}
