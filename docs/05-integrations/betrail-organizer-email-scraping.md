---
title: BeTrail Organizer Email Scraping
scope: integration
last_verified: 2026-09-06
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
  - apps/web/app/api/admin/race-catalog/betrail-import/route.ts
  - apps/web/app/api/admin/race-catalog/betrail-import/route.test.ts
  - apps/web/app/api/admin/race-catalog/betrail-import/format-parsers.ts
  - scripts/import-betrail-catalog-drafts.mjs
  - scripts/build-format-import-queue.mjs
  - scripts/build-format-import-queue.test.mjs
  - scripts/enrich-format-import-queue.mjs
  - scripts/enrich-format-import-queue.test.mjs
  - scripts/race-research-mcp.mjs
  - scripts/race-research-mcp-client.mjs
  - scripts/research-format-catalog.mjs
  - scripts/parse-route-references.mjs
  - scripts/import-format-queue-drafts.mjs
  - scripts/catalog-research-contract.mjs
  - scripts/catalog-research-validation.mjs
  - scripts/catalog-research-http.mjs
  - scripts/catalog-research-reliability.test.mjs
  - apps/web/app/api/admin/race-catalog/betrail-import/research-contract.ts
related_tables:
  - race_events
  - races
---

# BeTrail Organizer Email Scraping

## Purpose

`scripts/scrape-betrail-organizer-emails.mjs` collects organizer email addresses that BeTrail publicly reveals through the race page's organization contact action. It writes a reviewable CSV, can synchronize those records to the outreach Google Sheet, and never inserts data into Supabase or sends email itself. A separate, manually invoked admin route (below) can turn its `official_website`/`formats_raw` output into draft catalog rows.

## Key Concepts

- BeTrail protects automated HTTP traffic with Cloudflare, so the script drives a dedicated visible Chrome profile instead of trying to bypass the challenge.
- When Cloudflare requests verification, the operator completes it manually in Chrome. Scraping resumes after the normal race calendar becomes visible.
- The script scrolls the selected calendar, gathers race links, opens them sequentially, activates the organization contact control, and records email addresses exposed by that interaction.
- The default limit is 50 races and the default delay is 1.5 seconds between race pages. These conservative defaults reduce unnecessary load.
- A persistent state file, `tmp/betrail-organizer-emails-state.json` by default, records every completed race URL. Later runs skip those URLs and continue until they find the requested number of new races.
- Progress is saved to both the state file and cumulative CSV after every race. Rows whose status starts with `error:` remain eligible for a later retry.
- Event dates are collected conservatively from Event JSON-LD, explicit date attributes, or one unambiguous complete date visible on the race page. Month-only and conflicting dates stay blank.
- The scraper also reads the race page's own "en resume" summary table for an official website link and a Facebook page link, matched by their exact row label (`Site web`, `Facebook`) rather than by guessing markup. These are catalog-research leads, not verified organizer-provided data.
- The same summary table's `Localité` row (`"82200 Boudou (France > Occitanie > Tarn-Et-Garonne)"`) is parsed into a city and country: the text before the parenthesis, minus a leading postal code, is the city; the first `>`-separated segment inside the parenthesis is the country. Region/department are not extracted.
- Each `[itemprop="subEvent"]` microdata block on the page yields a best-effort format entry (`distance`, `elevation` text such as `19km` / `700 D+`). This is raw, unverified text meant only to help a human decide which official race website to investigate next — it must never be published to the race catalog without manual review and independent confirmation.
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
- `--retry-missing-enrichment` revisits already-completed records (kept in the anti-duplicate history) that still lack `official_website`, so races scraped before this field existed can be backfilled without being treated as new. It navigates directly to each record's current race URL, re-runs the same page probe, and updates the existing CSV/state row and Sheet entry in place rather than creating a duplicate.

