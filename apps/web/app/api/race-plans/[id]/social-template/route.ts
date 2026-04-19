import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders, checkRateLimit } from "../../../../../lib/http";
import { defaultFuelType, fuelTypeSchema } from "../../../../../lib/fuel-types";
import { buildSocialRacePlanTemplate } from "../../../../../lib/social-race-plan-template";
import type { FuelProduct } from "../../../../../lib/product-types";
import type { FormValues } from "../../../../(coach)/race-planner/types";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  isAdminUser,
} from "../../../../../lib/supabase";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const planRowSchema = z.array(
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    planner_values: z.record(z.unknown()).nullable().optional(),
    elevation_profile: z.array(z.unknown()).nullable().optional(),
    plan_course_stats: z.record(z.unknown()).nullable().optional(),
    races: z
      .object({
        name: z.string().nullable().optional(),
        distance_km: z.union([z.number(), z.string()]).nullable().optional(),
        elevation_gain_m: z.union([z.number(), z.string()]).nullable().optional(),
      })
      .nullable()
      .optional(),
  })
);

const productRowSchema = z.array(
  z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    fuel_type: fuelTypeSchema.nullable().optional(),
    calories_kcal: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
    carbs_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
    sodium_mg: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
    protein_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
    fat_g: z.union([z.number(), z.string(), z.null()]).transform((value) => Number(value ?? 0)),
  })
);

const buildAuthHeaders = (supabaseKey: string, accessToken: string) => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
});

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

function collectProductIds(plannerValues: Record<string, unknown> | null | undefined) {
  const productIds = new Set<string>();
  const startSupplies = Array.isArray(plannerValues?.startSupplies)
    ? (plannerValues.startSupplies as Array<Record<string, unknown>>)
    : [];
  const aidStations = Array.isArray(plannerValues?.aidStations)
    ? (plannerValues.aidStations as Array<Record<string, unknown>>)
    : [];

  startSupplies.forEach((supply) => {
    if (typeof supply?.productId === "string" && supply.productId.length > 0) {
      productIds.add(supply.productId);
    }
  });

  aidStations.forEach((station) => {
    const supplies = Array.isArray(station.supplies) ? (station.supplies as Array<Record<string, unknown>>) : [];

    supplies.forEach((supply) => {
      if (typeof supply?.productId === "string" && supply.productId.length > 0) {
        productIds.add(supply.productId);
      }
    });
  });

  return Array.from(productIds);
}

function mapProducts(rows: z.infer<typeof productRowSchema>): FuelProduct[] {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    fuelType: row.fuel_type ?? defaultFuelType,
    caloriesKcal: Number(row.calories_kcal) || 0,
    carbsGrams: Number(row.carbs_g) || 0,
    sodiumMg: Number(row.sodium_mg) || 0,
    proteinGrams: Number(row.protein_g) || 0,
    fatGrams: Number(row.fat_g) || 0,
    waterMl: 0,
  }));
}

async function loadProductsForPlan(
  supabaseUrl: string,
  supabaseAnonKey: string,
  accessToken: string,
  plannerValues: Record<string, unknown> | null | undefined
) {
  const productIds = collectProductIds(plannerValues);

  if (productIds.length === 0) {
    return [];
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/products?select=id,slug,name,fuel_type,calories_kcal,carbs_g,sodium_mg,protein_g,fat_g&id=in.(${productIds.join(",")})&is_live=eq.true&is_archived=eq.false`,
    {
      headers: buildAuthHeaders(supabaseAnonKey, accessToken),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load products for social template", await response.text());
    return [];
  }

  const parsedRows = productRowSchema.safeParse(await response.json().catch(() => []));

  if (!parsedRows.success) {
    console.error("Unable to parse products for social template", parsedRows.error);
    return [];
  }

  return mapProducts(parsedRows.data);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race plan id." }, { status: 400 }));
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const supabaseUser = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!supabaseUser?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  if (!isAdminUser(supabaseUser)) {
    return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
  }

  const rateLimit = checkRateLimit(`race-plan-social-template:${supabaseUser.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const planResponse = await fetch(
    `${supabaseConfig.supabaseUrl}/rest/v1/race_plans?id=eq.${encodeURIComponent(
      parsedParams.data.id
    )}&user_id=eq.${encodeURIComponent(
      supabaseUser.id
    )}&select=id,name,planner_values,elevation_profile,plan_course_stats,races(name,distance_km,elevation_gain_m)&limit=1`,
    {
      headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, accessToken),
      cache: "no-store",
    }
  );

  if (!planResponse.ok) {
    console.error("Unable to load race plan social template", await planResponse.text());
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to load race plan." }, { status: 502 })
    );
  }

  const parsedPlans = planRowSchema.safeParse(await planResponse.json().catch(() => []));

  if (!parsedPlans.success) {
    console.error("Unable to parse race plan social template payload", parsedPlans.error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to load race plan." }, { status: 500 })
    );
  }

  const plan = parsedPlans.data[0];

  if (!plan) {
    return withSecurityHeaders(NextResponse.json({ message: "Race plan not found." }, { status: 404 }));
  }

  const products = await loadProductsForPlan(
    supabaseConfig.supabaseUrl,
    supabaseConfig.supabaseAnonKey,
    accessToken,
    plan.planner_values
  );

  const payload = buildSocialRacePlanTemplate({
    plan: {
      id: plan.id,
      name: plan.name,
      plannerValues: (plan.planner_values ?? {}) as Partial<FormValues>,
      elevationProfile: (plan.elevation_profile ?? []) as Array<{
        distanceKm: number;
        elevationM: number;
        lat?: number;
        lon?: number;
      }>,
      planCourseStats: {
        distanceKm: toFiniteNumber(plan.plan_course_stats?.distanceKm),
        elevationGainM: toFiniteNumber(plan.plan_course_stats?.elevationGainM),
      },
      race: {
        name: plan.races?.name ?? null,
        distanceKm: toFiniteNumber(plan.races?.distance_km),
        elevationGainM: toFiniteNumber(plan.races?.elevation_gain_m),
      },
    },
    products,
  });

  return withSecurityHeaders(NextResponse.json(payload));
}
