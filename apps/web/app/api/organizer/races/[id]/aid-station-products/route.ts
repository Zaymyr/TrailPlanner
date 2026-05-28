import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { defaultFuelType, fuelTypeSchema } from "../../../../../../lib/fuel-types";
import { withSecurityHeaders } from "../../../../../../lib/http";
import {
  buildSlug,
  jsonError,
  loadRaceForOrganizer,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireOrganizerAuth,
  serviceHeaders,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import type { FuelProduct } from "../../../../../../lib/product-types";

const supabaseProductSchema = z.object({
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
});

const aidStationProductRowSchema = z.object({
  id: z.string().uuid(),
  race_aid_station_id: z.string().uuid(),
  product_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
  products: supabaseProductSchema.nullable().optional(),
});

const aidStationRaceRowSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
});

const updateProductsSchema = z.object({
  aidStationId: z.string().uuid(),
  products: z.array(
    z.object({
      productId: z.string().uuid(),
      notes: optionalTextOrNull,
    })
  ),
});

const createScopedProductSchema = z.object({
  aidStationId: z.string().uuid(),
  product: z.object({
    name: z.string().trim().min(1),
    brand: optionalTextOrNull,
    sku: optionalTextOrNull,
    fuelType: fuelTypeSchema.optional().default(defaultFuelType),
    productUrl: optionalUrlOrNull,
    caloriesKcal: z.coerce.number().nonnegative().default(0),
    carbsGrams: z.coerce.number().nonnegative().default(0),
    sodiumMg: z.coerce.number().nonnegative().default(0),
    proteinGrams: z.coerce.number().nonnegative().default(0),
    fatGrams: z.coerce.number().nonnegative().default(0),
  }),
  notes: optionalTextOrNull,
});

const toProduct = (row: z.infer<typeof supabaseProductSchema>): FuelProduct => ({
  id: row.id,
  slug: row.slug,
  sku: row.sku ?? undefined,
  name: row.name,
  brand: row.brand ?? undefined,
  imageUrl: row.image_url ?? undefined,
  fuelType: row.fuel_type ?? defaultFuelType,
  productUrl: row.product_url ?? undefined,
  caloriesKcal: Number(row.calories_kcal) || 0,
  carbsGrams: Number(row.carbs_g) || 0,
  sodiumMg: Number(row.sodium_mg) || 0,
  proteinGrams: Number(row.protein_g) || 0,
  fatGrams: Number(row.fat_g) || 0,
  waterMl: 0,
  createdBy: row.created_by ?? null,
  isOfficial: row.is_official ?? false,
});

const mapStationProduct = (row: z.infer<typeof aidStationProductRowSchema>) => ({
  id: row.id,
  aidStationId: row.race_aid_station_id,
  productId: row.product_id,
  notes: row.notes ?? null,
  orderIndex: row.order_index,
  product: row.products ? toProduct(row.products) : null,
});

async function requireStationForRace(auth: Awaited<ReturnType<typeof requireOrganizerAuth>>, raceId: string, aidStationId: string) {
  if ("error" in auth) return auth;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?id=eq.${aidStationId}&select=id,race_id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify organizer aid station", await response.text());
    return { error: jsonError("Unable to verify aid station.", 502) };
  }

  const station = z.array(aidStationRaceRowSchema).parse(await response.json())[0] ?? null;
  if (!station) return { error: jsonError("Aid station not found.", 404) };
  if (station.race_id !== raceId) return { error: jsonError("Aid station does not belong to this race.", 409) };

  return station;
}

