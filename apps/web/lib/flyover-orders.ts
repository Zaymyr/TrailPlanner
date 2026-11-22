import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { supportEmail } from "../app/support/copy";
import { FLYOVER_MAP_PRESET_VALUES, FLYOVER_MAX_DISTANCE_KM, FLYOVER_OFFERED_PRESETS, FLYOVER_STORY_MODE_VALUES, FLYOVER_TERRAIN } from "./flyover-shared";
import { escapeEmailHtml } from "./resend";
import { formatParisDateTime, parisLocalToUtc } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Organizer flyover video orders (/survol): a standalone paid product, not tied to the race
 * catalog. The organizer uploads a GPX and pays; the cron route makes the reel with the automatic
 * reel steps and emails the organizer. See docs/03-business-rules/flyover-video-orders.md.
 */

export {
  applyFlyoverSettings,
  buildFlyoverDetail,
  checkFlyoverGpx,
  readGpxAidStations,
  FLYOVER_MAX_DISTANCE_KM,
  type GpxCheck,
  FLYOVER_MAP_PRESET_VALUES,
  FLYOVER_MAP_PRESETS,
  FLYOVER_OFFERED_PRESETS,
  FLYOVER_STORY_MODE_VALUES,
  FLYOVER_STORY_MODES,
  type FlyoverStoryMode,
  FLYOVER_TERRAIN,
  getFlyoverMode,
  type FlyoverMapPreset,
} from "./flyover-shared";

// ---------------------------------------------------------------------------------------------
// Offers, rules

export const FLYOVER_OFFERS = {
  collab: { amountCents: 2_999, label: "Publication en collaboration", stripeEnv: "STRIPE_FLYOVER_COLLAB_PRICE_ID" },
  download: { amountCents: 5_999, label: "Vidéo MP4 à télécharger", stripeEnv: "STRIPE_FLYOVER_DOWNLOAD_PRICE_ID" },
} as const;
export type FlyoverOffer = keyof typeof FLYOVER_OFFERS;
export const FLYOVER_OFFER_VALUES = Object.keys(FLYOVER_OFFERS) as [FlyoverOffer, ...FlyoverOffer[]];

export const FLYOVER_MAX_GPX_BYTES = 10 * 1024 * 1024;
export const FLYOVER_MAX_AID_STATIONS = 40;
/** Production promise: the video is ready within 24 h of the payment. */
export const FLYOVER_DELIVERY_HOURS = 24;
/** A collab slot leaves the production window first, and must publish before the MP4 expires (30 days). */
export const FLYOVER_PUBLISH_MIN_HOURS = 48;
export const FLYOVER_PUBLISH_MAX_DAYS = 21;
/** A step is retried this many times before the order fails (and the team is told). */
export const FLYOVER_MAX_ATTEMPTS = 3;

export const FLYOVER_STATUSES = ["pending_payment", "paid", "scripted", "rendering", "ready", "failed", "expired", "refunded"] as const;
export type FlyoverStatus = (typeof FLYOVER_STATUSES)[number];

const HOUR_MS = 60 * 60 * 1_000;

