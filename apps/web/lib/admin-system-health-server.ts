import { z } from "zod";

import type { InboxItem } from "./admin-inbox";
import { unknownHealth, type HealthSystem } from "./admin-overview";
import {
  buildEmailActivity,
  buildSystemInboxItems,
  classifyCronJob,
  cronJobRowSchema,
  emailLogRowSchema,
  PAYMENT_WINDOW_DAYS,
  pgNetSummarySchema,
  STRIPE_UNPROCESSED_AFTER_MINUTES,
  summarizeCronHealth,
  summarizeEmailHealth,
  summarizePaymentHealth,
  vercelScheduledTasks,
  type EmailActivity,
  type PaymentActivity,
  type PgNetSummary,
  type ScheduledTask,
  type SystemHealthResponse,
} from "./admin-system-health";
import { getResendConfig } from "./resend";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loaders of the system health (service role, read-only): `admin_cron_job_status()` and
 * `admin_pg_net_response_summary()` (migration 20261123090000), the transactional e-mail journal and
 * the payment journals the Stripe webhook already writes. No Stripe or Resend API call. Each source
 * is settled on its own; one that fails turns its line into `unknown`.
 */

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  ...extra,
});

const getJson = async (supabase: SupabaseServiceConfig, path: string): Promise<unknown> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, { headers: headers(supabase), cache: "no-store" });
  if (!response.ok) throw new Error(`Read failed (${response.status}): ${path.split("?")[0]}`);
  return response.json();
};

