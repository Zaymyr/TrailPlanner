import { z } from "zod";

import { defaultFuelType, fuelTypeSchema } from "./fuel-types";
import type { FuelProduct } from "./product-types";
import type { SupabaseServiceConfig } from "./supabase";

export type SourceAidStation = {
  id: string;
  race_id?: string | null;
  name: string;
  km: number;
};

export type OrganizerAidStationProductSuggestion = {
  aidStationKey: string;
  sourceAidStationId?: string;
  aidStationName: string;
  distanceKm: number;
  notes?: string | null;
  orderIndex: number;
  product: FuelProduct;
};

export type OrganizerAidStationProductsByKey = Record<string, OrganizerAidStationProductSuggestion[]>;
export type OrganizerAidStationProductsByRaceId = Record<string, OrganizerAidStationProductsByKey>;

const organizerProductRowSchema = z.object({
  race_aid_station_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
  products: z
    .object({
      id: z.string().uuid(),
      slug: z.string(),
      sku: z.string().optional().nullable(),
      name: z.string(),
      brand: z.string().optional().nullable(),
      image_url: z.string().url().optional().nullable(),
      fuel_type: fuelTypeSchema.optional().default(defaultFuelType),
      product_url: z.string().url().optional().nullable(),
      calories_kcal: z.union([z.number(), z.string()]).transform((value) => Number(value)),
      carbs_g: z.union([z.number(), z.string()]).transform((value) => Number(value)),
      sodium_mg: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
      protein_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
      fat_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
      created_by: z.string().uuid().optional().nullable(),
      is_official: z.boolean().optional().default(false),
    })
    .nullable()
    .optional(),
});

const sourceAidStationSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  km: z.number(),
});

const serviceHeaders = (supabaseServiceRoleKey: string, contentType = "application/json") => ({
  apikey: supabaseServiceRoleKey,
  Authorization: `Bearer ${supabaseServiceRoleKey}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

export const buildAidStationProductKey = (name: string, distanceKm: number) =>
  `${name.trim().toLowerCase()}|${Number(distanceKm.toFixed(2))}`;

export const buildSourceAidStationProductKey = (sourceAidStationId: string) => `source:${sourceAidStationId}`;

const addSuggestionsForKey = (
  productsByKey: OrganizerAidStationProductsByKey,
  key: string,
  suggestions: OrganizerAidStationProductSuggestion[]
) => {
  if (suggestions.length > 0) {
    productsByKey[key] = suggestions.map((suggestion) => ({ ...suggestion, aidStationKey: key }));
  }
};

export const mapOrganizerAidStationProductRows = (
  rows: z.infer<typeof organizerProductRowSchema>[],
  stations: SourceAidStation[]
): OrganizerAidStationProductsByRaceId => {
  const stationById = new Map(stations.map((station) => [station.id, station]));
  const groupedByStationId = new Map<string, OrganizerAidStationProductSuggestion[]>();

  rows.forEach((row) => {
    const station = stationById.get(row.race_aid_station_id);
    if (!station || !row.products) return;

    const legacyKey = buildAidStationProductKey(station.name, station.km);
    const suggestion: OrganizerAidStationProductSuggestion = {
      aidStationKey: legacyKey,
      sourceAidStationId: station.id,
      aidStationName: station.name,
      distanceKm: station.km,
      notes: row.notes ?? null,
      orderIndex: row.order_index ?? 0,
      product: {
        id: row.products.id,
        slug: row.products.slug,
        sku: row.products.sku ?? undefined,
        name: row.products.name,
        brand: row.products.brand ?? undefined,
        imageUrl: row.products.image_url ?? undefined,
        fuelType: row.products.fuel_type ?? defaultFuelType,
        productUrl: row.products.product_url ?? undefined,
        caloriesKcal: Number(row.products.calories_kcal) || 0,
        carbsGrams: Number(row.products.carbs_g) || 0,
        sodiumMg: Number(row.products.sodium_mg) || 0,
        proteinGrams: Number(row.products.protein_g) || 0,
        fatGrams: Number(row.products.fat_g) || 0,
        waterMl: 0,
        createdBy: row.products.created_by ?? null,
        isOfficial: row.products.is_official ?? false,
      },
    };

    const stationSuggestions = groupedByStationId.get(station.id) ?? [];
    stationSuggestions.push(suggestion);
    groupedByStationId.set(station.id, stationSuggestions);
  });

  const productsByRaceId = stations.reduce<OrganizerAidStationProductsByRaceId>((acc, station) => {
    if (station.race_id) acc[station.race_id] ??= {};
    return acc;
  }, {});

  stations.forEach((station) => {
    if (!station.race_id) return;

    const suggestions = groupedByStationId.get(station.id) ?? [];
    productsByRaceId[station.race_id] ??= {};
    const productsByKey = productsByRaceId[station.race_id];

    addSuggestionsForKey(productsByKey, buildSourceAidStationProductKey(station.id), suggestions);
    addSuggestionsForKey(productsByKey, buildAidStationProductKey(station.name, station.km), suggestions);
  });

  return productsByRaceId;
};

export const loadOrganizerAidStationProductsForStations = async (
  supabaseService: SupabaseServiceConfig,
  stations: SourceAidStation[]
): Promise<OrganizerAidStationProductsByRaceId> => {
  const stationIds = stations.map((station) => station.id);

  if (stationIds.length === 0) {
    return {};
  }

  const response = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/race_aid_station_products?race_aid_station_id=in.(${stationIds.join(
      ","
    )})&select=race_aid_station_id,notes,order_index,products(id,slug,sku,name,brand,image_url,fuel_type,product_url,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g,created_by,is_official)&order=order_index.asc`,
    {
      headers: serviceHeaders(supabaseService.supabaseServiceRoleKey, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(await response.text().catch(() => "Unable to load organizer aid station products"));
  }

  const rows = z.array(organizerProductRowSchema).parse(await response.json());
  return mapOrganizerAidStationProductRows(rows, stations);
};

export const loadOrganizerAidStationProductsForRaceIds = async (
  supabaseService: SupabaseServiceConfig,
  raceIds: string[]
): Promise<OrganizerAidStationProductsByRaceId> => {
  const uniqueRaceIds = Array.from(new Set(raceIds.filter(Boolean)));

  if (uniqueRaceIds.length === 0) {
    return {};
  }

  const stationsResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/race_aid_stations?race_id=in.(${uniqueRaceIds.join(
      ","
    )})&select=id,race_id,name,km&order=order_index.asc`,
    {
      headers: serviceHeaders(supabaseService.supabaseServiceRoleKey, ""),
      cache: "no-store",
    }
  );

  if (!stationsResponse.ok) {
    throw new Error(await stationsResponse.text().catch(() => "Unable to load race aid stations"));
  }

  const stations = z.array(sourceAidStationSchema).parse(await stationsResponse.json());
  const productsByRaceId = await loadOrganizerAidStationProductsForStations(supabaseService, stations);

  uniqueRaceIds.forEach((raceId) => {
    productsByRaceId[raceId] ??= {};
  });

  return productsByRaceId;
};
