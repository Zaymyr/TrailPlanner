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

const supabaseEventSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_type: z.enum(["popup_open", "click"]),
  product_id: z.string().uuid(),
  offer_id: z.string().uuid().nullable().optional(),
  country_code: z.string().length(2).nullable().optional(),
  merchant: z.string().nullable().optional(),
  session_id: z.string(),
});

const supabaseProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

const analyticsResponseSchema = z.object({
  totals: z.object({
    popupOpens: z.number(),
    clicks: z.number(),
  }),
  productStats: z.array(
    z.object({
      productId: z.string(),
      productName: z.string().optional(),
      popupOpens: z.number(),
      clicks: z.number(),
    })
  ),
  recentEvents: z.array(
    z.object({
      id: z.string(),
      productId: z.string(),
      productName: z.string().optional(),
      eventType: z.enum(["popup_open", "click"]),
      countryCode: z.string().optional(),
      merchant: z.string().optional(),
      occurredAt: z.string(),
    })
  ),
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

const buildProductQuery = (ids: string[]) => {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return null;
  const joined = uniqueIds.join(",");
  return `${joined}`;
};

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const eventsResponse = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/affiliate_events?select=id,created_at,event_type,product_id,offer_id,country_code,merchant,session_id&order=created_at.desc&limit=100`,
      {
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    if (!eventsResponse.ok) {
      console.error("Unable to load affiliate events", await eventsResponse.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load analytics." }, { status: 502 }));
    }

    const eventRows = z.array(supabaseEventSchema).parse(await eventsResponse.json());
    const productIds = eventRows.map((row) => row.product_id);
    const productQuery = buildProductQuery(productIds);

    const productMap = new Map<string, { name?: string; slug?: string }>();

    if (productQuery) {
      const productsResponse = await fetch(
        `${auth.supabaseService.supabaseUrl}/rest/v1/products?id=in.(${productQuery})&select=id,name,slug`,
        {
          headers: {
            apikey: auth.supabaseService.supabaseServiceRoleKey,
            Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        }
      );

      if (productsResponse.ok) {
        const products = z.array(supabaseProductSchema).parse(await productsResponse.json());
        products.forEach((product) => {
          productMap.set(product.id, { name: product.name, slug: product.slug });
        });
      } else {
        console.warn("Unable to load product names for analytics", await productsResponse.text());
      }
    }

    const totals = eventRows.reduce(
      (acc, event) => {
        if (event.event_type === "popup_open") acc.popupOpens += 1;
        if (event.event_type === "click") acc.clicks += 1;
        return acc;
      },
      { popupOpens: 0, clicks: 0 }
    );

    const productStatsMap = new Map<
      string,
      { productId: string; productName?: string; popupOpens: number; clicks: number }
    >();

    eventRows.forEach((event) => {
      const current = productStatsMap.get(event.product_id) ?? {
        productId: event.product_id,
        productName: productMap.get(event.product_id)?.name,
        popupOpens: 0,
        clicks: 0,
      };

      if (event.event_type === "popup_open") current.popupOpens += 1;
      if (event.event_type === "click") current.clicks += 1;

      productStatsMap.set(event.product_id, current);
    });

    const recentEvents = eventRows.map((event) => ({
      id: event.id,
      productId: event.product_id,
      productName: productMap.get(event.product_id)?.name,
      eventType: event.event_type,
      countryCode: event.country_code ?? undefined,
      merchant: event.merchant ?? undefined,
      occurredAt: event.created_at,
    }));

    const payload = {
      totals,
      productStats: Array.from(productStatsMap.values()).sort(
        (a, b) => b.popupOpens + b.clicks - (a.popupOpens + a.clicks)
      ),
      recentEvents,
    };

    return withSecurityHeaders(NextResponse.json(analyticsResponseSchema.parse(payload)));
  } catch (error) {
    console.error("Unexpected error while building admin analytics", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load analytics." }, { status: 500 }));
  }
}
