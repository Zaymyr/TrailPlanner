import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildEmailActivity,
  buildSystemInboxItems,
  classifyCronJob,
  CRON_RUN_KEYS,
  CRON_RUN_PATHS,
  cronPeriodMinutes,
  describeCronSchedule,
  formatDuration,
  SCHEDULED_TASKS,
  summarizeCronHealth,
  summarizeEmailHealth,
  summarizePaymentHealth,
  taskRemedy,
  VERCEL_CRONS,
  vercelScheduledTasks,
  type CronJobRow,
  type EmailLogRow,
  type PaymentActivity,
} from "./admin-system-health";

const NOW = Date.parse("2026-11-23T10:00:00.000Z");
const now = new Date(NOW);
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const job = (overrides: Partial<CronJobRow> = {}): CronJobRow => ({
  job_name: "reel-automation",
  schedule: "17 * * * *",
  active: true,
  last_start: ago(40),
  last_end: ago(39.5),
  last_status: "succeeded",
  last_message: "1 row",
  runs_24h: 24,
  failures_24h: 0,
  ...overrides,
});

describe("cron schedules", () => {
  it("computes the longest interval between two runs", () => {
    expect(cronPeriodMinutes("*/5 * * * *")).toBe(5);
    expect(cronPeriodMinutes("17 * * * *")).toBe(60);
    expect(cronPeriodMinutes("0 */4 * * *")).toBe(240);
    expect(cronPeriodMinutes("23 4 * * *")).toBe(1440);
    expect(cronPeriodMinutes("0 9 * * 1")).toBe(10080);
    expect(cronPeriodMinutes("0 9,21 * * *")).toBe(720);
    expect(cronPeriodMinutes("30 seconds")).toBe(0.5);
    expect(cronPeriodMinutes("@daily")).toBe(1440);
    expect(cronPeriodMinutes("not a cron")).toBeNull();
    expect(cronPeriodMinutes("61 * * * *")).toBeNull();
  });

  it("describes a schedule in French, clock times in Paris", () => {
    expect(describeCronSchedule("*/5 * * * *", now)).toBe("Toutes les 5 minutes");
    expect(describeCronSchedule("*/10 * * * *", now)).toBe("Toutes les 10 minutes");
    expect(describeCronSchedule("17 * * * *", now)).toBe("Toutes les heures à :17");
    expect(describeCronSchedule("5 * * * *", now)).toBe("Toutes les heures à :05");
    expect(describeCronSchedule("0 */4 * * *", now)).toBe("Toutes les 4 heures à :00");
    // November: Paris = UTC + 1.
    expect(describeCronSchedule("23 4 * * *", now)).toBe("Tous les jours à 05 h 23 (heure de Paris)");
    expect(describeCronSchedule("0 9 * * 1", now)).toBe("Chaque lundi à 10 h 00 (heure de Paris)");
    expect(describeCronSchedule("0 9 * * *", new Date("2026-07-01T12:00:00Z"))).toBe("Tous les jours à 11 h 00 (heure de Paris)");
    expect(describeCronSchedule("0 9 1 * *", now)).toBe("Planification 0 9 1 * * (UTC)");
  });
});

