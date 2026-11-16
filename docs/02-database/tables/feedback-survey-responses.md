---
title: feedback_survey_responses Table
scope: database
last_verified: 2026-11-16
ai_priority: medium
related_files:
  - supabase/migrations/20261116180000_add_feedback_surveys.sql
  - supabase/tests/feedback_survey_checks.sql
  - apps/mobile/lib/userNotifications.ts
  - apps/mobile/components/feedback/FeedbackSurveyForm.tsx
  - apps/web/lib/feedback-surveys.ts
related_tables:
  - feedback_survey_responses
  - feedback_survey_campaigns
  - user_notifications
---

# feedback_survey_responses Table

## Purpose

A runner's answer to a feedback survey message: "Did you find the app useful?" (yes/no), "What was useful?" and "What was missing?" (optional free text). Admins read them in "Messagerie > Questionnaires".

## Columns

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key. |
| `notification_id` | uuid nullable | The `feedback_survey` notification answered; unique when set; set null if the notification row is deleted. |
| `campaign_id` | uuid nullable | Resolved by the trigger from the notification; set null if the campaign is deleted. |
| `user_id` | uuid | Respondent; cascades on Auth user deletion. |
| `found_useful` | boolean | Required answer. |
| `useful_text` / `missing_text` | text nullable | Trimmed by the trigger, empty becomes null, at most 2000 characters. |
| `app_version` | text nullable | Expo app version, at most 40 characters. |
| `platform` | text nullable | `ios`, `android` or `web`. |
| `created_at` | timestamptz | Set by the trigger. |

## RLS Policies And Privileges

- Authenticated runners insert only `notification_id, user_id, found_useful, useful_text, missing_text, app_version, platform` with `user_id = auth.uid()`.
- They select only `id, notification_id, found_useful, created_at` of their own rows, to know which surveys are answered. They cannot update or delete an answer.
- `anon` has no access; `service_role` has full access.

## Business Invariants

- `prepare_feedback_survey_response` (`BEFORE INSERT`, `SECURITY DEFINER`) refuses (`42501`) a notification that is not the runner's own `feedback_survey` message, then sets `campaign_id`, normalizes the free text and sets `created_at`. The client never chooses the campaign.
- One answer per survey: a second insert hits the unique index (`23505`), which the app reports as already answered.

## Gotchas

- The mobile insert uses the default minimal return; do not add `.select()` with text columns, they are not client-readable.
- Answers to a single-user test send (`audience_kind = 'single_user'`) are attached to that test campaign, so they never skew the results of the real campaign.
- Apply the migration before shipping the mobile update: older app versions show a survey as a plain Pace Yourself message (its body asks to update the app).

## Related Docs

- [feedback_survey_campaigns](feedback-survey-campaigns.md)
- [user_notifications](user-notifications.md)
- [Mobile App](../../01-architecture/mobile-app.md)
