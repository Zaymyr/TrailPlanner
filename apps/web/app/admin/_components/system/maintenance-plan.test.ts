import { describe, expect, it } from "vitest";

import {
  addResendSyncBatch,
  BETRAIL_IMPORT_COMMANDS,
  cleanupMayHaveMore,
  emptyResendTotals,
  formatCronResult,
  nextResendSyncPage,
  resendSyncBody,
  resendSyncResponseSchema,
} from "./maintenance-plan";

describe("Resend sync paging", () => {
  it("starts with a dry run of 10 pages and syncs page by page", () => {
    expect(resendSyncBody(true, 1)).toEqual({ dryRun: true, startPage: 1, pageSize: 100, maxPages: 10 });
    expect(resendSyncBody(false, 4)).toEqual({ dryRun: false, startPage: 4, pageSize: 100, maxPages: 1 });
  });

  it("continues after full pages and stops at the first short page", () => {
    expect(nextResendSyncPage({ startPage: 1, pagesProcessed: 10, usersRead: 1000 })).toBe(11);
    expect(nextResendSyncPage({ startPage: 11, pagesProcessed: 3, usersRead: 245 })).toBeNull();
    expect(nextResendSyncPage({ startPage: 4, pagesProcessed: 1, usersRead: 100 })).toBe(5);
    expect(nextResendSyncPage({ startPage: 1, pagesProcessed: 0, usersRead: 0 })).toBeNull();
  });

  it("adds the batches of the same run", () => {
    const batch = resendSyncResponseSchema.parse({
      summary: { dryRun: false, startPage: 1, pagesProcessed: 1, usersRead: 100, contactsPrepared: 90, contactsWouldSync: 0, contactsSynced: 88, created: 60, updated: 28, skipped: 10, skippedNoEmail: 4, skippedAnonymous: 6, failed: 2, propertiesDropped: 0 },
      failures: [{ userId: "u1", email: "a@b.fr", statusCode: 422, message: "invalid" }],
      hasMoreFailures: false,
    });
    const totals = addResendSyncBatch(addResendSyncBatch(emptyResendTotals(), batch), batch);
    expect(totals).toMatchObject({ pages: 2, usersRead: 200, prepared: 180, created: 120, updated: 56, skipped: 20, failed: 4 });
    expect(totals.failures).toHaveLength(2);
  });
});

describe("other actions", () => {
  it("offers to continue the cleanup after a full batch of 25", () => {
    expect(cleanupMayHaveMore({ processed: 25, deleted: [], retained: [], failed: [] })).toBe(true);
    expect(cleanupMayHaveMore({ processed: 3, deleted: [], retained: [], failed: [] })).toBe(false);
  });

  it("shows a bounded cron result and the documented Betrail commands", () => {
    expect(formatCronResult(null)).toBe("Aucune réponse JSON.");
    expect(formatCronResult({ ok: true, moved: false })).toContain("\"moved\": false");
    expect(formatCronResult({ text: "x".repeat(5_000) }).length).toBeLessThanOrEqual(1_200);
    expect(BETRAIL_IMPORT_COMMANDS[0]).toContain("scripts/import-betrail-catalog-drafts.mjs --input <scraper.csv> --dry-run");
  });
});