describe("classifyCronJob", () => {
  it("is ok when the last run succeeded within twice its period", () => {
    const task = classifyCronJob(job(), NOW);
    expect(task).toMatchObject({ status: "ok", statusLabel: "OK", label: "Reels automatiques", scheduleLabel: "Toutes les heures à :17", manualRun: "reel-automation", downSince: null });
    expect(task.durationMs).toBe(30_000);
    expect(task.detail).toBe("Dernier passage il y a 40 min, attendu toutes les 1 h.");
  });

  it("is late past twice the period, down since the missed run", () => {
    const task = classifyCronJob(job({ last_start: ago(130), last_end: ago(129) }), NOW);
    expect(task.status).toBe("late");
    expect(task.downSince).toBe(ago(10));
    expect(task.detail).toContain("attendu toutes les 1 h");
  });

  it("fails when the last run failed, and keeps the message", () => {
    const task = classifyCronJob(job({ last_status: "failed", last_message: "ERROR: relation does not exist", failures_24h: 2 }), NOW);
    expect(task).toMatchObject({ status: "failed", statusLabel: "Échec", lastMessage: "ERROR: relation does not exist", downSince: ago(40) });
  });

  it("warns on failures in 24 h when the last run succeeded", () => {
    expect(classifyCronJob(job({ failures_24h: 3 }), NOW)).toMatchObject({ status: "warning", detail: "3 échecs sur 24 passages en 24 h ; le dernier a réussi." });
  });

  it("tells running from stuck, never run and inactive", () => {
    expect(classifyCronJob(job({ last_status: "running", last_start: ago(2), last_end: null }), NOW).status).toBe("running");
    expect(classifyCronJob(job({ schedule: "*/5 * * * *", last_status: "running", last_start: ago(9), last_end: null }), NOW).status).toBe("running");
    expect(classifyCronJob(job({ schedule: "*/5 * * * *", last_status: "running", last_start: ago(16), last_end: null }), NOW).status).toBe("late");
    expect(classifyCronJob(job({ last_start: null, last_end: null, last_status: null, runs_24h: 0 }), NOW).status).toBe("never");
    expect(classifyCronJob(job({ active: false, last_start: ago(5000) }), NOW).status).toBe("inactive");
  });

  it("keeps an unknown job under its own name, without a manual run", () => {
    expect(classifyCronJob(job({ job_name: "custom-job" }), NOW)).toMatchObject({ label: "custom-job", manualRun: null });
  });

  it("tells what to do: nothing when healthy, the job's own remedy when it fails", () => {
    expect(classifyCronJob(job(), NOW).remedy).toBeNull();
    expect(classifyCronJob(job({ active: false, last_start: ago(5000) }), NOW).remedy).toBeNull();
    const reconciliation = classifyCronJob(job({ job_name: "revenuecat-reconciliation", schedule: "17 3 * * *", last_status: "failed" }), NOW);
    expect(reconciliation).toMatchObject({ label: SCHEDULED_TASKS["revenuecat-reconciliation"].label, manualRun: "revenuecat-reconciliation", remedy: SCHEDULED_TASKS["revenuecat-reconciliation"].remedy });
    expect(reconciliation.remedy).toContain("REVENUECAT");
    expect(classifyCronJob(job({ last_status: "failed" }), NOW).remedy).toBe(taskRemedy("failed", SCHEDULED_TASKS["reel-automation"]));
    expect(classifyCronJob(job({ failures_24h: 2 }), NOW).remedy).toBeTruthy();
  });

  it("tells to delete or version an unknown failing job (hand-made in Supabase)", () => {
    const task = classifyCronJob(job({ job_name: "trial-reminder-j0", last_status: "failed", last_message: "ERROR: function extensions.http_post does not exist" }), NOW);
    expect(task.remedy).toBe(taskRemedy("failed", undefined));
    expect(task.remedy).toContain("Cron Jobs");
  });
});

