---
title: BeTrail Organizer Email Scraping
scope: integration
last_verified: 2026-08-31
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
- `--retry-missing-dates` revisits only email-bearing records that still lack both an exact date and an event week. It checks the two preceding BeTrail edition URLs and accepts the first unambiguous exact historical date as an approximate ISO week.
- Outreach planning preserves that source date, derives its ISO week, and rolls a past edition forward to the same event week in the next applicable year. The derived Monday is only an internal planning anchor, not a claimed exact race date.
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
- `--retry-missing-dates` processes the next limited batch of contacts without a date or week.
- `--retry-date-failures` also revisits records previously marked `not_found`; transient errors are retried automatically.

Recover missing periods in batches without collecting the emails again:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --retry-missing-dates --limit 200
```

The CSV columns are `race_name`, `date`, `event_week`, `event_date_basis`, `event_week_source_date`, `organizer`, `emails`, `race_url`, and `status`. Multiple addresses in one row are separated with semicolons. If a CSV from the earlier script version exists but no state file does, the script imports its race URLs automatically to initialize the history.

### Direct Google Sheet synchronization

The local scraper cannot run inside Apps Script because it needs a visible Chrome session and may require manual Cloudflare validation. Instead, the Apps Script project exposes a token-protected web app endpoint that upserts extracted records into `Prospects`.

After deploying the Apps Script project as a Web app:

1. Run `createScraperWebhookToken` in the Apps Script editor.
2. Store the returned token and `/exec` deployment URL as local environment variables.
3. Run the scraper normally.

Successful batches are marked `sheetSyncStatus: "synced"` in the local JSON state. Failed batches retain an error marker and are retried on the next run. The scraper and web app exchange a schema version; when the configured `/exec` URL still runs an obsolete deployment, synchronization stops immediately with `webhook Apps Script obsolete` instead of falsely marking ignored rows as synchronized. A temporary Apps Script `locked` response is retried up to six times at five-second intervals before the batch is left pending. Existing prospects are matched by normalized email; populated organization, website, date, event week, contact, reply, bounce, exclusion, and opt-out values are never overwritten. A recovered historical week fills `event_week` and records its edition in `event_date_basis`; new prospects receive the same formulas, checkbox validation, and formatting as the existing queue.

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
- evaluates the send window against `outreach_planning_date`; exact future dates stay unchanged, while past editions use the same ISO event week in the next applicable year;
- rechecks the selected prospect's contact, reply, bounce, exclusion, and opt-out fields;
- searches Gmail for an existing sent message or reply from the same address;
- reconciles Gmail activity in bounded rotating batches every five minutes by default, updating `last_sent_email_at` and `replied_at` in `Prospects` even when draft creation is disabled;
- when `activation_relance` is checked, selects contacts whose last sent message is at least `delai_relance_jours` business days old, then rechecks Gmail and creates at most one relance draft; it stays in the existing thread only when the original subject already contains the organization name, otherwise a standalone draft uses the personalized `objet_relance`;
- reads the actual first sent message before drafting a follow-up: messages that explicitly proposed the TST/course-test flow use `corps_relance`, while older presentation emails use `corps_relance_premier_contact` to introduce the site and app links, then invite the organizer to open TST and share feedback;
- creates at most one personalized draft;
- appends a signed, prospect-specific unsubscribe link to initial and follow-up drafts; the link opens a confirmation page and confirmation sets `Prospects!opted-out` to true;
- records the outcome in `Historique envois`, which the job creates when first installed.

Initial drafts and follow-up drafts share the configured daily cap and inter-draft delay. A follow-up is blocked when Gmail contains a later reply, or when the prospect has no organizer name, is bounced, excluded, opted out, or already followed up. When the initial send is absent from Gmail, the job creates a standalone draft with `corps_relance_premier_contact`. When the initial Gmail subject is generic, the job also uses a standalone draft so `objet_relance` can include the course name; Gmail requires matching subjects for true thread membership. The default follow-up delay is ten business days. Business days are Monday through Friday; public holidays are not excluded unless a holiday calendar is added explicitly. `activation_relance` stays unchecked until the follow-up copy has been reviewed.

The one-minute trigger is a polling cadence, not an exact delivery guarantee. Apps Script can start a run slightly late. With a one-minute delay and a limit of 150, a full daily draft sequence takes at least two hours and thirty minutes.

## Gotchas

- BeTrail can change its DOM or contact interaction at any time. Rows with `contact_not_found`, `contact_without_email`, or `error: ...` require manual review.
- The calendar may lazy-load races. The script allows up to twelve scroll rounds without discovering a new race, or stops after reaching `--limit`.
- A contact action implemented as an internal form may not reveal the organizer's raw address. The script reports `contact_without_email` rather than attempting to defeat that design.
- Chrome uses `tmp/betrail-chrome-profile`, separate from the operator's everyday browser profile.
- Changing `--output` does not start a fresh crawl: the default state file remains authoritative. Conversely, changing `--state` creates an independent history and can therefore allow duplicate processing.
- A CSV queue is only an intermediate review artifact. Gmail or another sender must re-check replies and exclusions immediately before sending because those values can change after the export.
- Never present `outreach_planning_date` as a verified race date when `event_date_basis` says it was extrapolated. It is the Monday of the known ISO event week and exists only to place outreach in the right order of magnitude.
- Rows with neither an exact source date nor a reviewed `event_week` remain blocked. A week from 1 to 53 can be entered manually when another reliable source establishes the period.
- Creating a draft does not prove that it was sent. Gmail reconciliation confirms manual sends and replies, while `Historique envois` prevents duplicate initial and follow-up drafts. Reconciliation is deliberately batched and rotating to limit Gmail reads, so Sheet timestamps can lag Gmail by several minutes.
- Follow-ups inspect the latest sent Gmail message for the prospect address. The job filters individual message headers after the Gmail search so an incoming reply in the same thread is not mistaken for a sent message. It keeps a relance threaded only when the original subject already identifies the organization; otherwise the personalized subject would violate Gmail's subject-match requirement.
- Historical Overloop sends may populate `last_sent_email_at` without existing in Gmail. Those contacts receive a standalone follow-up draft; `Template email!objet_relance` controls its subject. This fallback prevents one missing Gmail thread from starving all later relances.
- `repairFollowupDraftSubjects` repairs existing follow-up drafts in place without sending them. It preserves their bodies and recipients, replaces the subject from `objet_relance`, and records `RELANCE_OBJET_REPARE`. A repaired draft can leave its old Gmail thread because its new personalized subject intentionally differs.
- Follow-up copy is selected from explicit evidence in the original sent content. A generic phrase such as “tester ce format sur un événement réel” does not count as having already shared a course test; only an explicit TST/course-test instruction selects that template.
- The follow-up business-day delay skips Saturdays and Sundays but does not currently know French public holidays.
- Gmail signatures are fetched through the Gmail advanced service. Non-BMP icons are converted to HTML entities before draft creation because `GmailApp.createDraft` can otherwise replace them. If the service or signature lookup is unavailable, the job creates the draft without a signature and logs a warning rather than blocking the queue.
- The Apps Script web app URL is public by necessity, but every write requires the long token stored in Script Properties. Rotate it with `createScraperWebhookToken` if it is ever exposed.
- Unsubscribe URLs use a separate HMAC signing secret stored in Script Properties. A GET only shows the confirmation page; the signed POST sets `opted-out`, so automated link previews do not unsubscribe a prospect. Run `installOutreachJob` once after deploying this version to initialize the secret.
- Saving `Code.gs` does not update an existing Web app by itself. After webhook changes, edit the deployment, choose a new version, and keep the corresponding `/exec` URL in `BETRAIL_SHEET_WEBHOOK_URL`; the schema check detects stale URLs before local sync state is changed.
- The one-minute Gmail trigger and the scraper webhook share an Apps Script lock while writing the workbook. The scraper waits and retries a temporary `locked` response; a batch that remains locked after those retries stays eligible for the next run.
- Google Sheet synchronization only accepts exact event dates that match the year encoded in the BeTrail race-edition URL. Ambiguous dates stay empty and therefore remain blocked from outreach.
- Historical recovery deliberately tries only the two preceding edition URLs. A renamed event, a changed BeTrail slug, or an edition without an exact date remains `not_found`; use `--retry-date-failures` only when a later retry is justified.

## Related Docs

- [Integration index](../README.md)
- [Mulebar Product Scraping](mulebar-scraping.md)
