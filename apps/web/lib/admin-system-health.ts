import { z } from "zod";

import type { InboxItem } from "./admin-inbox";
import type { HealthStatus, HealthSystem } from "./admin-overview";

/**
 * « Santé des systèmes » of the admin console (lot 3, pure): scheduled tasks (pg_cron jobs read by
 * `admin_cron_job_status()`, and the Vercel crons of `vercel.json`, never called in production),
 * transactional e-mails (`transactional_email_log`) and payments (Stripe journal, organizer payments,
 * flyover orders). Each becomes a health line of the dashboard and, when it is down, an item of type
 * « Système » in the « À traiter » queue. Thresholds are written once here.
 */

// ---------------------------------------------------------------------------------------------
// Cron expressions (pg_cron and Vercel both read them in UTC)

type CronFields = { minutes: Set<number>; hours: Set<number>; days: Set<number>; months: Set<number>; weekdays: Set<number>; dayRestricted: boolean; weekdayRestricted: boolean };

const range = (from: number, to: number, step = 1) => {
  const values: number[] = [];
  for (let value = from; value <= to; value += step) values.push(value);
  return values;
};

const parseField = (field: string, min: number, max: number): Set<number> | null => {
  const values = new Set<number>();
  for (const part of field.split(",")) {
    const match = /^(\*|\d+(?:-\d+)?)(?:\/(\d+))?$/.exec(part.trim());
    if (!match) return null;
    const step = match[2] ? Number(match[2]) : 1;
    if (!Number.isInteger(step) || step < 1) return null;
    let from = min;
    let to = max;
    if (match[1] !== "*") {
      const [start, end] = match[1].split("-").map(Number);
      from = start;
      to = end ?? (match[2] ? max : start);
    }
    if (from < min || to > max || from > to) return null;
    range(from, to, step).forEach((value) => values.add(value));
  }
  return values.size ? values : null;
};

const ALIASES: Record<string, string> = { "@hourly": "0 * * * *", "@daily": "0 0 * * *", "@midnight": "0 0 * * *", "@weekly": "0 0 * * 0", "@monthly": "0 0 1 * *", "@yearly": "0 0 1 1 *", "@annually": "0 0 1 1 *" };

export const parseCronExpression = (expression: string): CronFields | null => {
  const normalized = ALIASES[expression.trim().toLowerCase()] ?? expression.trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) return null;
  const [minutes, hours, days, months, weekdaysRaw] = [
    parseField(parts[0], 0, 59),
    parseField(parts[1], 0, 23),
    parseField(parts[2], 1, 31),
    parseField(parts[3], 1, 12),
    parseField(parts[4], 0, 7),
  ];
  if (!minutes || !hours || !days || !months || !weekdaysRaw) return null;
  const weekdays = new Set([...weekdaysRaw].map((day) => day % 7));
  return { minutes, hours, days, months, weekdays, dayRestricted: parts[2] !== "*", weekdayRestricted: parts[4] !== "*" };
};

const matches = (fields: CronFields, date: Date) => {
  if (!fields.minutes.has(date.getUTCMinutes()) || !fields.hours.has(date.getUTCHours()) || !fields.months.has(date.getUTCMonth() + 1)) return false;
  const dayOk = fields.days.has(date.getUTCDate());
  const weekdayOk = fields.weekdays.has(date.getUTCDay());
  // Standard cron: when both the day of month and the weekday are restricted, either one matches.
  if (fields.dayRestricted && fields.weekdayRestricted) return dayOk || weekdayOk;
  return dayOk && weekdayOk;
};

/** pg_cron also takes « 30 seconds » (sub-minute jobs). */
const SECONDS_PATTERN = /^(\d+)\s*seconds?$/i;
const REFERENCE_START = Date.UTC(2026, 0, 5); // a Monday, so weekly patterns repeat inside the window

