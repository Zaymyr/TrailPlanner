import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../lib/http";
import { loadOrganizerEditionEntitlement } from "../../../../lib/organizer-entitlements";
import { jsonError, requireEventOrganizer, requireOrganizerAuth, serviceHeaders } from "../../../../lib/organizer";
import { validateOrganizerEditionPublication } from "../../../../lib/organizer-publication";
import { getStripeConfig, getStripeJson, postStripeForm } from "../../../../lib/stripe";
import { isAnonymousUser } from "../../../../lib/supabase";

const requestSchema = z.object({
  eventId: z.string().uuid(),
  editionId: z.string().uuid(),
  targetTier: z.enum(["racebook", "pro"]),
});

const stripePriceSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  currency: z.string(),
  unit_amount: z.number().int().nullable(),
  recurring: z.unknown().nullable().optional(),
  tax_behavior: z.enum(["exclusive", "inclusive", "unspecified"]).optional(),
});

const paymentRowSchema = z.object({
  id: z.string().uuid(),
  stripe_checkout_url: z.string().url().nullable().optional(),
});

const OFFER_CONFIG = {
  racebook: { purchaseKind: "racebook", fromTier: "visibility", amount: 9_900 },
  pro_direct: { purchaseKind: "pro_direct", fromTier: "visibility", amount: 29_900 },
  pro_upgrade: { purchaseKind: "pro_upgrade", fromTier: "racebook", amount: 20_000 },
} as const;

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;
  if (isAnonymousUser(auth.user)) return jsonError("Crée un compte complet avant de payer une offre organisateur.", 403);

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid organizer checkout request.", 400);
  const membership = await requireEventOrganizer(auth.serviceConfig, auth.user, parsed.data.eventId);
  if (membership !== true) return membership.error;

  const rateLimit = await checkRateLimitAsync(`organizer-checkout:${auth.user.id}:${parsed.data.editionId}`, 5, 60_000);
  if (!rateLimit.allowed) return jsonError("Too many checkout attempts.", 429);

  const editionResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${parsed.data.editionId}&event_id=eq.${parsed.data.eventId}&select=id&limit=1`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
  );
  if (!editionResponse.ok) return jsonError("Unable to verify event edition.", 502);
  if (((await editionResponse.json()) as unknown[]).length === 0) return jsonError("Event edition not found.", 404);

  const readiness = await validateOrganizerEditionPublication(
    auth.serviceConfig,
    parsed.data.eventId,
    parsed.data.editionId
  );
  if (!readiness.ok) return jsonError(readiness.message, readiness.status);

  const current = await loadOrganizerEditionEntitlement(auth.serviceConfig, parsed.data.editionId);
  const currentTier = current?.status === "active" ? current.tier : "visibility";
  if (currentTier === "pro" || currentTier === parsed.data.targetTier) {
    return jsonError("Cette édition dispose déjà de cette offre.", 409);
  }
  if (currentTier === "racebook" && parsed.data.targetTier !== "pro") {
    return jsonError("Seul le passage à RaceBook Pro est disponible.", 409);
  }

  const offerKey = parsed.data.targetTier === "racebook" ? "racebook" : currentTier === "racebook" ? "pro_upgrade" : "pro_direct";
  const offer = OFFER_CONFIG[offerKey];
  const stripeConfig = getStripeConfig();
  if (!stripeConfig) return jsonError("Stripe configuration is missing.", 500);
  const priceId =
    offerKey === "racebook"
      ? stripeConfig.organizerRacebookPriceId
      : offerKey === "pro_direct"
        ? stripeConfig.organizerProPriceId
        : stripeConfig.organizerProUpgradePriceId;
  if (!priceId) return jsonError("L’offre Stripe organisateur n’est pas configurée.", 500);

  let paymentId: string | null = null;
  try {
    const price = stripePriceSchema.parse(await getStripeJson(`/v1/prices/${encodeURIComponent(priceId)}`, stripeConfig.secretKey));
    if (
      !price.active ||
      price.currency !== "eur" ||
      price.unit_amount !== offer.amount ||
      price.recurring ||
      price.tax_behavior !== "exclusive"
    ) {
      return jsonError("La configuration du prix Stripe organisateur est invalide.", 500);
    }

    paymentId = randomUUID();
    const insertResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments`, {
      method: "POST",
      headers: { ...serviceHeaders(auth.serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify({
        id: paymentId,
        edition_id: parsed.data.editionId,
        purchaser_user_id: auth.user.id,
        purchase_kind: offer.purchaseKind,
        from_tier: offer.fromTier,
        to_tier: parsed.data.targetTier,
        status: "pending",
        amount_subtotal: offer.amount,
        currency: "eur",
      }),
      cache: "no-store",
    });
    if (!insertResponse.ok) {
      if (insertResponse.status === 409) {
        const pendingResponse = await fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?edition_id=eq.${parsed.data.editionId}&purchase_kind=eq.${offer.purchaseKind}&status=eq.pending&select=id,stripe_checkout_url&limit=1`,
          { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" }
        );
        if (pendingResponse.ok) {
          const pending = z.array(paymentRowSchema).parse(await pendingResponse.json())[0];
          if (pending?.stripe_checkout_url) {
            return withSecurityHeaders(NextResponse.json({ url: pending.stripe_checkout_url, paymentId: pending.id }));
          }
        }
        return jsonError("Un paiement est déjà en cours pour cette offre.", 409);
      }
      console.error("Unable to create organizer payment attempt", await insertResponse.text());
      return jsonError("Unable to create organizer payment attempt.", 502);
    }
    const payment = z.array(paymentRowSchema).parse(await insertResponse.json())[0];
    if (!payment) return jsonError("Unable to create organizer payment attempt.", 502);

    const origin = new URL(request.url).origin;
    const successUrl =
      stripeConfig.organizerCheckoutSuccessUrl ??
      `${origin}/organizer?eventId=${parsed.data.eventId}&editionId=${parsed.data.editionId}&organizerPayment=success&targetTier=${parsed.data.targetTier}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl =
      stripeConfig.organizerCheckoutCancelUrl ??
      `${origin}/organizer?eventId=${parsed.data.eventId}&editionId=${parsed.data.editionId}&organizerPayment=cancel`;

    const session = await postStripeForm<{ id: string; url?: string }>(
      "/v1/checkout/sessions",
      {
        mode: "payment",
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: auth.user.email,
        "automatic_tax[enabled]": "true",
        billing_address_collection: "required",
        "tax_id_collection[enabled]": "true",
        "invoice_creation[enabled]": "true",
        locale: "fr",
        client_reference_id: payment.id,
        "metadata[purchase_type]": "organizer_edition",
        "metadata[payment_id]": payment.id,
        "metadata[event_id]": parsed.data.eventId,
        "metadata[edition_id]": parsed.data.editionId,
        "metadata[user_id]": auth.user.id,
        "metadata[from_tier]": offer.fromTier,
        "metadata[to_tier]": parsed.data.targetTier,
        "payment_intent_data[metadata][purchase_type]": "organizer_edition",
        "payment_intent_data[metadata][payment_id]": payment.id,
      },
      stripeConfig.secretKey,
      { idempotencyKey: `organizer-edition-${payment.id}` }
    );
    if (!session.url) throw new Error("Stripe checkout session has no URL.");

    await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${payment.id}`, {
      method: "PATCH",
      headers: serviceHeaders(auth.serviceConfig),
      body: JSON.stringify({ stripe_checkout_session_id: session.id, stripe_checkout_url: session.url }),
      cache: "no-store",
    });
    return withSecurityHeaders(NextResponse.json({ url: session.url, paymentId: payment.id }));
  } catch (error) {
    console.error("Organizer Stripe checkout error", error);
    if (paymentId) {
      await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/organizer_edition_payments?id=eq.${paymentId}&status=eq.pending`, {
        method: "PATCH",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({ status: "failed" }),
        cache: "no-store",
      }).catch(() => null);
    }
    return jsonError("Impossible d’ouvrir le paiement Stripe.", 500);
  }
}
