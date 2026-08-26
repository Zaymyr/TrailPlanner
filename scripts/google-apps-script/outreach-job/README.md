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

## BeTrail scraper webhook

The same Apps Script project can receive prospects extracted by the local BeTrail scraper:

1. Deploy the project as a **Web app**, executing as the project owner, with access allowed to anyone holding the URL.
2. Run `createScraperWebhookToken` once and copy the returned secret.
3. Store the deployment `/exec` URL and secret locally as `BETRAIL_SHEET_WEBHOOK_URL` and `BETRAIL_SHEET_WEBHOOK_TOKEN`.
4. Run the scraper normally. Records containing public email addresses are upserted into `Prospects` after each race.

The secret is stored in Apps Script properties, not in the spreadsheet. Generating a new token immediately revokes the previous one. The webhook accepts at most 100 race records per request, deduplicates by normalized email, preserves populated prospect fields, and fills the exact event date only when the scraper found a complete `YYYY-MM-DD` date.

## Safety model

- The code creates Gmail drafts only; it contains no Gmail send call.
- `Paramètres envoi!activation_envoi` must be checked before the job does any work.
- `Template email!mode_envoi` must remain `Brouillons`.
- Each run creates at most one draft.
- Existing sent mail, replies, bounces, exclusions, opt-outs, the daily cap, and the configured delay are rechecked.
- Every terminal outcome is written to `Historique envois` to prevent duplicate drafts.
- The scraper webhook never sends email and never changes contact/reply/exclusion fields on an existing prospect.
- Gmail signature icons outside the basic Unicode plane are encoded as HTML entities so Gmail preserves them in generated drafts.

Run `uninstallOutreachJob` to delete the trigger without deleting the spreadsheet history.