/**
 * Longest interval between two runs, in minutes (a daily job: 1 440, « *\/5 * * * * »: 5). Read over
 * 8 days, or 62 for monthly patterns; null when the expression is not understood.
 */
export const cronPeriodMinutes = (expression: string): number | null => {
  const seconds = SECONDS_PATTERN.exec(expression.trim());
  if (seconds) return Math.max(1, Number(seconds[1])) / 60;
  const fields = parseCronExpression(expression);
  if (!fields) return null;
  for (const days of [8, 62]) {
    const runs: number[] = [];
    for (let minute = 0; minute < days * 1440; minute += 1) {
      const date = new Date(REFERENCE_START + minute * 60_000);
      if (matches(fields, date)) runs.push(minute);
    }
    if (runs.length >= 2) {
      let longest = 0;
      for (let index = 1; index < runs.length; index += 1) longest = Math.max(longest, runs[index] - runs[index - 1]);
      // The wrap-around gap (last run of the window to the first of the next one).
      longest = Math.max(longest, runs[0] + days * 1440 - runs[runs.length - 1]);
      return longest;
    }
    if (runs.length === 1 && days === 62) return 62 * 1440;
  }
  return null;
};

const parisClock = (utcHour: number, utcMinute: number, now: Date) => {
  const instant = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, utcMinute));
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }).format(instant).replace(":", " h ");
};
const pad = (value: number) => String(value).padStart(2, "0");
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/**
 * French label of a schedule: « Toutes les 5 minutes », « Toutes les heures à :17 », « Tous les jours
 * à 05 h 23 (heure de Paris) ». Clock times are converted from UTC with today's Paris offset; an
 * expression outside these shapes is shown as is, marked UTC.
 */
export const describeCronSchedule = (expression: string, now = new Date()): string => {
  const trimmed = expression.trim();
  const seconds = SECONDS_PATTERN.exec(trimmed);
  if (seconds) return `Toutes les ${seconds[1]} secondes`;
  const parts = (ALIASES[trimmed.toLowerCase()] ?? trimmed).split(/\s+/);
  if (parts.length === 5 && parseCronExpression(trimmed)) {
    const [minute, hour, day, month, weekday] = parts;
    const restOpen = day === "*" && month === "*" && weekday === "*";
    const everyMinutes = /^\*\/(\d+)$/.exec(minute);
    if (restOpen && hour === "*" && minute === "*") return "Toutes les minutes";
    if (restOpen && hour === "*" && everyMinutes) return `Toutes les ${everyMinutes[1]} minutes`;
    if (restOpen && hour === "*" && /^\d+$/.test(minute)) return `Toutes les heures à :${pad(Number(minute))}`;
    const everyHours = /^\*\/(\d+)$/.exec(hour);
    if (restOpen && everyHours && /^\d+$/.test(minute)) return `Toutes les ${everyHours[1]} heures à :${pad(Number(minute))}`;
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && day === "*" && month === "*") {
      const clock = `${parisClock(Number(hour), Number(minute), now)} (heure de Paris)`;
      if (weekday === "*") return `Tous les jours à ${clock}`;
      if (/^\d$/.test(weekday)) return `Chaque ${WEEKDAYS[Number(weekday) % 7]} à ${clock}`;
    }
  }
  return `Planification ${trimmed} (UTC)`;
};

// ---------------------------------------------------------------------------------------------
// Catalog of the scheduled tasks

export const CRON_RUN_KEYS = [
  "social-posts-publish",
  "reel-automation",
  "carousel-automation",
  "flyover-orders",
  "demo-race-refresh",
  "organizer-import-cleanup-hourly",
] as const;
export type CronRunKey = (typeof CRON_RUN_KEYS)[number];

type TaskInfo = { label: string; description: string; target: string; manualRun: CronRunKey | null; docHref: string | null };

const DOCS = "https://github.com/Zaymyr/TrailPlanner/blob/main/docs";

