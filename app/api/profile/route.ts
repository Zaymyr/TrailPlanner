import { NextResponse } from "next/server";
import { z } from "zod";

import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
} from "../../../lib/supabase";
import {
  profileResponseSchema,
  profileUpdateSchema,
  type ProfileUpdatePayload,
  type UserProfile,
} from "../../../lib/profile-types";

const supabaseProductSchema = z.object({
  id: z.string(),
  slug: z.string(),
  sku: z.string(),
  name: z.string(),
  product_url: z.string().url().optional().nullable(),
  calories_kcal: z.number(),
  carbs_g: z.number(),
  sodium_mg: z.number().nullable().optional(),
  protein_g: z.number().nullable().optional(),
  fat_g: z.number().nullable().optional(),
});

const profileRowSchema = z.object({
  full_name: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  water_bag_liters: z.number().nullable().optional(),
});

const favoriteRowSchema = z.array(
  z.object({
    product_id: z.string(),
    products: supabaseProductSchema.nullable().optional(),
  })
);

const favoriteIdRowSchema = z.array(
  z.object({
    product_id: z.string(),
  })
);

const mapProduct = (row: z.infer<typeof supabaseProductSchema>) => ({
  id: row.id,
  slug: row.slug,
  sku: row.sku,
  name: row.name,
  productUrl: row.product_url ?? undefined,
  caloriesKcal: Number(row.calories_kcal ?? 0),
  carbsGrams: Number(row.carbs_g ?? 0),
  sodiumMg: Number(row.sodium_mg ?? 0),
  proteinGrams: Number(row.protein_g ?? 0),
  fatGrams: Number(row.fat_g ?? 0),
  waterMl: 0,
});

const buildHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const fetchProfile = async (supabaseUrl: string, supabaseKey: string, token: string): Promise<UserProfile> => {
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?select=full_name,age,water_bag_liters&limit=1`,
    {
      headers: buildHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!profileResponse.ok) {
    throw new Error("Unable to load profile");
  }

  const profileRow = z.array(profileRowSchema).parse(await profileResponse.json())?.[0];

  const favoritesResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_favorite_products?select=product_id,products(id,slug,sku,name,product_url,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g)&order=created_at.asc`,
    {
      headers: buildHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!favoritesResponse.ok) {
    throw new Error("Unable to load profile favorites");
  }

  const favoriteRows = favoriteRowSchema.parse(await favoritesResponse.json());

  const favoriteProducts = favoriteRows
    .map((row) => row.products)
    .filter((row): row is z.infer<typeof supabaseProductSchema> => Boolean(row))
    .map(mapProduct);

  return {
    fullName: profileRow?.full_name ?? null,
    age: profileRow?.age ?? null,
    waterBagLiters: profileRow?.water_bag_liters ?? null,
    favoriteProducts,
  } satisfies UserProfile;
};

const syncFavorites = async (
  supabaseUrl: string,
  supabaseKey: string,
  token: string,
  userId: string,
  favoriteProductIds: string[]
) => {
  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/user_favorite_products?select=product_id&user_id=eq.${encodeURIComponent(userId)}`,
    {
      headers: buildHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!existingResponse.ok) {
    throw new Error("Unable to read existing favorites");
  }

  const existingRows = favoriteIdRowSchema.parse(await existingResponse.json());

  const existingIds = new Set(existingRows.map((row) => row.product_id));
  const nextIds = new Set(favoriteProductIds);

  const toDelete = Array.from(existingIds).filter((id) => !nextIds.has(id));
  const toInsert = Array.from(nextIds).filter((id) => !existingIds.has(id));

  if (toDelete.length > 0) {
    const deleteFilter = toDelete.join(",");
    const deleteResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_favorite_products?user_id=eq.${encodeURIComponent(userId)}&product_id=in.(${deleteFilter})`,
      {
        method: "DELETE",
        headers: buildHeaders(supabaseKey, token, undefined),
      }
    );

    if (!deleteResponse.ok) {
      throw new Error("Unable to remove favorites");
    }
  }

  if (toInsert.length > 0) {
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/user_favorite_products`, {
      method: "POST",
      headers: {
        ...buildHeaders(supabaseKey, token),
        Prefer: "resolution=ignore-duplicates",
      },
      body: JSON.stringify(toInsert.map((id) => ({ user_id: userId, product_id: id }))),
    });

    if (!insertResponse.ok) {
      throw new Error("Unable to add favorites");
    }
  }
};

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing" }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token" }, { status: 401 });
  }

  try {
    const profile = await fetchProfile(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, token);
    return NextResponse.json(profileResponseSchema.parse({ profile }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load profile";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing" }, { status: 500 });
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json({ message: "Missing access token" }, { status: 401 });
  }

  const parsedBody = profileUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid profile payload" }, { status: 400 });
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return NextResponse.json({ message: "Invalid session" }, { status: 401 });
  }

  const body: ProfileUpdatePayload = parsedBody.data;

  try {
    const profilePayload: Record<string, unknown> = { user_id: user.id };

    if (Object.prototype.hasOwnProperty.call(body, "fullName")) {
      profilePayload.full_name = body.fullName ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "age")) {
      profilePayload.age = body.age ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "waterBagLiters")) {
      profilePayload.water_bag_liters = body.waterBagLiters ?? null;
    }

    const upsertResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/user_profiles?on_conflict=user_id`,
      {
        method: "POST",
        headers: {
          ...buildHeaders(supabaseConfig.supabaseAnonKey, token),
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(profilePayload),
      }
    );

    if (!upsertResponse.ok) {
      const details = await upsertResponse.text();
      throw new Error(details || "Unable to save profile");
    }

    if (Array.isArray(body.favoriteProductIds)) {
      await syncFavorites(
        supabaseConfig.supabaseUrl,
        supabaseConfig.supabaseAnonKey,
        token,
        user.id,
        body.favoriteProductIds
      );
    }

    const profile = await fetchProfile(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, token);

    return NextResponse.json(profileResponseSchema.parse({ profile }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile";
    return NextResponse.json({ message }, { status: 500 });
  }
}
