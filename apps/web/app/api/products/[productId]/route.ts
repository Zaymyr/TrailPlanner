import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { defaultFuelType, fuelTypeSchema } from "../../../../lib/fuel-types";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const paramsSchema = z.object({
  productId: z.string().uuid(),
});

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
  product: z.object({
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
  }),
});

const updateProductSchema = z.object({
  name: z.string().trim().min(1).optional(),
  brand: z.string().trim().optional().nullable(),
  fuelType: fuelTypeSchema.optional(),
  productUrl: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .optional()
    .pipe(z.string().url().optional()),
  caloriesKcal: z.coerce.number().nonnegative().optional(),
  carbsGrams: z.coerce.number().nonnegative().optional(),
  sodiumMg: z.coerce.number().nonnegative().optional(),
  proteinGrams: z.coerce.number().nonnegative().optional(),
  fatGrams: z.coerce.number().nonnegative().optional(),
});

const productSelect =
  "id,slug,sku,name,brand,image_url,fuel_type,product_url,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g,created_by";

const toProduct = (row: z.infer<typeof supabaseProductSchema>) => ({
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
});

const authorizeProductMutation = async (request: NextRequest, productId: string) => {
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
  if (!supabaseUser?.id) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 })) };
  }

  const productResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/products?id=eq.${productId}&select=${productSelect}&limit=1`,
    {
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  const productRows = (await productResponse.json().catch(() => null)) as unknown;
  if (!productResponse.ok) {
    console.error("Unable to load product before mutation", productRows);
    return { error: withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 502 })) };
  }

  const parsedProductRows = z.array(supabaseProductSchema).safeParse(productRows);
  const product = parsedProductRows.success ? parsedProductRows.data[0] ?? null : null;
  if (!product) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Product not found." }, { status: 404 })) };
  }

  const canMutateProduct = isAdminUser(supabaseUser) || product.created_by === supabaseUser.id;
  if (!canMutateProduct) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 })) };
  }

  return { product, supabaseService };
};

export async function PATCH(request: NextRequest, context: { params: { productId?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product id." }, { status: 400 }));
  }

  const parsedBody = updateProductSchema.safeParse(await request.json().catch(() => ({})));
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

  const auth = await authorizeProductMutation(request, parsedParams.data.productId);
  if ("error" in auth) return auth.error;

  const fieldsToUpdate: Record<string, unknown> = {};
  const { name, brand, fuelType, productUrl, caloriesKcal, carbsGrams, sodiumMg, proteinGrams, fatGrams } =
    parsedBody.data;

  if (name !== undefined) fieldsToUpdate.name = name;
  if (brand !== undefined) fieldsToUpdate.brand = brand?.trim() || null;
  if (fuelType !== undefined) fieldsToUpdate.fuel_type = fuelType;
  if (productUrl !== undefined) fieldsToUpdate.product_url = productUrl;
  if (caloriesKcal !== undefined) fieldsToUpdate.calories_kcal = caloriesKcal;
  if (carbsGrams !== undefined) fieldsToUpdate.carbs_g = carbsGrams;
  if (sodiumMg !== undefined) fieldsToUpdate.sodium_mg = sodiumMg;
  if (proteinGrams !== undefined) fieldsToUpdate.protein_g = proteinGrams;
  if (fatGrams !== undefined) fieldsToUpdate.fat_g = fatGrams;

  if (Object.keys(fieldsToUpdate).length === 0) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product payload." }, { status: 400 }));
  }

  try {
    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/products?id=eq.${parsedParams.data.productId}&select=${productSelect}`,
      {
        method: "PATCH",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(fieldsToUpdate),
        cache: "no-store",
      }
    );

    const rows = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      console.error("Unable to update product", rows);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 502 }));
    }

    const updatedProduct = z.array(supabaseProductSchema).parse(rows)[0] ?? null;
    if (!updatedProduct) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 500 }));
    }

    return withSecurityHeaders(
      NextResponse.json(
        productResponseSchema.parse({
          product: toProduct(updatedProduct),
        })
      )
    );
  } catch (error) {
    console.error("Unexpected error while updating product", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update product." }, { status: 500 }));
  }
}

export async function DELETE(request: NextRequest, context: { params: { productId?: string } }) {
  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product id." }, { status: 400 }));
  }

  const auth = await authorizeProductMutation(request, parsedParams.data.productId);
  if ("error" in auth) return auth.error;

  try {
    const archiveResponse = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/products?id=eq.${parsedParams.data.productId}`,
      {
        method: "PATCH",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          is_live: false,
          is_archived: true,
        }),
        cache: "no-store",
      }
    );

    if (!archiveResponse.ok) {
      console.error("Unable to archive product", await archiveResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to delete product." }, { status: 502 }));
    }

    const favoritesResponse = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/user_favorite_products?product_id=eq.${parsedParams.data.productId}`,
      {
        method: "DELETE",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!favoritesResponse.ok) {
      console.error("Unable to remove archived product from favorites", await favoritesResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to clean up product favorites." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unexpected error while deleting product", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete product." }, { status: 500 }));
  }
}