/** Readable names of the pg_cron jobs created by the migrations (unknown jobs keep their name). */
export const SCHEDULED_TASKS: Record<string, TaskInfo> = {
  "social-posts-publish": { label: "Publication Instagram", description: "Publie les posts programmés et suit les conteneurs Instagram.", target: "POST /api/cron/social-posts-publish", manualRun: "social-posts-publish", docHref: `${DOCS}/05-integrations/instagram-publishing.md` },
  "reel-automation": { label: "Reels automatiques", description: "Recalcule le plan des reels et avance d’une étape un reel prévu.", target: "POST /api/cron/reel-automation", manualRun: "reel-automation", docHref: `${DOCS}/05-integrations/reel-automation.md` },
  "carousel-automation": { label: "Carrousels automatiques", description: "Avance d’une étape un carrousel prévu (plan chiffré, brief, semaine).", target: "POST /api/cron/carousel-automation", manualRun: "carousel-automation", docHref: `${DOCS}/05-integrations/instagram-carousels.md` },
  "flyover-orders": { label: "Vidéos de survol", description: "Suit les rendus en cours puis avance d’une étape une commande payée.", target: "POST /api/cron/flyover-orders", manualRun: "flyover-orders", docHref: `${DOCS}/03-business-rules/flyover-video-orders.md` },
  "demo-race-refresh": { label: "Démo Trail TST", description: "Recale la démo sur la date du jour et republie ses formats.", target: "POST /api/cron/demo-race-refresh", manualRun: "demo-race-refresh", docHref: `${DOCS}/context/DECISIONS.md` },
  "organizer-import-cleanup-hourly": { label: "Nettoyage des imports organisateurs", description: "Supprime les sessions d’import organisateur expirées.", target: "GET /api/cron/organizer-import-cleanup", manualRun: "organizer-import-cleanup-hourly", docHref: `${DOCS}/02-database/tables/organizer-import-sessions.md` },
  "push-reminders-daily": { label: "Rappels push", description: "Envoie les rappels push du jour (Edge Function Supabase).", target: "Edge Function push-reminders", manualRun: null, docHref: null },
  "transactional-email-log-purge": { label: "Purge du journal des e-mails", description: "Supprime les lignes du journal des e-mails de plus de 90 jours.", target: "SQL : purge_transactional_email_log()", manualRun: null, docHref: `${DOCS}/02-database/tables/transactional-email-log.md` },
};

/** Route path of each manual run (the cron route is invoked in-process with `CRON_SECRET`). */
export const CRON_RUN_PATHS: Record<CronRunKey, string> = {
  "social-posts-publish": "/api/cron/social-posts-publish",
  "reel-automation": "/api/cron/reel-automation",
  "carousel-automation": "/api/cron/carousel-automation",
  "flyover-orders": "/api/cron/flyover-orders",
  "demo-race-refresh": "/api/cron/demo-race-refresh",
  "organizer-import-cleanup-hourly": "/api/cron/organizer-import-cleanup",
};

/**
 * Crons declared in the repository `vercel.json`: Vercel never calls them in production (no call
 * recorded 2026-11-17 → 21, docs/context/DECISIONS.md 2026-11-21). Kept in sync by a test.
 */
export const VERCEL_CRONS = [
  { path: "/api/cron/revenuecat-reconciliation", schedule: "17 3 * * *", label: "Réconciliation RevenueCat", description: "Rattrape les achats mobiles RevenueCat non reçus par webhook." },
  { path: "/api/cron/tracedetrail-catalog-enrichment", schedule: "47 3 * * *", label: "Enrichissement Trace de Trail", description: "Importe les GPX autorisés d’une liste de formats Trace de Trail." },
] as const;
export const VERCEL_CRONS_DOC_HREF = `${DOCS}/context/DECISIONS.md`;

// ---------------------------------------------------------------------------------------------
// Cron jobs → status

