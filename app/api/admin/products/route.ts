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
      `${auth.supabaseService.supabaseUrl}/rest/v1/products?select=id,slug,sku,name,product_url,is_live,is_archived,updated_at&order=updated_at.desc`,
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

  if (!parsedBody.success || (parsedBody.data.isLive === undefined && parsedBody.data.isArchived === undefined)) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product update payload." }, { status: 400 }));
  }

  const updates: Record<string, unknown> = {};
  if (parsedBody.data.isLive !== undefined) {
    updates.is_live = parsedBody.data.isLive;
  }
  if (parsedBody.data.isArchived !== undefined) {
    updates.is_archived = parsedBody.data.isArchived;
  }

  try {
    const response = await fetch(`${auth.supabaseService.supabaseUrl}/rest/v1/products?id=eq.${parsedBody.data.id}`, {
      method: "PATCH",
      headers: {
        apikey: auth.supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(updates),
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
