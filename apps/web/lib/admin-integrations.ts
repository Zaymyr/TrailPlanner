import { z } from "zod";

import { emailActivitySchema, paymentActivitySchema, type EmailActivity, type PaymentActivity } from "./admin-system-health";

/**
 * « Intégrations » of the admin console (lot 3, pure): for each third-party service, whether its
 * configuration is present (true / false per variable, NEVER a value) and what the console already
 * knows of its activity (e-mail journal, Stripe journals, latest renders). The variable names are
 * the ones the code reads (`lib/resend.ts`, `lib/video-render.ts`, Stripe routes, studio routes).
 */

type Env = Record<string, string | undefined>;
const present = (env: Env, name: string) => Boolean(env[name]?.trim());

export const INTEGRATION_STATUSES = ["ok", "warning", "error", "off"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const integrationCheckSchema = z.object({ label: z.string(), present: z.boolean() });
export const integrationServiceSchema = z.object({
  key: z.enum(["stripe", "resend", "gcp", "mapbox", "elevenlabs", "anthropic", "openai"]),
  label: z.string(),
  role: z.string(),
  status: z.enum(INTEGRATION_STATUSES),
  statusLabel: z.string(),
  checks: z.array(integrationCheckSchema),
  detail: z.string().nullable(),
});
export type IntegrationService = z.infer<typeof integrationServiceSchema>;

export const integrationRenderSchema = z.object({
  id: z.string(),
  kind: z.enum(["reel", "carousel"]),
  title: z.string(),
  status: z.enum(["active", "done", "failed"]),
  stage: z.string(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const integrationsResponseSchema = z.object({
  generatedAt: z.string(),
  services: z.array(integrationServiceSchema),
  emails: emailActivitySchema.nullable(),
  payments: paymentActivitySchema.nullable(),
  /** Latest reel and carousel renders (null when they could not be read). */
  renders: z.array(integrationRenderSchema).nullable(),
});
export type IntegrationsResponse = z.infer<typeof integrationsResponseSchema>;

const STATUS_LABELS: Record<IntegrationStatus, string> = { ok: "Configuré", warning: "À surveiller", error: "Incomplet", off: "Non configuré" };

const STRIPE_PRICE_VARIABLES = [
  "STRIPE_PRICE_ID",
  "STRIPE_ANNUAL_PRICE_ID",
  "STRIPE_COURSE_PRICE_ID",
  "STRIPE_FLYOVER_DOWNLOAD_PRICE_ID",
  "STRIPE_FLYOVER_COLLAB_PRICE_ID",
  "STRIPE_ORGANIZER_ESSENTIAL_PRICE_ID",
  "STRIPE_ORGANIZER_COMPLETE_PRICE_ID",
  "STRIPE_ORGANIZER_SIGNATURE_PRICE_ID",
] as const;

/** Same variables as `getVideoRenderConfig` (the others have defaults); the token secret needs 32 characters. */
const GCP_VARIABLES = ["GCP_PROJECT_ID", "GCP_PROJECT_NUMBER", "GCP_SERVICE_ACCOUNT_EMAIL", "VIDEO_RENDER_BUCKET", "VIDEO_RENDER_TOKEN_SECRET"] as const;

const service = (key: IntegrationService["key"], label: string, role: string, checks: IntegrationService["checks"], status: IntegrationStatus, detail: string | null = null): IntegrationService =>
  ({ key, label, role, status, statusLabel: STATUS_LABELS[status], checks, detail });

const allOrNothing = (checks: IntegrationService["checks"]): IntegrationStatus =>
  checks.every((check) => check.present) ? "ok" : checks.some((check) => check.present) ? "error" : "off";

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

/**
 * Cards of the services other than Instagram (its card is the existing one). `renderConfigured` is
 * `getVideoRenderConfig() !== null`; activity comes from the journals and may be null (unreadable).
 */
export const buildIntegrationServices = ({ env, renderConfigured, emails, payments }: {
  env: Env;
  renderConfigured: boolean;
  emails: EmailActivity | null;
  payments: PaymentActivity | null;
}): IntegrationService[] => {
  const pricesPresent = STRIPE_PRICE_VARIABLES.filter((name) => present(env, name)).length;
  const stripeChecks = [
    { label: "Clé secrète (STRIPE_SECRET_KEY)", present: present(env, "STRIPE_SECRET_KEY") },
    { label: "Secret du webhook (STRIPE_WEBHOOK_SECRET)", present: present(env, "STRIPE_WEBHOOK_SECRET") },
    { label: `Prix configurés (${pricesPresent} sur ${STRIPE_PRICE_VARIABLES.length})`, present: pricesPresent > 0 },
  ];
  let stripeStatus = allOrNothing(stripeChecks.slice(0, 2));
  if (stripeStatus === "ok" && payments?.unprocessed.length) stripeStatus = "error";
  else if (stripeStatus === "ok" && payments?.failedOrganizerPayments) stripeStatus = "warning";
  const stripeDetail = payments
    ? payments.unprocessed.length
      ? `${plural(payments.unprocessed.length, "événement")} non traité${payments.unprocessed.length > 1 ? "s" : ""} par le webhook`
      : payments.lastEventAt ? `Dernier événement : ${payments.lastEventSource}` : "Aucun événement Stripe enregistré"
    : "Journaux de paiement illisibles";

  const resendChecks = [
    { label: "Clé API (RESEND_API_KEY)", present: present(env, "RESEND_API_KEY") },
    { label: "Expéditeur personnalisé (RESEND_FROM)", present: present(env, "RESEND_FROM") },
  ];
  let resendStatus: IntegrationStatus = resendChecks[0].present ? "ok" : "off";
  if (resendStatus === "ok" && emails?.failed24h) resendStatus = emails.lastAttemptFailed ? "error" : "warning";
  const resendDetail = !emails
    ? "Journal des e-mails illisible"
    : !emails.journalAvailable
      ? "Journal des e-mails non déployé"
      : `${emails.sent24h} envoyé${emails.sent24h > 1 ? "s" : ""}, ${plural(emails.failed24h, "échec")} en 24 h`;

  const gcpChecks = GCP_VARIABLES.map((name) => ({
    label: name === "VIDEO_RENDER_TOKEN_SECRET" ? `${name} (32 caractères au moins)` : name,
    present: name === "VIDEO_RENDER_TOKEN_SECRET" ? (env[name]?.trim().length ?? 0) >= 32 : present(env, name),
  }));
  const gcpStatus: IntegrationStatus = renderConfigured ? "ok" : gcpChecks.some((check) => check.present) ? "error" : "off";

  const single = (key: IntegrationService["key"], label: string, role: string, variable: string) => {
    const checks = [{ label: variable, present: present(env, variable) }];
    return service(key, label, role, checks, checks[0].present ? "ok" : "off");
  };

  return [
    service("stripe", "Stripe", "Paiements coureurs, packs organisateurs, vidéos de survol", stripeChecks, stripeStatus, stripeDetail),
    service("resend", "Resend", "E-mails transactionnels et contacts", resendChecks, resendStatus, resendDetail),
    service("gcp", "Google Cloud (rendus)", "Rendus vidéo des reels et carrousels en arrière-plan", gcpChecks, gcpStatus, renderConfigured ? null : "Rendu en arrière-plan indisponible : le studio exporte seulement depuis le navigateur."),
    single("mapbox", "Mapbox", "Cartes 3D du studio et des survols", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"),
    single("elevenlabs", "ElevenLabs", "Voix off des reels et des survols", "ELEVENLABS_API_KEY"),
    single("anthropic", "Anthropic", "Textes des reels, carrousels, survols et légendes Instagram", "ANTHROPIC_API_KEY"),
    single("openai", "OpenAI", "Import organisateur depuis un site", "OPENAI_API_KEY"),
  ];
};
