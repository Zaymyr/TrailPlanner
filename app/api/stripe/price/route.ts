import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getStripeConfig } from "../../../../lib/stripe";

type StripeInterval = "day" | "week" | "month" | "year";

const stripePriceSchema = z.object({
  currency: z.string().min(1),
  unit_amount: z.number().int().nonnegative().nullable(),
  recurring: z
    .object({
      interval: z.enum(["day", "week", "month", "year"]).nullable().optional(),
      interval_count: z.number().int().positive().nullable().optional(),
    })
    .nullable()
    .optional(),
});

type StripePrice = z.infer<typeof stripePriceSchema>;
type StripePriceWithAmount = StripePrice & { unit_amount: number };

type PriceResponse = {
  price: {
    currency: string;
    unitAmount: number;
    interval: StripeInterval | null;
    intervalCount: number | null;
  };
};

let cachedPrice: { data: PriceResponse["price"]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

const respondWithPrice = (price: PriceResponse["price"]) => {
  const response = NextResponse.json<PriceResponse>({ price });
  response.headers.set("Cache-Control", "public, max-age=300");
  return withSecurityHeaders(response);
};

const parseStripePrice = (payload: unknown): StripePriceWithAmount => {
  const parsed = stripePriceSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("Invalid Stripe price payload.");
  }

  const price = parsed.data;

  if (price.unit_amount === null) {
    throw new Error("Stripe price is missing an amount.");
  }

  return { ...price, unit_amount: price.unit_amount };
};

export async function GET(request: NextRequest) {
  const stripeConfig = getStripeConfig();

  if (!stripeConfig?.priceId) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Stripe price is not configured." }, { status: 500 })
    );
  }

  const rateLimit = checkRateLimit(
    `stripe:price:${request.headers.get("x-forwarded-for") ?? request.ip ?? "global"}`,
    20,
    60_000
  );

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many price requests. Please try again in a moment." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  if (cachedPrice && cachedPrice.expiresAt > Date.now()) {
    return respondWithPrice(cachedPrice.data);
  }

  try {
    const response = await fetch(`https://api.stripe.com/v1/prices/${stripeConfig.priceId}`, {
      headers: {
        Authorization: `Bearer ${stripeConfig.secretKey}`,
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to fetch Stripe price", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load subscription price." }, { status: 500 }));
    }

    const stripePrice = parseStripePrice(payload);

    const normalizedPrice: PriceResponse["price"] = {
      currency: stripePrice.currency.toUpperCase(),
      unitAmount: stripePrice.unit_amount,
      interval: stripePrice.recurring?.interval ?? null,
      intervalCount: stripePrice.recurring?.interval_count ?? null,
    };

    cachedPrice = { data: normalizedPrice, expiresAt: Date.now() + CACHE_TTL_MS };

    return respondWithPrice(normalizedPrice);
  } catch (error) {
    console.error("Unexpected error while retrieving Stripe price", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load subscription price." }, { status: 500 }));
  }
}
