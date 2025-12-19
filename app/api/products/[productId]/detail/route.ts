import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, getSupabaseAnonConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ productId: z.string().uuid() });

const totalsSchema = z
  .object({
    caloriesKcal: z.number().nonnegative().optional(),
    carbsGrams: z.number().nonnegative().optional(),
    proteinGrams: z.number().nonnegative().optional(),
    fatGrams: z.number().nonnegative().optional(),
  })
  .partial();

const requestSchema = z.object({ totals: totalsSchema.optional() });

const productSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  sku: z.string().optional().nullable(),
  name: z.string(),
  product_url: z.string().url().optional().nullable(),
  calories_kcal: z.number(),
  carbs_g: z.number(),
  protein_g: z.number(),
  fat_g: z.number(),
});

const responseSchema = z.object({
  product: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    sku: z.string().optional(),
    name: z.string(),
    productUrl: z.string().url().optional().nullable(),
    caloriesKcal: z.number(),
    carbsGrams: z.number(),
    proteinGrams: z.number(),
    fatGrams: z.number(),
  }),
  estimatedUnits: z
    .object({
      calories: z.number().int().positive().optional(),
      carbs: z.number().int().positive().optional(),
      protein: z.number().int().positive().optional(),
      fat: z.number().int().positive().optional(),
    })
    .optional(),
});

const computeUnits = (total?: number, perUnit?: number) => {
  if (!total || !perUnit || perUnit <= 0) return undefined;
  return Math.max(1, Math.ceil(total / perUnit));
};

export async function POST(request: NextRequest, { params }: { params: { productId: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const parsedParams = paramsSchema.safeParse(params);
  const parsedBody = requestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedParams.success || !parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  try {
    const productResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/products?id=eq.${parsedParams.data.productId}&select=id,slug,sku,name,product_url,calories_kcal,carbs_g,protein_g,fat_g`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!productResponse.ok) {
      console.error("Unable to load product detail", await productResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 502 }));
    }

    const product = z.array(productSchema).parse(await productResponse.json())[0];

    if (!product) {
      return withSecurityHeaders(NextResponse.json({ message: "Product not found." }, { status: 404 }));
    }

    const totals = parsedBody.data.totals;
    const estimatedUnits = totals
      ? {
          calories: computeUnits(totals.caloriesKcal, product.calories_kcal),
          carbs: computeUnits(totals.carbsGrams, product.carbs_g),
          protein: computeUnits(totals.proteinGrams, product.protein_g),
          fat: computeUnits(totals.fatGrams, product.fat_g),
        }
      : undefined;

    const responseBody = responseSchema.parse({
      product: {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        name: product.name,
        productUrl: product.product_url ?? undefined,
        caloriesKcal: Number(product.calories_kcal),
        carbsGrams: Number(product.carbs_g),
        proteinGrams: Number(product.protein_g),
        fatGrams: Number(product.fat_g),
      },
      estimatedUnits,
    });

    return withSecurityHeaders(NextResponse.json(responseBody));
  } catch (error) {
    console.error("Unexpected error while loading product detail", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 500 }));
  }
}