describe("Vercel crons", () => {
  it("lists exactly the crons of vercel.json (none since every cron runs on pg_cron)", () => {
    const vercel = JSON.parse(readFileSync(path.resolve(__dirname, "../../../vercel.json"), "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
    expect(VERCEL_CRONS.map(({ path: cronPath, schedule }) => ({ path: cronPath, schedule }))).toEqual(vercel.crons ?? []);
    expect(vercelScheduledTasks(now).every((task) => task.status === "never_called" && task.statusLabel === "Jamais appelée par Vercel" && task.docHref)).toBe(true);
  });

  it("allows a manual run only for the pg_net jobs that call a Next route", () => {
    expect(CRON_RUN_KEYS.every((key) => SCHEDULED_TASKS[key].manualRun === key && CRON_RUN_PATHS[key].startsWith("/api/cron/"))).toBe(true);
    expect(SCHEDULED_TASKS["push-reminders-daily"].manualRun).toBeNull();
  });
});

describe("summarizeCronHealth", () => {
  it("is an error naming the task that is down", () => {
    const tasks = [classifyCronJob(job({ last_start: ago(200) }), NOW), classifyCronJob(job({ job_name: "social-posts-publish", schedule: "*/5 * * * *", last_start: ago(2) }), NOW), ...vercelScheduledTasks(now)];
    const health = summarizeCronHealth(tasks, null);
    expect(health).toMatchObject({ key: "crons", status: "error", href: "/admin/system/automation", lastAt: ago(2) });
    expect(health.detail).toContain("Reels automatiques : en retard");
    expect(health.detail).not.toContain("Vercel");
  });

  it("warns on pg_net HTTP errors that cannot be tied to a job", () => {
    const tasks = [classifyCronJob(job(), NOW)];
    const health = summarizeCronHealth(tasks, { available: true, responses: 30, errors: 2, oldest_at: ago(360), last_error_at: ago(30), last_error_status: 500, last_error_message: null });
    expect(health.status).toBe("warning");
    expect(health.detail).toContain("2 réponses HTTP en erreur (pg_net)");
    expect(summarizeCronHealth(tasks, null).status).toBe("ok");
  });
});

const emailRow = (minutes: number, status: EmailLogRow["status"], category = "flyover/paid"): EmailLogRow => ({
  id: `${status}-${minutes}`,
  created_at: ago(minutes),
  category,
  status,
  status_code: status === "failed" ? 422 : null,
  message: status === "failed" ? "Invalid to" : null,
  recipient_masked: "fa***@gmail.com",
});

describe("e-mail health", () => {
  it("is ok without failure, a warning when the latest went out, an error when the latest failed", () => {
    const ok = buildEmailActivity({ configured: true, rows: [emailRow(10, "sent"), emailRow(50, "sent")], recent: null });
    expect(summarizeEmailHealth(ok)).toMatchObject({ status: "ok", detail: "2 envoyés en 24 h", lastAt: ago(10) });
    const recovered = buildEmailActivity({ configured: true, rows: [emailRow(10, "sent"), emailRow(50, "failed")], recent: null });
    expect(summarizeEmailHealth(recovered)).toMatchObject({ status: "warning", detail: "1 envoyé en 24 h · 1 échec" });
    const broken = buildEmailActivity({ configured: true, rows: [emailRow(5, "failed", "organizer-demo/admin"), emailRow(50, "sent")], recent: null });
    expect(summarizeEmailHealth(broken)).toMatchObject({ status: "error" });
    expect(summarizeEmailHealth(broken).detail).toContain("dernier : organizer-demo/admin");
  });

  it("is an error without Resend and unknown without the journal", () => {
    expect(summarizeEmailHealth(buildEmailActivity({ configured: false, rows: [], recent: [] })).status).toBe("error");
    expect(summarizeEmailHealth(buildEmailActivity({ configured: true, rows: null, recent: null })).status).toBe("unknown");
  });
});

const payments = (overrides: Partial<PaymentActivity> = {}): PaymentActivity => ({
  stripeConfigured: true,
  webhookSecretConfigured: true,
  lastEventAt: ago(90),
  lastEventSource: "paiement organisateur",
  unprocessed: [],
  failedOrganizerPayments: 0,
  lastOrganizerPaymentAt: ago(90),
  lastFlyoverPaidAt: null,
  lastRunnerEventAt: null,
  ...overrides,
});

describe("payment health", () => {
  it("reads the journals the webhook writes", () => {
    expect(summarizePaymentHealth(payments())).toMatchObject({ status: "ok", lastAt: ago(90), detail: "Webhook reçu" });
    expect(summarizePaymentHealth(payments({ failedOrganizerPayments: 1 })).status).toBe("warning");
    expect(summarizePaymentHealth(payments({ unprocessed: [{ eventType: "checkout.session.completed", receivedAt: ago(30), error: null }] }))).toMatchObject({ status: "error", detail: "1 événement Stripe non traité (webhook en erreur)." });
    expect(summarizePaymentHealth(payments({ webhookSecretConfigured: false })).detail).toBe("Stripe : secret du webhook absent.");
    expect(summarizePaymentHealth(payments({ lastEventAt: null })).detail).toBe("Aucun événement Stripe enregistré");
  });
});

describe("buildSystemInboxItems", () => {
  it("makes one « Système » item per task down and per system in error", () => {
    const tasks = [classifyCronJob(job({ last_status: "failed" }), NOW), classifyCronJob(job({ job_name: "social-posts-publish", schedule: "*/5 * * * *", last_start: ago(1), failures_24h: 2 }), NOW), ...vercelScheduledTasks(now)];
    const emailActivity = buildEmailActivity({ configured: true, rows: [emailRow(5, "failed")], recent: null });
    const paymentActivity = payments({ unprocessed: [{ eventType: "charge.refunded", receivedAt: ago(60), error: null }, { eventType: "checkout.session.completed", receivedAt: ago(120), error: null }] });
    const items = buildSystemInboxItems({
      tasks,
      emails: { health: summarizeEmailHealth(emailActivity), activity: emailActivity },
      payments: { health: summarizePaymentHealth(paymentActivity), activity: paymentActivity },
    });
    expect(items.map((item) => item.id)).toEqual(["system:cron:reel-automation", "system:emails", "system:payments"]);
    expect(items.every((item) => item.type === "system")).toBe(true);
    expect(items[0]).toMatchObject({ title: "Tâche planifiée en échec · Reels automatiques", since: ago(40), href: "/admin/system/automation" });
    expect(items[2].since).toBe(ago(120));
  });

  it("makes no item for warnings or unreadable sources", () => {
    expect(buildSystemInboxItems({ tasks: [classifyCronJob(job({ failures_24h: 1 }), NOW)], emails: null, payments: null })).toEqual([]);
  });
});

describe("formatDuration", () => {
  it("formats run durations", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(840)).toBe("840 ms");
    expect(formatDuration(12_400)).toBe("12 s");
    expect(formatDuration(72_000)).toBe("1 min 12 s");
  });
});
