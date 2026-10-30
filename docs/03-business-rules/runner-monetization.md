---
title: Runner Monetization
scope: business-rule
last_verified: 2026-10-30
ai_priority: high
related_files:
  - apps/mobile/components/plan-workspace/LockedPlanContent.tsx
  - apps/mobile/components/announcements/RunnerLaunchAnnouncement.tsx
  - apps/mobile/hooks/useRunnerLaunchAnnouncement.ts
  - apps/mobile/lib/runnerLaunchAnnouncement.ts
  - apps/mobile/lib/runnerLaunchAnnouncement.test.ts
  - apps/mobile/components/race-workspace/RaceWorkspaceSwitch.tsx
  - apps/mobile/lib/planPreviewBoundary.ts
  - apps/mobile/lib/planPreviewBoundary.test.ts
  - apps/web/lib/runner-access.ts
  - apps/web/lib/runner-access.test.ts
  - apps/web/app/api/plans/[id]/access/route.ts
  - apps/web/app/api/admin/runner-access-mode/route.ts
  - apps/web/app/api/runner/config/route.ts
  - apps/web/app/premium/page.tsx
  - apps/web/components/RunnerAdminAccessMode.tsx
  - apps/web/app/onboarding/RunnerOnboardingGate.tsx
  - apps/web/app/onboarding/layout.tsx
  - apps/web/app/(planner)/race-planner/components/RunnerProfileStep.tsx
  - apps/web/app/(planner)/race-planner/components/RunnerPlanPreview.tsx
  - apps/web/lib/profile-types.ts
  - apps/web/app/api/profile/route.ts
  - apps/mobile/lib/runnerPlanAccess.ts
  - apps/mobile/lib/runnerPlanAccess.test.ts
  - apps/mobile/lib/runnerProfile.ts
  - apps/mobile/lib/runnerProfile.test.ts
related_tables:
  - runner_plan_unlocks
  - runner_subscription_accounts
  - runner_purchase_intents
  - runner_plan_history
  - runner_monetization_config
  - runner_admin_access_modes
---

# Runner Monetization

## Purpose and task packet

Offer a useful free race estimate, then sell editable preparation for one format/edition or all courses. The change spans web, mobile, billing and database authorization. Organizer commercial offers are independent. Existing local UX work must be preserved. Billing activation requires product configuration, sandbox verification and review before production rollout.

## Commercial contract

| Access | Rights |
| --- | --- |
| Free identified account | Multiple saved estimates, total time, average pace, course context and nutrition needs. |
| Course purchase, EUR 9.99 reference public price | Lasting editable preparation for the same user, exact format and exact edition. Recreating a plan for that scope reuses the unlock. |
| Annual subscription, EUR 29.99 reference public price | Editable preparation for every course while the verified subscription is active. Better value from four races per year. |
| Expired subscription | Previously prepared detailed plans remain readable, while editing requires renewed access or a course purchase. |

The annual subscription auto-renews. A one-time purchase does not grant global Premium, does not transfer to a different format/edition and is revoked when its transaction is invalidated. No retrospective credit toward an annual subscription is implemented. Existing paid subscribers keep their original provider products and prices; historical application trials end normally and new accounts receive none.

## Account, profile and estimate

New plans require an identified account. Course selection survives authentication and the profile step. First name, comfortable flat pace, water capacity and carbohydrate target initialize the estimate; body metrics, birth date and UTMB index are optional. Profile information is prefilled and validated. Existing plans are not silently overwritten when a profile changes.

The algorithm uses its actual pace/capacity/target inputs; it must not claim that optional identity/body fields change the chrono without an implemented algorithm. The free view renders genuine calculated total duration, average pace and section needs. Contextual CTAs lead to pace adjustment or station-by-station nutrition preparation. Editable controls must not be mounted in a free preview.

