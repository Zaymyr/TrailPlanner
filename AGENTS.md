# AGENTS.md

This repository is Pace Yourself — a trail race planning SaaS (Next.js + Expo + Supabase).

## Mandatory reading order

Before doing ANY task in this repo, read in this order:
1. `docs/AGENTS.md` — full agent routing and protocols
2. `docs/README.md` — documentation table of contents
3. Any doc in `docs/` whose `related_files` frontmatter lists a file you intend to modify

## Hard rules (non-negotiable)

1. **Documentation Maintenance Protocol** — see `docs/AGENTS.md` § "Documentation Maintenance Protocol". Any modification to a file listed in a doc's `related_files` MUST be accompanied by an update to that doc in the same commit.

2. **No preview, no plan-only output** — apply changes directly to files. The user explicitly does not want previews.

3. **Never invent** — file paths, schema fields, business rules. If unsure, search the code or add `<!-- TODO: verify with maintainer -->` markers.

4. **Branch discipline** — feature work goes on `dev/*` branches, never directly on `main`.

5. **Supabase auth** — admin role is in `auth.users.raw_app_meta_data` (JWT claims), NOT in `user_profiles.role`. RLS policies reference `app_metadata`, not `user_metadata`.

6. **UI component reuse-first** — before creating a UI component, search existing components in `apps/web/components`, the local `_components` folder, and package design-system exports. Reuse or extend an existing component when it fits; keep new components at the narrowest scope until they are used by multiple screens.

7. **Progressive context first** - start with the smallest reliable context: the active file, direct imports, the nearest relevant test, and the minimum required docs. Prefer targeted search before opening whole files. Expand to broader tests, related docs, or shared code as soon as uncertainty remains or contracts, security, schema, business rules, or regression risk require it.

## Quick task routing

| Task type | Read first |
|---|---|
| Database / migration | `docs/02-database/` + `docs/04-auth-and-security/rls-checklist.md` |
| Auth / session | `docs/04-auth-and-security/` |
| Business logic (nutrition, pacing, GPX) | `docs/03-business-rules/` |
| Stripe / Resend / Edge Functions | `docs/05-integrations/` |
| Resend broadcast email | `docs/05-integrations/resend-broadcasts.md` + `docs/05-integrations/resend.md` |
| Mulebar catalog scraping | `docs/05-integrations/mulebar-scraping.md` |
| Mobile screen | `docs/01-architecture/mobile-app.md` + `docs/07-design-system/` |
| New feature | `docs/06-workflows/ship-a-feature.md` |
