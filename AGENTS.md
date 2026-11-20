# AGENTS.md

## Context hub

Before any task, read `docs/context/README.md` and the files it lists (project, decisions, data model, ops). When a task changes the data model, update `docs/context/DATA-MODEL.md` in the same commit; when a task implements a decision, add it to `docs/context/DECISIONS.md`. Both obligations are part of the Documentation Maintenance Protocol (`docs/AGENTS.md`). Task tracking lives in the Claude Sheet "Pace Yourself — Suivi de projet", not in the repo.

This repository is Pace Yourself — a trail race planning SaaS (Next.js + Expo + Supabase).

This file is the canonical entry point for every AI assistant. Tool-specific instruction files must only redirect here and must not maintain a separate copy of project rules.

## Mandatory reading order

Before doing ANY task in this repo, read in this order:
1. This entire file
2. `docs/context/README.md` and the context files it lists
3. `docs/AGENTS.md` — full agent routing and protocols
4. `docs/README.md` — documentation table of contents
5. Any doc in `docs/` whose `related_files` frontmatter lists a file you intend to modify

## Task-start preflight

Before fetching, switching branches, editing, generating files, or installing dependencies:

1. Run `git status --short --branch`.
2. Treat every existing modification and untracked file as user-owned unless the current task clearly created it.
3. Never discard, overwrite, clean, reset, stash, or include pre-existing changes in the task commit without the user's explicit approval.
4. If pre-existing changes make the required branch switch unsafe, stop and ask the user. If Git can switch safely while preserving them, leave them untouched and exclude them from the task diff and commit.
5. After this safety check, create the task branch from the latest `origin/main` as required below.

## Hard rules (non-negotiable)

1. **Documentation Maintenance Protocol** — see `docs/AGENTS.md` § "Documentation Maintenance Protocol". Any modification to a file listed in a doc's `related_files` MUST be accompanied by an update to that doc in the same commit.

2. **No preview, no plan-only output** — apply changes directly to files. The user explicitly does not want previews.

3. **Never invent** — file paths, schema fields, business rules. If unsure, search the code or add `<!-- TODO: verify with maintainer -->` markers.

4. **Branch discipline** — every new task MUST start on a new `dev/*` branch created from the latest `origin/main` (`git fetch origin` then `git switch -c dev/<task-name> origin/main`). Never work directly on `main`, reuse a branch from an already merged or closed pull request, or continue new work on a previous task branch. One task = one `dev/*` branch = one pull request into `main`; every commit of the task goes to that same PR, which is validated on its own Vercel Preview and on the `development` OTA it publishes. **Merging into `main` is the production release**: `.github/workflows/release.yml` applies migrations, deploys web production and publishes the production OTA without further approval, so never merge a PR that was not validated, and never merge or push to `main` without the user's explicit go. Do not mix unrelated changes in one PR. Full flow and guards: `docs/06-workflows/release-flow.md`.

5. **Worktree and scope discipline** — sequential work uses the primary repository checkout and switches `dev/*` branches in that same directory. Parallel agent work is allowed when each agent has its own registered worktree, its own `dev/*` branch, and a file scope claimed before its first edit with `node scripts/agent-scope.mjs claim <task> <paths>`; a claim that overlaps another active claim fails and the agent must ask the user instead of editing. `docs/` is never part of a scope: each branch updates the docs its code requires, and docs edited by several branches are reconciled at integration. Only one agent may write in a given worktree. Full protocol: `docs/06-workflows/agentic-development.md` § "Parallel agent work". Before any push to `main` or production promotion, audit every path returned by `git worktree list --porcelain`; any uncommitted change or local commit absent from all remotes blocks the push until it is committed and pushed, integrated, or explicitly abandoned by the user.

6. **Supabase auth** — admin role is in `auth.users.raw_app_meta_data` (JWT claims), NOT in `user_profiles.role`. RLS policies reference `app_metadata`, not `user_metadata`.

7. **UI component reuse-first** — before creating a UI component, search existing components in `apps/web/components`, the local `_components` folder, and package design-system exports. Reuse or extend an existing component when it fits; keep new components at the narrowest scope until they are used by multiple screens.

8. **Progressive context first** - start with the smallest reliable context: the active file, direct imports, the nearest relevant test, and the minimum required docs. Prefer targeted search before opening whole files. Expand to broader tests, related docs, or shared code as soon as uncertainty remains or contracts, security, schema, business rules, or regression risk require it.

9. **Verification and handoff** — run targeted checks while working and `npm run verify` before handoff unless the task is documentation-only or the full gate cannot run. In those cases, run the smallest relevant checks and report exactly what was and was not verified. Always report the branch name, changed files, verification results, and any preserved pre-existing changes.

## Delegation and model economy

- Model capability should be treated as a scarce resource. Use stronger models where their additional reasoning materially improves the expected result, not merely because they are available.
- Handle small, clear changes directly. Delegate only bounded work that is genuinely independent, benefits from parallelism, or keeps noisy exploration and verification out of the primary context.
- Use the light tier for targeted exploration and mechanical work, the standard tier for clearly specified implementation, the strong tier for orchestration, integration, difficult development, and high-risk review, and the exceptional tier only for exceptional cross-domain architecture or a material problem the strong tier cannot resolve.
- Each assistant maps these tiers to its own models and role files; keep both mappings aligned when a role changes:

| Tier | Role | Codex (`.codex/agents/`) | Claude Code (`.claude/agents/`) |
|---|---|---|---|
| Light | explorer (read-only) | Luna, low effort | `haiku`, low effort |
| Standard | developer | Terra, medium effort | `sonnet`, medium effort |
| Strong | senior developer | Sol, medium effort | `opus`, medium effort |
| Strong | reviewer (read-only) | Sol, high effort | `opus`, high effort |
| Exceptional | architect (read-only) | Astra, xhigh effort | `fable`, xhigh effort |

- Give every delegated agent a compact handoff: objective, relevant current and expected behavior, the file scope it owns, constraints and patterns, acceptance criteria, and pertinent tests. Do not ask multiple agents to repeat the same repository scan.
- Execution agents must escalate material ambiguity, unexpected scope, architectural conflicts, security or data-integrity concerns, and risky migrations to the strong tier. The strong tier escalates to the exceptional tier only when the decision is genuinely architectural and unusually complex.
- Parallelize only work whose file scopes do not overlap, following the worktree and scope discipline above. Keep review and tests proportional to risk, and stop review-correction loops once acceptance criteria are met and relevant checks pass.
- All delegated agents inherit and must preserve the repository instructions, documentation protocol, and domain rules in this file and `docs/AGENTS.md`; role-specific configuration never overrides them.

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
| New feature | `docs/06-workflows/ship-a-feature.md` + `docs/06-workflows/release-flow.md` |
| AI implementation, review, or handoff | `docs/06-workflows/agentic-development.md` + `docs/06-workflows/ship-a-feature.md` |
| Parallel agents / file-scope claims | `docs/06-workflows/agentic-development.md` § "Parallel agent work" |
