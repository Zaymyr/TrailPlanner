---
title: OpenAI Organizer Import Reconciliation
scope: integration
last_verified: 2026-08-24
ai_priority: high
related_files:
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/reconciliation.test.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
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

`POST /api/organizer/events/[id]/website-import` is admin-only. For a preview, it first performs the existing deterministic website/PDF extraction, then sends the extracted event/formats, globally bounded roadbook text, and existing formats to OpenAI. Roadbook sampling preserves the beginning, middle, and end of long documents. Imported document text is explicitly treated as untrusted data, not as instructions. The model uses a strict Structured Outputs `json_schema` response and returns one `match`, `separate`, or `uncertain` decision per evaluated format, with typed field comparisons, rationale, and evidence.

The server then performs semantic validation beyond JSON shape: every preview key must appear exactly once, a target cannot be reused, `match` requires a valid target, `separate` forbids one, typed field values must match their contract, and high confidence requires evidence. Only a valid high-confidence match may prefill an existing target format. Medium and low confidence decisions are displayed for review only.

The model never supplies a database write value. Deterministic extraction creates typed event/format proposals; LLM output may enrich their evidence and recommendation only. The preview returns a canonical proposal snapshot bound to the event and preview hash, signed server-side with HMAC and expiring after 30 minutes. Apply accepts only proposal ids selected by the admin from that signed snapshot, with at most one selected proposal per field. A create requires selected name, date, distance, and D+ proposals; an update requires an explicit target in the selected edition. Document-only review is supported by comparing PDF findings with synthetic preview cards for existing formats.

The dashboard displays document findings, evidence, comparisons, alternatives, reconciliation status, and field-level checkboxes. Recommended choices are preselected but remain editable. A failed reconciliation exposes a sanitized provider reason while leaving the deterministic preview available. No client receives the OpenAI key or HMAC secret.

## Environment Variables

- `OPENAI_API_KEY`: server-only API credential.
- `OPENAI_ORGANIZER_IMPORT_MODEL`: optional model override; defaults to `gpt-4.1-mini`.

## Gotchas

- Do not let the LLM create, publish, or directly patch event/format rows.
- Do not use a distance tolerance alone to merge distinctively named formats; anonymous or rounded compatible detections may still be consolidated conservatively.
- Keep roadbook text bounded before sending it to the provider, and do not retain the temporary upload after analysis.
- Treat an unavailable or invalid LLM response as a preview warning or failure, never as permission to invent a deterministic match.
- Never apply raw client values from the review payload. Verify the canonical signed snapshot, expiry, preview hash, proposal scope, target edition, and selected ids first.

## Related Docs

- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Web App](../01-architecture/web-app.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
