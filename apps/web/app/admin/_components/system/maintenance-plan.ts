import { z } from "zod";

/**
 * Contracts and paging rules of the Maintenance actions (lot 3). Each action calls an existing admin
 * route, unchanged: `POST /api/admin/resend/sync`, `POST /api/admin/racebook-publications/backfill`,
 * `POST /api/admin/racebook-publications/cleanup`, `POST /api/admin/system/cron-run`.
 */

// Resend sync -------------------------------------------------------------------------------

export const RESEND_SYNC_PAGE_SIZE = 100;
/** Pages per call: the dry run only reads Supabase; the real run calls Resend for every contact (~0,5 s each). */
export const RESEND_SYNC_PAGES_PER_CALL = { dryRun: 10, real: 1 } as const;

export const resendSyncSummarySchema = z.object({
  dryRun: z.boolean(),
  startPage: z.number(),
  pagesProcessed: z.number(),
  usersRead: z.number(),
  contactsPrepared: z.number(),
  contactsWouldSync: z.number(),
  contactsSynced: z.number(),
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  skippedNoEmail: z.number(),
  skippedAnonymous: z.number(),
  failed: z.number(),
}).passthrough();
export const resendSyncResponseSchema = z.object({
  summary: resendSyncSummarySchema,
  failures: z.array(z.object({ userId: z.string(), email: z.string().nullable(), statusCode: z.number().optional(), message: z.string() })),
  hasMoreFailures: z.boolean(),
});
export type ResendSyncResponse = z.infer<typeof resendSyncResponseSchema>;

export const resendSyncBody = (dryRun: boolean, startPage: number) => ({
  dryRun,
  startPage,
  pageSize: RESEND_SYNC_PAGE_SIZE,
  maxPages: dryRun ? RESEND_SYNC_PAGES_PER_CALL.dryRun : RESEND_SYNC_PAGES_PER_CALL.real,
});

/**
 * The route stops at the first page shorter than `pageSize`: every page full means there may be more
 * users, so the next call starts after the last page read. Null when the user list is exhausted.
 */
export const nextResendSyncPage = (summary: Pick<ResendSyncResponse["summary"], "startPage" | "pagesProcessed" | "usersRead">, pageSize = RESEND_SYNC_PAGE_SIZE) =>
  summary.pagesProcessed > 0 && summary.usersRead === summary.pagesProcessed * pageSize ? summary.startPage + summary.pagesProcessed : null;

export type ResendSyncTotals = { pages: number; usersRead: number; prepared: number; created: number; updated: number; skipped: number; failed: number; failures: ResendSyncResponse["failures"] };
export const emptyResendTotals = (): ResendSyncTotals => ({ pages: 0, usersRead: 0, prepared: 0, created: 0, updated: 0, skipped: 0, failed: 0, failures: [] });

export const addResendSyncBatch = (totals: ResendSyncTotals, batch: ResendSyncResponse): ResendSyncTotals => ({
  pages: totals.pages + batch.summary.pagesProcessed,
  usersRead: totals.usersRead + batch.summary.usersRead,
  prepared: totals.prepared + batch.summary.contactsPrepared,
  created: totals.created + batch.summary.created,
  updated: totals.updated + batch.summary.updated,
  skipped: totals.skipped + batch.summary.skipped,
  failed: totals.failed + batch.summary.failed,
  failures: [...totals.failures, ...batch.failures].slice(0, 25),
});

// Livrets (RaceBook publications) -----------------------------------------------------------

export const backfillResponseSchema = z.object({
  candidateCount: z.number(),
  publishedRaceIds: z.array(z.string()),
  failures: z.array(z.object({ raceId: z.string(), message: z.string() })),
  complete: z.boolean(),
});
export type BackfillResponse = z.infer<typeof backfillResponseSchema>;

/** The cleanup route handles at most 25 queue rows per call. */
export const CLEANUP_BATCH_SIZE = 25;
export const cleanupResponseSchema = z.object({
  processed: z.number(),
  deleted: z.array(z.string()),
  retained: z.array(z.string()),
  failed: z.array(z.string()),
});
export type CleanupResponse = z.infer<typeof cleanupResponseSchema>;
/** A full batch means the queue may hold more due rows. */
export const cleanupMayHaveMore = (result: CleanupResponse) => result.processed >= CLEANUP_BATCH_SIZE;

// Manual cron run ---------------------------------------------------------------------------

export const cronRunResponseSchema = z.object({
  job: z.string(),
  ok: z.boolean(),
  status: z.number(),
  durationMs: z.number(),
  result: z.unknown(),
});
export type CronRunResponse = z.infer<typeof cronRunResponseSchema>;

/** Compact JSON of a cron result for the result panel (at most `max` characters). */
export const formatCronResult = (result: unknown, max = 1_200) => {
  if (result === null || result === undefined) return "Aucune réponse JSON.";
  const text = JSON.stringify(result, null, 2);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

// Betrail -----------------------------------------------------------------------------------

/** Documented in docs/05-integrations/betrail-organizer-email-scraping.md (no button: it reads a local CSV). */
export const BETRAIL_IMPORT_COMMANDS = [
  "node scripts/import-betrail-catalog-drafts.mjs --input <scraper.csv> --dry-run",
  "ADMIN_API_BASE_URL=https://pace-yourself.com ADMIN_ACCESS_TOKEN=<jeton admin> node scripts/import-betrail-catalog-drafts.mjs --input <scraper.csv>",
] as const;
