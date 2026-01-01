import crypto from "node:crypto";

import { z } from "zod";

const stripeConfigSchema = z.object({
  secretKey: z.string().trim().min(1),
  webhookSecret: z.string().trim().min(1).optional(),
  priceId: z.string().trim().min(1).optional(),
  checkoutSuccessUrl: z.string().trim().url().optional(),
  checkoutCancelUrl: z.string().trim().url().optional(),
  billingReturnUrl: z.string().trim().url().optional(),
});

export type StripeConfig = z.infer<typeof stripeConfigSchema>;

export const getStripeConfig = (): StripeConfig | null => {
  const parsed = stripeConfigSchema.safeParse({
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceId: process.env.STRIPE_PRICE_ID,
    checkoutSuccessUrl: process.env.STRIPE_CHECKOUT_SUCCESS_URL,
    checkoutCancelUrl: process.env.STRIPE_CHECKOUT_CANCEL_URL,
    billingReturnUrl: process.env.STRIPE_BILLING_RETURN_URL,
  });

  if (!parsed.success) {
    console.error("Missing Stripe configuration", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data;
};

export const postStripeForm = async <T>(
  path: string,
  params: Record<string, string | undefined>,
  secretKey: string
): Promise<T> => {
  const body = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "undefined") return;
    body.append(key, value);
  });

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Stripe request failed for ${path}`);
  }

  return (await response.json()) as T;
};

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export type StripeSubscriptionEventData = {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  items?: {
    data?: Array<{
      price?: { id?: string } | null;
    }>;
  };
  metadata?: Record<string, unknown>;
};

const timingSafeEqual = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

export const verifyStripeSignature = (
  payload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean => {
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signaturePart = parts.find((part) => part.startsWith("v1="));

  if (!timestampPart || !signaturePart) return false;

  const timestamp = Number(timestampPart.slice(2));
  const signature = signaturePart.slice(3);

  if (!Number.isFinite(timestamp)) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`, "utf8").digest("hex");

  if (!timingSafeEqual(expected, signature)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);

  return Math.abs(nowSeconds - timestamp) <= toleranceSeconds;
};
