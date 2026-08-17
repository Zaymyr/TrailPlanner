---
title: BeTrail Organizer Email Scraping
scope: integration
last_verified: 2026-08-17
ai_priority: medium
related_files:
  - scripts/scrape-betrail-organizer-emails.mjs
  - scripts/scrape-betrail-organizer-emails.test.mjs
related_tables: []
---

# BeTrail Organizer Email Scraping

## Purpose

`scripts/scrape-betrail-organizer-emails.mjs` collects organizer email addresses that BeTrail publicly reveals through the race page's organization contact action. It writes a reviewable CSV and never inserts data into Supabase or sends email.

## Key Concepts

- BeTrail protects automated HTTP traffic with Cloudflare, so the script drives a dedicated visible Chrome profile instead of trying to bypass the challenge.
- When Cloudflare requests verification, the operator completes it manually in Chrome. Scraping resumes after the normal race calendar becomes visible.
- The script scrolls the selected calendar, gathers race links, opens them sequentially, activates the organization contact control, and records email addresses exposed by that interaction.
- The default limit is 50 races and the default delay is 1.5 seconds between race pages. These conservative defaults reduce unnecessary load.
- A persistent state file, `tmp/betrail-organizer-emails-state.json` by default, records every completed race URL. Later runs skip those URLs and continue until they find the requested number of new races.
- Progress is saved to both the state file and cumulative CSV after every race. Rows whose status starts with `error:` remain eligible for a later retry.
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

The CSV columns are `race_name`, `date`, `organizer`, `emails`, `race_url`, and `status`. Multiple addresses in one row are separated with semicolons. If a CSV from the earlier script version exists but no state file does, the script imports its race URLs automatically to initialize the history.

## Data Handling

- Collect only addresses that the race page exposes through its organization contact interface.
- Treat the addresses as contact data: keep the CSV private, validate the intended use, and delete it when it is no longer needed.
- Do not use the output for unsolicited bulk email. Any outreach must respect BeTrail's terms and applicable privacy and electronic-communications rules.
- The scraper does not log in, solve CAPTCHA challenges, evade Cloudflare, or submit contact forms.

## Gotchas

- BeTrail can change its DOM or contact interaction at any time. Rows with `contact_not_found`, `contact_without_email`, or `error: ...` require manual review.
- The calendar may lazy-load races. The script allows up to twelve scroll rounds without discovering a new race, or stops after reaching `--limit`.
- A contact action implemented as an internal form may not reveal the organizer's raw address. The script reports `contact_without_email` rather than attempting to defeat that design.
- Chrome uses `tmp/betrail-chrome-profile`, separate from the operator's everyday browser profile.
- Changing `--output` does not start a fresh crawl: the default state file remains authoritative. Conversely, changing `--state` creates an independent history and can therefore allow duplicate processing.

## Related Docs

- [Integration index](../README.md)
- [Mulebar Product Scraping](mulebar-scraping.md)