const rpc = async (supabase: SupabaseServiceConfig, name: string): Promise<unknown> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(supabase, { "Content-Type": "application/json" }),
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC ${name} failed (${response.status}).`);
  return response.json();
};

const settle = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch (error) {
    console.error("Admin system health source failed", error instanceof Error ? error.message : error);
    return null;
  }
};

export const loadScheduledTasks = async (supabase: SupabaseServiceConfig, now: Date): Promise<ScheduledTask[]> =>
  z.array(cronJobRowSchema).parse(await rpc(supabase, "admin_cron_job_status")).map((row) => classifyCronJob(row, now.getTime(), now));

export const loadPgNetSummary = async (supabase: SupabaseServiceConfig): Promise<PgNetSummary | null> => {
  const rows = z.array(pgNetSummarySchema).parse(await rpc(supabase, "admin_pg_net_response_summary"));
  return rows[0] ?? null;
};

const EMAIL_COLUMNS = "id,created_at,category,status,status_code,message,recipient_masked";

export const loadEmailActivity = async (supabase: SupabaseServiceConfig, now: Date): Promise<EmailActivity> => {
  const dayAgo = encodeURIComponent(new Date(now.getTime() - 24 * 3_600_000).toISOString());
  const [rows, recent] = await Promise.all([
    settle((async () => z.array(emailLogRowSchema).parse(await getJson(supabase, `transactional_email_log?created_at=gte.${dayAgo}&select=${EMAIL_COLUMNS}&order=created_at.desc&limit=2000`)))()),
    settle((async () => z.array(emailLogRowSchema).parse(await getJson(supabase, `transactional_email_log?select=${EMAIL_COLUMNS}&order=created_at.desc&limit=10`)))()),
  ]);
  return buildEmailActivity({ configured: getResendConfigQuietly(), rows, recent });
};

const getResendConfigQuietly = () => Boolean(process.env.RESEND_API_KEY?.trim()) && getResendConfig() !== null;

const runnerEventRows = z.array(z.object({ event_type: z.string(), received_at: z.string(), processed_at: z.string().nullable(), processing_error: z.string().nullable() }));
const timestampRows = (column: string) => z.array(z.object({ [column]: z.string().nullable() }));

export const loadPaymentActivity = async (supabase: SupabaseServiceConfig, now: Date): Promise<PaymentActivity> => {
  const nowMs = now.getTime();
  const windowStart = encodeURIComponent(new Date(nowMs - PAYMENT_WINDOW_DAYS * 86_400_000).toISOString());
  const [runnerEvents, lastRunner, organizerFailures, lastOrganizer, lastFlyover] = await Promise.all([
    // Unprocessed or errored runner events of the window (the webhook journals, then processes).
    getJson(supabase, `runner_billing_events?provider=eq.stripe&received_at=gte.${windowStart}&or=(processed_at.is.null,processing_error.not.is.null)&select=event_type,received_at,processed_at,processing_error&order=received_at.asc&limit=50`).then((rows) => runnerEventRows.parse(rows)),
    getJson(supabase, "runner_billing_events?provider=eq.stripe&select=received_at&order=received_at.desc&limit=1").then((rows) => timestampRows("received_at").parse(rows)),
    getJson(supabase, `organizer_edition_payments?stripe_checkout_session_id=not.is.null&status=in.(failed,disputed)&updated_at=gte.${windowStart}&select=updated_at&limit=50`).then((rows) => timestampRows("updated_at").parse(rows)),
    getJson(supabase, "organizer_edition_payments?stripe_checkout_session_id=not.is.null&status=neq.pending&select=updated_at&order=updated_at.desc&limit=1").then((rows) => timestampRows("updated_at").parse(rows)),
    getJson(supabase, "flyover_video_orders?paid_at=not.is.null&select=paid_at&order=paid_at.desc&limit=1").then((rows) => timestampRows("paid_at").parse(rows)),
  ]);
  const cutoff = nowMs - STRIPE_UNPROCESSED_AFTER_MINUTES * 60_000;
  const unprocessed = runnerEvents
    .filter((row) => row.processing_error !== null || Date.parse(row.received_at) < cutoff)
    .map((row) => ({ eventType: row.event_type, receivedAt: row.received_at, error: row.processing_error ? row.processing_error.slice(0, 200) : null }));
  const lastRunnerEventAt = (lastRunner[0]?.received_at as string | null | undefined) ?? null;
  const lastOrganizerPaymentAt = (lastOrganizer[0]?.updated_at as string | null | undefined) ?? null;
  const lastFlyoverPaidAt = (lastFlyover[0]?.paid_at as string | null | undefined) ?? null;
  const candidates = [
    { at: lastRunnerEventAt, source: "achat coureur" },
    { at: lastOrganizerPaymentAt, source: "paiement organisateur" },
    { at: lastFlyoverPaidAt, source: "commande de survol" },
  ].filter((candidate): candidate is { at: string; source: string } => Boolean(candidate.at)).sort((left, right) => right.at.localeCompare(left.at));
  return {
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    lastEventAt: candidates[0]?.at ?? null,
    lastEventSource: candidates[0]?.source ?? null,
    unprocessed,
    failedOrganizerPayments: organizerFailures.length,
    lastOrganizerPaymentAt,
    lastFlyoverPaidAt,
    lastRunnerEventAt,
  };
};

export type LoadedSystemHealth = SystemHealthResponse & {
  /** The three health lines of the dashboard (`crons`, `emails`, `payments`), in this order. */
  lines: HealthSystem[];
  /** « Système » items of the « À traiter » queue. */
  incidents: InboxItem[];
};

export const loadSystemHealth = async (supabase: SupabaseServiceConfig, now = new Date()): Promise<LoadedSystemHealth> => {
  const [tasks, pgNet, emails, payments] = await Promise.all([
    settle(loadScheduledTasks(supabase, now)),
    settle(loadPgNetSummary(supabase)),
    settle(loadEmailActivity(supabase, now)),
    settle(loadPaymentActivity(supabase, now)),
  ]);
  const vercelTasks = vercelScheduledTasks(now);
  const cronLine = tasks ? summarizeCronHealth([...tasks, ...vercelTasks], pgNet) : unknownHealth("crons", "Tâches planifiées (crons)", "/admin/system/automation");
  const emailLine = emails ? summarizeEmailHealth(emails) : unknownHealth("emails", "E-mails (Resend)", "/admin/system/integrations");
  const paymentLine = payments ? summarizePaymentHealth(payments) : unknownHealth("payments", "Paiements Stripe (webhook)", "/admin/system/integrations");
  const lines = [cronLine, emailLine, paymentLine];
  return {
    generatedAt: now.toISOString(),
    tasks,
    vercelTasks,
    pgNet,
    emails,
    payments,
    systems: lines,
    lines,
    incidents: buildSystemInboxItems({
      tasks,
      emails: emails ? { health: emailLine, activity: emails } : null,
      payments: payments ? { health: paymentLine, activity: payments } : null,
    }),
  };
};