The legacy web onboarding routes defer to the new planner while monetization is enabled. The authenticated profile API includes `birthDate`, `heightCm`, `weightKg` and `defaultCarbsGPerHour` alongside existing fields.

The mobile Livret coureur exposes `Créer mon plan` when no owned plan exists and `Affiner mon plan` otherwise. The shared switch remains below the collapsing heroes. In a locked preview, the real departure and its first following section are clear; remaining real course cards/sections remain scrollable but non-interactive and accessibility-hidden behind the implemented light veil. There is no cutoff or automatic paywall. One full CTA card (title, description and button) remains vertically centered in the usable area below headers/tabs and above the scroll bottom while scrolling, then returns inline at the top; measured geometry is clamped on small screens. Exactly one CTA is visible and accessibility-active. Visible first-sample edit/add/split actions and auto-fill open that same central paywall without mutation. A plan-specific paywall leads with the EUR 9.99 course purchase (provider price is authoritative) and offers EUR 29.99 annual access second; without a plan, annual remains primary.

The locked free Recap deliberately shows only total estimated time and average pace, plus `Voir le reste des statistiques`. Lower down, a passage preview shows real departure and subsequent public point names/distances but no paid times, with `Voir les temps de passage`. Both CTAs open the central paywall and never write, share, or activate access. Separately authorized historical detailed recap remains available.

The full centered CTA threshold is derived from real viewport/section/inline coordinates and measured pinned-tab bottom. A preview-only minimum height preserves that threshold for short courses, adding any space only after ghost cards; paid layout is unchanged. Geometry is scoped to `planId` so stale measurements cannot affect a later plan.

## Access and simulation

`GET /api/plans/{id}/access` verifies ownership, resolves the canonical `race:<race_id>:edition:<edition_id>` key (using `legacy` when no edition exists), and falls back to `plan:<id>` for unlinked historical plans. It returns editing and detailed-reading capabilities separately. Both UI and persistence must use those capabilities rather than treating every purchase as Premium.

Trusted admin free/premium modes remain observable even when the global monetization flag is off; the real mode retains legacy access. The admin selector uses `GET/PUT /api/admin/runner-access-mode` with `real`, `free`, or `premium`. Only trusted Auth admins can change their own current session mode. Simulated access must neither charge real money nor record durable paid history. It does not change Auth metadata, subscriptions or trial timestamps.

Database policies gate updates and require identified/profile-ready creation. Free initial JSON removes paid timing/supply customization while retaining official station context. Owner reads retain the runner's own stored data; the paywall controls paid editing and app tools, not confidentiality of personal planning JSON.

## Rollout and external prerequisites

## Runner launch announcement

The marketing label **1.0** is a campaign label, independent from the native runtime version. The mobile announcement may appear only after bootstrap, launch overlay and onboarding transitions, and only on the identified runner root tabs Courses, Plans, Nutrition and Profile. It must never interrupt authentication, onboarding, plan editing, live mode or a purchase surface.

Campaign eligibility requires the canonical `/api/runner/config` response to enable monetization. Acknowledgement is written only after the explicit “J’ai compris” action, keyed by campaign, authenticated `userId`, and device in AsyncStorage. Failed config or storage operations fail closed: they neither display an ineligible campaign nor record a false acknowledgement. The root passes `userId` and eligibility into the hook; the hook performs no Auth query.

The message distinguishes free estimates, pace and RaceBook context from paid plan detail. It shows store-localized course/annual pricing supplied by the existing pricing hook, with explicit EUR 9.99 and EUR 29.99 reference fallbacks; acknowledgement is informational and does not start checkout. Existing trials, grants and paid subscriptions retain their actual existing terms. Stored free plans remain in the account without a promise of free detailed access.

The canonical database singleton starts with `monetization_enabled = false`. `GET /api/runner/config` exposes only this boolean. Failures during access checks must not fabricate a Premium grant. Enable only after the schema, verified payment processing and compatible clients are deployed together.

