import { buildIntegrationServices, type IntegrationsResponse } from "../../../../lib/admin-integrations";
import {
  buildEmailActivity,
  classifyCronJob,
  summarizeCronHealth,
  summarizeEmailHealth,
  summarizePaymentHealth,
  vercelScheduledTasks,
  type CronJobRow,
  type EmailLogRow,
  type PaymentActivity,
  type SystemHealthResponse,
} from "../../../../lib/admin-system-health";

/** Simulated data of the « Système » pages (rendering tests and screenshots). Never imported by a page. */

export const SYSTEM_FIXTURE_NOW = Date.parse("2026-11-23T10:00:00.000Z");
const ago = (minutes: number, now = SYSTEM_FIXTURE_NOW) => new Date(now - minutes * 60_000).toISOString();

const job = (row: Partial<CronJobRow> & Pick<CronJobRow, "job_name" | "schedule">, now: number): CronJobRow => ({
  active: true,
  last_start: ago(10, now),
  last_end: ago(9.9, now),
  last_status: "succeeded",
  last_message: "1 row",
  runs_24h: 24,
  failures_24h: 0,
  ...row,
});

export const buildSystemHealthFixture = (now = SYSTEM_FIXTURE_NOW): SystemHealthResponse => {
  const rows: CronJobRow[] = [
    job({ job_name: "social-posts-publish", schedule: "*/5 * * * *", last_start: ago(3, now), last_end: ago(2.99, now), runs_24h: 288 }, now),
    job({ job_name: "reel-automation", schedule: "17 * * * *", last_start: ago(43, now), last_end: ago(42.2, now) }, now),
    job({ job_name: "carousel-automation", schedule: "47 * * * *", last_start: ago(13, now), last_end: ago(12.9, now), failures_24h: 1 }, now),
    job({ job_name: "flyover-orders", schedule: "*/10 * * * *", last_start: ago(35, now), last_end: ago(35, now), last_status: "failed", last_message: "ERROR: canceling statement due to statement timeout", runs_24h: 144, failures_24h: 3 }, now),
    job({ job_name: "demo-race-refresh", schedule: "5 * * * *", last_start: ago(55, now), last_end: ago(54.9, now) }, now),
    job({ job_name: "organizer-import-cleanup-hourly", schedule: "17 * * * *", last_start: ago(43, now), last_end: ago(43, now) }, now),
    job({ job_name: "push-reminders-daily", schedule: "0 9 * * *", last_start: ago(60, now), last_end: ago(60, now), runs_24h: 1 }, now),
    job({ job_name: "revenuecat-reconciliation", schedule: "17 3 * * *", last_start: ago(400, now), last_end: ago(399, now), runs_24h: 1 }, now),
    job({ job_name: "transactional-email-log-purge", schedule: "23 4 * * *", last_start: ago(337, now), last_end: ago(337, now), runs_24h: 1 }, now),
  ];
  const date = new Date(now);
  const tasks = rows.map((row) => classifyCronJob(row, now, date));
  const vercelTasks = vercelScheduledTasks(date);
  const pgNet = { available: true, responses: 412, errors: 3, oldest_at: ago(360, now), last_error_at: ago(35, now), last_error_status: 504, last_error_message: null };
  const emailRows: EmailLogRow[] = [
    { id: "e1", created_at: ago(18, now), category: "flyover/ready", status: "sent", status_code: null, message: null, recipient_masked: "or***@trail-des-cretes.fr" },
    { id: "e2", created_at: ago(95, now), category: "organizer-demo/admin", status: "failed", status_code: 429, message: "Too many requests", recipient_masked: "co***@pace-yourself.com" },
    { id: "e3", created_at: ago(96, now), category: "organizer-demo/confirmation", status: "sent", status_code: null, message: null, recipient_masked: "ma***@gmail.com" },
    { id: "e4", created_at: ago(240, now), category: "admin-user-notification", status: "sent", status_code: null, message: null, recipient_masked: "ju***@orange.fr" },
  ];
  const emails = buildEmailActivity({ configured: true, rows: emailRows, recent: emailRows });
  const payments: PaymentActivity = {
    stripeConfigured: true,
    webhookSecretConfigured: true,
    lastEventAt: ago(48, now),
    lastEventSource: "paiement organisateur",
    unprocessed: [],
    failedOrganizerPayments: 0,
    lastOrganizerPaymentAt: ago(48, now),
    lastFlyoverPaidAt: ago(300, now),
    lastRunnerEventAt: ago(2_900, now),
  };
  return {
    generatedAt: new Date(now).toISOString(),
    tasks,
    vercelTasks,
    pgNet,
    emails,
    payments,
    systems: [summarizeCronHealth([...tasks, ...vercelTasks], pgNet), summarizeEmailHealth(emails), summarizePaymentHealth(payments)],
  };
};

export const buildIntegrationsFixture = (now = SYSTEM_FIXTURE_NOW): IntegrationsResponse => {
  const health = buildSystemHealthFixture(now);
  const env = {
    STRIPE_SECRET_KEY: "set", STRIPE_WEBHOOK_SECRET: "set", STRIPE_PRICE_ID: "set", STRIPE_ANNUAL_PRICE_ID: "set", STRIPE_FLYOVER_DOWNLOAD_PRICE_ID: "set",
    STRIPE_ORGANIZER_ESSENTIAL_PRICE_ID: "set", STRIPE_ORGANIZER_COMPLETE_PRICE_ID: "set", STRIPE_ORGANIZER_SIGNATURE_PRICE_ID: "set",
    RESEND_API_KEY: "set", NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "set", ELEVENLABS_API_KEY: "set", ANTHROPIC_API_KEY: "set",
    GCP_PROJECT_ID: "set", GCP_PROJECT_NUMBER: "set", GCP_SERVICE_ACCOUNT_EMAIL: "set", VIDEO_RENDER_BUCKET: "set", VIDEO_RENDER_TOKEN_SECRET: "s".repeat(40),
  };
  return {
    generatedAt: new Date(now).toISOString(),
    services: buildIntegrationServices({ env, renderConfigured: true, emails: health.emails, payments: health.payments }),
    emails: health.emails,
    payments: health.payments,
    renders: [
      { id: "r1", kind: "reel", title: "Trail des Aiguilles · 42 km", status: "done", stage: "Terminé", createdAt: ago(80, now), finishedAt: ago(72, now) },
      { id: "r2", kind: "carousel", title: "Le brief · SaintéLyon", status: "failed", stage: "Échec : délai dépassé", createdAt: ago(200, now), finishedAt: ago(190, now) },
      { id: "r3", kind: "reel", title: "Ultra des Druides · 80 km", status: "active", stage: "Rendu 40 %", createdAt: ago(5, now), finishedAt: null },
    ],
  };
};
