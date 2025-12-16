import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, getSupabaseAnonConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ productId: z.string().uuid() });

const querySchema = z.object({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2)
    .optional(),
});

const offerSchema = z.object({
  id: z.string().uuid(),
  product_id: z.string().uuid(),
  merchant: z.string().min(1),
  country_code: z.string().length(2).nullable(),
  affiliate_url: z.string().url(),
});

const responseSchema = z.object({
  offer: z.object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    merchant: z.string(),
    countryCode: z.string().length(2).nullable(),
    affiliateUrl: z.string().url(),
  }),
});

export async function GET(request: NextRequest, { params }: { params: { productId: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const parsedParams = paramsSchema.safeParse(params);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

  if (!parsedParams.success || !parsedQuery.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const productId = parsedParams.data.productId;
  const country = parsedQuery.data.country;

  try {
    const productResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/products?id=eq.${productId}&select=id`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!productResponse.ok) {
      console.error("Unable to verify product", await productResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load product." }, { status: 502 }));
    }

    const productData = (await productResponse.json()) as { id: string }[];

    if (!productData[0]) {
      return withSecurityHeaders(NextResponse.json({ message: "Product not found." }, { status: 404 }));
    }

    const filter = country
      ? `or=(country_code.eq.${country},country_code.is.null)`
      : "country_code.is.null";

    const offersResponse = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/affiliate_offers?product_id=eq.${productId}&active=eq.true&${filter}&select=id,product_id,merchant,country_code,affiliate_url&order=country_code.desc.nullslast,updated_at.desc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!offersResponse.ok) {
      console.error("Unable to fetch affiliate offers", await offersResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load offers." }, { status: 502 }));
    }

    const offers = z.array(offerSchema).parse(await offersResponse.json());

    if (!offers[0]) {
      return withSecurityHeaders(NextResponse.json({ message: "No offers available." }, { status: 410 }));
    }

    const offer = offers[0];

    const responseBody = responseSchema.parse({
      offer: {
        id: offer.id,
        productId: offer.product_id,
        merchant: offer.merchant,
        countryCode: offer.country_code,
        affiliateUrl: offer.affiliate_url,
      },
    });

    return withSecurityHeaders(NextResponse.json(responseBody));
  } catch (error) {
    console.error("Unexpected error while resolving offers", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load offers." }, { status: 500 }));
  }
}
