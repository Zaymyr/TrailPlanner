import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../lib/supabase";
import type { FuelProduct } from "../../../lib/product-types";

const supabaseProductSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  calories_kcal: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  carbs_g: z.union([z.number(), z.string()]).transform((value) => Number(value)),
  sodium_mg: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
  protein_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
  fat_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
});

const productResponseSchema = z.object({
  products: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      sku: z.string(),
      name: z.string(),
      caloriesKcal: z.number(),
      carbsGrams: z.number(),
      sodiumMg: z.number(),
      proteinGrams: z.number(),
      fatGrams: z.number(),
    })
  ),
});

const singleProductResponseSchema = z.object({
  product: productResponseSchema.shape.products.element,
});

const createProductSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1).optional(),
  caloriesKcal: z.coerce.number().nonnegative().default(0),
  carbsGrams: z.coerce.number().positive(),
  sodiumMg: z.coerce.number().nonnegative().default(0),
  proteinGrams: z.coerce.number().nonnegative().default(0),
  fatGrams: z.coerce.number().nonnegative().default(0),
});

const toProduct = (row: z.infer<typeof supabaseProductSchema>): FuelProduct => ({
  id: row.id,
  slug: row.slug,
  sku: row.sku,
  name: row.name,
  caloriesKcal: Number(row.calories_kcal) || 0,
  carbsGrams: Number(row.carbs_g) || 0,
  sodiumMg: Number(row.sodium_mg) || 0,
  proteinGrams: Number(row.protein_g) || 0,
  fatGrams: Number(row.fat_g) || 0,
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

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/products?is_live=eq.true&is_archived=eq.false&select=id,slug,sku,name,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g&order=updated_at.desc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
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
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product payload." }, { status: 400 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const slug = buildSlug(parsedBody.data.name);
  const sku = parsedBody.data.sku ?? `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
        calories_kcal: parsedBody.data.caloriesKcal,
        carbs_g: parsedBody.data.carbsGrams,
        sodium_mg: parsedBody.data.sodiumMg,
        protein_g: parsedBody.data.proteinGrams,
        fat_g: parsedBody.data.fatGrams,
        is_live: true,
        is_archived: false,
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