export const cronJobRowSchema = z.object({
  job_name: z.string(),
  schedule: z.string(),
  active: z.boolean(),
  last_start: z.string().nullable(),
  last_end: z.string().nullable(),
  last_status: z.string().nullable(),
  last_message: z.string().nullable(),
  runs_24h: z.number(),
  failures_24h: z.number(),
});
export type CronJobRow = z.infer<typeof cronJobRowSchema>;

export const pgNetSummarySchema = z.object({
  available: z.boolean(),
  responses: z.number(),
  errors: z.number(),
  oldest_at: z.string().nullable(),
  last_error_at: z.string().nullable(),
  last_error_status: z.number().nullable(),
  last_error_message: z.string().nullable(),
});
export type PgNetSummary = z.infer<typeof pgNetSummarySchema>;

/** A job is late when its last start is older than this many periods. */
export const CRON_LATE_FACTOR = 2;
/** A run still « running » after max(2 periods, 15 min) is stuck. */
const STUCK_MIN_MINUTES = 15;

export const TASK_STATUSES = ["ok", "running", "late", "failed", "warning", "never", "inactive", "never_called"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  ok: "OK",
  running: "En cours",
  late: "En retard",
  failed: "Échec",
  warning: "Échecs récents",
  never: "Aucun passage",
  inactive: "Désactivée",
  never_called: "Jamais appelée par Vercel",
};

export const scheduledTaskSchema = z.object({
  key: z.string(),
  runner: z.enum(["pg_cron", "vercel"]),
  label: z.string(),
  description: z.string(),
  target: z.string(),
  schedule: z.string(),
  scheduleLabel: z.string(),
  periodMinutes: z.number().nullable(),
  active: z.boolean(),
  status: z.enum(TASK_STATUSES),
  statusLabel: z.string(),
  /** Why the status (« dernier passage il y a 3 h, attendu toutes les heures »). */
  detail: z.string(),
  lastStart: z.string().nullable(),
  lastEnd: z.string().nullable(),
  durationMs: z.number().nullable(),
  lastMessage: z.string().nullable(),
  runs24h: z.number().nullable(),
  failures24h: z.number().nullable(),
  /** When the task started being down (failed run or missed run), for the queue age. */
  downSince: z.string().nullable(),
  manualRun: z.enum(CRON_RUN_KEYS).nullable(),
  docHref: z.string().nullable(),
});
export type ScheduledTask = z.infer<typeof scheduledTaskSchema>;

