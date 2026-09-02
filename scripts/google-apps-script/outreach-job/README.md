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

`Template email!mode_envoi` controls delivery:

- `Brouillons` keeps every generated message in Gmail for manual review;
- `Envoi automatique` sends only drafts whose IDs were recorded by this job in `Historique envois`.

When automatic mode is enabled, existing tracked drafts are drained oldest first before new messages are created. The job processes one message per trigger run and continues to honor `activation_envoi`, allowed days, the start time, `limite_quotidienne`, and `delai_entre_envois_minutes`.

After changing [`Code.gs`](Code.gs), replace the bound Apps Script editor content again and save it. The existing trigger continues to call `runOutreachJob`; rerun `installOutreachJob` once after adding the unsubscribe feature so its signing secret is created. Later reruns are only needed when the trigger or OAuth permissions need to be recreated.

For webhook or unsubscribe-page changes, also edit the existing Web app deployment and select **New version**. Merely saving the editor does not update the `/exec` deployment. The scraper verifies the webhook schema and stops with `webhook Apps Script obsolete` when its configured URL still points to an older deployment.

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

- The default `Brouillons` mode creates Gmail drafts without sending them.
- `Envoi automatique` sends only drafts tracked in `Historique envois`; unrelated Gmail drafts are never selected.
- `Paramètres envoi!activation_envoi` must be checked before the job does any work.
- `Template email!mode_envoi` must be either `Brouillons` or `Envoi automatique`.
- Each run creates at most one draft.
- Existing sent mail, replies, bounces, exclusions, opt-outs, the organizer name, the daily cap, and the configured delay are rechecked.
- Before an existing tracked draft is sent automatically, its prospect and Gmail activity are checked again. A changed address, reply, bounce, exclusion, or opt-out cancels that draft's automatic delivery.
- Every terminal outcome is written to `Historique envois` to prevent duplicate drafts.
- Gmail reconciliation updates `Prospects!last_sent_email_at` and `Prospects!replied_at` from actual Gmail messages. It runs in a rotating bounded batch every five minutes by default, including while draft creation is disabled.
- `activation_relance` is off by default. When enabled, the job creates up to `nombre_max_relances` drafts, capped at three, after `delai_relance_jours` business days since the latest confirmed send. Existing legacy `RELANCE_ENVOYEE` history is treated as relance 1. A pending draft, response, bounce, exclusion, or opt-out blocks the next step.
- Relance 1 keeps the existing copy selection: `corps_relance` when the first sent message mentioned the TST/course-test flow, or `corps_relance_premier_contact` for older presentation emails. Relances 2 and 3 use `corps_relance_2` and `corps_relance_3`; the third explicitly says it is the final message.
- After relance 3 has been sent and one final `delai_relance_jours` period has elapsed without a reply, the job records `PROSPECT_SANS_REPONSE`. The Sheet displays this as `SANS RÉPONSE` and stops the sequence.
- Gmail requires matching subjects to keep a reply in the same thread: when the latest sent subject already contains the organization name, the draft stays threaded; when it is generic or the older send came from Overloop, the job creates a standalone follow-up with `objet_relance`, personalized from `Organization name`.
- Public holidays are not excluded unless a holiday calendar is added explicitly; the business-day calculation currently skips weekends only.
- Initial and follow-up drafts share `limite_quotidienne` and `delai_entre_envois_minutes`.
- The scraper webhook never sends email and never changes contact/reply/exclusion fields on an existing prospect.
- Gmail signature icons outside the basic Unicode plane are encoded as HTML entities so Gmail preserves them in generated drafts.
- Every initial and follow-up draft includes a prospect-specific signed unsubscribe link. The link first displays a confirmation page; confirmation checks `Prospects!opted-out`, records `DESINSCRIPTION_CONFIRMEE` in `Historique envois`, and blocks later drafts for that prospect. `Template email!texte_desinscription` controls the visible link label, while `objet_relance` controls the standalone follow-up subject.

Run `uninstallOutreachJob` to delete the trigger without deleting the spreadsheet history.

If older follow-up drafts were created with a generic subject, run `repairFollowupDraftSubjects` manually once. It updates only the subjects of existing `RELANCE_BROUILLON_CREE` drafts, preserves recipients and bodies, and records `RELANCE_OBJET_REPARE` in `Historique envois`. Because Gmail only threads matching subjects, a repaired personalized draft can become a standalone conversation.
