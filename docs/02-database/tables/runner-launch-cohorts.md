---
title: runner_launch_cohorts Table
scope: database
last_verified: 2026-11-02
ai_priority: high
related_files:
  - supabase/migrations/20261102063210_add_runner_launch_grandfathering.sql
  - supabase/tests/runner_launch_checks.sql
  - apps/web/app/api/runner/launch/route.ts
related_tables:
  - runner_launch_cohorts
---

# `runner_launch_cohorts`

## Purpose

Stores the launch snapshot for identified accounts eligible for the cosmetic “Soutien de la première heure” badge and the bounded seven-day launch announcement.

## Contract

- Production activation captured 422 identified accounts at `2026-11-02 06:32:21.546733+00`; anonymous accounts were excluded.
- One row exists per identified account captured by service-only launch activation, whether or not that account owns a plan.
- Grandfathered plan access is a separate snapshot in `runner_launch_grandfathered_plans`. Cohort membership alone never implies that the runner had a plan.
- `early_supporter` is presentation/cohort state, not a billing or access entitlement.
- Direct client access is revoked; the service role reads and manages rows for the authenticated launch endpoint.
- The authenticated launch endpoint returns only the bounded eligibility/badge projection needed by the app.

## Gotchas

- Badge/cohort state never creates a purchase, unlock, trial, grant, or Premium access.
- Announcement acknowledgement is device-local campaign state, not a column in this table.

## Related Docs

- [Runner Monetization](../../03-business-rules/runner-monetization.md)