const formatPeriod = (minutes: number) => {
  if (minutes < 1) return `${Math.round(minutes * 60)} s`;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} j`;
};
const formatAge = (ms: number) => formatPeriod(Math.max(0, ms) / 60_000);

/**
 * Status of one pg_cron job, from its last run: inactive; never run; failed (last run failed); late
 * (last start older than `CRON_LATE_FACTOR` periods); running (or stuck); warning (failures in 24 h
 * but the last run succeeded); ok. pg_cron « succeeded » only says the SQL ran: for the pg_net jobs it
 * means the HTTP request was queued, not that the route answered 2xx.
 */
export const classifyCronJob = (row: CronJobRow, nowMs: number, now = new Date(nowMs)): ScheduledTask => {
  const info = SCHEDULED_TASKS[row.job_name];
  const period = cronPeriodMinutes(row.schedule);
  const lastStartMs = row.last_start ? Date.parse(row.last_start) : null;
  const sinceLast = lastStartMs !== null ? nowMs - lastStartMs : null;
  const lateAfterMs = period !== null ? CRON_LATE_FACTOR * period * 60_000 : null;
  let status: TaskStatus = "ok";
  let detail = "";
  let downSince: string | null = null;
  const lastRun = sinceLast !== null ? `dernier passage il y a ${formatAge(sinceLast)}` : "";
  const expected = period !== null ? `attendu toutes les ${formatPeriod(period)}` : "période inconnue";

  if (!row.active) {
    status = "inactive";
    detail = "Tâche désactivée dans pg_cron.";
  } else if (lastStartMs === null) {
    status = "never";
    detail = "Aucun passage enregistré dans cron.job_run_details.";
  } else if (row.last_status === "failed") {
    status = "failed";
    detail = `Le dernier passage a échoué (${lastRun}).`;
    downSince = row.last_start;
  } else if (lateAfterMs !== null && sinceLast !== null && sinceLast > lateAfterMs) {
    status = "late";
    detail = `${lastRun.charAt(0).toUpperCase()}${lastRun.slice(1)}, ${expected}.`;
    downSince = new Date(lastStartMs + lateAfterMs).toISOString();
  } else if (row.last_status === "running" || row.last_status === "starting") {
    const stuckAfterMs = Math.max(STUCK_MIN_MINUTES, 2 * (period ?? 0)) * 60_000;
    status = sinceLast !== null && sinceLast > stuckAfterMs ? "late" : "running";
    detail = status === "late" ? `Passage commencé il y a ${formatAge(sinceLast ?? 0)} et toujours en cours.` : "Passage en cours.";
    if (status === "late") downSince = new Date((lastStartMs ?? nowMs) + stuckAfterMs).toISOString();
  } else if (row.failures_24h > 0) {
    status = "warning";
    detail = `${row.failures_24h} échec${row.failures_24h > 1 ? "s" : ""} sur ${row.runs_24h} passage${row.runs_24h > 1 ? "s" : ""} en 24 h ; le dernier a réussi.`;
  } else {
    detail = `${lastRun.charAt(0).toUpperCase()}${lastRun.slice(1)}, ${expected}.`;
  }

  const durationMs = row.last_start && row.last_end ? Math.max(0, Date.parse(row.last_end) - Date.parse(row.last_start)) : null;
  return {
    key: row.job_name,
    runner: "pg_cron",
    label: info?.label ?? row.job_name,
    description: info?.description ?? "Tâche pg_cron sans description dans la console.",
    target: info?.target ?? "pg_cron",
    schedule: row.schedule,
    scheduleLabel: describeCronSchedule(row.schedule, now),
    periodMinutes: period,
    active: row.active,
    status,
    statusLabel: TASK_STATUS_LABELS[status],
    detail,
    lastStart: row.last_start,
    lastEnd: row.last_end,
    durationMs,
    lastMessage: row.last_message,
    runs24h: row.runs_24h,
    failures24h: row.failures_24h,
    downSince,
    manualRun: info?.manualRun ?? null,
    docHref: info?.docHref ?? null,
  };
};

/** The Vercel crons, always « jamais appelée par Vercel » (documented fact, not a measure). */
export const vercelScheduledTasks = (now = new Date()): ScheduledTask[] =>
  VERCEL_CRONS.map((cron) => ({
    key: cron.path,
    runner: "vercel" as const,
    label: cron.label,
    description: cron.description,
    target: `GET ${cron.path}`,
    schedule: cron.schedule,
    scheduleLabel: describeCronSchedule(cron.schedule, now),
    periodMinutes: cronPeriodMinutes(cron.schedule),
    active: false,
    status: "never_called" as const,
    statusLabel: TASK_STATUS_LABELS.never_called,
    detail: "Déclarée dans vercel.json, mais Vercel n’appelle pas ces crons en production. Rien ne tourne tant qu’elle n’est pas passée sur pg_cron.",
    lastStart: null,
    lastEnd: null,
    durationMs: null,
    lastMessage: null,
    runs24h: null,
    failures24h: null,
    downSince: null,
    manualRun: null,
    docHref: VERCEL_CRONS_DOC_HREF,
  }));

const DOWN_TASK_STATUSES = new Set<TaskStatus>(["failed", "late"]);
export const isTaskDown = (task: Pick<ScheduledTask, "status" | "runner">) => task.runner === "pg_cron" && DOWN_TASK_STATUSES.has(task.status);

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;
const latestOf = (values: Array<string | null | undefined>) => values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;

/**
 * Health line of the scheduled tasks: error when a pg_cron task failed or is late, warning when one
 * had failures in 24 h, never ran, or pg_net kept HTTP errors; the Vercel crons are named, not counted.
 */
export const summarizeCronHealth = (tasks: ScheduledTask[], pgNet: PgNetSummary | null): HealthSystem => {
  const pgCron = tasks.filter((task) => task.runner === "pg_cron");
  const down = pgCron.filter(isTaskDown);
  const warnings = pgCron.filter((task) => task.status === "warning" || task.status === "never");
  const httpErrors = pgNet?.available ? pgNet.errors : 0;
  let status: HealthStatus = down.length ? "error" : warnings.length || httpErrors ? "warning" : "ok";
  const parts: string[] = [];
  if (down.length) parts.push(`${down.map((task) => task.label).join(", ")} : ${down.length > 1 ? "en panne" : down[0].statusLabel.toLowerCase()}`);
  else parts.push(`${plural(pgCron.filter((task) => task.active).length, "tâche")} active${pgCron.filter((task) => task.active).length > 1 ? "s" : ""}`);
  if (warnings.length) parts.push(`${plural(warnings.length, "avertissement")}`);
  if (httpErrors) parts.push(`${plural(httpErrors, "réponse")} HTTP en erreur (pg_net)`);
  const vercel = tasks.filter((task) => task.runner === "vercel").length;
  if (vercel) parts.push(`${vercel} cron${vercel > 1 ? "s" : ""} Vercel jamais appelé${vercel > 1 ? "s" : ""}`);
  if (!pgCron.length) status = "warning";
  return {
    key: "crons",
    label: "Tâches planifiées (crons)",
    status,
    detail: parts.join(" · "),
    lastAt: latestOf(pgCron.map((task) => task.lastStart)),
    meter: null,
    href: "/admin/system/automation",
  };
};

// ---------------------------------------------------------------------------------------------
// E-mails

export const emailLogRowSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  category: z.string(),
  status: z.enum(["sent", "skipped", "failed"]),
  status_code: z.number().nullable(),
  message: z.string().nullable(),
  recipient_masked: z.string().nullable(),
});
export type EmailLogRow = z.infer<typeof emailLogRowSchema>;

export const emailActivitySchema = z.object({
  configured: z.boolean(),
  /** false: the journal could not be read (table not deployed yet, or an error). */
  journalAvailable: z.boolean(),
  sent24h: z.number(),
  failed24h: z.number(),
  skipped24h: z.number(),
  lastSentAt: z.string().nullable(),
  lastFailure: emailLogRowSchema.nullable(),
  /** The newest attempt of the last 24 h failed. */
  lastAttemptFailed: z.boolean(),
  recent: z.array(emailLogRowSchema),
});
export type EmailActivity = z.infer<typeof emailActivitySchema>;

/** Counts of the last 24 h and the latest rows (newest first), from the journal rows of 24 h. */
export const buildEmailActivity = ({ configured, rows, recent }: { configured: boolean; rows: EmailLogRow[] | null; recent: EmailLogRow[] | null }): EmailActivity => {
  const list = [...(rows ?? [])].sort((left, right) => right.created_at.localeCompare(left.created_at));
  const sorted = [...(recent ?? list)].sort((left, right) => right.created_at.localeCompare(left.created_at));
  return {
    configured,
    journalAvailable: rows !== null,
    sent24h: list.filter((row) => row.status === "sent").length,
    failed24h: list.filter((row) => row.status === "failed").length,
    skipped24h: list.filter((row) => row.status === "skipped").length,
    lastSentAt: latestOf(sorted.filter((row) => row.status === "sent").map((row) => row.created_at)),
    lastFailure: sorted.find((row) => row.status === "failed") ?? list.find((row) => row.status === "failed") ?? null,
    lastAttemptFailed: list[0]?.status === "failed",
    recent: sorted.slice(0, 10),
  };
};

/**
 * Error when Resend is not configured (nothing leaves) or when the latest attempt of the last 24 h
 * failed; warning when some failed but the latest went out, or when the journal is unreadable.
 */
export const summarizeEmailHealth = (activity: EmailActivity): HealthSystem => {
  const base = { key: "emails", label: "E-mails (Resend)", meter: null, href: "/admin/system/integrations" } as const;
  if (!activity.configured) {
    return { ...base, status: "error", detail: "Resend non configuré : aucun e-mail transactionnel ne part.", lastAt: activity.lastSentAt };
  }
  if (!activity.journalAvailable) {
    return { ...base, status: "unknown", detail: "Journal des e-mails illisible (table non déployée ?).", lastAt: null };
  }
  const latest = activity.recent[0] ?? null;
  const status: HealthStatus = activity.failed24h === 0 ? "ok" : activity.lastAttemptFailed ? "error" : "warning";
  const parts = [`${activity.sent24h} envoyé${activity.sent24h > 1 ? "s" : ""} en 24 h`];
  if (activity.failed24h) parts.push(`${plural(activity.failed24h, "échec")}`);
  if (activity.skipped24h) parts.push(`${activity.skipped24h} non envoyé${activity.skipped24h > 1 ? "s" : ""}`);
  if (status === "error" && activity.lastFailure) parts.push(`dernier : ${activity.lastFailure.category}`);
  return { ...base, status, detail: parts.join(" · "), lastAt: latest?.created_at ?? activity.lastSentAt };
};

// ---------------------------------------------------------------------------------------------
// Payments (no Stripe call: the journals the webhook writes)

/** A journaled Stripe event still unprocessed after this long is an error (the webhook threw). */
export const STRIPE_UNPROCESSED_AFTER_MINUTES = 15;
export const PAYMENT_WINDOW_DAYS = 7;

export const paymentActivitySchema = z.object({
  stripeConfigured: z.boolean(),
  webhookSecretConfigured: z.boolean(),
  /** Latest Stripe event seen by the webhook (runner journal, organizer payment, flyover payment). */
  lastEventAt: z.string().nullable(),
  lastEventSource: z.string().nullable(),
  /** Runner journal rows not processed after 15 min, or with a processing error (7 days). */
  unprocessed: z.array(z.object({ eventType: z.string(), receivedAt: z.string(), error: z.string().nullable() })),
  /** Organizer payments failed or disputed in the last 7 days. */
  failedOrganizerPayments: z.number(),
  lastOrganizerPaymentAt: z.string().nullable(),
  lastFlyoverPaidAt: z.string().nullable(),
  lastRunnerEventAt: z.string().nullable(),
});
export type PaymentActivity = z.infer<typeof paymentActivitySchema>;

export const summarizePaymentHealth = (activity: PaymentActivity): HealthSystem => {
  const base = { key: "payments", label: "Paiements Stripe (webhook)", meter: null, href: "/admin/billing", lastAt: activity.lastEventAt } as const;
  if (!activity.stripeConfigured || !activity.webhookSecretConfigured) {
    const missing = [!activity.stripeConfigured ? "clé secrète" : null, !activity.webhookSecretConfigured ? "secret du webhook" : null].filter(Boolean).join(" et ");
    return { ...base, status: "error", detail: `Stripe : ${missing} absent${missing.includes(" et ") ? "s" : ""}.` };
  }
  if (activity.unprocessed.length) {
    return { ...base, status: "error", detail: `${plural(activity.unprocessed.length, "événement")} Stripe non traité${activity.unprocessed.length > 1 ? "s" : ""} (webhook en erreur).` };
  }
  const parts = [activity.lastEventAt ? "Webhook reçu" : "Aucun événement Stripe enregistré"];
  if (activity.failedOrganizerPayments) parts.push(`${activity.failedOrganizerPayments} paiement${activity.failedOrganizerPayments > 1 ? "s" : ""} organisateur en échec ou contesté${activity.failedOrganizerPayments > 1 ? "s" : ""} (7 j)`);
  return { ...base, status: activity.failedOrganizerPayments ? "warning" : "ok", detail: parts.join(" · ") };
};

// ---------------------------------------------------------------------------------------------
// « À traiter »: one « Système » item per system that is down

export const SYSTEM_INBOX_HREF = { crons: "/admin/system/automation", emails: "/admin/system/integrations", payments: "/admin/billing" } as const;

/**
 * Items of type « system » (counted in « À traiter »): one per pg_cron task failed or late, one for
 * the e-mails and one for the payments when their health line is `error`. Warnings are not items.
 */
export const buildSystemInboxItems = ({ tasks, emails, payments }: {
  tasks: ScheduledTask[] | null;
  emails: { health: HealthSystem; activity: EmailActivity } | null;
  payments: { health: HealthSystem; activity: PaymentActivity } | null;
}): InboxItem[] => {
  const items: InboxItem[] = [];
  (tasks ?? []).filter(isTaskDown).forEach((task) => items.push({
    id: `system:cron:${task.key}`,
    type: "system",
    title: `Tâche planifiée ${task.status === "failed" ? "en échec" : "en retard"} · ${task.label}`,
    context: ["Système", task.detail].join(" · "),
    since: task.downSince ?? task.lastStart,
    dueDate: null,
    href: SYSTEM_INBOX_HREF.crons,
  }));
  if (emails?.health.status === "error") {
    items.push({
      id: "system:emails",
      type: "system",
      title: "E-mails en panne · Resend",
      context: ["Système", emails.health.detail].join(" · "),
      since: emails.activity.lastFailure?.created_at ?? null,
      dueDate: null,
      href: SYSTEM_INBOX_HREF.emails,
    });
  }
  if (payments?.health.status === "error") {
    const oldest = [...payments.activity.unprocessed].sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))[0];
    items.push({
      id: "system:payments",
      type: "system",
      title: "Paiements en panne · webhook Stripe",
      context: ["Système", payments.health.detail].join(" · "),
      since: oldest?.receivedAt ?? null,
      dueDate: null,
      href: SYSTEM_INBOX_HREF.payments,
    });
  }
  return items;
};

// ---------------------------------------------------------------------------------------------
// `GET /api/admin/system/health`

const healthSystemShape = z.object({
  key: z.string(),
  label: z.string(),
  status: z.enum(["ok", "warning", "error", "off", "unknown", "untracked"]),
  detail: z.string(),
  lastAt: z.string().nullable(),
  meter: z.object({ value: z.number(), total: z.number() }).nullable(),
  href: z.string().nullable(),
});

export const systemHealthResponseSchema = z.object({
  generatedAt: z.string(),
  /** null when `admin_cron_job_status()` could not be read (migration not applied, error). */
  tasks: z.array(scheduledTaskSchema).nullable(),
  vercelTasks: z.array(scheduledTaskSchema),
  pgNet: pgNetSummarySchema.nullable(),
  emails: emailActivitySchema.nullable(),
  payments: paymentActivitySchema.nullable(),
  systems: z.array(healthSystemShape),
});
export type SystemHealthResponse = z.infer<typeof systemHealthResponseSchema>;

/** « 1 min 12 s », « 840 ms ». */
export const formatDuration = (ms: number | null) => {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${pad(seconds % 60)} s`;
};

export const TASK_STATUS_TONES: Record<TaskStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  ok: "success",
  running: "info",
  late: "danger",
  failed: "danger",
  warning: "warning",
  never: "warning",
  inactive: "neutral",
  never_called: "neutral",
};
