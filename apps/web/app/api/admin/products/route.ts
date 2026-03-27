import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const supabaseProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  sku: z.string().nullable().optional(),
  name: z.string(),
  product_url: z.string().url().nullable().optional(),
  is_live: z.boolean(),
  is_archived: z.boolean(),
  updated_at: z.string(),
  fuel_type: z.string().nullable().optional(),
  calories_kcal: z.number().nonnegative().nullable().optional(),
  carbs_g: z.number().nonnegative().nullable().optional(),
  sodium_mg: z.number().nonnegative().nullable().optional(),
  protein_g: z.number().nonnegative().nullable().optional(),
  fat_g: z.number().nonnegative().nullable().optional(),
});

const productResponseSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      sku: z.string().optional(),
      name: z.string(),
      productUrl: z.string().optional(),
      isLive: z.boolean(),
      isArchived: z.boolean(),
      updatedAt: z.string(),
      waterMl: z.number().optional(),
      fuelType: z.string().optional(),
      caloriesKcal: z.number().nonnegative().optional(),
      carbsGrams: z.number().nonnegative().optional(),
      sodiumMg: z.number().nonnegative().optional(),
      proteinGrams: z.number().nonnegative().optional(),
      fatGrams: z.number().nonnegative().optional(),
    })
  ),
});

const singleProductResponseSchema = z.object({
  product: productResponseSchema.shape.products.element,
});

const updatePayloadSchema = z.object({
  id: z.string().uuid(),
  isLive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  name: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  sku: z.string().trim().optional().nullable(),
  productUrl: z.string().url().optional().nullable(),
  fuelType: z.string().optional(),
  caloriesKcal: z.coerce.number().nonnegative().optional(),
  carbsGrams: z.coerce.number().nonnegative().optional(),
  sodiumMg: z.coerce.number().nonnegative().optional(),
  proteinGrams: z.coerce.number().nonnegative().optional(),
  fatGrams: z.coerce.number().nonnegative().optional(),
});

const mapProduct = (row: z.infer<typeof supabaseProductSchema>): z.infer<typeof productResponseSchema.shape.products.element> => ({
  id: row.id,
  slug: row.slug,
  sku: row.sku ?? undefined,
  name: row.name,
  productUrl: row.product_url ?? undefined,
  isLive: row.is_live,
  isArchived: row.is_archived,
  updatedAt: row.updated_at,
  waterMl: 0,
  fuelType: row.fuel_type ?? undefined,
  caloriesKcal: row.calories_kcal ?? undefined,
  carbsGrams: row.carbs_g ?? undefined,
  sodiumMg: row.sodium_mg ?? undefined,
  proteinGrams: row.protein_g ?? undefined,
  fatGrams: row.fat_g ?? undefined,
});

const authorizeAdmin = async (request: NextRequest) => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return {
      error: withSecurityHeaders(
        NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
      ),
    };
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser || !isAdminUser(supabaseUser)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  }

  return { supabaseService };
};

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/products?select=id,slug,sku,name,product_url,is_live,is_archived,updated_at,fuel_type,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g&order=updated_at.desc`,
      {
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load admin products", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load products." }, { status: 502 }));
    }

    const rows = z.array(supabaseProductSchema).parse(await response.json());
    const products = rows.map(mapProduct);

    return withSecurityHeaders(NextResponse.json(productResponseSchema.parse({ products })));
  } catch (error) {
    console.error("Unexpected error while fetching admin products", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load products." }, { status: 500 }));
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const parsedBody = updatePayloadSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product update payload." }, { status: 400 }));
  }

  const { id, isLive, isArchived, name, slug, sku, productUrl, fuelType, caloriesKcal, carbsGrams, sodiumMg, proteinGrams, fatGrams } = parsedBody.data;

  const fieldsToUpdate: Record<string, unknown> = {};
  if (isLive !== undefined) fieldsToUpdate.is_live = isLive;
  if (isArchived !== undefined) fieldsToUpdate.is_archived = isArchived;
  if (name !== undefined) fieldsToUpdate.name = name;
  if (slug !== undefined) fieldsToUpdate.slug = slug;
  if (sku !== undefined) fieldsToUpdate.sku = sku;
  if (productUrl !== undefined) fieldsToUpdate.product_url = productUrl;
  if (fuelType !== undefined) fieldsToUpdate.fuel_type = fuelType;
  if (caloriesKcal !== undefined) fieldsToUpdate.calories_kcal = caloriesKcal;
  if (carbsGrams !== undefined) fieldsToUpdate.carbs_g = carbsGrams;
  if (sodiumMg !== undefined) fieldsToUpdate.sodium_mg = sodiumMg;
  if (proteinGrams !== undefined) fieldsToUpdate.protein_g = proteinGrams;
  if (fatGrams !== undefined) fieldsToUpdate.fat_g = fatGrams;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product update payload." }, { status: 400 }));
  }

  try {
    const response = await fetch(`${auth.supabaseService.supabaseUrl}/rest/v1/products?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: auth.supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(fieldsToUpdate),
      cache: "no-store",
    });

    const rows = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to update product", rows);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 502 }));
    }

    const product = z.array(supabaseProductSchema).parse(rows)[0];

    if (!product) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 500 }));
    }

    return withSecurityHeaders(
      NextResponse.json(
        singleProductResponseSchema.parse({
          product: mapProduct(product),
        })
      )
    );
  } catch (error) {
    console.error("Unexpected error while updating product", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 500 }));
  }
}
