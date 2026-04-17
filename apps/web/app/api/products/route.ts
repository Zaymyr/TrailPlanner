import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../lib/supabase";
import { defaultFuelType, fuelTypeSchema } from "../../../lib/fuel-types";
import type { FuelProduct } from "../../../lib/product-types";

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
});

const productResponseSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      sku: z.string().optional(),
      name: z.string(),
      brand: z.string().optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      fuelType: fuelTypeSchema,
      productUrl: z.string().url().optional().nullable(),
      caloriesKcal: z.number(),
      carbsGrams: z.number(),
      sodiumMg: z.number(),
      proteinGrams: z.number(),
      fatGrams: z.number(),
      waterMl: z.number().optional(),
      createdBy: z.string().uuid().optional().nullable(),
    })
  ),
});

const singleProductResponseSchema = z.object({
  product: productResponseSchema.shape.products.element,
});

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  brand: z.string().trim().min(1).optional().nullable(),
  sku: z.string().trim().min(1).optional(),
  fuelType: fuelTypeSchema,
  productUrl: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional()
    .pipe(z.string().url().optional()),
  caloriesKcal: z.coerce.number().nonnegative().default(0),
  carbsGrams: z.coerce.number().nonnegative().default(0),
  sodiumMg: z.coerce.number().nonnegative().default(0),
  proteinGrams: z.coerce.number().nonnegative().default(0),
  fatGrams: z.coerce.number().nonnegative().default(0),
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
  createdBy: row.created_by ?? undefined,
});

const buildSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const suffix = Math.random().toString(36).slice(2, 6);
  return base ? `${base}-${suffix}` : `product-${suffix}`;
};

export async function GET(request: NextRequest) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  const authToken = token ?? supabaseConfig.supabaseAnonKey;
  const fuelTypeParam = request.nextUrl.searchParams.get("fuel_type") ?? request.nextUrl.searchParams.get("fuelType");
  const fuelTypeFilter = fuelTypeParam
    ? fuelTypeSchema.safeParse(fuelTypeParam)
    : null;
  const mineParam = request.nextUrl.searchParams.get("mine");

  if (fuelTypeParam && (!fuelTypeFilter || !fuelTypeFilter.success)) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid fuel type filter." }, { status: 400 }));
  }

  if (mineParam === "true" && !token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  let createdByUserId: string | null = null;
  if (mineParam === "true" && token) {
    const supabaseUser = await fetchSupabaseUser(token, supabaseConfig);
    if (!supabaseUser) {
      return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
    }
    createdByUserId = supabaseUser.id;
  }

  const fuelTypeQuery = fuelTypeFilter?.success ? `&fuel_type=eq.${fuelTypeFilter.data}` : "";
  const createdByQuery = createdByUserId ? `&created_by=eq.${createdByUserId}` : "";

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/products?is_live=eq.true&is_archived=eq.false&select=id,slug,sku,name,brand,image_url,fuel_type,product_url,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g,created_by${fuelTypeQuery}${createdByQuery}&order=updated_at.desc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${authToken}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to fetch products", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load products." }, { status: 502 }));
    }

    const rows = z.array(supabaseProductSchema).parse(await response.json());
    const products = rows.map(toProduct);

    return withSecurityHeaders(NextResponse.json(productResponseSchema.parse({ products })));
  } catch (error) {
    console.error("Unexpected error while fetching products", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load products." }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const supabaseService = getSupabaseServiceConfig();
  const supabaseAnon = getSupabaseAnonConfig();

  if (!supabaseService || !supabaseAnon) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const parsedBody = createProductSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    const firstIssue = parsedBody.error.issues[0];
    return withSecurityHeaders(
      NextResponse.json(
        {
          message: firstIssue?.message ?? "Invalid product payload.",
          field: firstIssue?.path?.[0] ?? null,
        },
        { status: 400 }
      )
    );
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const slug = buildSlug(parsedBody.data.name);
  const sku = parsedBody.data.sku ?? `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const productUrl = parsedBody.data.productUrl;

  try {
    const response = await fetch(`${supabaseService.supabaseUrl}/rest/v1/products`, {
      method: "POST",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      cache: "no-store",
      body: JSON.stringify({
        slug,
        sku,
        name: parsedBody.data.name,
        brand: parsedBody.data.brand ?? null,
        fuel_type: parsedBody.data.fuelType,
        product_url: productUrl,
        calories_kcal: parsedBody.data.caloriesKcal,
        carbs_g: parsedBody.data.carbsGrams,
        sodium_mg: parsedBody.data.sodiumMg,
        protein_g: parsedBody.data.proteinGrams,
        fat_g: parsedBody.data.fatGrams,
        is_live: true,
        is_archived: false,
        created_by: supabaseUser.id,
      }),
    });

    const rows = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to create product", rows);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create product." }, { status: 500 }));
    }

    const product = z.array(supabaseProductSchema).parse(rows)[0];

    if (!product) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create product." }, { status: 500 }));
    }

    return withSecurityHeaders(
      NextResponse.json(
        singleProductResponseSchema.parse({
          product: toProduct(product),
        }),
        { status: 201 }
      )
    );
  } catch (error) {
    console.error("Unexpected error while creating product", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create product." }, { status: 500 }));
  }
}
