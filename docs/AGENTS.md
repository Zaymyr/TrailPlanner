# AI Assistant Entry Point

Read this first when working in Pace Yourself. Then route yourself to the smallest relevant doc set.

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
- No Resend implementation was found in repo code.

## When Unsure

Ask before assuming when a fact is not traceable to code or migrations. If you must write a doc with uncertainty, use a maintainer-verification TODO comment or a `<!-- CONFLICT: ... -->` marker.