Required configuration includes new Stripe annual/course Prices; explicit RevenueCat annual offering/package and consumable course products per store; provider secrets; authenticated webhooks; and store server notifications for purchase/refund lifecycle. Prices displayed during purchase come from the payment provider. Never publish a store price change by merely changing a UI string.

On 2026-10-30 Google and Apple credentials were repaired and the new store products were created after review. RevenueCat's store-state tool supports Play subscriptions but not Play one-time-product creation; the Android consumable was created manually in Play Console. Preserve old products for existing subscribers.

The seven intended launch countries are FR, DE, ES, IE, IT, CH and US. The Google annual SKU is `runner_premium_annual_v2:annual`: EUR 29.99 in the five euro territories, CHF 29.99 and USD 29.99. Apple SKUs are `runner_premium_annual_v2` (annual) and `runner_course_unlock` (consumable); verified euro prices are EUR 29.99 and EUR 9.99. Apple equalized CH/US prices to CHF 20/USD 24.99 annually and CHF 8/USD 8.99 per course. Both Apple products are `READY_TO_SUBMIT`; replace placeholder review screenshots before submission.

RevenueCat offering `runner_v2` contains the new annual products in `$rc_annual`, attached to the existing Premium entitlement. The old default offering and old products are retained. Android `runner_course_unlock` is registered as consumable and its `standard` purchase option is active. The last read still showed EUR 11.99 in the five euro territories and availability beyond the intended seven countries; the owner is correcting local final prices. Re-read live store state before purchase testing. Stripe prices and environment wiring, database migration execution and sandbox transactions remain unverified. No Apple review submission or application production rollout was performed.

Pushing `dev/runner-course-purchases` triggers the development OTA workflow, not a production OTA. It does not apply SQL migrations or configure provider environment variables. The Dev binary uses `com.paceyourself.app.dev`; real store sandbox tests for these products require a test-distributed binary with the matching `com.paceyourself.app` identifier. Keep the database rollout flag off in production and enable only on an isolated migrated test database after configuring the corresponding test backend.

Rollback: turn the canonical switch off to return to compatible editing behavior; suspend new checkouts without deleting transactions, history or plan JSON. Do not roll back by deleting historical trial dates or paid rows.

## Validation and gotchas

On 2026-10-30 the owner explicitly authorized applying the three runner migrations to the existing production database. The CLI dry run first found remote-only historical migrations `20261029090122`, `20261029091807` and `20261029110000`; their recorded SQL was recovered with the original versions rather than repairing history or replaying them. Only the three runner migrations were then applied. Post-deployment checks confirmed all seven runner tables have RLS, no existing plan lacks history, clients cannot grant purchases, internal billing functions are not publicly executable, and `monetization_enabled` remains false. New-account automatic trials are stopped; historical trial dates were not rewritten. A follow-up migration pins the unlock timestamp trigger's search path after an advisor warning. Full fixture-based SQL tests remain intended for an isolated database; production verification used read-only checks and a rolled-back caller-predicate smoke test.

- Verify guest denial, profile validation, multiple previews, same-course recreated-plan access, cross-course denial and historical readonly.
- Verify real/free/premium admin sessions, including no real charges and no durable simulated access.
- Exercise sandbox annual purchase, two different course purchases using the same consumable SKU, cancellation, restart recovery, restore, refunds and event reordering on both stores and Stripe.
- Local TypeScript/unit tests do not establish store acceptance or database policy execution. Run the SQL checks in a migrated disposable database before enabling the flag; no local Docker/Postgres runtime was available during initial implementation.
- Required repository checks are `npm run verify` and the documentation protocol. Do not claim deployment or real-store purchase success from source tests alone.

## Related Docs

- [Runner Billing Tables](../02-database/tables/runner-billing.md)
- [Premium Entitlement](premium-entitlement.md)
- [Historical Trials](trial-lifecycle.md)
- [Stripe](../05-integrations/stripe.md)