/** " @trail_du_lac", "instagram.com/trail_du_lac/" → "trail_du_lac" (checked by INSTAGRAM_HANDLE_PATTERN). */
export const normalizeInstagramHandle = (value: string | null | undefined) => {
  const handle = (value ?? "").trim().replace(/^@+/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  return handle ? handle : null;
};
export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

/** The collab slot: Paris wall time, after the production window and before the MP4 lifetime. */
export const validatePublishLocal = (local: string, now = new Date()): { ok: true; at: Date } | { ok: false; message: string } => {
  const at = parisLocalToUtc(local);
  if (!at) return { ok: false, message: "Date de publication invalide." };
  if (at.getTime() < now.getTime() + FLYOVER_PUBLISH_MIN_HOURS * HOUR_MS) {
    return { ok: false, message: `Choisissez une publication au moins ${FLYOVER_PUBLISH_MIN_HOURS} h à l’avance (production sous 24 h).` };
  }
  if (at.getTime() > now.getTime() + FLYOVER_PUBLISH_MAX_DAYS * 24 * HOUR_MS) {
    return { ok: false, message: `Choisissez une publication dans les ${FLYOVER_PUBLISH_MAX_DAYS} prochains jours.` };
  }
  return { ok: true, at };
};

// ---------------------------------------------------------------------------------------------
// Order form

const aidStationInputSchema = z.object({
  name: z.string().trim().min(1, "Nom de ravito manquant.").max(80),
  km: z.coerce.number().min(0).max(FLYOVER_MAX_DISTANCE_KM),
});

export const flyoverOrderFormSchema = z.object({
  offer: z.enum(FLYOVER_OFFER_VALUES),
  raceName: z.string().trim().min(2, "Indiquez le nom de la course.").max(120),
  raceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().transform((value) => value || null),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(320),
  instagramHandle: z.string().max(120).nullable().optional().transform((value) => normalizeInstagramHandle(value)),
  // Only the presets offered on the page can be ordered.
  mapPreset: z.enum(FLYOVER_MAP_PRESET_VALUES).refine((value) => FLYOVER_OFFERED_PRESETS.includes(value), "Fond de carte indisponible."),
  storyMode: z.enum(FLYOVER_STORY_MODE_VALUES).nullable().optional().transform((value) => value ?? null),
  terrainExaggeration: z.coerce.number().min(FLYOVER_TERRAIN.min).max(FLYOVER_TERRAIN.max),
  publishLocal: z.string().nullable().optional().transform((value) => value || null),
  aidStations: z.array(aidStationInputSchema).max(FLYOVER_MAX_AID_STATIONS).default([]),
  // The organizer cleared or edited the stations: never fall back to the GPX waypoints.
  aidStationsEdited: z.boolean().default(false),
  // Honeypot.
  website: z.string().optional(),
}).superRefine((value, context) => {
  if (value.instagramHandle && !INSTAGRAM_HANDLE_PATTERN.test(value.instagramHandle)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["instagramHandle"], message: "Compte Instagram invalide." });
  }
  if (value.offer === "collab") {
    if (!value.instagramHandle) context.addIssue({ code: z.ZodIssueCode.custom, path: ["instagramHandle"], message: "Le compte Instagram de l’événement est requis pour la collaboration." });
    if (!value.publishLocal) context.addIssue({ code: z.ZodIssueCode.custom, path: ["publishLocal"], message: "Choisissez la date de publication." });
  }
});
export type FlyoverOrderForm = z.infer<typeof flyoverOrderFormSchema>;

/** Reads the multipart fields of the order form (the GPX file is read separately). */
export const readFlyoverOrderFormData = (formData: FormData) => {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : undefined;
  };
  let aidStations: unknown = [];
  try {
    aidStations = JSON.parse(text("aidStations") || "[]");
  } catch {
    aidStations = null;
  }
  return flyoverOrderFormSchema.safeParse({
    offer: text("offer"),
    raceName: text("raceName"),
    raceDate: text("raceDate"),
    email: text("email"),
    instagramHandle: text("instagramHandle"),
    mapPreset: text("mapPreset"),
    storyMode: text("storyMode") || null,
    terrainExaggeration: text("terrainExaggeration") ?? FLYOVER_TERRAIN.default,
    publishLocal: text("publishLocal"),
    aidStations,
    aidStationsEdited: text("aidStationsEdited") === "1",
    website: text("website"),
  });
};

// ---------------------------------------------------------------------------------------------
// Rows

export const flyoverAidStationSchema = z.object({ id: z.string().uuid(), name: z.string(), km: z.number() });
export type FlyoverAidStation = z.infer<typeof flyoverAidStationSchema>;

/** Stations sorted along the course, inside it, with ids fixed once for every step. */
export const prepareAidStations = (stations: Array<{ name: string; km: number }>, distanceKm: number): FlyoverAidStation[] =>
  stations
    .filter((station) => station.km <= distanceKm + 0.5)
    .map((station) => ({ id: randomUUID(), name: station.name.trim(), km: Math.round(Math.min(station.km, distanceKm) * 10) / 10 }))
    .sort((a, b) => a.km - b.km);

