---
title: runner_launch_cohorts Table
scope: database
last_verified: 2026-10-31
ai_priority: high
related_files:
  - supabase/migrations/20261031092049_add_runner_launch_grandfathering.sql
  - supabase/tests/runner_launch_checks.sql
  - apps/web/app/api/runner/launch/route.ts
related_tables:
  - runner_launch_cohorts
---

# `runner_launch_cohorts`

## Purpose

Stores the launch snapshot for identified accounts eligible for the cosmetic “Soutien de la première heure” badge and the bounded seven-day launch announcement.

## Contract

- One row per identified account captured by service-only launch activation; anonymous accounts are excluded.
- `early_supporter` is presentation/cohort state, not a billing or access entitlement.
- Users may read only their own row; service role manages it.
- The authenticated launch endpoint returns only the bounded eligibility/badge projection needed by the app.

## Gotchas

- Badge/cohort state never creates a purchase, unlock, trial, grant, or Premium access.
- Announcement acknowledgement is device-local campaign state, not a column in this table.

## Related Docs

- [Runner Monetization](../../03-business-rules/runner-monetization.md)
