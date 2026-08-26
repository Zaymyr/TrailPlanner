---
title: BeTrail Organizer Email Scraping
scope: integration
last_verified: 2026-08-26
ai_priority: medium
related_files:
  - scripts/scrape-betrail-organizer-emails.mjs
  - scripts/scrape-betrail-organizer-emails.test.mjs
  - scripts/prepare-betrail-outreach-csv.mjs
  - scripts/prepare-betrail-outreach-csv.test.mjs
  - scripts/google-apps-script/outreach-job/Code.gs
  - scripts/google-apps-script/outreach-job/Code.test.mjs
  - scripts/google-apps-script/outreach-job/appsscript.json
  - scripts/google-apps-script/outreach-job/README.md
related_tables: []
---

# BeTrail Organizer Email Scraping

## Purpose

`scripts/scrape-betrail-organizer-emails.mjs` collects organizer email addresses that BeTrail publicly reveals through the race page's organization contact action. It writes a reviewable CSV, can synchronize those records to the outreach Google Sheet, and never inserts data into Supabase or sends email.

## Key Concepts

- BeTrail protects automated HTTP traffic with Cloudflare, so the script drives a dedicated visible Chrome profile instead of trying to bypass the challenge.
- When Cloudflare requests verification, the operator completes it manually in Chrome. Scraping resumes after the normal race calendar becomes visible.
- The script scrolls the selected calendar, gathers race links, opens them sequentially, activates the organization contact control, and records email addresses exposed by that interaction.
- The default limit is 50 races and the default delay is 1.5 seconds between race pages. These conservative defaults reduce unnecessary load.
- A persistent state file, `tmp/betrail-organizer-emails-state.json` by default, records every completed race URL. Later runs skip those URLs and continue until they find the requested number of new races.
- Progress is saved to both the state file and cumulative CSV after every race. Rows whose status starts with `error:` remain eligible for a later retry.
- Event dates are collected conservatively from Event JSON-LD, explicit date attributes, or one unambiguous complete date visible on the race page. Month-only and conflicting dates stay blank.
- Output stays under the ignored `tmp/` directory by default and must be reviewed before any further use.

## Usage

Run a small sample first:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --limit 5
```

The script opens Chrome. Complete a Cloudflare check if one appears, then leave the window open until the terminal reports completion.

Run a larger extraction or choose another BeTrail calendar URL:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --limit 200 --output tmp/betrail-france-emails.csv
node scripts/scrape-betrail-organizer-emails.mjs --calendar-url https://www.betrail.run/calendar/france --limit 100
```

The `--limit` value now means **new races per run**. Repeating the same command processes the next batch without revisiting completed race URLs:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --limit 200
node scripts/scrape-betrail-organizer-emails.mjs --limit 200
```

Region filtering is optional. A single persistent history is safer because it also prevents overlap when BeTrail regions or date ranges contain the same race.

Useful options:

- `--limit <number>` caps the number of race pages visited.
- `--delay-ms <ms>` controls pacing between race pages.
- `--manual-timeout-ms <ms>` controls how long the script waits for manual Cloudflare validation.
- `--chrome-path <path>` selects a Chrome or Chromium executable when auto-detection fails.
- `--output <path>` selects the CSV output path.
- `--state <path>` selects the persistent anti-duplicate history. Keep the same state path across regions and runs.
- `--sheet-webhook-url <url>` selects the deployed Apps Script `/exec` endpoint. It can instead come from `BETRAIL_SHEET_WEBHOOK_URL`.
- `--sheet-webhook-token <token>` authenticates that endpoint. It can instead come from `BETRAIL_SHEET_WEBHOOK_TOKEN`.

The CSV columns are `race_name`, `date`, `organizer`, `emails`, `race_url`, and `status`. Multiple addresses in one row are separated with semicolons. If a CSV from the earlier script version exists but no state file does, the script imports its race URLs automatically to initialize the history.

### Direct Google Sheet synchronization

The local scraper cannot run inside Apps Script because it needs a visible Chrome session and may require manual Cloudflare validation. Instead, the Apps Script project exposes a token-protected web app endpoint that upserts extracted records into `Prospects`.

After deploying the Apps Script project as a Web app:

1. Run `createScraperWebhookToken` in the Apps Script editor.
2. Store the returned token and `/exec` deployment URL as local environment variables.
3. Run the scraper normally.

Successful batches are marked `sheetSyncStatus: "synced"` in the local JSON state. Failed batches retain an error marker and are retried on the next run. Existing prospects are matched by normalized email; populated organization, website, date, contact, reply, bounce, exclusion, and opt-out values are never overwritten. New prospects receive the same formulas, checkbox validation, and formatting as the existing queue.

## Data Handling

- Collect only addresses that the race page exposes through its organization contact interface.
- Treat the addresses as contact data: keep the CSV private, validate the intended use, and delete it when it is no longer needed.
- Do not use the output for unsolicited bulk email. Any outreach must respect BeTrail's terms and applicable privacy and electronic-communications rules.
- The scraper does not log in, solve CAPTCHA challenges, evade Cloudflare, or submit contact forms.

## Preparing an Overloop export for outreach

`scripts/prepare-betrail-outreach-csv.mjs` turns a reviewed Overloop CSV export into a conservative daily outreach queue. It never sends email and never overwrites its input file. The processor:

- preserves all source columns;
- uses only `overloop_event_date_safe` as the canonical event date;
- blocks archived, excluded, opted-out, hard-bounced, replied-to, or previously contacted prospects;
- calculates the number of days before the event;
- ranks eligible prospects by event proximity and selects at most the configured daily limit.

Example with an explicit 90-to-180-day contact window and a 150-recipient cap:

```bash
node scripts/prepare-betrail-outreach-csv.mjs \
  --input tmp/leads.csv \
  --output tmp/leads-outreach.csv \
  --as-of 2026-08-26 \
  --min-days-before 90 \
  --max-days-before 180 \
  --daily-limit 150