export const flyoverOrderRowSchema = z.object({
  id: z.string().uuid(),
  offer: z.enum(FLYOVER_OFFER_VALUES),
  amount_cents: z.number().int(),
  status: z.enum(FLYOVER_STATUSES),
  race_name: z.string(),
  race_date: z.string().nullable(),
  contact_email: z.string(),
  instagram_handle: z.string().nullable(),
  map_preset: z.enum(FLYOVER_MAP_PRESET_VALUES),
  // Null for orders placed before the choice (2026-11-22): the distance rule applies.
  story_mode: z.enum(FLYOVER_STORY_MODE_VALUES).nullable().optional().transform((value) => value ?? null),
  terrain_exaggeration: z.number(),
  publish_local: z.string().nullable(),
  aid_stations: z.array(flyoverAidStationSchema).catch([]),
  gpx_storage_path: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable(),
  stripe_checkout_session_id: z.string().nullable(),
  stripe_checkout_url: z.string().nullable(),
  stripe_payment_intent_id: z.string().nullable(),
  paid_at: z.string().nullable(),
  work: z.record(z.string(), z.unknown()).nullable(),
  attempts: z.number().int(),
  error: z.string().nullable(),
  locked_until: z.string().nullable(),
  render_job_id: z.string().uuid().nullable(),
  social_post_id: z.string().uuid().nullable(),
  ready_at: z.string().nullable(),
  paid_email_sent_at: z.string().nullable(),
  ready_email_sent_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type FlyoverOrderRow = z.infer<typeof flyoverOrderRowSchema>;
export const FLYOVER_ORDER_COLUMNS = Object.keys(flyoverOrderRowSchema.shape).join(",");

export const getFlyoverGpxPath = (orderId: string) => `flyover/${orderId}.gpx`;

const serviceHeaders = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

export type FlyoverOrderRepository = {
  get: (id: string) => Promise<FlyoverOrderRow | null>;
  insert: (row: Record<string, unknown>) => Promise<FlyoverOrderRow>;
  /** Guarded update: applied only when the row matches `filter` (PostgREST query string). */
  update: (id: string, patch: Record<string, unknown>, filter?: string) => Promise<FlyoverOrderRow | null>;
  /** Orders of these statuses, oldest payment first. */
  listByStatus: (statuses: FlyoverStatus[], limit: number) => Promise<FlyoverOrderRow[]>;
  findByPaymentIntent: (paymentIntentId: string) => Promise<FlyoverOrderRow[]>;
  /** Ready orders whose ready email has not gone out yet (a failed send is retried by the next tick). */
  listReadyWithoutEmail: (limit: number) => Promise<FlyoverOrderRow[]>;
};

export const createFlyoverOrderRepository = (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch): FlyoverOrderRepository => {
  const base = `${supabase.supabaseUrl}/rest/v1/flyover_video_orders`;
  const rows = async (response: Response) => {
    if (!response.ok) throw new Error(`Flyover orders request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    return z.array(flyoverOrderRowSchema).parse(await response.json());
  };
  return {
    get: async (id) => (await rows(await fetcher(`${base}?id=eq.${encodeURIComponent(id)}&select=${FLYOVER_ORDER_COLUMNS}&limit=1`, { headers: serviceHeaders(supabase), cache: "no-store" })))[0] ?? null,
    insert: async (row) => {
      const inserted = (await rows(await fetcher(`${base}?select=${FLYOVER_ORDER_COLUMNS}`, {
        method: "POST",
        headers: serviceHeaders(supabase, { Prefer: "return=representation" }),
        body: JSON.stringify(row),
        cache: "no-store",
      })))[0];
      if (!inserted) throw new Error("Flyover order insert returned no row.");
      return inserted;
    },
    update: async (id, patch, filter) => (await rows(await fetcher(`${base}?id=eq.${encodeURIComponent(id)}${filter ? `&${filter}` : ""}&select=${FLYOVER_ORDER_COLUMNS}`, {
      method: "PATCH",
      headers: serviceHeaders(supabase, { Prefer: "return=representation" }),
      body: JSON.stringify(patch),
      cache: "no-store",
    })))[0] ?? null,
    listByStatus: async (statuses, limit) => rows(await fetcher(`${base}?status=in.(${statuses.join(",")})&select=${FLYOVER_ORDER_COLUMNS}&order=paid_at.asc.nullslast,created_at.asc&limit=${limit}`, {
      headers: serviceHeaders(supabase),
      cache: "no-store",
    })),
    listReadyWithoutEmail: async (limit) => rows(await fetcher(`${base}?status=eq.ready&ready_email_sent_at=is.null&select=${FLYOVER_ORDER_COLUMNS}&order=ready_at.asc&limit=${limit}`, {
      headers: serviceHeaders(supabase),
      cache: "no-store",
    })),
    findByPaymentIntent: async (paymentIntentId) => rows(await fetcher(`${base}?stripe_payment_intent_id=eq.${encodeURIComponent(paymentIntentId)}&select=${FLYOVER_ORDER_COLUMNS}`, {
      headers: serviceHeaders(supabase),
      cache: "no-store",
    })),
  };
};

// ---------------------------------------------------------------------------------------------
// Composition

/** The collab caption: the written one, then the organizer's account. */
export const withCollabMention = (caption: string, handle: string | null) => {
  if (!handle) return caption;
  const mention = `@${handle}`;
  if (caption.toLowerCase().includes(mention.toLowerCase())) return caption;
  return `${caption.trim()}\n\nEn collaboration avec ${mention}`.slice(0, 2_000);
};

// ---------------------------------------------------------------------------------------------
// Order page link

const ORDER_TOKEN_SCOPE = "flyover-order";

const orderSecret = () => {
  const secret = process.env.FLYOVER_ORDER_TOKEN_SECRET?.trim() || process.env.VIDEO_RENDER_TOKEN_SECRET?.trim() || "";
  return secret.length >= 32 ? secret : null;
};

/** Signed, non-expiring access to one order page (the MP4 itself expires with the bucket). */
export const createFlyoverOrderToken = (orderId: string, secret = orderSecret()) => {
  if (!secret) throw new Error("FLYOVER_ORDER_TOKEN_SECRET (ou VIDEO_RENDER_TOKEN_SECRET) absent.");
  return createHmac("sha256", secret).update(`${ORDER_TOKEN_SCOPE}:${orderId}`).digest("base64url");
};

export const verifyFlyoverOrderToken = (orderId: string, token: string | null | undefined, secret = orderSecret()) => {
  if (!token || !secret) return false;
  const expected = Buffer.from(createFlyoverOrderToken(orderId, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const getFlyoverAppOrigin = () =>
  (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://pace-yourself.com").replace(/\/$/, "");

export const buildFlyoverOrderUrl = (orderId: string, origin = getFlyoverAppOrigin()) =>
  `${origin}/survol/commande/${orderId}?t=${encodeURIComponent(createFlyoverOrderToken(orderId))}`;

// ---------------------------------------------------------------------------------------------
// Emails

export const flyoverNotifyEmail = () => process.env.FLYOVER_NOTIFY_EMAIL?.trim() || process.env.ORGANIZER_DEMO_NOTIFY_EMAIL?.trim() || supportEmail;

const layout = (title: string, body: string) => `<!doctype html>
<html lang="fr"><body style="margin:0; padding:24px 12px; background:#f4f1ea; font-family:Arial, Helvetica, sans-serif; color:#1f2410;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px; margin:0 auto; background:#ffffff; border:1px solid #e5e2d8; border-radius:16px;">
    <tr><td style="padding:28px 28px 8px 28px;">
      <p style="margin:0 0 6px 0; color:#2d5016; font-size:12px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase;">Pace Yourself · Vidéo de survol</p>
      <h1 style="margin:0 0 16px 0; font-size:24px; line-height:31px;">${title}</h1>
    </td></tr>
    <tr><td style="padding:0 28px 28px 28px; font-size:15px; line-height:24px; color:#3d4433;">${body}</td></tr>
  </table>
</body></html>`;

const button = (href: string, label: string) =>
  `<p style="margin:22px 0;"><a href="${escapeEmailHtml(href)}" style="display:inline-block; background:#2d5016; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 20px; border-radius:10px;">${label}</a></p>`;

type EmailCopy = { subject: string; html: string; text: string };

const publishLabel = (order: Pick<FlyoverOrderRow, "publish_local">) => {
  const at = order.publish_local ? parisLocalToUtc(order.publish_local) : null;
  return at ? formatParisDateTime(at.toISOString()) : null;
};

export const buildFlyoverPaidEmail = (order: FlyoverOrderRow, orderUrl: string): EmailCopy => {
  const name = escapeEmailHtml(order.race_name);
  const when = publishLabel(order);
  const next = order.offer === "collab"
    ? `Elle sera publiée sur le compte Instagram Pace Yourself le ${escapeEmailHtml(when ?? "jour choisi")}, en collaboration avec @${escapeEmailHtml(order.instagram_handle ?? "")}. Vous recevrez une invitation de collaboration sur Instagram : acceptez-la pour que le reel apparaisse aussi sur votre compte.`
    : "Vous recevrez un e-mail avec le lien de téléchargement du fichier MP4.";
  return {
    subject: `Commande reçue : vidéo de survol « ${order.race_name} »`,
    html: layout("Merci, votre commande est confirmée", `
      <p style="margin:0 0 12px 0;">Nous préparons la vidéo de survol de <strong>${name}</strong> : tracé 3D, voix off et récit. Elle sera prête sous ${FLYOVER_DELIVERY_HOURS} h.</p>
      <p style="margin:0 0 12px 0;">${next}</p>
      ${button(orderUrl, "Suivre ma commande")}
      <p style="margin:0; color:#8a917e; font-size:13px;">Une question ? Répondez simplement à cet e-mail.</p>`),
    text: [
      "Merci, votre commande est confirmée.",
      `Nous préparons la vidéo de survol de ${order.race_name}. Elle sera prête sous ${FLYOVER_DELIVERY_HOURS} h.`,
      next,
      `Suivre ma commande : ${orderUrl}`,
    ].join("\n\n"),
  };
};

export const buildFlyoverReadyEmail = (order: FlyoverOrderRow, orderUrl: string, scheduled: boolean): EmailCopy => {
  const name = escapeEmailHtml(order.race_name);
  if (order.offer === "download") {
    return {
      subject: `Votre vidéo de survol « ${order.race_name} » est prête`,
      html: layout("Votre vidéo est prête", `
        <p style="margin:0 0 12px 0;">La vidéo de survol de <strong>${name}</strong> est disponible au format MP4 (1080 × 1920, prête pour les reels et stories).</p>
        ${button(orderUrl, "Télécharger la vidéo")}
        <p style="margin:0; color:#8a917e; font-size:13px;">Le fichier reste téléchargeable 30 jours : pensez à l’enregistrer.</p>`),
      text: [
        `La vidéo de survol de ${order.race_name} est prête.`,
        `Télécharger la vidéo : ${orderUrl}`,
        "Le fichier reste téléchargeable 30 jours : pensez à l’enregistrer.",
      ].join("\n\n"),
    };
  }
  const when = publishLabel(order) ?? "la date choisie";
  const line = scheduled
    ? `Elle est programmée sur le compte Instagram Pace Yourself le ${escapeEmailHtml(when)}, en collaboration avec @${escapeEmailHtml(order.instagram_handle ?? "")}.`
    : "Elle est prête ; nous confirmons sa programmation sur Instagram et revenons vers vous rapidement.";
  return {
    subject: `Votre vidéo de survol « ${order.race_name} » est prête`,
    html: layout("Votre vidéo est prête", `
      <p style="margin:0 0 12px 0;">La vidéo de survol de <strong>${name}</strong> est prête. ${line}</p>
      <p style="margin:0 0 12px 0;">Au moment de la publication, Instagram enverra une invitation de collaboration à votre compte : acceptez-la pour que le reel apparaisse aussi sur votre profil.</p>
      ${button(orderUrl, "Voir ma commande")}`),
    text: [
      `La vidéo de survol de ${order.race_name} est prête.`,
      line,
      "Au moment de la publication, Instagram enverra une invitation de collaboration à votre compte : acceptez-la pour que le reel apparaisse aussi sur votre profil.",
      `Voir ma commande : ${orderUrl}`,
    ].join("\n\n"),
  };
};

export const buildFlyoverTeamAlertEmail = (order: FlyoverOrderRow, reason: string): EmailCopy => ({
  subject: `Vidéo de survol à reprendre : ${order.race_name}`,
  html: layout("Commande de survol à reprendre", `
    <p style="margin:0 0 12px 0;"><strong>${escapeEmailHtml(order.race_name)}</strong> (${order.offer === "collab" ? "collaboration" : "téléchargement"}, commande ${order.id}).</p>
    <p style="margin:0 0 12px 0;">${escapeEmailHtml(reason)}</p>
    <p style="margin:0;">Client : ${escapeEmailHtml(order.contact_email)}. Livraison promise sous ${FLYOVER_DELIVERY_HOURS} h après le paiement.</p>`),
  text: [`Commande de survol à reprendre : ${order.race_name} (${order.id}).`, reason, `Client : ${order.contact_email}.`].join("\n\n"),
});
