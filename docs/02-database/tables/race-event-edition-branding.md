---
title: race_event_edition_branding
scope: database
last_verified: 2026-09-09
ai_priority: high
related_files:
  - supabase/migrations/20260907171043_add_racebook_edition_branding.sql
  - supabase/tests/racebook_branding_checks.sql
  - apps/web/lib/racebook-branding.ts
  - apps/web/lib/racebook-branding.test.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.test.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/api/racebook-sponsors/route.test.ts
  - apps/web/app/organizer/_components/dashboard/branding-editor.tsx
  - apps/mobile/lib/racebookSponsorPresentation.ts
  - apps/mobile/lib/racebookSponsors.ts
  - apps/mobile/app/(app)/race/[id]/racebook.tsx
  - packages/design-system/src/branding.ts
related_tables:
  - race_event_edition_branding
  - race_event_editions
  - organizer_edition_entitlements
---

# `race_event_edition_branding`

## Purpose

Stores one draft and one published RaceBook identity for a canonical event edition. Every format attached to that edition uses the same published colors; logo data is retained but its editor and runner presentation are temporarily disabled.

## Key Concepts

- The organizer portal edits the draft and previews it locally.
- Publication atomically copies all draft values to the published fields.
- Runner and mobile preview payloads expose only published color values. `RACEBOOK_EDITION_LOGO_ENABLED` currently forces the resolved logo to `null` without deleting stored draft or published URLs.
- Editing and publication require the Signature `branding.manage` capability and an active `branding` module. A downgrade or module deactivation masks the published identity without deleting it.
- Pace Yourself keeps typography, neutral surfaces, navigation, layout, sponsor placements, and semantic danger/warning/info colors.

## Columns

| Column | Rules | Meaning |
| --- | --- | --- |
| `edition_id` | UUID primary key, edition FK with cascade | Shared edition scope and one-row uniqueness. |
| `draft_logo_url` | nullable HTTPS URL | Organizer working logo. |
| `draft_primary_color` | `#RRGGBB`, default `#2D5016` | Working interaction color. |
| `draft_accent_color` | `#RRGGBB`, default `#B45309` | Working graphic and decorative-surface accent. |
| `published_logo_url` | nullable HTTPS URL | Preserved published logo, dormant while the shared feature flag is disabled. |
| `published_primary_color` | nullable `#RRGGBB` | Runner-visible interaction color after publication. |
| `published_accent_color` | nullable `#RRGGBB` | Runner-visible graphic accent after publication. |
| `published_at` | nullable timestamp | Explicit publication marker. |
| `created_at`, `updated_at` | UTC timestamps | Audit fields. |

The published-state constraint keeps all published values null before first publication and requires both colors when `published_at` is present.

## Foreign Keys

- `edition_id -> race_event_editions.id on delete cascade`

Edition and event deletion routes collect branding Storage paths before the database cascade, then delete the orphaned objects after a successful database mutation.

## Indexes

The primary key on `edition_id` is the only lookup required and enforces one branding row per edition.

## RLS Policies

RLS is enabled with no client policies. `PUBLIC`, `anon`, and `authenticated` have no table privileges or publish-function execution. Only `service_role` can read or mutate the row and execute the invoker-security publication function. Organizer routes separately verify the session, active parent-event membership, edition ownership, and Pro capability.

## Business Invariants

- Colors accept exactly six hexadecimal digits and are normalized to uppercase at the API boundary.
- Logos accept PNG, JPEG, WebP, or AVIF only, must match their binary signature and declared MIME type, and cannot exceed 5 MB.
- Logos live in `race-images/organizer-branding/{editionId}/`.
- Replaced unpublished logos, superseded published logos, and logos belonging to deleted editions/events are removed from Storage when no draft or published field still references them.
- `publish_racebook_edition_branding(uuid)` copies logo and both colors in one SQL update and timestamps the publication.
- The additive public sponsors payload always includes defaults when no valid published identity exists.
- The shared design-system resolver chooses black or white primary text by contrast and derives light surfaces/borders from both colors. Accent now covers route/progress graphics plus related non-semantic cards and positive information highlights; warning, danger and information semantics keep Pace Yourself colors.

## Common Queries

```sql
select draft_logo_url, draft_primary_color, draft_accent_color,
       published_logo_url, published_primary_color, published_accent_color, published_at
from race_event_edition_branding
where edition_id = :edition_id;
```

## Gotchas

- Never return draft columns from a runner-facing route.
- Do not grant direct mobile/browser access to this table; the existing server route is the compatibility and authorization boundary.
- Do not delete a logo still referenced by either the draft or the published state.
- Sponsor logos and organizer-branding logos use separate Storage prefixes. Edition-logo controls and rendering are dormant behind `RACEBOOK_EDITION_LOGO_ENABLED`; do not delete stored URLs merely because the flag is off.
- Invalid/missing branding and image load failures must fall back silently to the Pace Yourself theme.
- Branding mutation requires an active Signature entitlement and active `branding` module. Inactive or locked branding remains stored but the runner bootstrap returns the Pace Yourself defaults.

## Related Docs

- [race_event_editions](race-event-editions.md)
- [Organizer Commercial Offers](../../03-business-rules/organizer-commercial-offers.md)
- [Organizer Race Management](../../03-business-rules/organizer-race-management.md)
- [Mobile App](../../01-architecture/mobile-app.md)
- [Design Tokens](../../07-design-system/tokens.md)
