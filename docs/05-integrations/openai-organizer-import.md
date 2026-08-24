---
title: OpenAI Organizer Import Reconciliation
scope: integration
last_verified: 2026-08-24
ai_priority: high
related_files:
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
related_tables:
  - race_events
  - races
---

# OpenAI Organizer Import Reconciliation

## Purpose

This integration lets a trusted admin reconcile website, roadbook, and existing format information before manually applying an organizer import.

## Key Concepts

- Reconciliation: semantic comparison of imported formats against existing formats.
- Evidence: supplied source text or structured facts cited by the model for each decision.
- Proposal: transient LLM output that never writes event or format data by itself.

## Flow

`POST /api/organizer/events/[id]/website-import` is admin-only. For a preview, it first performs the existing deterministic website/PDF extraction, then sends the extracted event/formats, bounded roadbook text, and existing formats to OpenAI. The model returns validated JSON containing a summary, warnings, and one `match`, `separate`, or `uncertain` decision per evaluated format. Each decision includes a field-level comparison whose action is `add`, `replace`, `keep`, or `unknown`, with current/imported values, rationale, and evidence.

Only a `match` with `high` confidence may prefill an existing target format. The admin can still change every selection before applying the import. Medium and low confidence decisions are displayed for review only. The normal server-side schema, edition-range, and score checks remain authoritative.

The preview always shows the LLM execution state: completed, not executed because `OPENAI_API_KEY` is missing, or failed. A failed reconciliation now exposes a sanitized provider reason such as invalid key, quota/rate limit, missing model, malformed JSON, or another HTTP failure. A failed reconciliation leaves the deterministic preview available and explicitly states that no LLM proposal was used. No client receives the OpenAI key.

## Environment Variables

- `OPENAI_API_KEY`: server-only API credential.
- `OPENAI_ORGANIZER_IMPORT_MODEL`: optional model override; defaults to `gpt-4.1-mini`.

## Gotchas

- Do not let the LLM create, publish, or directly patch event/format rows.
- Do not use a distance tolerance alone to merge formats; the LLM decision must include evidence and remain admin-reviewable.
- Keep roadbook text bounded before sending it to the provider, and do not retain the temporary upload after analysis.
- Treat an unavailable or invalid LLM response as a preview warning or failure, never as permission to invent a deterministic match.

## Related Docs

- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Web App](../01-architecture/web-app.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)