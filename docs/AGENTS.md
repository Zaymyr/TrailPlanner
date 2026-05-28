# AI Assistant Entry Point

> **You are an AI agent working on Pace Yourself.**
> Read this entire file before doing anything. The Documentation Maintenance Protocol below is a hard rule. If a task seems to conflict with these rules, ASK before proceeding.

Read this first when working in Pace Yourself. Then route yourself to the smallest relevant doc set.

## Documentation Maintenance Protocol

**This is a hard rule. Violation invalidates the task.**

### The trigger

Before completing any task, for EVERY file you intend to modify, run this mental check:

> "Is this file path listed in the `related_files` frontmatter of any doc in `docs/`?"

To answer, scan all .md files in `docs/` for their frontmatter. The convention is:

```yaml
---
related_files:
  - apps/web/lib/auth/session.ts
  - apps/web/lib/auth/usePremium.ts
---
```

If any file you modify appears in any `related_files` list → the doc(s) referencing it MUST be updated in the same commit.

### What "updating a doc" means

Updating a doc is NOT just bumping the date. It requires, in order:

1. **Re-read the doc end-to-end.**
2. **Verify every code reference still exists** at the cited path (line numbers may have shifted — that's fine, paths must resolve).
3. **Confirm no business rule described is contradicted** by your code change. If yes, rewrite the affected section.
4. **Update the "Gotchas" section** if your change introduces a new pitfall or removes an old one.
5. **Update `related_files`** if your change adds or removes a relevant file.
6. **Bump `last_verified` to today's date** — but ONLY after steps 1–5 are done.

### When you CANNOT confirm

If you modified a referenced file but cannot fully verify the doc (out of context, unclear business intent, etc.):
- Do NOT bump `last_verified`.
- Add a `<!-- NEEDS REVIEW: <date> — <reason> -->` marker at the top of the affected section.
- Mention it explicitly in your final response so the maintainer knows.

### When a NEW doc is needed

If your task introduces:
- A new database table → create `docs/02-database/tables/<table-name>.md`
- A new business rule with no existing doc → create in `docs/03-business-rules/`
- A new integration → create in `docs/05-integrations/`
- A new auth pattern → create in `docs/04-auth-and-security/`

Use the frontmatter template from `docs/_conventions.md`. Cross-link from `docs/README.md` and `docs/AGENTS.md` routing table.

### Anti-patterns (DO NOT DO)

❌ Bumping `last_verified` without re-reading the doc.
❌ Updating only one doc when multiple list the same file in `related_files`.
❌ Saying "I'll update the doc later" — it must be the same commit.
❌ Deleting `<!-- TODO -->` or `<!-- NEEDS REVIEW -->` markers without resolving them.
❌ Treating doc updates as a separate commit (they belong with the code change).

### Examples

**Example 1 — code change triggers doc update:**

You modify `apps/web/lib/nutrition/allocate.ts`. This file is in `related_files` of `docs/03-business-rules/nutrition-algorithm.md`.
→ You must re-read that doc, verify the allocation order described still matches your code, update the description if it changed, bump `last_verified`. Commit both files together.

**Example 2 — code change does NOT trigger doc update:**

You fix a typo in a UI label in `apps/mobile/components/RaceCard.tsx`. This file is in no doc's `related_files`.
→ No doc update needed.

**Example 3 — partial verification:**

You modify `apps/web/lib/auth/session.ts`, which is referenced by `docs/04-auth-and-security/session-management.md`. You're confident about the auth flow change but unsure if the "Race conditions" section is still accurate.
→ Update the parts you're sure about. Add `<!-- NEEDS REVIEW: 2026-05-17 — race conditions section not verified after refactor -->` above the unsure section. Do NOT bump `last_verified`. Flag it in your task summary.

## Quick Task Routing

| Task type | Read first |
|---|---|
| Database changes | `docs/02-database/` + `docs/04-auth-and-security/rls-checklist.md` |
| Auth / session work | `docs/04-auth-and-security/` + `docs/03-business-rules/trial-lifecycle.md` |
| Business logic changes | `docs/03-business-rules/` |
| Organizer portal / race organizer claims | `docs/03-business-rules/organizer-race-management.md` + `docs/02-database/` + `docs/01-architecture/web-app.md` |
| Integration work (Stripe, Resend, Edge Functions) | `docs/05-integrations/` |
| Mobile-specific work | `docs/01-architecture/mobile-app.md` + `docs/06-workflows/add-new-screen-mobile.md` |
| Design system changes | `docs/07-design-system/` |
| New feature shipping | `docs/06-workflows/ship-a-feature.md` |

## If You Are Working On Database Changes, Read:

- `docs/02-database/schema-overview.md`
- `docs/02-database/relationships.md`
- `docs/02-database/rls-policies.md`
- `docs/02-database/migrations.md`
- Relevant table doc in `docs/02-database/tables/`
- Workflow: `docs/06-workflows/add-new-table.md` or `docs/06-workflows/add-rls-policy.md`

## If You Are Working On Auth/Session, Read:

- `docs/04-auth-and-security/auth-flows.md`
- `docs/04-auth-and-security/session-management.md`
- `docs/04-auth-and-security/duplicate-events-pattern.md`
- `docs/04-auth-and-security/rls-checklist.md`
- `docs/03-business-rules/trial-lifecycle.md`
- `docs/03-business-rules/premium-entitlement.md`

## If You Are Implementing A Business Rule, Read:

- Nutrition: `docs/03-business-rules/nutrition-algorithm.md`
- Pacing: `docs/03-business-rules/pacing-algorithm.md`
- GPX: `docs/03-business-rules/gpx-import.md`
- Premium: `docs/03-business-rules/premium-entitlement.md`
- Trial: `docs/03-business-rules/trial-lifecycle.md`
- Organizer race management: `docs/03-business-rules/organizer-race-management.md`
- Plan persistence: `docs/03-business-rules/plan-storage.md`

## If You Are Working On Web, Read:

- `docs/01-architecture/web-app.md`
- Relevant business/auth/database docs above
- `docs/07-design-system/components.md` for UI primitives

## If You Are Working On Mobile, Read:

- `docs/01-architecture/mobile-app.md`
- `docs/06-workflows/add-new-screen-mobile.md`
- `docs/05-integrations/analytics.md`
- `docs/03-business-rules/premium-entitlement.md`

## If You Are Working On Integrations, Read:

- Stripe: `docs/05-integrations/stripe.md`
- Resend Broadcasts: `docs/05-integrations/resend-broadcasts.md`
- Mulebar catalog scraping: `docs/05-integrations/mulebar-scraping.md`
- RevenueCat context: `docs/03-business-rules/premium-entitlement.md`
- Supabase functions: `docs/05-integrations/supabase-edge-functions.md`
- Analytics: `docs/05-integrations/analytics.md`
- Email/Resend status: `docs/05-integrations/resend.md`

## If You Are Working On Design System, Read:

- `docs/07-design-system/tokens.md`
- `docs/07-design-system/icons.md`
- `docs/07-design-system/components.md`
- `packages/design-system/ICONS.md`

## Hard Rules

- Migrations are schema truth. `docs/_archive/db/schema.sql` is historical.
- Never query `auth.users` from client code. Use server/service role or SECURITY DEFINER functions.
- New RLS admin checks must use trusted `app_metadata`, profile/server checks, or service role. Do not use `user_metadata`.
- Service-role keys stay server-side or in Supabase functions only.
- `race_plans.planner_values` is durable planner JSON; `elevation_profile` is stored separately.
- Trial duration is 15 days in current code/migrations.
- `products` has no `water_ml`; water demand is segment/carry context.
- Onboarding plan save must remain idempotent across duplicate auth/session events.
- Preserve anonymous Supabase user ownership behavior for guest plan flows.
- When code and archived docs conflict, document the conflict and follow code/migrations.

## Forbidden Patterns

```sql
-- Do not add this in new policies.
(auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
```

```ts
// Do not expose service role to client/mobile code.
process.env.SUPABASE_SERVICE_ROLE_KEY
```

```sql
-- Do not resurrect old catalog names in new code.
select * from public.race_catalog;
```

```ts
// Do not save onboarding plan on every auth event without guards.
supabase.auth.onAuthStateChange((_event, session) => savePlan(session));
```

## Known Verification Gaps

- `race_events` is used by code, but its create-table migration is not visible in this repo.
- Some code references race/import review columns not visible in migrations.
- Stripe product and active price IDs are env/dashboard facts, not repo constants.
- Resend currently has admin Contacts sync, authenticated identified-user contact sync, and a Broadcast draft playbook; production transactional email ownership is still maintainer-confirmation territory.

## When Unsure

Ask before assuming when a fact is not traceable to code or migrations. If you must write a doc with uncertainty, use a maintainer-verification TODO comment or a `<!-- CONFLICT: ... -->` marker.
