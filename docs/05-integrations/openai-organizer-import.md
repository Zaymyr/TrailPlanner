---
title: OpenAI Organizer Import Reconciliation
scope: integration
last_verified: 2026-09-03
ai_priority: high
related_files:
  - apps/web/lib/organizer-source-intelligence.ts
  - apps/web/lib/organizer-source-intelligence.test.ts
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-engine.test.ts
  - apps/web/lib/organizer-document-import.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/reconciliation.test.ts
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.test.ts
related_tables:
  - race_events
  - races
---

# OpenAI Organizer Import Reconciliation

## Purpose

This integration lets a trusted admin reconcile website, roadbook, and existing format information before manually applying an organizer import.

## Key Concepts

- Format candidate: evidence that one format exists, independently from the completeness of its fields.
- Source claim: one typed field value with source, edition, URL or document page, verbatim evidence, confidence, and role (`candidate`, `current`, or historical `reference`).
- Field resolution: the current claim and all alternatives for one event/format field, classified as resolved, conflicting, or missing.
- LLM selection: a transient choice of an existing applicable `claimId`, or `uncertain`; it is never a new value.

## Flow

`POST /api/organizer/events/[id]/website-import` is admin-only and separates discovery from enrichment. Discovery first returns every credible format candidate, including incomplete ones. Completeness and the former quality score remain review signals only: they cannot erase a format whose existence has been confirmed. Candidate consolidation requires compatible normalized identity evidence; distance proximity by itself never merges two detections or selects an existing format.

The source step treats the main URL and `additionalUrls` as official evidence pages, not as a list of formats. Automatic exploration remains same-origin and capped; explicitly added pages may be event overviews, one or several formats, regulations, schedules, logistics, registrations, result archives, or another official source. Generic HTML is cleaned deterministically first. Text PDFs join the same bounded intelligence pass after local extraction, while scanned/image-only documents still report `ocr-pending`.

Each source is classified heuristically into one of those roles. OpenAI is requested only for classifications that remain ambiguous, incomplete, or assertion-free. A request contains at most 21 source inputs so the main URL, twelve explicit additions, and eight documents can all remain represented; the shared text budget stays capped at 48,000 characters with at most 12,000 for one source. Long inputs are sampled across their beginning, middle, and end. Strict Structured Outputs return a role plus grounded assertions; server validation requires every evidence excerpt, value, list item, and named format to occur in that exact source. Registration, results/archive, other, and unusable roles stay visible in the audit but cannot create formats or field claims. The analysis is cached in memory for 30 minutes by SHA-256 of the bounded content and model, with at most 64 entries, and its signed claims are reused after format confirmation instead of calling OpenAI again.

After the admin confirms the format count and bindings, deterministic extraction emits source claims for website, structured data, GPX, paginated roadbook findings, current Organizer values, and previous-edition reference values. A PDF finding keeps the matched datum inside a centered excerpt capped at 2,000 characters for evidence and 500 for its typed value. Equivalent document claims are deduplicated and capped at eight per scope and field for each document before reconciliation. Field grouping uses symmetric concordance tolerances of `max(0.5 km, 2%)` for distance and `max(100 m, 8%)` for D+/D-. A previous-edition claim is contextual only and cannot be selected automatically.

OpenAI is called only for field resolutions containing incompatible applicable claims. The strict Structured Outputs schema contains no output value: every response must return exactly one decision per requested `resolutionId`, either `select` with a `selectedClaimId` already present in that resolution, or `uncertain` with no claim. Server-side semantic validation rejects missing/duplicate resolutions, invented claim ids, and attempts to select historical reference claims. Imported text remains wrapped as untrusted source data.

The deterministic report remains usable if OpenAI is unavailable or abstains. It groups the event and each confirmed format separately, counts safe/review/conflict/missing fields, and keeps the current value beside every alternative, source, edition, document page, evidence, and confidence. An LLM choice is visibly recommended but remains unselected when claims conflict. Only a high-confidence, non-conflicting candidate that fills a missing current value is eligible for preselection. Confirmation may retain missing fields and create an incomplete draft format. No client receives the OpenAI key.

Edition visibility and deletion remain ordinary organizer controls outside the LLM workflow. Deleting an edition cascades any import sessions scoped to it; a stale review can therefore no longer apply after deletion.

Every dated format persisted by a service-side import must resolve to a canonical `race_event_editions` row. The database assignment trigger repairs a missing event/year edition atomically; the LLM never chooses an edition id or billing target.

After import, manual format-specific bib-pickup, equipment, and access overrides use the ordinary race-details autosave path. They are not import claims and must remain durable when the admin leaves and reopens a format.

## Environment Variables

- `OPENAI_API_KEY`: server-only API credential.
- `OPENAI_ORGANIZER_IMPORT_MODEL`: optional model override; defaults to `gpt-4.1-mini`.

## Gotchas

- The self-service complex import route remains admin-only. Pro organizers receive an assisted-import contact CTA; Pro does not authorize direct LLM import execution.

- Do not let the LLM create, publish, or directly patch event/format rows.
- Do not treat `additionalUrls` as asserted format identities. Only grounded named-format evidence from a compatible source role may add a candidate; unnamed distance observations remain unscoped.
- Keep source text, source count, cache lifetime, and assertion count bounded before the provider call. Provider failures, invalid JSON, ungrounded evidence, or hallucinated format names must fall back to deterministic analysis.
- Do not use distance, including an exact or rounded match, as the only evidence for candidate consolidation or existing-format binding.
- Keep roadbook excerpts and per-field claim counts bounded and deduplicated before schema validation or provider calls, so verbose multi-page PDFs cannot reject the complete discovery. Retain the temporary upload only for the active two-pass session, then delete it on apply, cancel, or expiry cleanup.
- Preserve document page numbers in claims when the PDF parser exposes them. Unscoped format findings remain observations until a confirmed format can be identified conservatively.
- Treat an unavailable, invalid, or `uncertain` LLM response as a review state, never as permission to invent a choice.
- Never apply raw client values from the review payload. Verify the event/edition/session-bound signed field snapshot, expiry, field scope, target format, and selected claim ids first.
- Never let an import proposal change edition visibility or request deletion. Those destructive controls require their dedicated membership-checked route and explicit organizer confirmation.

## Related Docs

- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Web App](../01-architecture/web-app.md)
- [RLS Checklist](../04-auth-and-security/rls-checklist.md)
