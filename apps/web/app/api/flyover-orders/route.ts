import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  checkFlyoverGpx,
  createFlyoverOrderRepository,
  createFlyoverOrderToken,
  FLYOVER_MAX_GPX_BYTES,
  FLYOVER_OFFERS,
  getFlyoverGpxPath,
  prepareAidStations,
  readGpxAidStations,
  readFlyoverOrderFormData,
  validatePublishLocal,
} from "../../../lib/flyover-orders";
import { GpxParseError, parseGpx } from "../../../lib/gpx/parseGpx";
import { checkRateLimitAsync, withSecurityHeaders } from "../../../lib/http";
import { getStripeConfig, getStripeJson, postStripeForm } from "../../../lib/stripe";
import { getSupabaseServiceConfig } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => withSecurityHeaders(NextResponse.json(body, { status }));

const stripePriceSchema = z.object({
  id: z.string(),
  active: z.boolean(),
  currency: z.string(),
  unit_amount: z.number().int().nullable(),
  recurring: z.unknown().nullable().optional(),
});

/**
 * Public order of an organizer flyover video (/survol): checks the form and the GPX, stores the
 * GPX and a pending order, then opens Stripe Checkout. The webhook marks the order paid and the
 * cron route makes the video. Rules: docs/03-business-rules/flyover-video-orders.md.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rateLimit = await checkRateLimitAsync(`flyover-order:${ip}`, 8, 60 * 60 * 1000);
  if (!rateLimit.allowed) return json({ message: "Trop de tentatives. Réessayez dans un moment." }, 429);

  const supabase = getSupabaseServiceConfig();
  const stripe = getStripeConfig();
  if (!supabase || !stripe) return json({ message: "La commande n’est pas disponible pour le moment." }, 503);

  const formData = await request.formData().catch(() => null);
  if (!formData) return json({ message: "Formulaire invalide." }, 400);
  const parsed = readFlyoverOrderFormData(formData);
  if (!parsed.success) return json({ message: parsed.error.issues[0]?.message ?? "Formulaire invalide." }, 400);
  const form = parsed.data;
  // Bots filling the hidden field get a neutral answer, without any write or payment.
  if (form.website) return json({ message: "Commande impossible." }, 400);

  if (form.offer === "collab" && form.publishLocal) {
    const slot = validatePublishLocal(form.publishLocal);
    if (!slot.ok) return json({ message: slot.message }, 400);
  }

  const file = formData.get("gpx");
  if (!(file instanceof File) || file.size === 0) return json({ message: "Ajoutez le fichier GPX du parcours." }, 400);
  if (file.size > FLYOVER_MAX_GPX_BYTES) return json({ message: "Le GPX dépasse 10 Mo." }, 400);
  const gpxText = await file.text();
  let check: ReturnType<typeof checkFlyoverGpx>;
  let gpxStations: Array<{ name: string; km: number }> = [];
  try {
    const parsedGpx = parseGpx(gpxText);
    check = checkFlyoverGpx(parsedGpx);
    gpxStations = readGpxAidStations(parsedGpx);
  } catch (error) {
    if (error instanceof GpxParseError) return json({ message: "Ce fichier n’est pas un GPX lisible." }, 422);
    throw error;
  }
  if (!check.ok) return json({ message: check.message }, 422);

  const priceId = form.offer === "collab" ? stripe.flyoverCollabPriceId : stripe.flyoverDownloadPriceId;
  if (!priceId) return json({ message: "Le paiement de cette offre n’est pas encore configuré." }, 503);
  const offer = FLYOVER_OFFERS[form.offer];

  const orderId = randomUUID();
  const orders = createFlyoverOrderRepository(supabase);
  try {
    const price = stripePriceSchema.parse(await getStripeJson(`/v1/prices/${encodeURIComponent(priceId)}`, stripe.secretKey));
    if (!price.active || price.currency !== "eur" || price.unit_amount !== offer.amountCents || price.recurring) {
      console.error("Flyover Stripe price mismatch", { offer: form.offer, priceId });
      return json({ message: "Le paiement de cette offre n’est pas correctement configuré." }, 503);
    }

    const gpxPath = getFlyoverGpxPath(orderId);
    const upload = await fetch(`${supabase.supabaseUrl}/storage/v1/object/race-gpx/${gpxPath}`, {
      method: "POST",
      headers: {
        apikey: supabase.supabaseServiceRoleKey,
        Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
        "Content-Type": "application/gpx+xml",
        "x-upsert": "true",
      },
      body: gpxText,
      cache: "no-store",
    });
    if (!upload.ok) throw new Error(`GPX upload failed (${upload.status}): ${(await upload.text()).slice(0, 200)}`);

    await orders.insert({
      id: orderId,
      offer: form.offer,
      amount_cents: offer.amountCents,
      status: "pending_payment",
      race_name: form.raceName,
      race_date: form.raceDate,
      contact_email: form.email,
      instagram_handle: form.instagramHandle,
      map_preset: form.mapPreset,
      terrain_exaggeration: form.terrainExaggeration,
      publish_local: form.offer === "collab" ? form.publishLocal : null,
      // The form sends the stations shown to the organizer (GPX waypoints pre-filled, editable);
      // the GPX ones are only a fallback when the form sent none and the field was never touched.
      aid_stations: prepareAidStations(form.aidStations.length || form.aidStationsEdited ? form.aidStations : gpxStations, check.distanceKm),
      gpx_storage_path: gpxPath,
      distance_km: check.distanceKm,
      elevation_gain_m: check.gainM,
      elevation_loss_m: check.lossM,
    });

    const origin = new URL(request.url).origin;
    const token = createFlyoverOrderToken(orderId);
    const session = await postStripeForm<{ id: string; url?: string }>(
      "/v1/checkout/sessions",
      {
        mode: "payment",
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/survol/commande/${orderId}?t=${encodeURIComponent(token)}&paiement=ok`,
        cancel_url: `${origin}/survol?paiement=annule`,
        customer_email: form.email,
        "automatic_tax[enabled]": "true",
        billing_address_collection: "required",
        "tax_id_collection[enabled]": "true",
        "invoice_creation[enabled]": "true",
        // Promotion codes: internal 100 % test code (no_payment_required is handled as paid).
        allow_promotion_codes: "true",
        locale: "fr",
        client_reference_id: orderId,
        "metadata[purchase_type]": "flyover_video",
        "metadata[order_id]": orderId,
        "metadata[offer]": form.offer,
        "payment_intent_data[metadata][purchase_type]": "flyover_video",
        "payment_intent_data[metadata][order_id]": orderId,
      },
      stripe.secretKey,
      { idempotencyKey: `flyover-order-${orderId}` },
    );
    if (!session.url) throw new Error("Stripe checkout session has no URL.");
    await orders.update(orderId, { stripe_checkout_session_id: session.id, stripe_checkout_url: session.url }, "status=eq.pending_payment");
    return json({ url: session.url, orderId }, 201);
  } catch (error) {
    console.error("Flyover order failed", error instanceof Error ? error.message : error);
    await orders.update(orderId, { status: "expired", error: "Ouverture du paiement impossible." }, "status=eq.pending_payment").catch(() => null);
    return json({ message: "Impossible d’ouvrir le paiement pour le moment. Réessayez ou écrivez-nous." }, 502);
  }
}
