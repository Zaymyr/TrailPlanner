import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ slug: z.string().trim().min(1) });

const querySchema = z.object({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .optional(),
});

const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  carbs_g: z.number(),
  sodium_mg: z.number(),
});

const offerSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  merchant: z.string().min(1),
  country_code: z.string().length(2).nullable(),
  affiliate_url: z.string().url(),
});

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(params);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsedParams.success || !parsedQuery.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const rateLimitKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = checkRateLimit(`affiliate-product:${rateLimitKey}`, 60, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Too many requests." }, { status: 429 })
    );
  }

  const slug = parsedParams.data.slug;
  const country = parsedQuery.data.country;

  try {
    const productResponse = await fetch(
      `${supabaseService.supabaseUrl}/rest/v1/products?slug=eq.${encodeURIComponent(slug)}&is_live=eq.true&is_archived=eq.false&select=id,name,carbs_g,sodium_mg`,
      {
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!productResponse.ok) {
      console.error("Unable to load product", await productResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 502 }));
    }

    const product = z.array(productSchema).parse(await productResponse.json())[0];

    if (!product) {
      return withSecurityHeaders(NextResponse.json({ message: "Product not found." }, { status: 404 }));
    }

    const offerFilter = country
      ? `or=(country_code.eq.${country},country_code.is.null)`
      : "country_code.is.null";

    const offersResponse = await fetch(
      `${supabaseService.supabaseUrl}/rest/v1/affiliate_offers?product_id=eq.${product.id}&active=eq.true&${offerFilter}&select=id,product_id,merchant,country_code,affiliate_url&order=country_code.desc.nullslast,updated_at.desc`,
      {
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!offersResponse.ok) {
      console.error("Unable to load affiliate offers", await offersResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load affiliate offers." }, { status: 502 }));
    }

    const offers = z.array(offerSchema).parse(await offersResponse.json());

    if (!offers[0]) {
      return withSecurityHeaders(NextResponse.json({ message: "Offer unavailable." }, { status: 410 }));
    }

    const offer = offers[0];

    return withSecurityHeaders(
      NextResponse.json({
        product: {
          id: product.id,
          name: product.name,
          carbs: product.carbs_g,
          sodium: product.sodium_mg,
        },
        offer: {
          id: offer.id,
          merchant: offer.merchant,
          countryCode: offer.country_code,
          affiliateUrl: offer.affiliate_url,
        },
      })
    );
  } catch (error) {
    console.error("Unexpected error while loading affiliate product", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 500 }));
  }
}
