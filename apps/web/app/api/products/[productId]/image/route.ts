import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

const paramsSchema = z.object({
  productId: z.string().uuid(),
});

const productRowSchema = z.object({
  id: z.string().uuid(),
  created_by: z.string().uuid().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const PRODUCT_IMAGES_BUCKET = "product-images";

function extractStoragePathFromPublicUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  const marker = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`;
  const markerIndex = imageUrl.indexOf(marker);

  if (markerIndex < 0) return null;

  return imageUrl.slice(markerIndex + marker.length);
}

export async function PUT(request: NextRequest, context: { params: { productId?: string } }) {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid product id." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);
  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`product-image-update:${supabaseUser.id}`, 12, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const productResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/products?id=eq.${parsedParams.data.productId}&select=id,created_by,image_url`,
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
    console.error("Unable to load product before image upload", productRows);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 502 }));
  }

  const parsedProductRows = z.array(productRowSchema).safeParse(productRows);
  const product = parsedProductRows.success ? parsedProductRows.data[0] ?? null : null;

  if (!product) {
    return withSecurityHeaders(NextResponse.json({ message: "Product not found." }, { status: 404 }));
  }

  const canEditProduct = isAdminUser(supabaseUser) || product.created_by === supabaseUser.id;
  if (!canEditProduct) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid form data." }, { status: 400 }));
  }

  const imageFile = formData.get("image");
  if (!(imageFile instanceof File)) {
    return withSecurityHeaders(NextResponse.json({ message: "Image file is required." }, { status: 400 }));
  }

  const mimeType = imageFile.type;
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Invalid image type. Use JPEG, PNG, WebP or AVIF." }, { status: 400 })
    );
  }

  if (imageFile.size > MAX_SIZE_BYTES) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Image is too large (max 5 MB)." }, { status: 400 })
    );
  }

  const ext = mimeType.split("/")[1] ?? "jpg";
  const storagePath = `products/${product.id}/image-${Date.now()}.${ext}`;

  const uploadResponse = await fetch(
    `${supabaseService.supabaseUrl}/storage/v1/object/${PRODUCT_IMAGES_BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": mimeType,
        "x-upsert": "true",
      },
      body: imageFile,
    }
  );

  if (!uploadResponse.ok) {
    console.error("Unable to upload product image", await uploadResponse.text());
    return withSecurityHeaders(NextResponse.json({ message: "Unable to upload image." }, { status: 502 }));
  }

  const publicUrl = `${supabaseService.supabaseUrl}/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/${storagePath}`;

  const updateResponse = await fetch(
    `${supabaseService.supabaseUrl}/rest/v1/products?id=eq.${product.id}`,
    {
      method: "PATCH",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ image_url: publicUrl }),
      cache: "no-store",
    }
  );

  if (!updateResponse.ok) {
    console.error("Unable to update product image_url", await updateResponse.text());
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/${PRODUCT_IMAGES_BUCKET}/${storagePath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    }).catch(() => null);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update product image." }, { status: 502 }));
  }

  const previousStoragePath = extractStoragePathFromPublicUrl(product.image_url ?? null);
  if (previousStoragePath && previousStoragePath !== storagePath) {
    await fetch(`${supabaseService.supabaseUrl}/storage/v1/object/${PRODUCT_IMAGES_BUCKET}/${previousStoragePath}`, {
      method: "DELETE",
      headers: {
        apikey: supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
      },
    }).catch(() => null);
  }

  return withSecurityHeaders(NextResponse.json({ imageUrl: publicUrl }));
}