export async function GET(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const response = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products?select=id,race_aid_station_id,product_id,notes,order_index,products(id,slug,sku,name,brand,image_url,fuel_type,product_url,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g,created_by,is_official),race_aid_stations!inner(race_id)&race_aid_stations.race_id=eq.${parsedParams.data.id}&order=order_index.asc`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer station products", await response.text());
    return jsonError("Unable to load aid station products.", 502);
  }

  const rows = z.array(aidStationProductRowSchema.passthrough()).parse(await response.json());
  return withSecurityHeaders(NextResponse.json({ products: rows.map(mapStationProduct) }));
}

export async function PUT(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const parsedBody = updateProductsSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid aid station products.", 400);

  const station = await requireStationForRace(auth, parsedParams.data.id, parsedBody.data.aidStationId);
  if ("error" in station) return station.error;

  const deleteResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products?race_aid_station_id=eq.${parsedBody.data.aidStationId}`,
    {
      method: "DELETE",
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!deleteResponse.ok) {
    console.error("Unable to clear organizer station products", await deleteResponse.text());
    return jsonError("Unable to update aid station products.", 502);
  }

  if (parsedBody.data.products.length === 0) {
    return withSecurityHeaders(NextResponse.json({ products: [] }));
  }

  const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify(
      parsedBody.data.products.map((product, index) => ({
        race_aid_station_id: parsedBody.data.aidStationId,
        product_id: product.productId,
        notes: product.notes,
        order_index: index,
      }))
    ),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to insert organizer station products", await insertResponse.text());
    return jsonError("Unable to update aid station products.", 502);
  }

  const rows = z.array(aidStationProductRowSchema.omit({ products: true })).parse(await insertResponse.json());
  return withSecurityHeaders(
    NextResponse.json({
      products: rows.map((row) => ({
        id: row.id,
        aidStationId: row.race_aid_station_id,
        productId: row.product_id,
        notes: row.notes ?? null,
        orderIndex: row.order_index,
      })),
    })
  );
}

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid race id.", 400);

  const race = await loadRaceForOrganizer(auth.serviceConfig, auth.user, parsedParams.data.id);
  if ("error" in race) return race.error;

  const parsedBody = createScopedProductSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid product payload.", 400);

  const station = await requireStationForRace(auth, parsedParams.data.id, parsedBody.data.aidStationId);
  if ("error" in station) return station.error;

  const productId = randomUUID();
  const createResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/products`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: productId,
      slug: buildSlug(parsedBody.data.product.name, "organizer-product"),
      sku: parsedBody.data.product.sku ?? `ORG-${randomUUID().slice(0, 8).toUpperCase()}`,
      name: parsedBody.data.product.name,
      brand: parsedBody.data.product.brand,
      fuel_type: parsedBody.data.product.fuelType,
      product_url: parsedBody.data.product.productUrl,
      calories_kcal: parsedBody.data.product.caloriesKcal,
      carbs_g: parsedBody.data.product.carbsGrams,
      sodium_mg: parsedBody.data.product.sodiumMg,
      protein_g: parsedBody.data.product.proteinGrams,
      fat_g: parsedBody.data.product.fatGrams,
      is_live: false,
      is_archived: false,
      is_official: false,
      official_name: null,
      created_by: auth.user.id,
    }),
    cache: "no-store",
  });

  if (!createResponse.ok) {
    console.error("Unable to create organizer scoped product", await createResponse.text());
    return jsonError("Unable to create product.", 502);
  }

  const product = z.array(supabaseProductSchema).parse(await createResponse.json())[0] ?? null;
  if (!product) return jsonError("Unable to create product.", 502);

  const attachResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products`, {
    method: "POST",
    headers: {
      ...serviceHeaders(auth.serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      race_aid_station_id: parsedBody.data.aidStationId,
      product_id: product.id,
      notes: parsedBody.data.notes,
      order_index: 999,
    }),
    cache: "no-store",
  });

  if (!attachResponse.ok) {
    console.error("Unable to attach organizer scoped product", await attachResponse.text());
    return jsonError("Product created, but unable to attach it to the aid station.", 502);
  }

  const link = z.array(aidStationProductRowSchema.omit({ products: true })).parse(await attachResponse.json())[0] ?? null;
  return withSecurityHeaders(
    NextResponse.json(
      {
        product: toProduct(product),
        stationProduct: link
          ? {
              id: link.id,
              aidStationId: link.race_aid_station_id,
              productId: link.product_id,
              notes: link.notes ?? null,
              orderIndex: link.order_index,
            }
          : null,
      },
      { status: 201 }
    )
  );
}