```

The output adds `outreach_event_date`, `outreach_days_to_event`, `outreach_eligible`, `outreach_selected_today`, `outreach_queue_rank`, and `outreach_block_reason`.

The `--repair-shifted-enrichment` flag exists for the reviewed 2026-08-26 export whose date-enrichment columns were proven to be offset by one data row. It shifts only the documented date-analysis columns one row upward; it deliberately leaves prospect-level fields such as `reply_flag` untouched. Do not use this repair flag on an export unless the same offset has been verified.

## Gmail draft job

`scripts/google-apps-script/outreach-job/Code.gs` is a Google Apps Script job for the native outreach spreadsheet. Its manifest is stored beside it in `appsscript.json`. The job is intentionally draft-only: it never invokes a Gmail send method.

Run `installOutreachJob` once from the Apps Script editor after deployment and OAuth approval. It installs a one-minute time trigger. Each invocation:

- stops unless `activation_envoi` is checked;
- requires the template mode to remain `Brouillons`;
- reads the enabled weekdays, start time, time zone, daily cap, and inter-draft delay from `Paramètres envoi`;
- rechecks the selected prospect's contact, reply, bounce, exclusion, and opt-out fields;
- searches Gmail for an existing sent message or reply from the same address;
- creates at most one personalized draft;
- records the outcome in `Historique envois`, which the job creates when first installed.

The one-minute trigger is a polling cadence, not an exact delivery guarantee. Apps Script can start a run slightly late. With a one-minute delay and a limit of 150, a full daily draft sequence takes at least two hours and thirty minutes.

## Gotchas

- BeTrail can change its DOM or contact interaction at any time. Rows with `contact_not_found`, `contact_without_email`, or `error: ...` require manual review.
- The calendar may lazy-load races. The script allows up to twelve scroll rounds without discovering a new race, or stops after reaching `--limit`.
- A contact action implemented as an internal form may not reveal the organizer's raw address. The script reports `contact_without_email` rather than attempting to defeat that design.
- Chrome uses `tmp/betrail-chrome-profile`, separate from the operator's everyday browser profile.
- Changing `--output` does not start a fresh crawl: the default state file remains authoritative. Conversely, changing `--state` creates an independent history and can therefore allow duplicate processing.
- A CSV queue is only an intermediate review artifact. Gmail or another sender must re-check replies and exclusions immediately before sending because those values can change after the export.
- Never infer a precise future event date from a month or period label. Rows without `overloop_event_date_safe` remain blocked until a precise date is verified.
- Creating a draft does not prove that it was sent. `Historique envois` prevents duplicate drafts, but manual sending and replies still need reconciliation before an automatic-send mode is ever considered.
- Gmail signatures are fetched through the Gmail advanced service. Non-BMP icons are converted to HTML entities before draft creation because `GmailApp.createDraft` can otherwise replace them. If the service or signature lookup is unavailable, the job creates the draft without a signature and logs a warning rather than blocking the queue.
- The Apps Script web app URL is public by necessity, but every write requires the long token stored in Script Properties. Rotate it with `createScraperWebhookToken` if it is ever exposed.
- Google Sheet synchronization only accepts exact event dates that match the year encoded in the BeTrail race-edition URL. Ambiguous dates stay empty and therefore remain blocked from outreach.

## Related Docs

- [Integration index](../README.md)
- [Mulebar Product Scraping](mulebar-scraping.md)
