# Outreach Gmail draft job

This folder is the deployable Google Apps Script source for the organizer outreach spreadsheet.

## One-time installation

1. Open the Google Sheet and choose **Extensions → Apps Script**.
2. Replace the editor's `Code.gs` content with [`Code.gs`](Code.gs).
3. In **Project settings**, enable display of the `appsscript.json` manifest.
4. Replace the manifest with [`appsscript.json`](appsscript.json).
5. Save the project.
6. Select `installOutreachJob` in the function menu and click **Run**.
7. Approve the requested Google Sheets and Gmail permissions for `faustin@pace-yourself.com`.

The installer creates a trigger that checks the queue every minute. It updates `Template email!statut_job` after successful installation.

After changing [`Code.gs`](Code.gs), replace the bound Apps Script editor content again and save it. The existing trigger continues to call `runOutreachJob`; rerun `installOutreachJob` only when the trigger or OAuth permissions need to be recreated.

For webhook changes, also edit the existing Web app deployment and select **New version**. Merely saving the editor does not update the `/exec` deployment. The scraper verifies the webhook schema and stops with `webhook Apps Script obsolete` when its configured URL still points to an older deployment.

## BeTrail scraper webhook

The same Apps Script project can receive prospects extracted by the local BeTrail scraper:

1. Deploy the project as a **Web app**, executing as the project owner, with access allowed to anyone holding the URL.
2. Run `createScraperWebhookToken` once and copy the returned secret.
3. Store the deployment `/exec` URL and secret locally as `BETRAIL_SHEET_WEBHOOK_URL` and `BETRAIL_SHEET_WEBHOOK_TOKEN`.
4. Run the scraper normally. Records containing public email addresses are upserted into `Prospects` after each race.

The secret is stored in Apps Script properties, not in the spreadsheet. Generating a new token immediately revokes the previous one. The webhook accepts at most 100 race records per request, deduplicates by normalized email, preserves populated prospect fields, and fills the exact event date only when the scraper found a complete `YYYY-MM-DD` date. It can also fill an empty `event_week` and its historical-edition basis during a missing-date recovery pass. Each request and successful response carry a schema version so an obsolete deployment cannot silently report recovered weeks as synchronized.

## Event-period planning

The sheet keeps the scraped date in `outreach_event_date` and derives three planning fields:

- `event_week` stores the ISO week number;
- `outreach_planning_date` keeps a future exact date unchanged, or maps a past edition to the Monday of the same ISO week in the next applicable year;
- `event_date_basis` identifies an exact date, a previous edition extrapolation, a manually supplied week, or a missing period.

The queue uses `outreach_planning_date`, so a past 2026 edition can be scheduled at the same general period in 2027 without presenting the inferred Monday as a verified race date. When no source date exists, a reviewed ISO week from 1 to 53 may be entered manually in `event_week`; otherwise the prospect remains blocked.

## Safety model

- The code creates Gmail drafts only; it contains no Gmail send call.
- `Paramètres envoi!activation_envoi` must be checked before the job does any work.
- `Template email!mode_envoi` must remain `Brouillons`.
- Each run creates at most one draft.
- Existing sent mail, replies, bounces, exclusions, opt-outs, the daily cap, and the configured delay are rechecked.
- Every terminal outcome is written to `Historique envois` to prevent duplicate drafts.
- Gmail reconciliation updates `Prospects!last_sent_email_at` and `Prospects!replied_at` from actual Gmail messages. It runs in a rotating bounded batch every five minutes by default, including while draft creation is disabled.
- `activation_relance` is off by default. When enabled, the job creates one reply draft in the existing Gmail thread after `delai_relance_jours` (seven days by default), only if no response, bounce, exclusion, opt-out, or earlier follow-up exists.
- Initial and follow-up drafts share `limite_quotidienne` and `delai_entre_envois_minutes`.
- The scraper webhook never sends email and never changes contact/reply/exclusion fields on an existing prospect.
- Gmail signature icons outside the basic Unicode plane are encoded as HTML entities so Gmail preserves them in generated drafts.

Run `uninstallOutreachJob` to delete the trigger without deleting the spreadsheet history.