Recover missing periods in batches without collecting the emails again:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --retry-missing-dates --limit 200
```

Backfill the official website / Facebook link / formats / city / country on races that were already scraped before those fields existed:

```bash
node scripts/scrape-betrail-organizer-emails.mjs --retry-missing-enrichment --limit 200
```

The CSV columns are `race_name`, `date`, `event_week`, `event_date_basis`, `event_week_source_date`, `organizer`, `emails`, `race_url`, `status`, `official_website`, `facebook_url`, `formats_raw`, `city`, and `country`. Multiple addresses in one row are separated with semicolons; `formats_raw` joins each detected format as `distance/elevation` (for example `19km/700 D+;10km/370 D+`). If a CSV from the earlier script version exists but no state file does, the script imports its race URLs automatically to initialize the history.

### Direct Google Sheet synchronization

The local scraper cannot run inside Apps Script because it needs a visible Chrome session and may require manual Cloudflare validation. Instead, the Apps Script project exposes a token-protected web app endpoint that upserts extracted records into `Prospects`.

After deploying the Apps Script project as a Web app:

1. Run `createScraperWebhookToken` in the Apps Script editor.
2. Store the returned token and `/exec` deployment URL as local environment variables.
3. Run the scraper normally.

Successful batches are marked `sheetSyncStatus: "synced"` in the local JSON state. Failed batches retain an error marker and are retried on the next run. The scraper and web app exchange a schema version (currently `4`); when the configured `/exec` URL still runs an obsolete deployment, synchronization stops immediately with `webhook Apps Script obsolete` instead of falsely marking ignored rows as synchronized. A temporary Apps Script `locked` response is retried up to six times at five-second intervals before the batch is left pending. Existing prospects are matched by normalized email; populated organization, website, date, event week, `official_website`, `facebook_url`, `formats_raw`, `Organization city`, `Organization country`, contact, reply, bounce, exclusion, and opt-out values are never overwritten. A recovered historical week fills `event_week` and records its edition in `event_date_basis`; new prospects receive the same formulas, checkbox validation, and formatting as the existing queue. `official_website`/`facebook_url`/`formats_raw`/`Organization city`/`Organization country` columns must exist in `Prospects` before running this client version; the webhook rejects the batch with `Colonne Prospects manquante` otherwise.

## Catalog draft import (admin)

`POST /api/admin/race-catalog/betrail-import` turns already-scraped BeTrail data (race name, date, `official_website`, `formats_raw`) into a draft `race_events` row plus one draft `races` row per format. It never fetches BeTrail itself (Cloudflare blocks server-side requests); the admin caller supplies the fields already collected by the scraper/CSV/Sheet. Every created race is forced to `data_status = "draft"` and `is_live = false`; the database's `races_draft_is_hidden` constraint independently blocks publication even if the route had a bug. Distance/elevation parsed from `formats_raw` by `format-parsers.ts` populate `distance_km`/`elevation_gain_m` directly since BeTrail is a reputable results aggregator, but the row still starts as an unpublished draft pending admin review and, ideally, cross-checking against the official website before publishing. `action: "preview"` returns the parsed formats and any duplicate event without writing; `action: "import"` writes and skips formats that already exist for that event (matched by `event_id` + `source_url` + `distance_km` + `race_date`) to keep reruns idempotent. `race_events.website_url` stores the official site; `races.source_url` stores the BeTrail race URL for provenance and dedup.

`scripts/import-betrail-catalog-drafts.mjs` is the batch caller: it reads a scraper CSV, keeps only rows with an official website and at least one format, and posts each to the route above with `ADMIN_API_BASE_URL`/`ADMIN_ACCESS_TOKEN` (or `--base-url`/`--token`). `--dry-run` prints the planned requests without calling the API or requiring credentials.

## Format-level research queue

The prospect CSV is a discovery source, not verified catalog data. `build-format-import-queue.mjs` creates one row per format, parses ISO/French dates and spreadsheet serial planning dates, and preserves the original candidates. `target_edition_year` comes from the campaign/prospect date, never from an old BeTrail URL. Invalid calendar dates and past exact editions are excluded. Planning dates only order research; they cannot certify an exact race date.

Queue ordering distributes formats across events consistently with or without pagination. `--offset` applies even without `--limit`. The campaign lower bound is the later of `--as-of` plus `--min-days-before` (default 21) and optional `--date-from`; optional `--date-to` is an inclusive upper bound. Rows without a planning date cannot enter a bounded campaign. Every researched row retains `min_event_date` and `max_event_date`, so a later extracted exact date outside the campaign is rejected even if the prospect estimate was inside it. Excluded prospects and reasons are exported separately by the complete pipeline.

```bash
node scripts/research-format-catalog.mjs --input tmp/Prospects.csv --output-dir tmp/catalog-research-v9 --as-of 2026-09-07 --min-days-before 21 --limit 25 --no-llm --verbose
node scripts/research-format-catalog.mjs --input tmp/Prospects.csv --output-dir tmp/catalog-research-v9 --resume --limit 25 --no-llm --verbose
```

Create the reproducible November 2026 through February 2027 cohort in a fresh campaign directory:

```bash
node scripts/research-format-catalog.mjs --input tmp/Prospects.csv --output-dir tmp/catalog-research-2026-11--2027-02 --as-of 2026-09-08 --min-days-before 0 --date-from 2026-11-01 --date-to 2027-02-28 --limit 10 --verbose
node scripts/research-format-catalog.mjs --input tmp/Prospects.csv --output-dir tmp/catalog-research-2026-11--2027-02 --resume --limit 10 --verbose
```

Use a fresh output directory for the first run. `catalog-progress.json` stores schema version 2, the input SHA-256, campaign date/window (including `date_from` and `date_to`), LLM mode, queue keys, completed rows, and next offset. Each completed format is checkpointed through a temporary file and rename; resume regenerates the CSV exports from that state. A changed input, incompatible queue, changed campaign settings, or a legacy output directory is refused. `catalog.lock` prevents concurrent writers. A forcibly killed process can leave this lock behind: confirm its recorded PID is no longer running before removing that specific lock. Failed-source rows are recorded as completed research attempts; resume processes subsequent rows, so retry those failures through a separately reviewed input and new output directory.

### Fetching and evidence

`enrich-format-import-queue.mjs` performs deterministic extraction and optionally semantic extraction. HTTP resources are cached by URL, while crawl decisions and extracted claims remain specific to each format and target edition. Up to eight pages are fetched normally, eighteen for deeper research; same-host course, programme, organization, regulations and logistics links are ranked along with the site's sitemap. One level of nested sitemap indexes is expanded so WordPress page sitemaps lead to actual source pages. The HTTP reader limits response size (8 MB normally), has a 12-second timeout, and extracts text from PDFs using the existing web workspace `pdf-parse` dependency (maximum 100 pages). JavaScript-only content, deeper sitemap nesting, scanned PDFs and access challenges can still require review.

A secondary source can identify an organizer through an explicit official link or organizer metadata. Arbitrary sponsor links, canonical URLs and social profiles do not become proof of organizer authority. Accepted claims must cite a fetched page on the selected organizer host, contain the proposed value, match the target edition for dates, and identify the requested format for format-specific fields. A page containing explicit dates exclusively from another edition cannot verify any field for the target edition, and a distance found only in a price line is rejected. A unique matching page heading may supply format context and is retained with the citation. A model-proposed alias alone cannot establish that match. Unknown hosts are only official candidates; the domain selection still warrants human review.

`catalog-research-contract.mjs` defines the field mapping and schema. `catalog-research-validation.mjs` normalizes numeric strings, calendar dates and route references, checks citations, detects conflicting accepted claims, and recomputes readiness. Every verified value has `field_provenance_json` with value, source URL, evidence, context when needed, method, edition and status. Rejected claims and fetch/LLM errors remain reviewable. A refresh clears stale verification flags. Verified organizer data can replace an unverified prospect estimate, including D+; prospect values are retained separately.

Only three fields are mandatory for **draft import**: exact date, official location and distance. D+ and other enrichment fields remain optional and are imported only when verified. Neither a candidate value nor a manually retained `ready_to_import` flag satisfies the contract. Conflicts in mandatory fields block import. Optional conflicts remain alerts and the affected fields are omitted.

Set `OPENAI_API_KEY` and optionally `OPENAI_ORGANIZER_IMPORT_MODEL`, `LLM_API_URL`, or `LLM_MODEL`; omit `--no-llm` to enable semantic extraction. The LLM still researches optional fields after deterministic mandatory-field extraction. Its context is bounded to 24,000 characters across the eight best-ranked pages; pages containing dates only from another edition receive a strong ranking penalty. There is no separate paid page-mapping pass. The 60-second timeout covers both response headers and body; provider errors preserve deterministic evidence and do not abort the batch. Structured logistics are returned as JSON-encoded claim strings for strict-schema compatibility.

The local `race-research-mcp.mjs` server exposes `crawl_source`, `fetch_page`, `search_page`, `parse_gpx`, and `download_and_parse_gpx`. The default adapter starts the MCP bridge automatically. A failed request closes only that client, starts a fresh bridge, and retries the current race once; a second failure falls back to direct HTTP for that race. Non-JSON diagnostics accidentally written to child stdout are ignored and reported on stderr instead of poisoning every later request. `RACE_RESEARCH_USE_MCP=0` selects direct HTTP. `crawl_transport` records the path used. MCP and HTTP use the same evidence rules and requested field set; neither is an authority. `--verbose` shows progress and decisions without printing credentials.

### Outputs, GPX and draft import

The complete pipeline writes `events.csv`, `formats.csv`, `formats-wide.csv`, `source-claims.csv`, `aid-stations.csv`, `gpx-manifest.csv`, `excluded-prospects.csv`, and `run-summary.json`. Both format CSVs retain the complete import contract. Source claims use the shared field mapping, so dates, locations and logistics retain their actual values and URLs. Per-format `evidence/` JSON snapshots store fetched pages, request context, extraction response, model metadata and errors; downloaded GPX files are stored by SHA-256. These local artifacts can be large and should remain under ignored `tmp/`.

GPX processing requires a verified route-link claim. Metrics remain separate from published text fields: they never promote an unverified date, distance or D+. Missing altitude stays unknown rather than zero; separate track segments are not joined artificially. Waypoints do not imply aid stations or water availability. A shared compatible trace is marked ambiguous for every affected format. Historical routes, distance mismatches and elevation discrepancies retain explicit review statuses. OpenRunner page metrics are `route_metrics`, not a downloaded trace. `parse-route-references.mjs` remains the standalone reference parser.

`import-format-queue-drafts.mjs` accepts only schema-v2 rows whose verified values and provenance agree. It recomputes readiness, rejects past dates and conflicting event locations, and sends only verified fields to the admin route using `importKind: catalog_research_v2`. It uses the official location instead of the prospect city. The route independently validates field agreement, edition and source hosts; deduplication includes the race date to separate editions.

```bash
node scripts/import-format-queue-drafts.mjs --input tmp/catalog-research-v9/formats-wide.csv --dry-run
```

Drafts remain `data_status = draft` and `is_live = false`. Supported schedule, venue, equipment and logistics fields populate existing `organizer_details`; all research evidence, candidates and remaining structured data are retained under `organizer_details.catalogResearch`. Aid stations and GPX references remain review data there: this adapter does not create child aid-station records or upload a route to Storage. Existing organizer editors may not preserve unknown JSON properties when saving, so retain the research exports as the durable audit record. The legacy BeTrail draft endpoint mode remains available separately; legacy research CSVs must be researched again rather than relabelled as schema v2.

Validation commands:

```bash
node --test --test-isolation=none scripts/build-format-import-queue.test.mjs scripts/enrich-format-import-queue.test.mjs scripts/catalog-research-reliability.test.mjs
node node_modules/vitest/vitest.mjs run apps/web/app/api/admin/race-catalog/betrail-import/route.test.ts --pool=threads --poolOptions.threads.singleThread
```

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

<!-- NEEDS REVIEW: 2026-09-07 - Outreach behavior was not re-audited during the catalog reliability changes; last_verified is intentionally unchanged. -->

## Gmail draft job

`scripts/google-apps-script/outreach-job/Code.gs` is a Google Apps Script job for the native outreach spreadsheet. Its manifest is stored beside it in `appsscript.json`. `Template email!mode_envoi` selects either review-only drafts (`Brouillons`) or controlled delivery of job-tracked drafts (`Envoi automatique`).

Run `installOutreachJob` once from the Apps Script editor after deployment and OAuth approval. It installs a one-minute time trigger. Each invocation:

- stops unless `activation_envoi` is checked;
- requires the template mode to be `Brouillons` or `Envoi automatique`;
- reads the enabled weekdays, start time, time zone, daily cap, and inter-message delay from `Paramètres envoi`;
- evaluates the send window against `outreach_planning_date`; exact future dates stay unchanged, while past editions use the same ISO event week in the next applicable year;
- rechecks the selected prospect's contact, reply, bounce, exclusion, and opt-out fields;
- searches Gmail for an existing sent message or reply from the same address;
- reconciles Gmail activity in bounded rotating batches every five minutes by default, updating `last_sent_email_at` and `replied_at` in `Prospects` even when draft creation is disabled;
- when `activation_relance` is checked, selects contacts whose latest sent message is at least `delai_relance_jours` business days old, then creates the next draft in a sequence capped at three relances; legacy generic relance history counts as relance 1;
- before drafting relance 1, reads the sent message and uses `corps_relance` when it explicitly proposed the TST/course-test flow; older presentation emails use `corps_relance_premier_contact` to introduce the site and app links, then invite the organizer to open TST and share feedback;
- processes at most one personalized message; draft mode creates it for review, while automatic mode sends it immediately;
- in automatic mode, drains existing tracked drafts oldest first before creating new messages, and never selects unrelated Gmail drafts;
- resolves private `GmailApp` draft IDs, Gmail message IDs, and Gmail API draft IDs from existing history, allowing drafts created before automatic mode was added to be sent without recreation;
- appends a signed, prospect-specific unsubscribe link to initial and follow-up drafts; the link opens a confirmation page and confirmation sets `Prospects!opted-out` to true;
- records the outcome in `Historique envois`, which the job creates when first installed.

Initial messages and follow-ups share the configured daily cap and inter-message delay. In automatic mode, the cap counts confirmed sends; in draft mode, it counts created drafts. Before sending a queued draft, the job rechecks the prospect address, reply, bounce, exclusion, and opt-out state. A pending relance draft blocks the next attempt. Relance 1 retains the original-content routing between `corps_relance` and `corps_relance_premier_contact`; relances 2 and 3 use their numbered templates, and the third identifies itself as the final message. After relance 3 is confirmed sent and one last configured business-day delay passes without a response, the job records `PROSPECT_SANS_REPONSE`; the Sheet displays this as `SANS RÉPONSE` and the sequence stops. When the initial send is absent from Gmail, the job creates a standalone draft. When the latest Gmail subject is generic, the job also uses a standalone draft so `objet_relance` can include the course name; Gmail requires matching subjects for true thread membership. The default delay is ten business days between steps and after the final send. Business days are Monday through Friday; public holidays are not excluded unless a holiday calendar is added explicitly. `activation_relance` stays unchecked until the copy has been reviewed.

The one-minute trigger is a polling cadence, not an exact delivery guarantee. Apps Script can start a run slightly late. With a one-minute delay and a limit of 150, a full daily draft sequence takes at least two hours and thirty minutes.

## Gotchas

- A bounded November-through-February campaign crosses an edition year. Always pass both inclusive dates; do not approximate it with `target_edition_year`. Date-window settings are part of resume identity and require a fresh output directory when changed.
- Scanned PDFs and text rendered only inside images remain review cases: the crawler now reaches nested sitemap pages, but it does not treat unverified OCR output as publication evidence.
- A mandatory-equipment statement without a distance qualifier is treated as event-wide; a sentence tied to a specific distance remains format-scoped and requires matching format evidence.
- The enriched CSV separates `prospect_date`/`prospect_city`/`prospect_country` from `official_date`/`official_location`/`official_distance_km`. Only the `official_*` values are source-backed publication data; prospect values remain discovery hints.
- The draft importer accepts an empty elevation string and records `elevation_gain_m` as missing in the draft API row; it must not be replaced by a fabricated zero in the CSV.
- GPX claims such as `OpenRunner N° 18684916` are normalized to the OpenRunner route page. Its JSON-LD distance/D+/D-/altitude metrics are recorded as `route_metrics`; they are not confused with a downloadable GPX trace.
- `scripts/parse-route-references.mjs` is the reusable standalone route parser. It accepts `--url`/`--reference` values or one reference per line with `--input`, supports OpenRunner IDs/URLs and generic UTMB route pages, and emits normalized JSON metrics without publishing them.
- `--limit` alone always selects the first block from the priority queue. Use `--offset 50 --limit 50` for the second block (and a new output directory or reviewed merge) so a later run does not repeat the first 50 formats.
- An exact race date before `--as-of` is excluded even when a separate planning date rolls the event into a future queue position; this prevents an old edition URL from becoming a current catalogue row.

- Keep testable helper exports such as the BeTrail distance/elevation parsers outside `route.ts`: Next.js validates Route Handler exports and rejects fields other than supported HTTP methods and route configuration.
- The default run only ever visits races absent from the anti-duplicate history (`tmp/betrail-organizer-emails-state.json` by default): once a race URL is recorded with a non-`error:` status, it is never revisited again, even to backfill newly added fields. Use `--retry-missing-enrichment` to update existing records instead of relying on the default discovery crawl.
- `--retry-missing-enrichment` only targets records with an email and an empty `official_website`; a race whose official site genuinely does not appear on its BeTrail page will be revisited every run until one is found or the record is manually corrected.

- `official_website`, `facebook_url`, and `formats_raw` are synced to the Google Sheet (schema v3) exactly like the other scraped fields (never overwriting an already-populated cell); the admin catalog draft-import route is a separate, manually invoked step and does not run automatically from the scraper or the Sheet.
- `formats_raw` distance/elevation text comes straight from BeTrail's display strings and is not cross-checked against any other source. Treat it strictly as a research hint for which official race website to open next; the admin import route does persist it as `distance_km`/`elevation_gain_m` on a draft race, but that draft still requires manual review before publication.
- BeTrail can change its DOM or contact interaction at any time. Rows with `contact_not_found`, `contact_without_email`, or `error: ...` require manual review.
- The calendar may lazy-load races. The script allows up to twelve scroll rounds without discovering a new race, or stops after reaching `--limit`.
- A contact action implemented as an internal form may not reveal the organizer's raw address. The script reports `contact_without_email` rather than attempting to defeat that design.
- Chrome uses `tmp/betrail-chrome-profile`, separate from the operator's everyday browser profile.
- Changing `--output` does not start a fresh crawl: the default state file remains authoritative. Conversely, changing `--state` creates an independent history and can therefore allow duplicate processing.
- A CSV queue is only an intermediate review artifact. Gmail or another sender must re-check replies and exclusions immediately before sending because those values can change after the export.
- `enrich-format-import-queue.mjs` must fetch page text through its `fetchPage` adapter; calling the deterministic extractor with a raw `Response` produces `html.replace is not a function`. If an older output contains that error, regenerate from the original `formats-queue.csv` rather than enriching the corrupted output, otherwise the old error is retained in the evidence column.
- The local MCP bridge is an optimization and orchestration boundary, not an authority: if its child process cannot start, enrichment falls back to the direct HTTP adapter. `RACE_RESEARCH_USE_MCP=0` explicitly selects that fallback.
- A generic `/telechargements` or `/parcours` page is not stored as a GPX URL unless the path identifies a concrete `.gpx` asset or a trace/download endpoint; the hostname itself is never used as a GPX signal.
- The enrichment LLM uses strict JSON Schema. Complex claims (ravitos, accès, dossards, services) are therefore returned as JSON-encoded strings; using free-form object schemas can make OpenAI-compatible APIs reject the request with HTTP 400.
- Prospects exports use `outreach_event_date` for an exact date and `outreach_planning_date` for ordering; both aliases must remain mapped when rebuilding the format queue. The planning date is never a verified import date when its basis is extrapolated.
- A row sourced only from a social, registration, timing, or aggregator URL cannot become `ready_to_import`; it needs a discovered/verified organizer source first. An external organizer URL may promote the source classification, but the original secondary URL remains in `source_pages_json` for provenance.
- Format-scoped claims (distance, D+, D-, schedules, cutoffs, GPX, ravitos, equipment, and participation mode) require their citation to identify the requested format. Event-wide claims such as the date, venue, access, or services may use an event-level citation. This prevents a neighboring format's 27 km/800 m or children's 11:00 start from being attached to a 12 km row merely because the text exists on the same page.
- Never present `outreach_planning_date` as a verified race date when `event_date_basis` says it was extrapolated. It is the Monday of the known ISO event week and exists only to place outreach in the right order of magnitude.
- Rows with neither an exact source date nor a reviewed `event_week` remain blocked. A week from 1 to 53 can be entered manually when another reliable source establishes the period.
- Creating a draft does not prove that it was sent. Gmail reconciliation confirms manual sends and replies, numbers confirmed relances in `Historique envois`, and prevents a later attempt while a draft remains pending. In `Envoi automatique` mode, only draft IDs already recorded in this history are eligible; changing an address or detecting a reply, bounce, exclusion, or opt-out closes the pending item without sending it. Reconciliation is deliberately batched and rotating to limit Gmail reads, so Sheet timestamps can lag Gmail by several minutes.
- Historical `gmail_draft_id` values may be private `GmailApp` IDs such as `r-...` rather than Gmail API draft IDs. The automatic sender opens the built-in draft to obtain its message ID, matches that against the current Gmail API draft list, then calls the Gmail send endpoint; a deleted draft is reported as missing instead of being confused with a sendable draft.
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
