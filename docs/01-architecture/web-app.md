---
title: Web App Architecture
scope: architecture
last_verified: 2026-11-23
# Event hubs and landing pages (2026-11-22): /courses/evenements/<event-slug> is the permanent indexable hub (edition pages canonicalize to it), distance/region/month landing pages are paginated under /page/<n>, list upcoming formats only and emit ItemList; the sitemap lists hubs instead of edition URLs.
# Reel caption voice (2026-11-20): the reel caption is written for reading (lively tone, a hook line, a question, 2-8 emojis) and may not copy 7 words of the voice-over (reel-content.ts checks).
# Reel voice pool (2026-11-20): the admin keeps a shared pool of ElevenLabs voices (video_voices, service role only, /api/admin/video-generator/voices); each new reel draws an active voice at random (pickPoolVoice), the choice is saved with the narration and shown as « Voix : <nom> ».
# Admin publications workflow (2026-11-20): generate/publish switch on both pages, month calendar and filters in Publications, « déjà publiée » marks on videos and in the generator race picker, published posts removable from the admin list.
# Instagram 5 hashtags (2026-11-19): captions, reel content and the full-mode caption writer keep 5 hashtags at most (3-5 asked), Instagram's limit since late 2025.
# One-click reel (2026-11-19): « Générer le reel » chains the AI text, voice, narration save and background render in Temps forts mode (now the editor's initial mode; the schema default stays full), and the render completion route creates the Instagram draft (video_render_jobs.auto_draft, social_posts.auto_generated, service role) shown with a « Généré automatiquement » badge in Publications.
# Reel subtitles lower (2026-11-19): the burned-in subtitle box moves from 64 % to 74 % of the frame height (still above y = 1500 px).
# Reel camera and labels (2026-11-19): highlights reels (or tiltedCamera on) use a 60 degree chase camera that keeps the runner and the next 2 km in frame (camera-framing.ts); start/finish/aid labels never overlap or get cut by the frame edge, and a loop shows one Départ / Arrivée label (label-layout.ts).
# Inbox push badge (2026-11-18): `sendAdminUserNotificationPush` counts the runner's unread, non-deleted `user_notifications` (service role, after the row is inserted) and sends it as the Expo `badge`; a failed count only drops the badge. Other pushes (race reminders, race event updates) send no badge, unchanged.
# Reel light overlay (2026-11-19): highlights reels (or compactOverlay on) drop the title band, the profile ticks and the aid bubble details; every readable overlay text is at least 32 px at 1080 wide.
# Reel hook (2026-11-19): highlights reels (and full ones with hookIntro on) open on a 2.4 s hook: tilted camera on the hardest climb, one headline figure and the short event name (race_events.short_name, editable in the admin event dialog).
# Reel highlights (2026-11-19): storyMode "highlights" tells 3 to 5 key moments in 30-50 s (highlights.ts); narrations are saved per race and mode.
# Reel figures (2026-11-19): the admin reel generator shows the race record distance and D+ as the announced truth and rescales GPX kilometres and D+ to it (race-figures.ts); badge, counter, story, aid cards and AI inputs share one rounding policy.
# Livret supporter private preview (2026-11-18): SupporterGuideView retries with the stored session token for organizer preview of a private edition.
# Crew follow UX (2026-11-17): passed checkpoints collapse, confirmed passages can be corrected or undone, the crew handover is a device-local checklist, aid-station directions match supporter points by place name within 2 km, and phones without the app get an app-first gate on the public page; no column, RLS or crew_state shape change.
# Organizer hero note (2026-11-16): /organisateurs now presents the Livret coureur and the Livret supporter side by side (hero cards, illustrative supporter preview, metadata title); presentation only, no data, analytics event or offer change.
# Assisted legacy conversion (2026-11-15): historical organizer text can request a schema-specific OpenAI proposal; every proposed field requires explicit Apply/Ignore review and the conversion endpoint never persists.
# Structured runner-info phase (2026-11-15): additive start-area, briefing and key-rule objects coexist with historical strings for old mobile compatibility; equipment control checkpoints and short notes are optional runner guidance.
# Structured bib phase (2026-11-15): required and third-party document kinds are optional JSON lists rendered as runner-facing guidance; historical free text remains visible as conversion source and no persisted runner checklist is introduced.
# Structured access phase (2026-11-15): optional parking and shuttle collections use geocoded locations, bounded notes and edition-day schedules; event inheritance and historical text fallbacks remain intact, while public pages expose summaries only.
# Structured station phase (2026-11-15): optional amenities, supporter access and maximum-stop metadata remain in organizer JSON; runner surfaces prefer them while preserving legacy notes, and planner pauses only warn when they exceed the organizer limit.
# Structured cutoff phase (2026-11-15): optional day offsets make overnight and multi-day aid-station/final cutoffs deterministic; missing offsets preserve the historical clock heuristic, and relay clock columns remain text normalized client-side.
ai_priority: high
# Business card link (2026-11-18): the printed business card QR code encodes the same Trail TST Supporter Guide URL with ?src=carte; app builds with /courses universal links / App Links open the guide, otherwise the guide page redirects to /carte-visite, a no-store 302: Android tries the app through the same intent URL with the tagged Google Play listing as fallback, iOS goes to the App Store listing and desktop to /links (utm_source=carte, utm_medium=qr, utm_campaign=carte-visite).
# Brochure demo link (2026-11-18): the printed organizer brochure QR code encodes the Trail TST Supporter Guide URL with ?src=plaquette, so app builds that declare /courses universal links / App Links open it directly. In a browser, the web guide page redirects that tagged visit to /demo, a no-store 302: Android opens the app through a Chrome intent URL whose browser fallback is /organisateurs, while iOS and desktop go straight to /organisateurs. Both fallbacks carry utm_source=plaquette, utm_medium=qr, utm_campaign=demo.
# Organizer shell (2026-11-13): the 1440px workspace switches at 1320px to a 240px / flexible / 300px grid; media-heavy editors span the two content columns.
# Organizer nav fixes (2026-11-17): the whole left column (nav + Gérer les sections) is the sticky, self-scrolling unit so the nav no longer covers that button; the header Actions menu starts with Statistiques (analytics view) and Gérer les sections; the editor header clips only its watermark so the format ⋯ menu shows; header, versions and format menus anchor left below their breakpoint so they stay on screen on mobile.
# Aid-station editor (2026-11-13): the course timeline is the selection list, with one adjacent detail panel on desktop and a full-screen detail surface after selection on mobile; arrow keys move between aid stations.
# Organizer loading/forms (2026-11-13): lazy editors and sidecars use neutral skeletons; required inputs derive their Requis badge from the existing `required` contract.
# Organizer hierarchy (2026-11-13): section labels wrap to two lines, the active subsection owns the strong state, headers use section-specific glyphs plus an 8%-opacity contour watermark, and destructive format actions live in the overflow menu.
# Dense organizer modules (2026-11-13): course dates are localized, same-place access hides the duplicate finish field, equipment rows omit redundant Added badges, and sponsors expose a logo-first navigation grid.
# Organizer mobile finish (2026-11-13): editor content uses compact phone gutters, inherited location wraps, and Course media is collapsed behind “Tracé et médias” below 900px.
# Organizer regression guard (2026-11-13): UTF-8/source checks assert the 240/flexible/300 grid and the social auto-fit layout without a nested “Réseaux sociaux” title.
# Organizer polish (2026-11-13): the Course media rail no longer relies on a closed <details> (its content was hidden on desktop) and collapses behind “Tracé et médias” only below 900px; format metrics sit on one row with grouped warnings and readable inherited date/location; aid stations use a single timeline plus a two-column detail panel with start/cutoff fields in “Horaires et consignes”; section headers use per-module SVG icons with the format ⋯ menu inline; equipment rows move status with a compact “→ Recommandé/Obligatoire” action instead of a segmented control.
# Organizer fill-flow pass (2026-11-13): ravito detail restores Eau/Solide/Assistance/Sac de délestage/Point de relais toggles (lost with the card list), the new-ravito form replaces the detail panel, submits on Enter and selects the added station, and the mobile sheet stays under confirm dialogs; equipment drafts add on Enter and chain; new bib slots inherit the previous date, focus the start time and removals can be undone; Sponsors puts the add form first (open when empty) and partner slots last; the Services status reads “Texte à convertir”.
# Organizer UX pass (2026-11-14): the left nav expands a format's sections directly under that format (chevron, aria-expanded) instead of below “Ajouter un format”; ravito detail offers a two-option Ravito / Base de vie type (life_base vs existing non-life-base value) and the timeline badges bases de vie; Matériel is a flat compact list with a quick-add bar at the top (Enter, suggestions, required switch, new items prepended) and an Obligatoire/Recommandé switch per row that no longer moves rows between groups.
# Course timeline pass (2026-11-14): the Départ/ravitos editor shows one timeline filtered by Tout / Ravitos / Suivi / SAS / Relais; SAS sit right after Départ, each point kind has its own marker (ravito green dot, base de vie larger dot + badge, suivi blue ring + “Suivi” tag, relais violet diamond), aid/relay/finish rows show a clock cutoff chip or “Sans barrière”, the right panel follows the clicked point, the timeline is height-capped with its own scroll, and “Horaires et consignes” sits below the grid so the sticky timeline no longer overlaps it.
related_files:
  - apps/web/lib/admin-renders.ts
  - apps/web/vitest.config.ts
  - apps/web/lib/admin-audit.ts
  - apps/web/lib/admin-audit.test.ts
  - apps/web/lib/admin-audit-log.ts
  - apps/web/lib/admin-audit-log.test.ts
  - apps/web/lib/admin-audit-server.ts
  - apps/web/app/api/admin/audit/route.ts
  - apps/web/app/api/admin/audit/route.test.ts
  - apps/web/app/admin/system/audit/page.tsx
  - apps/web/app/admin/_components/audit/AuditLog.tsx
  - apps/web/app/admin/_components/audit/AuditEntryDrawer.tsx
  - apps/web/app/admin/_components/audit/audit-api.ts
  - apps/web/lib/admin-renders.test.ts
  - apps/web/lib/admin-renders-server.ts
  - apps/web/app/api/admin/renders/route.ts
  - apps/web/app/api/admin/renders/route.test.ts
  - apps/web/app/admin/_components/renders/RendersQueue.tsx
  - apps/web/app/admin/_components/renders/RenderDrawer.tsx
  - apps/web/app/admin/_components/renders/RenderDrawer.test.ts
  - apps/web/app/admin/_components/renders/useAdminRenders.ts
  - apps/web/app/admin/content/renders/page.tsx
  - apps/web/app/admin/video-generator/studio-draft.ts
  - apps/web/app/admin/video-generator/studio-draft.test.ts
  - apps/web/app/admin/video-generator/InstagramPanel.tsx
  - apps/web/app/admin/publications/FlyoverOrdersCard.tsx
  - apps/web/app/admin/publications/PublicationCalendar.tsx
  - apps/web/app/admin/publications/automation-labels.ts
  - apps/web/app/admin/publications/publications-api.ts
  - apps/web/app/admin/publications/publication-calendar.ts
  - apps/web/lib/admin-inbox.ts
  - apps/web/lib/admin-overview.ts
  - apps/web/app/admin/video-generator/ReelPipelinePanel.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.tsx
  - apps/web/app/api/admin/video-generator/render-jobs/route.ts
  - apps/web/app/admin/publications/publication-tabs.ts
  - apps/web/app/admin/publications/RenderActivityCard.tsx
  - apps/web/app/admin/publications/PublicationViews.tsx
  - apps/web/app/admin/video-generator/BackgroundRenderPanel.tsx
  - apps/web/app/admin/content/posts/page.tsx
  - apps/web/lib/render-activity.ts
  - apps/web/app/api/admin/render-activity/route.ts
  - apps/web/lib/admin-runner-profile.ts
  - apps/web/lib/admin-runner-profile.test.ts
  - apps/web/lib/admin-runner-profile-server.ts
  - apps/web/lib/admin-messages.ts
  - apps/web/lib/admin-messages.test.ts
  - apps/web/lib/admin-messages-server.ts
  - apps/web/lib/tanstack-query-shim.test.ts
  - packages/tanstack-react-query/index.tsx
  - apps/web/app/api/admin/users/[id]/route.ts
  - apps/web/app/api/admin/users/[id]/route.test.ts
  - apps/web/app/admin/runners/page.tsx
  - apps/web/app/admin/messaging/page.tsx
  - apps/web/app/admin/_components/AdminUsersTab.tsx
  - apps/web/app/admin/_components/admin-notification-api.ts
  - apps/web/app/admin/_components/shell/DrawerTabs.tsx
  - apps/web/app/admin/_components/runners/runner-url.ts
  - apps/web/app/admin/_components/runners/runner-url.test.ts
  - apps/web/app/admin/_components/runners/RunnerProfileDrawer.tsx
  - apps/web/app/admin/_components/runners/PremiumGrantDialog.tsx
  - apps/web/app/admin/_components/messaging/MessagesHistory.tsx
  - apps/web/app/admin/_components/organizers/organizer-admin-model.ts
  - apps/web/app/admin/_components/organizers/organizer-admin-model.test.ts
  - apps/web/app/admin/_components/organizers/useOrganizerAdminData.ts
  - apps/web/app/admin/_components/organizers/EditionDrawer.tsx
  - apps/web/app/admin/_components/organizers/EditionPackForm.tsx
  - apps/web/app/admin/_components/organizers/EditionRightsCard.tsx
  - apps/web/app/admin/_components/organizers/PendingRequestsCard.tsx
  - apps/web/app/admin/_components/organizers/OrganizerRequestItems.tsx
  - apps/web/app/admin/_components/organizers/AssignOrganizerCard.tsx
  - apps/web/app/admin/_components/organizers/AssignmentAutocomplete.tsx
  - apps/web/app/admin/_components/organizers/ActiveAccessCard.tsx
  - apps/web/app/admin/_components/organizers/FeatureCatalogCard.tsx
  - apps/web/app/admin/_components/catalog/race-catalog-model.ts
  - apps/web/app/admin/_components/catalog/race-catalog-model.test.ts
  - apps/web/app/admin/_components/catalog/RaceCatalogList.tsx
  - apps/web/app/admin/_components/catalog/AddRaceDialog.tsx
  - apps/web/app/admin/_components/catalog/EditRaceDialog.tsx
  - apps/web/app/admin/_components/catalog/EditEventDialog.tsx
  - apps/web/app/admin/_components/catalog/UtmbImportDialog.tsx
  - apps/web/app/admin/_components/catalog/TraceDeTrailImportDialog.tsx
  - apps/web/lib/admin-billing.ts
  - apps/web/lib/admin-billing.test.ts
  - apps/web/lib/admin-billing-server.ts
  - apps/web/lib/admin-service-rest.ts
  - apps/web/app/api/admin/billing/route.ts
  - apps/web/app/api/admin/billing/route.test.ts
  - apps/web/app/api/admin/billing/editions/route.ts
  - apps/web/app/admin/billing/page.tsx
  - apps/web/app/admin/_components/billing/BillingRegister.tsx
  - apps/web/app/admin/_components/billing/BillingEntryDrawer.tsx
  - apps/web/app/admin/_components/billing/OrganizerInvoiceDialog.tsx
  - apps/web/app/admin/_components/billing/BankTransferDialog.tsx
  - apps/web/app/admin/_components/billing/HistoricalInvoiceDialog.tsx
  - apps/web/app/admin/_components/billing/EditionBillingSummary.tsx
  - apps/web/app/admin/_components/billing/billing-components.test.ts
  - apps/web/app/livret-coureur/page.tsx
  - apps/web/app/livret-supporter/page.tsx
  - apps/web/components/landing/LivretProductPage.tsx
  - apps/web/components/landing/RaceBookPhoneMockup.tsx
  - apps/web/components/landing/HomeProofStrip.tsx
  - apps/web/components/landing/ProofLogo.tsx
  - apps/web/components/landing/home-copy.ts
  - apps/web/app/home-structured-data.ts
  - apps/web/components/SiteFooter.tsx
  - apps/web/app/admin/_components/AdminSurveysTab.tsx
  - apps/web/app/admin/_components/AdminSurveysTab.test.ts
  - apps/web/app/api/admin/feedback-surveys/route.ts
  - apps/web/app/api/admin/feedback-surveys/route.test.ts
  - apps/web/app/api/admin/feedback-surveys/audiences/route.ts
  - apps/web/lib/feedback-surveys.ts
  - apps/web/lib/feedback-surveys.test.ts
  - apps/web/app/api/supporter-guide/route.ts
  - apps/web/app/api/supporter-guide/qr/route.ts
  - apps/web/app/courses/supporter-guide/[raceId]/page.tsx
  - apps/web/app/courses/supporter-guide/[raceId]/SupporterGuideView.tsx
  - apps/web/lib/supporter-guide.ts
  - apps/web/lib/organizer-legacy-conversion.ts
  - apps/web/lib/organizer-legacy-conversion.test.ts
  - apps/web/app/organizer/_components/dashboard/legacy-conversion-panel.tsx
  - apps/web/app/admin/video-generator/export-frame.test.ts
  - apps/web/app/admin/video-generator/export-frame.ts
  - apps/web/app/admin/_components/AdminMessagingTab.tsx
  - apps/web/app/admin/_components/AdminFeedbackTab.tsx
  - apps/web/app/admin/_components/AdminReplyStatus.tsx
  - apps/web/app/admin/_components/admin-message-template.ts
  - apps/web/app/admin/_components/admin-message-template.test.ts
  - apps/web/app/api/admin/feedback/route.ts
  - apps/web/app/api/admin/feedback/route.test.ts
  - apps/web/app/api/admin/inbox-counts/route.ts
  - apps/web/lib/organizer-structured-content.ts
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.tsx
  - apps/web/app/organizer/_components/dashboard/form-kit/index.tsx
  - apps/web/app/organizer/_components/dashboard/structured-content-editors.test.ts
  - apps/web/app/organizer/_components/dashboard/organizer-import-documents.ts
  - apps/web/app/organizer/_components/dashboard/organizer-import-documents.test.ts
  - apps/web/app/api/organizer/editions/[id]/services/route.ts
  - apps/web/app/api/organizer/races/[id]/start-waves/route.ts
  - apps/web/app/api/organizer/races/[id]/awards/route.ts
  - apps/web/package.json
  - apps/web/playwright.organizer.config.ts
  - apps/web/e2e/organizer-payment.spec.ts
  - apps/web/tsconfig.json
  - apps/web/app/layout.tsx
  - apps/web/app/page.tsx
  - apps/web/app/home-structured-data.ts
  - apps/web/app/home-jsonld.test.ts
  - apps/web/app/audience-routing.test.ts
  - apps/web/app/seo.ts
  - apps/web/app/seo.test.ts
  - apps/web/lib/legacy-redirects.ts
  - apps/web/lib/redirect-integrity.test.ts
  - apps/web/app/localized-metadata.tsx
  - apps/web/app/i18n-provider.tsx
  - apps/web/app/i18n-provider.test.ts
  - apps/web/app/support/page.tsx
  - apps/web/app/support/page-client.tsx
  - apps/web/app/partenaires/page.tsx
  - apps/web/app/en/partners/page.tsx
  - apps/web/components/landing/PartnersPage.tsx
  - apps/web/next.config.mjs
  - apps/web/app/admin/components/AdminRaceCatalogSection.tsx
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/layout.tsx
  - apps/web/app/admin/admin-routes.ts
  - apps/web/app/admin/admin-routes.test.ts
  - apps/web/app/admin/admin-redirects.ts
  - apps/web/app/admin/admin-redirects.test.ts
  - apps/web/app/admin/admin-tabs.ts
  - apps/web/app/admin/_components/shell/AdminShell.tsx
  - apps/web/app/admin/_components/shell/AdminSidebar.tsx
  - apps/web/app/admin/_components/shell/AdminCommandPalette.tsx
  - apps/web/app/admin/_components/shell/AdminAccess.tsx
  - apps/web/app/admin/_components/shell/AdminPageHeader.tsx
  - apps/web/app/admin/_components/shell/useAdminModes.ts
  - apps/web/app/admin/_components/useInboxCounts.ts
  - apps/web/app/admin/publications/usePublicationsWorkspace.ts
  - apps/web/app/admin/publications/PublicationViews.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorStudio.tsx
  - apps/web/app/admin/content/posts/page.tsx
  - apps/web/app/admin/catalog/races/page.tsx
  - apps/web/app/admin/inbox/page.tsx
  - apps/web/app/admin/_components/pages/AdminOverviewPage.tsx
  - apps/web/app/admin/_components/overview/OverviewCards.tsx
  - apps/web/app/admin/_components/overview/overview-period.ts
  - apps/web/app/admin/_components/inbox/InboxQueue.tsx
  - apps/web/app/admin/_components/inbox/inbox-mode.ts
  - apps/web/app/api/admin/overview/route.ts
  - apps/web/app/api/admin/inbox/route.ts
  - apps/web/lib/admin-overview.ts
  - apps/web/lib/admin-overview-server.ts
  - apps/web/lib/admin-inbox.ts
  - apps/web/lib/admin-inbox-server.ts
  - apps/web/lib/admin-growth.ts
  - apps/web/lib/admin-system-health.ts
  - apps/web/lib/admin-system-health-server.ts
  - apps/web/lib/admin-integrations.ts
  - apps/web/app/api/admin/system/health/route.ts
  - apps/web/app/api/admin/system/integrations/route.ts
  - apps/web/app/api/admin/system/cron-run/route.ts
  - apps/web/app/admin/system/automation/page.tsx
  - apps/web/app/admin/system/integrations/page.tsx
  - apps/web/app/admin/system/maintenance/page.tsx
  - apps/web/app/admin/_components/system/SystemPanels.tsx
  - apps/web/app/admin/_components/system/MaintenancePanel.tsx
  - apps/web/app/admin/_components/system/maintenance-plan.ts
  - apps/web/app/admin/_components/system/system-api.ts
  - apps/web/app/admin/_components/AdminNotificationDialog.tsx
  - apps/web/app/admin/_components/AdminNotificationDialog.test.ts
  - apps/web/app/admin/_components/AdminRaceRequestsTab.tsx
  - apps/web/app/api/admin/race-requests/route.ts
  - apps/web/app/api/admin/race-requests/route.test.ts
  - apps/web/app/api/admin/user-notifications/route.ts
  - apps/web/app/api/admin/user-notifications/route.test.ts
  - apps/web/app/admin/video-generator/page.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMap.tsx
  - apps/web/app/admin/video-generator/VideoGeneratorMapClient.tsx
  - apps/web/app/admin/video-generator/voice-pool.ts
  - apps/web/app/admin/video-generator/voice-pool.test.ts
  - apps/web/app/admin/video-generator/useVoicePool.ts
  - apps/web/app/admin/video-generator/VoiceSection.tsx
  - apps/web/lib/video-voices.ts
  - apps/web/app/api/admin/video-generator/voices/route.ts
  - apps/web/app/api/admin/video-generator/voices/[id]/route.ts
  - apps/web/app/api/admin/video-generator/voices/route.test.ts
  - apps/web/app/admin/video-generator/AnimationControls.tsx
  - apps/web/app/admin/video-generator/video-composition.ts
  - apps/web/app/admin/video-generator/audio-master.ts
  - apps/web/app/admin/video-generator/reel-music.ts
  - apps/web/public/reel-music/manifest.json
  - apps/web/app/admin/video-generator/route-story.ts
  - apps/web/app/admin/video-generator/StoryEditor.tsx
  - apps/web/app/admin/video-generator/reel-pipeline.ts
  - apps/web/app/admin/video-generator/useReelPipeline.ts
  - apps/web/app/admin/video-generator/ReelPipelinePanel.tsx
  - apps/web/app/admin/video-generator/background-render.ts
  - apps/web/app/admin/video-generator/BackgroundRenderPanel.tsx
  - apps/web/lib/social-post-auto-draft.ts
  - apps/web/app/api/video-render/jobs/[id]/route.ts
  - apps/web/app/api/admin/video-generator/script/route.ts
  - apps/web/app/api/admin/video-generator/voice/route.ts
  - apps/web/app/api/admin/video-generator/caption/route.ts
  - apps/web/lib/reel-content.ts
  - apps/web/lib/reel-content.test.ts
  - apps/web/lib/video-script-prompt.ts
  - apps/web/app/api/admin/video-generator/content/route.ts
  - apps/web/app/api/admin/video-generator/content/route.test.ts
  - apps/web/app/admin/publications/page.tsx
  - apps/web/app/admin/publications/PostCard.tsx
  - apps/web/app/admin/publications/CaptionForm.tsx
  - apps/web/app/admin/publications/publications-api.ts
  - apps/web/app/admin/publications/publication-tabs.ts
  - apps/web/app/admin/publications/RenderActivityCard.tsx
  - apps/web/app/api/admin/render-activity/route.ts
  - apps/web/lib/render-activity.ts
  - apps/web/app/api/admin/social-posts/route.ts
  - apps/web/app/api/admin/social-posts/[id]/route.ts
  - apps/web/app/api/admin/instagram/route.ts
  - apps/web/app/api/admin/instagram/route.test.ts
  - apps/web/app/admin/publications/InstagramStatusCard.tsx
  - apps/web/app/admin/video-generator/map-appearance.ts
  - apps/web/app/admin/video-generator/VideoCompositionOverlay.tsx
  - apps/web/app/admin/video-generator/CompositionSettingsPanel.tsx
  - apps/web/app/admin/video-generator/animation-controller.ts
  - apps/web/app/admin/video-generator/camera-controller.ts
  - apps/web/app/admin/video-generator/map-resize-controller.ts
  - apps/web/app/admin/video-generator/route-animation.ts
  - apps/web/app/api/admin/video-generator/races/[id]/route.ts
  - apps/web/lib/video-generator-race.ts
  - apps/web/app/admin/video-generator/video-race-info.ts
  - apps/web/app/admin/publications/AutomationCard.tsx
  - apps/web/app/api/admin/reel-automation/route.ts
  - apps/web/app/api/cron/reel-automation/route.ts
  - apps/web/lib/video-generator.ts
  - apps/web/app/admin/_components/AdminOrganizerSocialProofsTab.tsx
  - apps/web/app/admin/_components/AdminOrganizerSocialProofsTab.test.ts
  - apps/web/app/api/admin/organizer-social-proofs/route.ts
  - apps/web/app/api/admin/organizer-social-proofs/route.test.ts
  - apps/web/app/admin/_components/AdminPartnerLinksTab.tsx
  - apps/web/app/api/admin/partner-links/route.ts
  - apps/web/app/api/admin/partner-links/route.test.ts
  - apps/web/app/api/partner-links/route.ts
  - apps/web/app/api/partner-links/route.test.ts
  - apps/web/lib/partner-links.ts
  - apps/web/lib/partner-links.test.ts
  - apps/web/app/hooks/useVerifiedSession.tsx
  - apps/web/app/hooks/useOrganizerMembershipStatus.ts
  - apps/web/app/header-tabs.tsx
  - apps/web/app/header-menu.tsx
  - apps/web/components/SiteFooter.tsx
  - apps/web/app/robots.ts
  - apps/web/app/sitemap.ts
  - apps/web/app/sitemap.test.ts
  - apps/web/app/survol/page.tsx
  - apps/web/app/survol/flyover-order-form.tsx
  - apps/web/app/survol/flyover-preview.tsx
  - apps/web/app/survol/commande/[id]/page.tsx
  - apps/web/app/api/flyover-orders/route.ts
  - apps/web/app/api/flyover-orders/[id]/download/route.ts
  - apps/web/app/api/cron/flyover-orders/route.ts
  - apps/web/app/noindex-metadata.ts
  - apps/web/app/blog/page.tsx
  - apps/web/app/blog/[...slug]/page.tsx
  - apps/web/app/blog/blog-jsonld.test.ts
  - apps/web/components/BlogLayout.tsx
  - apps/web/components/BlogCard.tsx
  - apps/web/components/blog/RelatedPosts.tsx
  - apps/web/components/landing/GuideCards.tsx
  - apps/web/lib/blog/posts.tsx
  - apps/web/lib/blog/posts.test.ts
  - apps/web/lib/blog/posts-locale.test.ts
  - apps/web/app/courses/page.tsx
  - apps/web/app/courses/catalog-query.ts
  - apps/web/app/courses/catalog-query.test.ts
  - apps/web/app/courses/[slug]/page.tsx
  - apps/web/app/courses/[slug]/page.test.ts
  - apps/web/app/courses/[slug]/race-metadata.ts
  - apps/web/app/courses/[slug]/race-structured-data.ts
  - apps/web/app/courses/[slug]/race-structured-data.test.ts
  - apps/web/app/courses/evenements/[slug]/page.tsx
  - apps/web/app/courses/evenements/[slug]/event-structured-data.ts
  - apps/web/app/courses/evenements/[slug]/event-structured-data.test.ts
  - apps/web/app/courses/evenements/[slug]/event-edition-status.ts
  - apps/web/app/courses/evenements/[slug]/event-edition-status.test.ts
  - apps/web/app/courses/_components/RaceCatalogFilter.tsx
  - apps/web/app/courses/_components/RaceCatalogFilter.test.ts
  - apps/web/app/courses/_components/catalog-display.ts
  - apps/web/app/courses/_components/PublicRaceLinks.tsx
  - apps/web/app/courses/_components/PublicRaceShare.tsx
  - apps/web/app/courses/_components/PublicElevationProfile.tsx
  - apps/web/app/courses/_components/RaceHeroSummary.tsx
  - apps/web/app/courses/_components/RaceRouteExplorer.tsx
  - apps/web/app/courses/_components/RaceAidStationsTimeline.tsx
  - apps/web/app/courses/_components/RunnerAppBridge.tsx
  - apps/web/app/courses/_components/RaceLinksCarousel.tsx
  - apps/web/app/courses/_components/DemoRaceBadge.tsx
  - apps/web/app/courses/_components/StickyEstimateBar.tsx
  - apps/web/app/courses/_components/catalog-display.test.ts
  - apps/web/lib/demo-race.ts
  - apps/web/components/ui/accordion.tsx
  - apps/web/app/courses/PublicRaceShare.test.ts
  - apps/web/app/courses/distances/[category]/[[...page]]/page.tsx
  - apps/web/app/courses/regions/[region]/[[...page]]/page.tsx
  - apps/web/app/courses/mois/[month]/[[...page]]/page.tsx
  - apps/web/app/courses/_components/RaceLandingPage.tsx
  - apps/web/lib/race-landing-pages.ts
  - apps/web/lib/race-landing-pages.test.ts
  - apps/web/app/courses/evenements/[slug]/EventEditionSections.tsx
  - apps/web/app/courses/evenements/[slug]/event-hub.ts
  - apps/web/app/courses/evenements/[slug]/event-hub.test.ts
  - apps/web/app/courses/race-discovery.test.ts
  - apps/web/app/calculateur-glucides-trail/page.tsx
  - apps/web/app/calculateur-glucides-trail/CarbCalculator.tsx
  - apps/web/app/calculateur-glucides-trail/carb-calculator-fun.test.ts
  - apps/web/app/a-propos/page.tsx
  - apps/web/app/methodologie/page.tsx
  - apps/web/app/(planner)/race-planner/page.tsx
  - apps/web/app/(planner)/race-planner/components/PlannerLanding.tsx
  - apps/web/app/(planner)/race-planner/page.test.ts
  - apps/web/app/(planner)/race-planner/planner-seo.tsx
  - apps/web/app/settings/page.tsx
  - apps/web/app/profile/page.tsx
  - apps/web/app/profile/_components/ProfileLayout.tsx
  - apps/web/app/(planner)/race-planner/components/RaceCatalogModal.tsx
  - apps/web/app/(planner)/race-planner/components/RaceCatalogModal.test.ts
  - apps/web/app/legal/metadata.ts
  - apps/web/app/legal/metadata.test.ts
  - apps/web/app/legal/mentions-legales/page.tsx
  - apps/web/app/legal/cgu/page.tsx
  - apps/web/app/legal/cgv/page.tsx
  - apps/web/app/legal/privacy/page.tsx
  - apps/web/lib/public-races.ts
  - apps/web/lib/public-race-cache.ts
  - apps/web/lib/public-race-cache.test.ts
  - apps/web/lib/public-race-events.ts
  - apps/web/lib/public-race-events.test.ts
  - apps/web/lib/public-races.test.ts
  - apps/web/lib/public-race-detail.ts
  - apps/web/lib/public-race-detail.test.ts
  - apps/web/lib/app-store.ts
  - apps/web/lib/race-discovery.ts
  - apps/web/lib/carb-calculator.ts
  - apps/web/lib/carb-calculator-fun.ts
  - apps/web/app/api/auth/session/route.ts
  - apps/web/app/api/resend/contact/route.ts
  - apps/web/lib/entitlements-client.ts
  - apps/web/app/api/plans/route.ts
  - apps/web/app/api/plans/from-catalog/route.ts
  - apps/web/lib/organizer-aid-station-products.ts
  - apps/web/app/api/plan-shares/route.ts
  - apps/web/app/api/plan-shares/crew-state/route.ts
  - apps/web/app/share/plan/[token]/page.tsx
  - apps/web/app/share/plan/[token]/PlanShareCrewTimeline.tsx
  - apps/web/app/root-chrome.tsx
  - apps/web/lib/plan-share.ts
  - apps/web/app/api/race-catalog/route.ts
  - apps/web/app/api/race-catalog/[id]/thumbnail/route.ts
  - apps/web/app/api/admin/race-events/[id]/thumbnail/route.ts
  - scripts/optimize-supabase-race-images.mjs
  - apps/web/app/api/admin/race-catalog/utmb/route.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/route.test.ts
  - apps/web/app/api/admin/race-catalog/tracedetrail/importer.test.ts
  - apps/web/app/api/internal/race-catalog/tracedetrail/enrich/route.ts
  - apps/web/app/api/internal/race-catalog/tracedetrail/enrich/route.test.ts
  - apps/web/app/api/cron/tracedetrail-catalog-enrichment/route.ts
  - apps/web/app/api/cron/tracedetrail-catalog-enrichment/route.test.ts
  - apps/web/lib/tracedetrail-gpx-enrichment.ts
  - apps/web/lib/tracedetrail-gpx-enrichment.test.ts
  - apps/web/lib/tracedetrail-race-import.ts
  - apps/web/lib/organizer.ts
  - apps/web/app/demo/route.ts
  - apps/web/app/carte-visite/route.ts
  - apps/web/lib/demo-app-link.ts
  - apps/web/lib/demo-app-link.test.ts
  - apps/web/app/organisateurs/page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.tsx
  - apps/web/app/organisateurs/organizer-landing-page.test.ts
  - apps/web/lib/organizer-social-proof.ts
  - apps/web/lib/organizer-social-proof.test.ts
  - apps/web/lib/organizer-social-proof-server.ts
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizers/layout.tsx
  - apps/web/app/(planner)/race-planner/print/assistance/page.tsx
  - apps/web/lib/organizer-acquisition.ts
  - apps/web/lib/organizer-acquisition.test.ts
  - apps/web/app/organizer/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/lib/organizer-publication-tier.ts
  - apps/web/lib/organizer-publication-tier.test.ts
  - apps/web/app/organizer/_components/dashboard/types.ts
  - apps/web/app/organizer/_components/dashboard/constants.ts
  - apps/web/app/organizer/_components/dashboard/helpers.ts
  - apps/web/app/organizer/_components/dashboard/helpers.test.ts
  - apps/web/app/organizer/_components/dashboard/data-cache.ts
  - apps/web/app/organizer/_components/dashboard/data-cache.test.ts
  - apps/web/app/organizer/_components/dashboard/utf8-copy.test.ts
  - apps/web/app/organizer/_components/dashboard/controls.tsx
  - apps/web/app/organizer/_components/dashboard/address-autocomplete-field.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/components/gpx/GpxRouteMap.tsx
  - apps/web/components/gpx/GpxRouteMapClient.tsx
  - apps/web/app/organizer/_components/dashboard/detail-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
  - apps/web/app/organizer/_components/dashboard/products-editor.tsx
  - apps/web/app/organizer/_components/dashboard/sponsors-editor.tsx
  - apps/web/app/organizer/_components/dashboard/branding-editor.tsx
  - apps/web/app/organizer/_components/completion.ts
  - apps/web/app/organizer/_components/completion.test.ts
  - apps/web/lib/organizer-dashboard-details.ts
  - apps/web/lib/organizer-dashboard-details.test.ts
  - apps/web/lib/organizer-document-import.ts
  - apps/web/lib/organizer-import-engine.ts
  - apps/web/lib/organizer-import-engine.test.ts
  - apps/web/lib/organizer-import-reconciliation.ts
  - apps/web/lib/organizer-source-intelligence.ts
  - apps/web/lib/organizer-source-intelligence.test.ts
  - apps/web/lib/organizer-import-proposals.ts
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.tsx
  - apps/web/app/organizer/_components/dashboard/website-import-review-details.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/reconciliation.test.ts
  - apps/web/vitest.config.ts
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.tsx
  - apps/web/app/admin/_components/AdminOrganizerClaimsTab.test.ts
  - apps/web/app/api/organizer/claims/route.ts
  - apps/web/app/api/organizer/claims/route.test.ts
  - apps/web/app/api/organizer/bootstrap/route.ts
  - apps/web/app/api/organizer/bootstrap/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.ts
  - apps/web/app/api/organizer/editions/[id]/analytics/route.test.ts
  - apps/web/app/organizer/_components/dashboard/analytics-panel.tsx
  - apps/web/app/organizer/_components/dashboard/analytics-panel.test.ts
  - apps/web/app/api/organizer/editions/[id]/sponsor-report/route.ts
  - apps/web/app/organizer/_components/dashboard/sponsor-report-card.tsx
  - apps/web/lib/posthog-organizer-analytics.ts
  - apps/web/lib/posthog-organizer-analytics.test.ts
  - apps/web/app/api/admin/organizer-payments/route.ts
  - apps/web/app/api/admin/organizer-payments/preview/route.ts
  - apps/web/app/api/admin/organizer-payments/preview/route.test.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.ts
  - apps/web/app/api/admin/organizer-payments/[paymentId]/invoice/route.test.ts
  - apps/web/app/api/organizer/invoices/route.ts
  - apps/web/app/api/organizer/invoices/[paymentId]/download/route.ts
  - apps/web/app/organizer/_components/dashboard/invoices-dialog.tsx
  - apps/web/lib/organizer-payments.ts
  - apps/web/lib/organizer-invoices.ts
  - apps/web/lib/organizer-invoices.test.ts
  - apps/web/lib/organizer-invoice-document.ts
  - apps/web/lib/organizer-invoice-document.test.ts
  - apps/web/app/api/organizer/edition-requests/route.ts
  - apps/web/app/api/organizer/edition-requests/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/route.ts
  - apps/web/app/api/organizer/editions/[id]/route.test.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/route.ts
  - apps/web/app/api/organizer/editions/[id]/sponsors/[sponsorId]/route.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.ts
  - apps/web/app/api/organizer/editions/[id]/branding/route.test.ts
  - apps/web/app/api/racebook-sponsors/route.ts
  - apps/web/app/api/racebook-data/route.ts
  - apps/web/app/api/racebook-data/route.test.ts
  - apps/web/app/api/racebook-sponsors/[id]/click/route.ts
  - apps/web/app/api/racebook-sponsors/impression/route.ts
  - apps/web/app/api/racebook-sponsors/impression/route.test.ts
  - apps/web/lib/racebook-cache.ts
  - apps/web/lib/racebook-cache.test.ts
  - apps/web/lib/racebook-sponsors.ts
  - apps/web/lib/racebook-branding.ts
  - apps/web/lib/racebook-branding.test.ts
  - apps/web/app/api/organizer/publication-requests/route.ts
  - apps/web/app/api/organizer/publication-requests/route.test.ts
  - apps/web/app/api/organizer/publication-requests/readiness.test.ts
  - apps/web/app/api/organizer/events/route.ts
  - apps/web/app/api/organizer/events/route.test.ts
  - apps/web/app/api/admin/organizer-claims/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.ts
  - apps/web/app/api/admin/event-publication-requests/route.test.ts
  - apps/web/app/api/organizer/events/[id]/route.ts
  - apps/web/app/api/organizer/events/[id]/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.ts
  - apps/web/app/api/organizer/events/[id]/website-import/route.test.ts
  - apps/web/app/api/organizer/events/[id]/website-import/parser.test.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.ts
  - apps/web/app/api/organizer/events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/events/[id]/image/route.ts
  - apps/web/app/api/organizer/events/[id]/image/route.test.ts
  - apps/web/lib/optimized-image.ts
  - apps/web/lib/optimized-image.test.ts
  - apps/web/app/api/products/[productId]/image/route.ts
  - scripts/optimize-supabase-product-images.mjs
  - apps/web/app/api/race-favorites/route.ts
  - apps/web/app/api/race-favorites/route.test.ts
  - apps/web/app/api/race-events/[id]/updates/route.ts
  - apps/web/app/api/race-events/[id]/updates/route.test.ts
  - apps/web/app/api/organizer/races/route.ts
  - apps/web/app/api/organizer/races/route.test.ts
  - apps/web/app/api/organizer/races/[id]/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.ts
  - apps/web/app/api/organizer/races/[id]/gpx/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.ts
  - apps/web/app/api/organizer/races/[id]/aid-stations/route.test.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.ts
  - apps/web/app/api/organizer/races/[id]/relay-points/route.test.ts
  - apps/web/app/api/organizer/races/[id]/aid-station-products/route.ts
  - supabase/migrations/20260910081049_add_atomic_organizer_course_collections.sql
  - supabase/migrations/20260911110037_fix_organizer_publication_and_manual_payment_consistency.sql
  - supabase/migrations/20260915100443_add_generated_organizer_invoices.sql
  - supabase/tests/organizer_generated_invoice_checks.sql
  - supabase/tests/organizer_atomic_course_collections_checks.sql
  - apps/web/app/api/location-search/route.ts
  - apps/web/lib/organizer-website-import.ts
  - apps/web/lib/organizer-publication.ts
  - apps/web/app/api/plans/from-catalog/route.test.ts
  - apps/web/app/api/stripe/checkout/route.ts
  - apps/web/lib/location-utils.ts
  - apps/web/lib/push.ts
  - apps/web/lib/admin-user-notifications.ts
  - apps/web/lib/admin-user-notifications.test.ts
  - apps/web/lib/organizer-entitlements.ts
  - apps/web/app/api/organizer/publication-checkout/route.ts
  - apps/web/app/api/organizer/publication-checkout/route.test.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.ts
  - apps/web/app/api/organizer/events/[id]/onboarding/route.test.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.ts
  - apps/web/app/organizer/_components/dashboard/onboarding.test.ts
  - apps/web/components/race-planner/OnboardingOverlay.tsx
  - apps/web/components/MobileAppPrompt.tsx
  - apps/web/components/mobile-app-prompt-paths.ts
  - apps/web/lib/spotlight-overlay.ts
  - apps/web/lib/spotlight-overlay.test.ts
  - apps/web/app/admin/publications/CarouselAutomationSection.tsx
  - apps/web/app/render/carousel/[id]/page.tsx
related_tables:
  - race_plans
  - plan_share_links
  - races
  - race_aid_stations
  - race_relay_points
  - race_event_claims
  - race_event_organizers
  - race_event_publication_requests
  - race_event_updates
  - race_event_update_reads
  - race_aid_station_products
  - user_favorite_race_events
  - user_profiles
  - race_requests
  - user_notifications
  - subscriptions
  - push_devices
  - push_notification_events
  - race_slug_redirects
  - race_event_edition_sponsors
  - race_event_edition_branding
  - organizer_social_proofs
---

# Web App Architecture

Supporter Guide format identification (2026-11-15): each format gets a colour from the `colors.formats` token, assigned by increasing distance (same rule on app and web). Programme rows show a round badge in the format colour with a type icon (start ▶, expected arrival / last runner clock, podium trophy, animation by type), the moment label in that colour and a coloured dot before the race name; past rows turn grey with a check. The « Je suis » checkboxes and the Suivre / Pratique race tabs carry the same colour, acting as the legend. Animations keep the brand colour.

Supporter Guide course line endpoints (2026-11-15): `addCourseEndpoints` opens every `formats[].stops` line with a start stop (`endpoint: "start"`, km 0, `startTimes` — wave names only when there are several SAS — and start-area directions) and closes it with the finish (`endpoint: "finish"`: the organizer « Arrivée » checkpoint is enriched, otherwise a finish stop is added) carrying `expectedArrivals`, the resolved finish cutoff and finish directions. A single wave is never labelled (no « Départ commun ») in the programme either.

The Supporter Guide timeline adds `arrival_estimate` entries (official start + estimated winning time, `audience` men/women, multi-day aware) and event-wide `animation` entries (`eventWide`, `endTime`, `animationType`) shown whatever races are followed; Programme gains an Animations tab and the Arrivées tab groups expected first arrivals with the last-runner finish cutoff. Supporter Guide programme data (2026-11-15): race `organizer_details.schedule` accepts optional `estimatedWinnerMen` / `estimatedWinnerWomen` durations (`H:MM`, hours may exceed 23); event `organizer_details.programme` holds up to 60 programme items (`id`, `type` animation/concert/kids_race/briefing/village/other, `title`, `date`, `startTime`, `endTime`, `location`, `description`). Both are additive JSON validated by `apps/web/lib/organizer-dashboard-details.ts`, so organizer saves preserve them; no column or migration. No organizer form edits them yet (TODO: organizer schedule card and programme editor).

Supporter Guide places (2026-11-15): the payload adds `formats[].stops`, built server-side by `buildSupporterStops` — an aid station and supporter points sharing the same normalized place name (accents, case, punctuation ignored, « St »/« Ste » = Saint/Sainte) within 2 km become one stop carrying every role (ravito, encouragement, assistance), the supporter access rule, services, cutoff and directions. Start timeline entries carry `mapsUrl` (start area directions). Both fields are additive on `schemaVersion: 1`. Livret supporter programme (2026-11-15): type tabs (Tout, Départs, Arrivées, Podiums) instead of race tabs; a « Je suis » race selection (small checkboxes, remembered per edition) filters the Programme only (Suivre and Pratique keep their own race tabs); fully past days are dimmed and collapsed by default; on the event day the current day is live — past entries dimmed and checked, a « maintenant » line, the next entry with a countdown, and Suivre marks a place « Fermé » once its last-runner cutoff has passed. Times are compared with the device clock, assuming the supporter is on the event timezone. The web page has no reminders (unreliable on mobile browsers).

The Supporter Guide payload now carries resolved cutoffs and a sorted `timeline`; `SupporterGuideView` groups the programme by day and formats dates, distances and cross-day cutoffs per locale. Cutoff resolution uses `@trailplanner/shared` `racebook-cutoffs`, a server-side copy of the runner RaceBook rules.

The public Supporter Guide lives at `/courses/supporter-guide/[raceId]` and consumes `/api/supporter-guide`, which aggregates only immutable format publications and reuses RaceBook cache tags. The client route is mobile-first and `noindex`; `/api/supporter-guide/qr` generates a downloadable SVG QR for the organizer workspace. When the anonymous request fails with a non-5xx status, `SupporterGuideView` retries once with the stored session access token (`readStoredSession`), so an active organizer of the event sees the private preview banner.

Shared-plan follow APIs are authenticated Next.js route handlers using service role only after bearer validation and per-user rate limiting. The public token route remains anonymous and token-based; its crew-state mutation and the authenticated follow-id mutation share one validation/update service. The public page only adds a native-app CTA and preserves its snapshot contract.
Runner course pages expose one free-estimate destination (hero, reference-times block, desktop aside and a mobile fixed bar all link to the same planner URL) and an app bridge whose Livret wording is gated by public mobile visibility. The planner preserves validated course context through authentication, uses a narrow public race-summary endpoint for anonymous presentation and, in runner mode, renders `QuickRaceEstimate` for anonymous visitors with a catalog race: comfortable flat pace and/or UTMB Index → `POST /api/race-estimate` → time and ravito passages, then app download or web sign-up/sign-in with the same return path. The estimate inputs start pre-filled with real defaults (pace 6:30 /km, 10 km in 55:00) rather than placeholders, and its next-step card states the free scope (departure + first ravito) versus the full plan. The typed values are kept in `sessionStorage` (`runner.quickEstimate`) and prefill an empty `RunnerProfileStep`. `PlannerLanding` (props `onBrowseRaces`, `onImportGpx`) is the presentational no-race landing content (hero, 3 steps, illustrative plan, free vs full plan); the page metadata title is « Plan de course trail : temps, ravitos et nutrition ». It publishes association files under `public/.well-known/`. The global trial-expired overlay and blocking planner tutorial are retired.

Manual organizer billing now has dedicated admin preview, issue, corrective-invoice, settlement, PDF-repair and catalog endpoints. These service-role routes write `organizer_invoices` independently from access rights; organizer invoice list/download endpoints merge those rows with the legacy payment-backed history and lazily repair a missing PDF after authorization. The admin screen presents billing and rights as separate actions. Exact feature grants have availability but no standalone price, and flow through organizer and public RaceBook reads without granting the rest of a higher plan.

The admin area exposes a top-level `Demandes de course` queue backed by a protected, paginated service-role route. An admin can filter requests and move one to `pending`, `completed`, or `rejected`; the status update and required in-app notification are written atomically by `review_race_request_with_notification`. The reusable notification dialog also lets an admin message a user directly from the Users tab. In-app delivery is fixed on, while e-mail and push are explicit opt-ins. Each opened dialog generates one notification UUID and retains it across failed or lost-response retries until success or cancellation, so the server and providers deduplicate one logical action. Provider delivery runs after the durable write, records its outcome on `user_notifications`, and cannot roll back the request status or in-app message.

Organizer course-point autosave now waits for the active race sidecars to finish loading, and a same-race server refresh no longer clears those loaded collections. This prevents transient empty ravito/supporter payloads and removes the editor jump caused by resetting the workspace after each format save.

Organizer Matériel and Dossard authoring is glanceable rather than accordion-driven: saved equipment, pickup locations, and dated slots remain inline and editable, with fixed-column controls on desktop and wrapped controls on narrow screens. Equipment is a flat compact list: a quick-add bar sits at the top (Enter to add, suggestions, Obligatoire switch, new items prepended) and each row carries its own Obligatoire/Recommandé switch, optional weather select and remove action, while read-first inputs retain normal focus and autocomplete behavior. Third-party pickup conditions are stored additively in organizer JSON and appear on the public course detail only when pickup by another person is allowed and the bib module is public.

The organizer editor autosaves the active event or format scope after an 800 ms debounce, exposes a persistent save state with explicit retry, and preserves revision-aware background queues during navigation. New formats inherit only event-level date, location, and optional official website defaults; they never clone the active format. A format website is optional for completion, import, and publication readiness.

Organizer forms use shared progressive-disclosure controls: optional modules are added explicitly without deleting hidden values, while repeated equipment items and bib-pickup slots render as compact, single-open rows. Format-specific equipment, bib pickup, and access show a read-only summary of the inherited event content before personalization. Access keeps departure/arrival visible and moves maps, restrictions, parking, and shuttles behind action-labelled modules.

The Organizer `Suivi coureur` editor can seed a point from an existing ravito or create an independent point. Same-course access interpolates and persists a coordinate from the active GPX; separate access continues through the existing address autocomplete. Writes still pass through the authenticated organizer route and the service-only atomic replacement RPC.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

The organizer dashboard code-splits its heavy module editors and review panels, then loads module data only when needed. Structured collection autosaves are serialized and revision-aware, so an older server response cannot overwrite edits made during the request. Late dashboard responses are abortable and scoped to the active event/race. Aid-station, station-product, relay-point and sponsor-order mutations use service-only atomic database functions instead of write loops. The bootstrap embeds only lightweight status projections, so every tile is correct on first render without downloading editable collections. The shared module catalog separates selected authoring state from effective public state: inactive tiles leave navigation, while `draftOnly` tiles remain editable and are filtered from runner responses until the required offer becomes active.

The dashboard uses progressive disclosure for secondary guidance: controls keep short labels, while reusable contextual help exposes longer explanations on pointer hover and keyboard/touch focus. Validation errors, missing-data warnings, save state, and actual event values remain visible because they require immediate attention and must not depend on hover.

Organizer RaceBook statistics are also lazy. Bootstrap and the normal event-detail reload expose the same edition-level effective-access source, so selecting an event or reloading it after a mutation cannot discard a complimentary grant. The dedicated authenticated route verifies membership, capability, and format ownership before making one server-to-server PostHog Endpoint request. Its client normalizes both positional SQL Endpoint rows and equivalent object rows. Four traffic KPIs and the daily series are bounded to 7, 30, or 90 UTC calendar days; a fifth card shows the exact current event-wide favorite count from Supabase and remains independent of the period and format filters. PostHog credentials remain server-only and upstream failures render as a temporary-unavailability state rather than an empty successful series.

The event information editor uses five ordered visual sections instead of one flat grid: primary identity, online presence, edition dates, emergency contact, and cover image. The emergency block has a restrained warning surface, while the image preview and picker share one bounded row so neither creates unused page width.

The format GPX side rail keeps two independent, accessible RaceBook display switches: route map and elevation profile. They persist in `races.organizer_details.gpxDisplay`, default to visible for historical payloads, and do not affect the Organizer's own GPX validation previews. A confirmed source-delete action clears GPX-only race metadata and the private object, disables both switches, and preserves course metrics, aid stations, and saved-plan snapshots.

The edition-level RaceBook branding editor is another lazy event module. It keeps local primary/accent edits separate from its saved draft, previews both interaction colors and accent-tinted information surfaces, and publishes only through the atomic database RPC. New or invalid palettes resolve to the Pace Yourself forest green `#2D5016` and alpine blue `#3F6F8F` defaults. The shared edition-logo flag is enabled, so organizers can upload and publish a valid logo and runner-facing resolution may expose it. Non-Pro organizers receive an upsell instead of draft data.

## Purpose

`/api/racebook-data` remains a public, cacheable official snapshot. It can expose the current source revision for mobile warning presentation but must not include owner plan data; the mobile client loads that separately under runner ownership.

The web app owns the browser planner, onboarding/account flows, admin catalog tools, server-side API routes, and most Supabase service-role operations. Read this before changing `apps/web` routes or planner state.

## Key Concepts

- App Router: Next.js app routes live under `apps/web/app`.
- Server API route: a Next.js route handler that wraps Supabase, Stripe, RevenueCat, or storage calls.
- Verified session: browser session state verified against Supabase by `/api/auth/session`.
- Service role: server-only Supabase key used for privileged database and storage operations.
- Planner values: JSON payload saved in `race_plans.planner_values`.

## Framework Setup

`apps/web/package.json` marks the package as ESM with `"type": "module"`. Main scripts are:

- `npm run dev --workspace apps/web`
- `npm run build --workspace apps/web`
- `npm run start --workspace apps/web`
- `npm run lint --workspace apps/web`
- `npm run test --workspace apps/web`
- `npm run test:e2e:organizer-payment --workspace apps/web` (explicit Stripe-test opt-in and credentials required)
- `npm run typecheck --workspace apps/web`

The current web stack still runs on `react` / `react-dom` `18.3.1`. Any browser map bindings added under `apps/web` must stay compatible with React 18 until the app is upgraded; for Leaflet route previews that means staying on the React 18-compatible `react-leaflet` line rather than the React 19-only v5 releases.

`sharp` is server-only. Organizer and admin event/format thumbnails and product images are decoded, orientation-normalized, bounded to 1024 px without enlargement, encoded as WebP, and uploaded with `cacheControl: max-age=31536000` Storage metadata. Versioned object paths make a long cache safe wherever the delivery layer honors that metadata. Invalid raster payloads fail before any Storage or database write. Reference-based maintenance scripts migrate only URLs currently present in database rows: the product script updates `products.image_url`, while `scripts/optimize-supabase-race-images.mjs` updates referenced `race_events.thumbnail_url` and `races.thumbnail_url` values. Both keep prior objects for rollback instead of scanning or copying complete buckets.

The production web TypeScript project excludes `*.test.ts` and `*.test.tsx` files. Vitest remains responsible for compiling and running those tests; this prevents a web-only Next.js build from following test imports into mobile-only Expo modules whose dependencies are intentionally absent from the web deployment.

`apps/web/vitest.config.ts` aliases `next/font/google` to `apps/web/test/next-font-google.stub.ts` (2026-11-23): the real loader only runs inside the Next.js compiler, so any test importing a module that declares a font (for example `components/race-planner/plan-fonts.ts`, pulled in by the planner page and `ActionPlan`) would otherwise fail with « Bricolage_Grotesque is not a function ». The stub returns the `className` / `variable` / `style` shape; add a factory there when a new Google font is declared in code reached by tests.

`apps/web/next.config.mjs` enables:

- optional MDX page support when MDX dependencies are available;
- `experimental.typedRoutes = true`;
- `eslint.ignoreDuringBuilds = true`;
- transpilation of `@trailplanner/shared` and `@pace-yourself/design-system`;
- custom SVG handling through SVGR for component imports.
- a route-scoped `Content-Language: en` response header for `/en/*` without reading request headers in the root layout.

## Main Runtime Areas

The public homepage hero offers two explicit audience routes without adding a blocking interstitial: runners continue to `/race-planner`, while organizers first reach the explanatory `/organisateurs` page. Desktop and mobile navigation call the latter destination `Espace organisateur`, and the planner's private-course form repeats that distinction before a user creates runner-owned race data. Server-rendered `WebSite` and `Organization` JSON-LD connect the canonical site and publisher identities without inventing social profiles or a site-search action.

The `/organisateurs` server page also loads at most three published edition proof snapshots through a server-only service-role helper. The client landing receives only event identity, optional consented quote attribution and aggregate `racebook opened` counts. Its conversion hero promotes the first published snapshot as a clickable strip (race logo, testimonial excerpt, metrics in plain text) linking to `#preuve-sociale`, then that section renders the complete published selection with the race logo and a large testimonial first and the metrics in a compact side column. The logo is resolved server-side from the organizer space (published Livret coureur logo, else the event image) by `resolveOrganizerSocialProofLogo`; nothing is uploaded for the proof. A dedicated trusted-admin tab selects an edition through a keyboard-accessible local combobox that filters the authorized list by accent-insensitive trail name, year, and location, captures its analytics from the first real RaceBook publication through today or edition end plus fourteen days, stores that snapshot in Supabase, and invalidates the five-minute landing cache after a successful upsert. PostHog credentials, drafts, consent timestamps and admin actor ids never enter the public component.

### Organizer Information Import

The organizer dashboard action is named `Importer les informations` and is visible and callable only to a trusted admin. Its source step accepts an optional main website URL, up to twelve additional official URLs of any useful role, and up to eight PDF/image selections capped at 25 MB each. Additional URLs may be event, regulation, program, logistics, registration, archive, or format pages; their presence never asserts that each URL is one format. The browser uploads documents directly to the private `organizer-imports` Storage bucket through resumable TUS transfers with 6 MB chunks, retry, progress, cancellation and cleanup, then sends only their temporary paths to the API. The session manifest retains those paths only for the two review passes; apply, cancel, or expiry cleanup deletes the objects. A document-only discovery remains possible without a website URL.

The workflow has two reviews. Format discovery comes first and reports existence confidence independently from field completeness. It does not merge anonymous or named candidates from distance alone, and it keeps incomplete candidates available for confirmation. The admin confirms the final format count, bindings, names, additions, and ignores before field enrichment begins.

Enrichment converts website, structured data, GPX, current Organizer data, previous-edition references, and paginated PDF findings into typed source claims. PDF findings keep a match-centered excerpt capped at 2,000 characters for evidence and 500 for the typed value; equivalent document claims are deduplicated and limited to eight per scope and field for each document. The review displays current value, alternatives, source URL or document/page, evidence, confidence, conflicts, and missing fields for every confirmed format. New formats may stay incomplete hidden drafts. OCR for images and scanned PDFs remains pending.

For generic pages and extracted text PDFs, a bounded deterministic pass first classifies each source and extracts explicit assertions. The main page itself contributes explicit heading-based formats (including event-prefixed KMS labels such as `Event:Trail 16KM 385m D+`), and up to two same-origin linked PDFs are downloaded only when their URL or link explicitly identifies a PDF, capped at 25 MB and 100 pages. A page with several explicit named distances is classified as multi-format before repeated registration navigation can misclassify it. OpenAI is then used only for ambiguous or incomplete sources, with strict grounded output: values, evidence, and named formats must occur in the source. Registration/results/unusable pages are reported but cannot manufacture formats or course claims. The source pass is capped at twelve sources and 48,000 total characters, cached for 30 minutes by content/model hash, and persisted as signed claims for the second pass. Separately, field conflict reconciliation can return only an existing applicable `claimId` or `uncertain`; it cannot return a value or select a previous-edition reference claim. Distance concordance uses `max(0.5 km, 2%)`, and D+/D- use `max(100 m, 8%)`. Only a high-confidence, conflict-free fill of an empty field may be preselected.

### Authentication and Session

The client session entry point is `apps/web/app/hooks/useVerifiedSession.tsx`. It:

- reads and writes tokens through `apps/web/lib/auth-storage.ts`;
- verifies access tokens by calling `apps/web/app/api/auth/session/route.ts`;
- passes refresh tokens through the `x-refresh-token` header when needed;
- fetches entitlements through `apps/web/lib/entitlements-client.ts` after verification without keeping the verified-session loading state active;
- triggers the authenticated Resend contact sync for identified, non-anonymous sessions;
- clears planner local storage on sign-out.
- re-verifies on tab focus/visibility only when the last successful verification for the current stored token is older than five minutes; the initial load, session-update and storage events and the 30-minute interval are not throttled.
- reruns verification from the latest stored token when a session-update event overlaps an older in-flight request.
- aborts a browser session-verification request after 10 seconds and releases the loading state so a stalled endpoint cannot freeze protected route presentation.

The session API route validates Supabase users through `apps/web/lib/supabase.ts`, reads existing trial status without creating or extending it, and sets HTTP-only cookies through auth cookie helpers. New accounts receive no automatic trial.

### Planner API

Saved plans are handled by `apps/web/app/api/plans/route.ts`. The route:

- verifies a bearer token with Supabase anon config;
- reads and writes `race_plans`;
- stores planner state in `planner_values`;
- stores elevation in `elevation_profile`;
- checks entitlements before creating extra plans;
- enriches aid stations with nutrition when `fuelTypes` are present;
- overlays current organizer ravito products from `race_aid_station_products` on GET for plans linked to a `race_id`, without mutating the stored `planner_values`.

Catalog race plan creation is handled by `apps/web/app/api/plans/from-catalog/route.ts`. It copies GPX from `race-gpx` into `plan-gpx`, parses elevation, creates `plan_aid_stations`, and copies source station `waterRefill`, `solidRefill`, and `assistanceAllowed` flags into `planner_values.aidStations`.

When the source race has organizer station products, the route loads them server-side and stores `planner_values.organizerAidStationProducts` as an import-time fallback snapshot. The same mapping is reused by `/api/plans` GET so saved plans linked to a race receive the current official ravito products at read time. Suggestions are keyed by source station id when available, with a legacy `name|km` fallback, displayed in the planner, shown in the manual product picker for the matching ravito, and kept out of auto-fill by default unless the runner favorites/selects the product or enables the ravito-products auto-fill option.

Plan crew recap links are handled by `apps/web/app/api/plan-shares/route.ts`, `apps/web/app/api/plan-shares/crew-state/route.ts`, `apps/web/app/share/plan/[token]/page.tsx`, and `apps/web/app/share/plan/[token]/PlanShareCrewTimeline.tsx`. The mobile app sends an authenticated snapshot generated from the saved plan recap. The API verifies the bearer token, checks `race_plans.user_id`, creates a stable server-derived public token for new reusable links, stores only its SHA-256 hash in `plan_share_links`, and returns the public URL. Re-sharing a plan updates the existing stable link snapshot instead of creating another URL; legacy random-token links remain readable but cannot be re-shown because the raw token was never stored. Share URLs use the canonical web domain from `PLAN_SHARE_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, or `APP_URL`, falling back to `https://pace-yourself.com`; `.vercel.app` hostnames are ignored even when they come from those env vars. The public page hashes the URL token server-side and renders the stored snapshot plus limited `crew_state`, with highlighted assistance checkpoints, muted no-assistance checkpoints, and crew controls that persist the corrected start time and confirmed assistance passages. The crew can clear confirmed passages from the tracking card to return calculations to the planned snapshot times without changing the runner's shared snapshot.

The public client emits consent-gated, aggregate-only crew engagement events for link opening and successful state mutations. The URL token, plan identity, snapshot content, and individual passage details never leave the server-rendered secret-link boundary as analytics properties.

`PlanShareAppGate.tsx` (same folder) renders an app-first, full-screen gate when the server user agent (`detectMobileAppPlatform` in `lib/app-store.ts`) or the client (touch iPadOS) is a phone: download from the platform store, open the plan through `paceyourself://share/plan/<token>`, or a small "Continuer sur le web" remembered per plan in `localStorage`. The timeline collapses passed checkpoints, lets the crew correct or undo one confirmed passage, and turns the handover into a device-local checklist.

### Race Catalog and GPX

Catalog reads tolerate an officially unpublished D+ as `null`. Runner and admin surfaces display it as not supplied (never as zero or `NaN`), and catalog plan creation remains unavailable until a real elevation value exists.

### Admin Partner Links

The Admin `Liens partenaires` tab manages the two global Booking and Decathlon destinations. Each entry keeps a normal URL, an optional affiliate URL, an explicit affiliate-mode switch, and a global enabled switch. The browser never accesses the configuration table directly: the admin API revalidates the bearer user through trusted Auth `app_metadata`, then performs one service-role PostgREST upsert for both partners. Both seed rows are disabled, so the schema rollout alone publishes no mobile CTA. The public read-only `/api/partner-links` route uses the service credential server-side, filters enabled rows, applies the shared standard-versus-affiliate resolver, and returns only partner key, resolved HTTPS destination, and affiliation status with a five-minute CDN TTL. It never exposes disabled rows, alternate URLs, rollout flags, audit metadata, or the service credential.

### Admin 3D Course Viewer

The studio is served at `/admin/content/studio` (« Studio vidéo » in the console sidebar) since lot 1 of the admin console; `/admin/video-generator` redirects there. The page client is `app/admin/video-generator/VideoGeneratorStudio.tsx` (the former `page.tsx`, moved without changes to its logic; the other modules of that folder stay in place because the render pages and `lib/` import them). It is protected by the shared server admin layout. It reuses the complete authorized race catalog, including drafts and standalone formats, then lazily calls `/api/admin/video-generator/races/[id]` only after a format is selected. Selection changes abort the previous request.

The detail route verifies trusted `app_metadata` before service-role reads, parses the private `race-gpx` object on the server and returns a narrow route/station DTO without Storage paths or raw XML. Mapbox GL JS is dynamically loaded client-side for satellite terrain, route/marker GeoJSON layers and an isolated camera controller. A deterministic cumulative-distance engine drives a centred chase FreeCamera whose pacing follows a continuous narrated story told leg by leg, the voice running over every leg (cut at climb feet and tops, life bases and aid stations, with summit names from the Mapbox Tilequery API, short holds at stations, a high, distant camera (54° down, 4.5 to 20 km back) aimed at the runner position averaged over ±6 s and oriented from that pose rather than the terrain under it, shifted so the action sits below the title band, orbiting the relief in three-quarter views per leg instead of chasing every turn, the whole flight precomputed and low-passed in time (σ 1.8 s) so it glides like a helicopter, framing each told climb from high above with an orange border on the slope and a Pace Yourself card that pulls back as it speeds up and frames each told climb whole, burned-in voice-over subtitles timed from the ElevenLabs alignment, a steady or expressive voice model with an intonation setting and v3 performance tags, an app download call to action (iPhone and Android), a Claude-written Instagram Reel description with hashtags (`/api/admin/video-generator/caption`), a deterministic in-browser MP4 export (H.264 + AAC with the voice-over, `mediabunny` and `html-to-image`), collapsed settings groups, a green route with a white casing and start, finish and station icons drawn on the route with a card above stations on approach (name, cumulative D+, cutoff), and a day/night look from an estimated race clock), pause/resume, seek, a Reel length capped at 2 minutes that grows with the route and the narration or a fixed 30-120 s, optional intro/outro, progressive reveal, and real 9:16/16:9 framing; the complete GPX source remains unchanged. The page is a three-column workspace (race selection, viewport-height phone preview with transport bar, composition settings) and the preview overlays the Reel composition: header, scrolling slope-coloured elevation profile, current kilometre, altitude and grade, a compact title band with the profile right under it, a bottom caption of the narrated moment with its facts and service icons, the narrated slope or rolling section recoloured in a highlight colour, and Pace Yourself branding. Admins edit the narration, have Claude write it (`/api/admin/video-generator/script`) and generate an ElevenLabs voice-over (`/api/admin/video-generator/voice`); both routes are admin-only, use server-only keys, leave room for the script model's thinking tokens, accept up to 40 beats and explain configuration errors (wrong ElevenLabs key, free-plan voice restrictions), and keep the voice requests within the plan's parallel limit with retries, and the voice is scheduled with Web Audio on the same timeline as the camera. The default basemap is the Pace Yourself brand Mapbox style with prominent peaks labelled; admins can restyle it (satellite, Standard, own Mapbox Studio style, ambiance, labels, peaks, relief, route width and glow); the Mapbox logo stays on the map and the attribution is burned into the overlay as text. The detail DTO adds the edition year, race date, start time and place, and per-station services without returning organizer JSON. Each frame only moves the camera, trims a reveal layer with `line-trim-offset` (mapped through the Mercator line-progress of the drawn route so the trace never runs ahead of the marker) and moves a DOM progress marker, gated by the viewer's own layers-ready flag rather than `map.isStyleLoaded()`, which stays false while tiles stream in during the flyover. The viewer uses a stable Mercator projection, defaults to the brand topographic style with runtime satellite and Standard Satellite alternatives, and observes its preview container so the WebGL canvas follows responsive layout changes. The Mapbox container itself is unpositioned (`h-full w-full` inside an absolutely positioned wrapper) because `.mapboxgl-map { position: relative }` would otherwise override `absolute` and collapse the canvas to a black 0px viewer. Public and Organizer Leaflet components are unchanged.

Admin catalog creation lives in `apps/web/app/api/race-catalog/route.ts`. It requires an admin user, validates GPX, can create a `race_events` row, uploads GPX to the private `race-gpx` bucket, normalizes an optional image to a bounded WebP before uploading it to `race-images`, and inserts `races` plus `race_aid_stations`. New event/race rows from this flow should start as draft (`is_live = false`) unless the admin explicitly marks them live. A new catalog race initializes its required series identity with `edition_group_id = id` and `series_name = name`.

The Trace de Trail admin dialog uses `/api/admin/race-catalog/tracedetrail` for preview, import, direct GPX download, and enrichment of an existing format. The adapter tries authenticated then public provider downloads and may rebuild a GPX from geometry already embedded in the accessible trace page. Direct download returns the GPX without database or Storage writes. Catalog creation initializes the required edition-series fields for the first imported edition.

Existing-format enrichment is implemented once in a server-only library shared by the admin action and `POST /api/internal/race-catalog/tracedetrail/enrich`. The internal route uses a dedicated constant-time-checked bearer secret and accepts a bounded list of race ids, returning `imported`, `unchanged`, or `error` independently for each race. The library requires the recorded Trace de Trail provider/id, downloads only the genuine official GPX for enrichment, rejects id conflicts, stores a versioned object, verifies its bytes in Storage before and after the selective race patch, and patches only trace/GPX and parsed geometry metadata. It does not create an event or format, overwrite official distance/elevation labels, publication/commercial data, plans, or ravitos. An identical hash is unchanged only when the referenced Storage object exists with that hash.

`GET /api/cron/tracedetrail-catalog-enrichment` is the Vercel Cron adapter. It validates `CRON_SECRET`, then invokes the existing internal POST over HTTP with the separate server-only enrichment secret, so scheduling does not bypass the service authentication. Its reviewed allowlist is limited to the six 2027 Trace des Maquisards formats and the four 2027 Trail de la Galinette formats. It never discovers targets from `trace_id` alone: a new format must be explicitly reviewed for organizer download permission before entering the daily batch, and embedded-only traces fail before writes.

Runner-created private races are retired. `GET /api/races` returns only public live catalog formats and `POST /api/races` returns `410 Gone`; the planner selector no longer offers personal creation. Organizer and admin race authoring continue through their dedicated server routes.

### Public SEO Routes

The canonical homepage is French-first even though the product name is English. Its server-rendered metadata advertises `fr-FR` plus an `x-default` pointing to the same canonical URL, and the client locale helper must not replace the homepage title, description, or canonical after hydration. This keeps crawler-visible language signals stable until a genuine server-rendered English homepage has its own URL.

`/support` is a French canonical route with stable French server metadata; the client locale switch no longer mutates its canonical or metadata after hydration. The French `/partenaires` and English `/en/partners` routes publish reciprocal `fr-FR`/`en-US` hreflang entries plus the French `x-default`, and their content roots carry the matching `lang`. The `/en/*` response header adds the server-visible English signal while the shared root layout remains static.

Public metadata uses the optimized 1200 x 630 `/branding/social-preview-v2.png` as the shared Open Graph/Twitter fallback. Routes with their own course or article image keep that specific asset; public landing pages and image-less races use the shared fallback instead of emitting an image-less social card. The global header logo now goes through Next image optimization, while its dedicated favicon and Apple/structured-data icon variants retain purpose-sized raster dimensions.

Blog frontmatter supports an explicit `locale` of `fr` or `en` and otherwise defaults to French. It may also provide bounded `seoTitle` and `seoDescription` snippets for metadata and `BlogPosting`; the editorial title and introduction remain unchanged. Article metadata, Open Graph locale, visible byline/CTA/reading-time/related-post copy, `hreflang`, and `BlogPosting.inLanguage` all use the stored locale rather than guessing from accents or tags. `BlogPosting` identifies the verifiable Pace Yourself organization and its About page; no personal qualification is inferred. Its safely escaped JSON-LD is emitted by the server in the initial HTML rather than injected after hydration, and homepage guide cards never expose a technical slug as editorial copy.

`/organisateurs` is the French, indexable organizer-acquisition landing page. Its hero leads with the single-source runner-information promise, keeps `/organizers` as the authenticated event-creation form, and sends the lower-friction secondary action to the on-page TST demonstration instead of immediately leaving for an app store. The hero media is a self-contained framed, muted 30-second TST screen recording compressed for web delivery, with seven short white-and-brand-green touch indicators burned into the catalog, RaceBook, checklist and tab actions. External floating text cards were removed so no decorative copy sits behind or overlaps the phone. The frame retains only its real-preview identity, publication state and video control. Its width is bounded by both the breakpoint and the short viewport height; the hero aligns content at the top and uses a compact two-column tablet layout so the CTA and product context remain visible at 100% zoom. It also has an optimized static poster, inline playback, and automatic pause for reduced-motion preferences. The detailed demo below retains the production Google Play action and four real screenshots (course and aid stations, bib collection, equipment, and access). The TST section gives the exact in-app path: open Courses, search for `Trail TST`, select one of its three formats, then press `Racebook`. The selected screenshot is shown in full with a viewport-constrained height so the selector and preview remain usable together. The footer links to the landing page while the authenticated header continues to route "Mes courses" to `/organizers` or `/organizer` according to membership state. Only the supported UTM keys are forwarded to the creation flow.

The public race discovery surface lives at `/courses`. Its server-only service read loads only rows where both `races.web_catalog_is_live` and `races.is_public` are true, uses explicit public column selects, and requires a live optional parent event. This keeps masked organizer columns behind existing client RLS while making mobile format/edition visibility independent. Search, distance, period, grouping, and pagination are computed on the server, and only 12 event-edition groups are serialized per response; none of the complete `PublicRace` collection is sent as client-component props. The server-rendered page emits a page-scoped `ItemList`, ordinary crawlable course links, and `prev`/`next` pagination links. Filtered query combinations are `noindex,follow` with `/courses` as canonical; unfiltered numbered pages keep their own canonical and out-of-range pages return not found. Text search covers the format name/location, parent event name/location, and the event's normalized city, department, region, and country. It is accent- and punctuation-insensitive and treats entered words independently, so administrative names remain findable in any order. The default view puts upcoming/current formats before undated formats, while the past view sorts newest first. After filtering, formats sharing a stable non-null `eventId + editionId` render inside one semantic event-edition card ordered by distance; legacy event rows without an edition fall back to `eventId`, and standalone races remain separate cards. An event card formats different valid dates as a compact inclusive range, uses a shared normalized city when format locations differ, and otherwise counts distinct departure labels. Every format row repeats its own date and location so a real `race_date` is never replaced by a generic event-level message. Event and format image URLs stay distinct, missing images reserve no space, and every format keeps a crawlable course link.

Each web-public race has a canonical `/courses/[slug]` page. `generateStaticParams` deliberately returns no build-time paths: a course is generated and cached by ISR on its first request, avoiding a complete catalog/detail/GPX replay on every deployment. Catalog, slug resolution, sitemap, detail visibility, and the route page keep a 15-minute revalidation window. The raw private GPX fetch uses a one-year persistent data-cache entry because every replacement receives a new versioned Storage path; uncached slugs remain resolvable at runtime. A former slug is looked up in `race_slug_redirects`, revalidated against the durable web flag and optional parent-event visibility, then permanently redirected before rich data is loaded. Course metadata keeps titles at 60 characters and descriptions at 160 characters. The title reserves a factual distance/year suffix and truncates the middle of long race names, preserving both the event prefix and the distinguishing format code or name at the end; untruncated titles skip a distance already in the name and may add « · temps & ravitos ». When the format name does not already contain its parent event name (generic names such as « 10 km » or « Trail 22 km »), the title and description identity becomes `Event — Format`, so two events' formats never share a title. The description ends with the reference finishing-time range computed from the same cached detail as the page. Event-edition titles (`buildEventEditionMetadataTitle`) keep `Event Year` and pick the longest suffix that fits 60 characters (« : formats, parcours et ravitos », then « : parcours et ravitos », then « : formats et parcours »), otherwise truncate the event name while keeping the year.

`robots.txt` disallows `/race-planner?` in addition to `/api/` and catalog filter combinations: every course page links to `/race-planner?catalogRaceId=…`, a canonicalized planner state with no search value, which otherwise doubled the crawl. Sitemap event-hub entries use the most recent `updatedAt` among the event's formats. Every indexable static page (including `/premium` and `/support`) emits the shared social image, and static titles/descriptions stay within 60/160 characters.

Public catalog, course-detail, event-edition, and sitemap data-cache reads carry the shared `public-races` tag. Mutations also emit stable race, edition, and event tags, while always invalidating the shared tag so list and detail views refresh together. Successful organizer publication/visibility, source metadata, image, ravito, edition, and event writes plus admin catalog mutations invalidate on demand; failures do not. Invalidation is best effort and the 15-minute TTL remains the fallback.

The lightweight catalog DTO and server-only detail DTO are deliberately separate. The detail service rechecks web-public race and live parent event before service-role organizer, edition-date, ravito, or private GPX reads. Public entitlement, exact capability grant, and module-setting reads use the same 15-minute data-cache window as the detail instead of the private Organizer loaders' `no-store` policy, so on-demand generation and ISR revalidation never change the route from static to dynamic. It applies the shared inheritance parser but serializes only an explicit runner-safe shape: emergency phone, `lastMinuteMessage`, raw organizer JSON, GPX paths and GPX source content never reach client components. Aid-station summaries are a deliberate catalog exception: id, name, kilometer, water, and solid food are public unless the organizer explicitly disables the module; cutoff, altitude, cumulative elevation, assistance, drop bag, notes, relay data, and products require the currently published and effective Livret module and are not selected otherwise. A valid private GPX is parsed on the server and reduced to about 600 route/profile points; invalid GPX removes only that visualization. Detail pages add `BreadcrumbList` JSON-LD and add factual `SportsEvent` JSON-LD only when the format has a valid calendar date in strict `YYYY-MM-DD` form. They also provide Open Graph/Twitter image fallbacks, responsive map/profile and ravito cards, an app bridge when detailed ravito data is unavailable, native/Facebook/copy sharing, same-edition formats, similar races, distinct official sources, and a planner link carrying `catalogRaceId`.

The detail page hierarchy is decision-first and mirrors the app RaceBook header: `RaceHeroSummary` renders the photo with a dark veil carrying event name, title, date/location and participation badge, an icon-only `PublicRaceShare` (`variant="icon"`, card background for contrast), a metric strip that wraps into rows on phones and scrolls horizontally from `sm` (distance, D+, D− when real, departure, cutoff, ravito count, max altitude when known), the planner CTA, the registration link (omitted for the Trail TST demo, which shows a « Course de démonstration » pill instead), and horizontally scrolling other-format pills labelled with the format name plus its distance. A stored D− of 0 is an import placeholder and is hidden unless the GPX preview confirms it. The mobile fixed estimate bar (`StickyEstimateBar`) stays hidden while the hero estimate button is visible. The ravito timeline merges an organizer start/finish row into the Départ/Arrivée endpoints instead of listing it twice. Below the hero, the sticky `RaceSectionTabs` bar (`#temps`/`#route`/`#ravitos`/`#infos-pratiques`/`#a-decouvrir`) jumps to the « Combien de temps pour finir … ? » reference-times block (`RaceTimeEstimates`), then the route section (map + elevation profile stacked full-width, with a desktop sticky "Informations clés" aside), the `RaceAidStationsTimeline` (vertical timeline replacing the old ravito grid), and an `Informations pratiques` block built from reusable `AccordionItem`s, each with a category icon and split into two visually distinct groups: "Essentiel pour courir" (schedule and access open by default, bib pickup opens automatically within 14 days of race day, each showing a one-line collapsed summary) and "Informations complémentaires" (equipment/services/runner-info, collapsed, no summary). Equipment items show a colored "Obligatoire"/"Recommandé" badge instead of inline text, binary bib-pickup answers (third-party pickup, equipment check) use the same badge pattern, and every external map link (départ/arrivée/parking access, bib pickup location) renders as a bordered button with an icon instead of a plain underlined link. The route map uses `RaceRouteExplorer`, a client wrapper that keeps `GpxRouteMapClient` non-interactive until the runner taps "Explorer la carte", so page scroll on mobile is never captured by the map. All accordion/timeline content stays in the server-rendered HTML for SEO; only visibility toggles via native `<details>`. A closing "Autres courses à découvrir" block sits in its own muted, rounded container to separate discovery links from this race's own information, rendering "Autres formats" and "Courses de distance similaire" as horizontal scroll-snap carousels (`RaceLinksCarousel`) rather than a grid. The distance, region and month landing pages reuse the `/courses` event cards (`EventRaceGroup` / `StandaloneRaceCard` exported from `RaceCatalogFilter`) through `RaceLandingPage`; `PublicRaceLinks`, the original grid component, is no longer rendered by any route.

Every detail page also renders a factual overview from its verified event, date, location, distance, and D+ so formats without GPX still expose useful race-specific copy. When eligible, `SportsEvent` JSON-LD includes a canonical entity id, scheduled status and a URL-only registration `Offer` while the format has not passed (a finished format keeps the factual item without `eventStatus` or `Offer`: schema.org has no finished status), a known event organizer identity, and a physical `Place` assembled only from verified start label/address/coordinates and normalized geography fields. Missing postal components, price, currency, and availability are omitted. Without a valid `startDate`, or for the Trail TST demo, the complete event item is omitted while `BreadcrumbList` remains. A single-day edition supplies the same `endDate`; a later edition end is used only when strict stored start and finish-cutoff clocks prove that the format crosses midnight. Slugged editions add a `superEvent` that is a bare `@id` reference; `/courses/evenements/[slug]` renders the parent event with `subEvent` `@id` references to its public formats, so nested items are never validated as partial Events. The same route also serves the permanent event hub (`race_events.slug`): it publishes the featured edition's `SportsEvent` under that edition's `@id` with the hub as `url`/`mainEntityOfPage`, and no `EventSeries` (an Event subtype Google would validate as a partial Event). The course breadcrumb, the « Toutes les éditions et formats » link and the catalog card « Voir l’événement » target the hub when the event has a slug. Every `SportsEvent` carries an image (falling back to the shared social image). Mobile anchor navigation links only to sections present in the HTML.

An event-edition page stays indexable after its final day (the Trail TST demo pages are `noindex,follow` at any date). The server compares the stored inclusive end date with the current Europe/Paris calendar day: only the following day produces the “Édition terminée” banner. When a later public edition exists, past pages link to it from that banner and non-past pages surface it in a dedicated next-edition callout.

`/courses/distances/[category]`, `/courses/regions/[region]` (French regions) and `/courses/mois/[month]` (`mai-2027`) are server-rendered ISR landing pages (`revalidate = 3600`, generated on first request) built by `lib/race-landing-pages.ts` and `RaceLandingPage`. They list only dated upcoming formats (Europe/Paris, Trail TST demo excluded), exist only with at least five of them (`MIN_INDEXABLE_RACES`), and paginate 12 event groups per page under an optional `[[...page]]` segment (`/page/2`, `/page/1` and out-of-range pages are not found) with self-canonicals, `prev`/`next` links, a page-scoped `ItemList`, a breadcrumb, titles within 60 and descriptions within 160 characters, and links to every other indexable distance/region/month page (also shown on `/courses`). The region of a format comes only from the parent event's normalized INSEE `location_region_code` with `location_country_code = 'FR'` (exposed as the derived `PublicRace.regionSlug`, never the code itself); free-text locations are not used to manufacture geographic landing pages.

`/calculateur-glucides-trail` is a public server-rendered landing page with an interactive client calculator. Duration, distance, elevation gain, and digestive-tolerance sliders keep their visible values, but the nutrition result remains hidden until the runner starts an explicit calculation. A short client-only loading state reveals the estimate and one intentionally unfair elite pace comparison. The comparison is deliberately compact: one projected time-gap headline followed by one larger randomized trail mishap. Changing any slider invalidates the displayed result. Distance and elevation provide comparison context only; they do not alter the carbohydrate estimate.

`/race-planner` keeps the interactive planner behind its existing Suspense boundary but renders a useful French H1, summary and capability list as the server fallback. Its `SoftwareApplication` JSON-LD is emitted server-side so crawlers receive both the structured data and useful page content in the initial HTML.

The planner race picker (`RaceCatalogModal`, opened by « Parcourir les courses » / « Choisir une autre course ») mirrors the mobile app catalog instead of a table: a full-screen sheet on phones (`100dvh`, safe-area padding) and a centered panel from `sm`, a search field (16 px text so iOS does not zoom) with a clear button, the app distance quick filters (`< 30 km`, `30–60 km`, `60+ km`, filtered client-side), and one card per event like the app (thumbnail, event name, date · location) listing its formats (label without the event prefix via `getFormatLabelWithinEvent`, distance and D+ cotes). A format with a GPX is itself the click target: a light full-width row button (name, km, D+, chevron; accessible name « Utiliser le GPX : <event> <format> ») calling `onUseRace(raceId)`, with « Ouvrir Trace de Trail » kept below it when a trace id exists. The live catalog is loaded once and searched client-side across format name, event name and locations; the count shows events. `groupCatalogRaces` (tested) keeps only the latest edition of a format name repeated in one event, sorts formats GPX first then by distance, hides events dated before today (calendar day in Europe/Paris via `getCatalogToday`; a race dated today, like the daily-refreshed demo event, stays), and orders events with a usable GPX first then events without any trace, each block by date ascending with undated events last. Formats without a GPX are muted, non-clickable rows with a « Pas de GPX » label. Escape, the backdrop and the close button dismiss it; focus is trapped and page scroll locked while open. `GET /api/race-catalog` additively embeds the parent event (`race_events(id,name,location,race_date,thumbnail_url)`) plus `event_id` and `race_date`. The public `/courses` catalog is a separate component (`RaceCatalogFilter`) and is not affected.

The calculator's bounded duration/tolerance interpolation lives in `apps/web/lib/carb-calculator.ts` and is documented separately from the full planner allocation rule. Its share links are stateless: `duration`, `tolerance`, `distance`, `elevation`, and stable `comparison` / `joke` ids reproduce the same estimate and copy. The client accepts only in-range, step-aligned values and known ids; invalid or incomplete query strings fall back to the untouched calculator. Sharing uses the browser Web Share API when available and clipboard copy otherwise, without a database write.

`/a-propos` and `/methodologie` explain the product mission, editorial safeguards, calculator assumptions, source policy, and correction path. They are linked from the global footer and included in the sitemap to provide public trust and provenance signals.

`sitemap.ts` includes the organizer landing page, Premium, French and English partner acquisition, support, race catalog, every currently published race slug, one permanent hub per public event (`/courses/evenements/<event-slug>`, falling back to the edition URL only when the hub slug is unavailable; both without the Trail TST demo event), every page of the qualified distance, region and month landing pages, the calculator, trust pages, and existing blog pages. Race and event-edition URLs use the latest available format/event/edition `updated_at` as evidence-based `<lastmod>`; aid-station-only changes cannot affect it because station rows do not currently store `updated_at`. Landing pages (each paginated URL) use the newest timestamp among their listed races; hubs use the newest timestamp of any of the event's formats. Blog discovery resolves `content/blog` from both the web workspace and monorepo/runtime ancestors and fails explicitly when the directory is absent, preventing a successful but empty blog sitemap. `robots.ts` permits public crawling but excludes `/api/` and `/courses` filter combinations (`q`, `distance`, `period`), which are already `noindex` and each cost a server render; `?page=` pagination stays crawlable. Account, admin, onboarding, organizer-dashboard, organizer-creation, planner-print, and token-share route layouts reuse `noindex-metadata.ts`; they remain crawlable so search engines can observe the noindex directive, but should not remain in the index. The legal notice publishes the maintainer-confirmed micro-enterprise identity, registration, contact, VAT exemption, publication director, and Vercel hosting details. The four legal routes keep distinct self-canonicals and remain `noindex,follow` pending broader legal validation, including designation of the consumer mediator required for paid consumer offers.

### Organizer Portal

The admin Organizer area separates publication and membership work into `Publier le RaceBook` and `Accès organisateurs`. Its publication-rights collection is filtered client-side by an accent-insensitive event/location/format search plus the existing offer selector, then paginated in ten-event pages; changing either filter returns to the first page. Its rights dialog uses large radio rows for Visibilité, Essentiel, Complet, and Signature; choosing Visibilité keeps the catalog edition visible while removing its RaceBooks from public access. Choosing a new virement preloads the canonical pack price and zero VAT under article 293 B CGI, and requires the customer's legal name and billing address. The SIREN is optional for organizations that do not have one, but must contain nine digits when supplied. The preview endpoint renders a non-persisted inline PDF through the same `pdf-lib` document builder used at issuance. The protected write route derives the canonical amount, normalizes the payment date to midnight UTC, creates the payment/right, allocates its chronological invoice number, freezes the legal snapshot, and uploads the final PDF. A paid historical virement without invoice instead shows `Générer une facture`; its preview and issuance load the immutable payment amount/date/tier server-side, attach the result to that row, and leave the existing right unchanged. Direct assignment uses two searchable comboboxes: the event field filters the already admin-authorized event list locally, while an e-mail query of at least two characters requests at most eight matching Auth accounts from the protected route. Because the shared blurred `Card` primitive creates a stacking context, the complete assignment card is positioned above the following active-access card; the listboxes then remain visible outside their fields instead of being trapped behind the sibling card. A missing account remains a valid manual value and returns a bounded not-found response that opens a cancel/create dialog; confirmation calls the route again with `/reset-password` in GoTrue's `redirect_to` query parameter and the canonical race name in `data.event_name`, creates the membership, and sends the invite. After choosing a password, the page persists the invited session and opens `/organizer`. Assigning or reactivating an existing account sends a Resend transactional notice only after the membership write succeeds, with the canonical event name and a `/sign-in?next=...` CTA whose validated return path retains the selected event UUID; delivery failure is logged without rolling back the granted access. The browser never receives the service credential, Resend key, or complete Auth user list.

For trusted admins, the organizer header also exposes `Importer les informations`. That flow posts to `/api/organizer/events/[id]/website-import`, reuses the existing UTMB / Trace de Trail import adapters when possible, and falls back to generic HTML/JSON-LD extraction. It is review-first in two passes: source discovery writes no race data; confirming the final format list atomically binds existing rows or creates hidden drafts; applying reviewed fields later enriches only that event and those confirmed formats. It must never create another event row or publish a Racebook automatically. Historical drafts are importable even after the normal edition edit window has elapsed.

The Organizer header keeps only the selected event/edition, completion, primary publication CTA, and a secondary `Actions` menu visible. Notification, import, edition/event creation, and destructive actions live in that menu; typed confirmations remain mandatory. The collapsed visibility panel retains the edition-wide catalog switch and gives each format one accessible three-state radio control: `Masqué` sets both preview and runner visibility off, `Privé` keeps only organizer preview, and `Public` requests entitlement-checked runner publication. `POST /api/organizer/editions/[id]/publication` still atomically publishes all selected complete formats from the primary CTA. `PATCH /api/organizer/editions/[id]` hides or restores complete course rows after active membership validation; hiding always forces attached Racebooks off. Edition `DELETE` invokes the atomic service-only deletion RPC, cleans up format GPX/images, and returns the remaining year the dashboard should select.

The new-edition dialog keeps the active request visible until the refreshed edition is ready. During a duplicated creation it announces `Duplication de l’édition en cours…`, displays an indeterminate spinner plus a short wait message, marks the form busy, and disables dates, duplication choice, cancel, submit, and overlay dismissal so the organizer cannot accidentally start or imply a second operation.

The organizer dashboard reuses the shared planner spotlight overlay for a six-step first-arrival guide. `GET /api/organizer/bootstrap` includes the membership's nullable onboarding timestamp; the client opens the guide only after the selected event and completion surface are ready. The overlay waits for the cookie choice, suppresses the global mobile-app prompt while active, locks document scrolling, restores focus on close, measures its rendered card, and recalculates a viewport-clamped spotlight on responsive viewport changes. `PATCH /api/organizer/events/[id]/onboarding` stamps the active user's membership idempotently when the guide is finished, skipped, or closed. Admin selector rows remain synthetic and are excluded from automatic display. `Actions > Revoir le guide` is presentation-only and leaves the stored first completion unchanged.

The publication dialog captures the selected event id, canonical edition id, year, and effective tier when it opens, displays the event/year context, and reuses that stable snapshot for checkout. It explicitly overrides the shared dialog's narrow default width, keeps its header fixed, bounds itself to the viewport, and gives the commercial cards and optional admin partner actions one internal scroll region. It shows Essential, Complete and Signature only when publication starts from Visibilité; an already-active paid or complimentary tier publishes directly, while effective-module serialization withholds higher-tier drafts. A failed single-format publication may reopen the commercial dialog only when the displayed effective tier is still Visibilité; with an active paid or complimentary tier it remains an inline operational error. A verified admin may open the separate upgrade flow and use the same snapshot to grant a higher tier without Stripe; ordinary organizers never receive that section. Dated legacy/imported formats missing `edition_id` are repaired by the canonical-edition backfill rather than billed or granted from a year-only browser guess.

The post-analysis recap uses a viewport-bounded flex dialog: its header and validation actions stay fixed while the center review panel owns vertical scrolling. The flex display is explicitly prioritized because the shared `cn` helper concatenates utility classes and does not resolve a route-level `flex` against the dialog primitive's default `grid` class.

Each detected format carries existence evidence plus a separate completeness summary. Scores may help order the review but are not a visibility or creation threshold. The first step exposes all credible candidates so the admin can confirm the count, merge/split detections, bind an existing format, add a missing format, or ignore a false positive. A candidate remains confirmable without date, distance, D+, or GPX.

For non-provider sites, the general URL remains the primary source for event-level facts and common logistics and can also yield structured format blocks. The importer discovers a bounded set of hint-matched same-origin pages and combines them with the explicitly supplied additional official URLs. Every fetched page is classified by role before its grounded assertions are promoted. Only compatible event/format/regulation evidence with an explicit name can add a format candidate; registration deadlines, result archives, unrelated logistics, and unnamed distances cannot. Extraction otherwise combines JSON-LD, accessible tabs, embedded GeoJSON, headings, named regulation prose, and bounded LLM assistance. Candidate consolidation requires compatible normalized identity evidence. Anonymous same-distance detections remain separate for the admin, and proximity alone never attaches a GPX to a named candidate across pages. The legacy one-pass `formatUrls` request remains readable as its former authoritative compatibility mode, but the current two-pass UI writes `additionalUrls`.

GPX detection accepts explicit `.gpx` URLs, labeled download anchors, supported Trace de Trail embeds, and complete public GeoJSON route geometry. Recovered geometry is parsed through the normal GPX pipeline and becomes a high-confidence claim only after unambiguous format association. The importer never guesses absent elevation data or reconstructs routes from map tiles/screenshots. Incomplete confirmed formats may still be created as hidden drafts; a format without GPX keeps its GPX path and hash columns null because GPX is not part of the catalog publication minimum.

The v1 organizer portal is web-only:

- For a trusted admin, `/api/organizer/claims` replaces the membership-limited selector data with every `race_events` row ordered by name, including drafts. The downstream Organizer detail and mutation routes use the same admin bypass through `requireEventOrganizer`; non-admin selector data remains membership-scoped.
- `GET /api/organizer/bootstrap` verifies the bearer token once, returns the same claims, memberships, edition requests, and publication requests as `GET /api/organizer/claims`, then includes the selected authorized event detail. It deliberately excludes GPX, products, ravitos, relay points, updates, and follower data. The client loads GPX only for the Course or Ravitos module, loads the race sidecars and product catalog only for Ravitos/Products, and loads runner updates/follower totals only when their dialog opens. An explicit `eventId` must belong to the returned active memberships, except for trusted admins whose selector represents the complete event catalog; without an id, the first selectable event is used, and `event` is `null` when none exists.
- The same bootstrap membership projection includes `dashboard_onboarding_completed_at`. It is per user/event and remains null on synthetic admin rows; it is not event content or an edition-wide setup flag.
- The route-local Organizer data cache keeps the product catalog for 5 minutes, complete ravito/relay/station-product sidecars per race for 2 minutes, and GPX previews for 10 minutes. Its LRU bounds retain at most 20 sidecar races, 20 GPX races and three GPX paths per race. GPX entries are keyed by both race id and `gpx_storage_path`, so a replaced source path cannot reuse the previous preview. Organizer mutations invalidate the affected race entry, and a session boundary clears the complete cache.

- `/organizers` creates a new catalog-visible event through `POST /api/organizer/events` and immediately creates its active owner membership; its new formats remain private until explicit publication. It does not claim existing catalog events, expose the admin-only URL importer, or send `officialSiteUrl` during creation. After success it redirects to `/organizer` with only the new event selected. The `/organizer` server page still normalizes legacy/admin `eventId` and `importUrl` values from its `searchParams` prop before passing them to the client dashboard, which keeps the route compatible with static generation without a client-side search-param bailout.
- `/organizer` lets active event members maintain catalog-visible events, canonical `race_event_editions` ranges, and attached formats. Its header is task-first: one compact searchable event combobox, the edition selector, one completion bar, one publication CTA, then a secondary action menu. The same event field opens the authorized list and filters it while the user types; its listbox remains keyboard navigable. The visibility panel is closed by default and maps each format's persisted booleans to `Masqué`, `Privé`, or `Public`; moving from Public to Privé explicitly clears `racebook_is_live` without hiding the private demo. The format workspace keeps every selected-edition format visible to authorized organizers/admins: masked choices are grey with `Course masquée pour le public`, private choices show `RaceBook privé`, and public choices show `Course et RaceBook publics`, including in the responsive native selector. The compatibility `/api/organizer/edition-requests` URL creates the edition either empty or with cloned formats and no longer writes the retired review table. Essential, Complete or Signature remains required for Public, and admin/legacy-admin grants remain auditable complimentary access.
- In a selected format tab, the required module card is named `Course`. The `Formats & GPX` editor stays permanently expanded, has no internal runner-preview or single-format duplication action, and aligns the destructive format-delete action at the far right of its title row. Its former helper description is intentionally omitted. Format dates and locations inherit respectively from the selected edition and event until the organizer enables their explicit `Date différente` or `Lieu différent` controls.
- The format information grid exposes one `Nom du format` input. Its client state and save payload keep `races.name` and `races.series_name` identical, while `edition_group_id` remains the stable cross-year grouping key.
- The organizer dashboard now uses a route-local address autocomplete field for event location, format location, bib pickup, and start/finish access addresses. Bib pickup accepts several event-level locations, each with several structured date/start/end slots; the legacy single location and free-text schedule remain readable as compatibility fallbacks. The editor calls `/api/location-search`, keeps the first bib location mirrored into the legacy text/location fields, and stores the complete location and slot list in `organizer_details` so published runner surfaces can expose every address, GPS link, day, and time range.
- The Organizer access form groups its unchanged `organizer_details.access` fields in the same runner-facing order used by mobile: locations/map, priority information/restrictions, then parking/navettes. Section switches sit with the group they control; no extra table or JSON key is introduced by this visual hierarchy.
- The event `Informations` editor stores the optional official website, Instagram URL, Facebook URL, and a structured emergency contact name and phone in `race_events.organizer_details`. The shared parser adds `https://` to valid domain links pasted without a protocol, rejects invalid or non-HTTP(S) values, and normalizes French phone inputs to the canonical `+33 X XX XX XX XX` display. These values stay behind the existing organizer membership-checked event route; no separate event column or client-side Supabase write is introduced.
- The organizer creation screen and dashboard keep concise, consistently accented French copy across `/organizers` and `/organizer`.
- The main header always shows "Mes courses" / "My races". It opens `/organizers` to let a new organizer create their first event, then opens `/organizer` after `/api/organizer/claims` reports at least one active membership.
- `apps/web/lib/organizer.ts` centralizes bearer-token verification, admin checks, service headers, and event-membership checks.
- `/api/organizer/*` routes verify the current Supabase user and then use the service role for authorized mutations.
- `/api/organizer/events/[id]/updates` returns recent announcements plus an aggregate follower count. Its Supabase REST read requests `count=exact` with a one-row range, so the server does not transfer the full cross-user favorite list.
- `/api/race-favorites` is the authenticated runner bridge for favoriting `race_events`, and `/api/race-events/[id]/updates` is the runner/mobile read route for the latest published organizer announcements on live events.
- `/api/admin/organizer-claims` keeps legacy access-claim review and membership revocation, and lets a trusted admin attach an existing Supabase Auth e-mail to an event as an `organizer`. Auth-user lookup and membership writes stay server-side; direct assignment grants edit access without changing catalog/Racebook state. `/api/admin/event-publication-requests` returns the pending queue plus every event's current-edition Racebook state. Approval invokes the service-role-only review function; the admin event switch invokes a separate service-role-only function to publish or hide Racebooks; and `setEditionTier` invokes the audited entitlement RPC (kept for compatibility; since lot 4 of the admin console no screen calls it: the admin tab uses `setEditionGrant`, and `/organizer` shows admins a « Gérer le pack dans l’admin » link to `/admin/organizers?edition=<id>` instead of the former « Offrir une offre partenaire » buttons).

Organizer edits are source edits for `race_events`, `race_event_editions`, `races`, `race_aid_stations`, `race_relay_points`, and station products. Active membership authorizes private draft authoring, including modules above the current offer. Public publication and costly operations remain behind centralized edition capabilities; public serializers combine the publication flag, entitlement tier, and selected module before returning content.

Inside the format-level `Départ, ravitos, suivi coureur & relais` editor, the common start and finish schedule cards render above the local `SAS`, `Ravitos`, default-enabled `Suivi coureur`, and conditional `Relais` tabs. The common departure uses a native minute-precision time input. Unambiguous legacy strings (`9h`, `10h15`, or `11:10:00`) normalize to `HH:mm` in the organizer form and are persisted canonically on the next save; strings carrying several starts or prose remain untouched, appear beside an empty time control with a migration warning, and must be represented with SAS instead of being collapsed. `Ravitos` is the default local tab on initial mount and after changing format or participation mode. When at least one SAS exists, its earliest native time is displayed as the format start and the common start field is disabled; removing the last SAS restores manual editing without clearing the stored time. The contextual add action follows the active list tab. `Relais` shows compact derived legs in one horizontal row above the handover-point editor; handover cards expose only the point name, distance, cutoff, and a compact delete cross, while the persisted optional passage time and notes remain outside the current editor. Solo formats omit only the relay tab. This split is presentation-only and does not change the existing race-details, aid-station, or relay-point save order.

The same approved-only dashboard exposes a manual `Notifier les coureurs` modal. The organizer selects the whole event or one format from the selected edition before sending. The route validates that the format belongs to the event, stores it as nullable `race_event_updates.race_id`, and uses the event or format name in the push title. Delivery still targets event followers; the payload includes `eventId`, `updateId`, optional `raceId`, and a catalog deep link. Delivery is logged in `push_notification_events` as `notification_kind = 'organizer-race-update'`. Each recent history card also has a compact delete cross; the `DELETE` handler repeats the organizer membership check and scopes the service-role deletion to both event id and update id.

The organizer write surface remains edition-aware for selection and grouping, but no longer becomes read-only based on `race_date`. Active event membership is the mutation authorization boundary for past and future editions.

For a brand-new organizer format, the add-format form may hold a pending image and GPX before submit. `OrganizerDashboard.tsx` parses GPX in-browser to prefill exact course metrics, defaults the race date from the selected edition, persists the effective inherited event location, and exposes the official source required by catalog publication. The create route requires `editionId` and validates the date range before the existing image/GPX routes persist pending files. Existing-format GPX replacement keeps the same edition and refreshes returned metrics directly into the active form. Pricing stays closed until a local prerequisite check finds at least one publishable format; the server still revalidates persisted data before checkout.

`apps/web/e2e/organizer-payment.spec.ts` covers the public organizer hero, password sign-in, TEST event and format creation, Stripe test-card payment, webhook-confirmed entitlement, and UI deletion. Its fallback API cleanup runs even after a failed assertion.

The completion shell intentionally omits a local "Avancement global" heading/helper line above the tabs. The task-first header exposes completion once, keeps publication primary, groups rare actions, and starts detailed visibility collapsed. Dirty work displays a fixed save bar. Scope navigation is split explicitly between `Informations communes` / `Commun à toutes les courses` and `Formats de course`; mobile mirrors the same hierarchy with labelled option groups and an explicit `Ajouter un format` option. Module tiles contain only their emphasized title, content summary, and actionable missing-field text. Grey, amber, and green surfaces mean empty, partial, and complete; the active tile adds a strong brand ring independently of completion color.

Format-level detail modules keep their context in the main card header instead of repeating it inside a nested panel. `Dossard`, `Matériel`, and `Accès` display their `<module> - <format>` title with the corresponding format-specific override control right-aligned in that header. Their fields render directly in the module content area only while the override is enabled; otherwise the format inherits the event value.

The equipment editor layout should keep each item on one compact flexible row so the material name, weather toggles, status radios, and delete action stay in the same horizontal flow whenever width allows.

### RaceBook Sponsor Routes

The optional Organizer `Sponsors` tile is Signature-only for runner presentation. Opening the selected private draft lazily reads the edition list; metadata includes the partnership level, optional category, loading/hero flags, and one exact contextual placement. Organizer routes repeat active-membership and selected-module checks for writes. Ordering submits the complete list to one service-only transaction; partial lists, foreign ids and duplicate positions are rejected. The same tile reports active rows plus aggregate raw clicks and impressions. All database and `race-images/organizer-sponsors/{editionId}/` writes remain server-side; route validation repeats the ten-row/two-loading database limits and removes superseded objects.

`/api/racebook-data?raceId=...` resolves one immutable publication containing the race, ravitos/products, supporter and relay points, SAS, awards, services, sponsors, branding, and asset references. `/api/racebook-sponsors` can be pinned to that publication id, and `/api/racebook-gpx` resolves the GPX path from the same service-only snapshot. Public responses use a one-hour Vercel CDN TTL (one-day stale-while-revalidate) with race/edition/event cache tags, so tag purges rather than the TTL deliver organizer changes; the shared helper also serves `/api/onboarding/race-profile`, whose admin catalog GPX edits do not purge and are therefore visible within the hour; private organizer reads remain authenticated and `private, no-store`. Autosaves only increment the draft revision and never invalidate the public cache. Publication, restoration, visibility, and effective entitlement changes invalidate the relevant tags; the previous immutable version remains safe if invalidation is temporarily unavailable.



The sponsor response exposes only active presentation DTOs (`tier`, optional `category`, exact `contextualPlacement`) and counted redirect URLs; it never exposes destinations or counters. The redirect validates edition membership, rate-limits counting with a hashed network identifier, attempts the atomic increment, and always preserves navigation to a valid active sponsor target. The separate POST impression route accepts a random view UUID and exact surface placement, deduplicates and throttles it through opaque rate-limit keys, validates the active module/configuration, and uses a service-only RPC that repeats the published race/edition gate before incrementing the aggregate counter.

The same public snapshot adds `supporterPointRows` only when the independent module is effective, and filters incomplete drafts before serialization. `GET/PUT /api/organizer/races/:id/supporter-points` remains membership-gated and uncached; PUT calls the service-only atomic replacement function and invalidates the race snapshot. The organizer sidecar cache always stores the draft collection beside ravitos and relays; its first load honors the module's enabled-by-default contract even if settings have not finished loading, and it is invalidated after mutation.

### Billing and Entitlements

Runner billing is independently gated by the server-side `runner_monetization_config` flag (default off). Identified users can create free previews, while plan-detail editing is authorized per owned plan by global annual access or a canonical format/edition unlock. Historical paid plans stay readable after expiry. `GET /api/plans/:id/access` is the client contract; route handlers must enforce the same decision and never accept a browser-supplied purchase scope. Trusted admins may select a session-only real/free/premium simulation through the protected admin route; it does not debit, alter a subscription, or create durable access.

Stripe routes live under `apps/web/app/api/stripe`:

- `checkout/route.ts`: creates subscription checkout sessions.
- `portal/route.ts`: creates billing portal sessions.
- `price/route.ts`: fetches the configured Stripe price and caches it for 5 minutes.
- `webhook/route.ts`: verifies Stripe signatures and updates `subscriptions`.
- `organizer/publication-checkout/route.ts`: creates one-time 199/349/499 € HT edition checkouts, plus 150/300/150 € HT upgrades, selected entirely by the server.

The Stripe webhook also updates `organizer_edition_payments` for immediate/deferred payment outcomes, expiry, refunds, disputes, and the generated Invoice reference, then recalculates the separate edition entitlement. Organizer success redirects poll the normal event detail until the webhook-confirmed tier appears. The same ledger stores admin-recorded EUR bank transfers plus generated invoice number and legal snapshot. Missing invoices on eligible historical virements are issued on demand through the service-only numbering function, without another payment insert. Organizer event/bootstrap DTOs expose only a sanitized purchase summary; the Factures action loads event-wide edition history, shows the invoice number, and obtains private-Storage or Stripe PDF URLs from membership-checked server routes. Supabase may return a signed path rooted at `/object/sign/...`; the server resolves that path against the Storage API base so the browser receives `/storage/v1/object/sign/...`.

Generated bank-transfer invoices require the customer legal name and billing address. Customer SIREN is optional, validated as nine digits when present, and omitted from the shared preview/final PDF renderer when absent.

RevenueCat routes live under `apps/web/app/api/revenuecat`. They synchronize mobile purchases into the same `subscriptions` table with provider `google` or `apple`.

Resend contact sync lives under `apps/web/app/api/resend/contact/route.ts`. It validates the current Supabase bearer token, skips anonymous users, rate-limits by user id, and upserts a Resend contact using the server-only `RESEND_API_KEY`. The same server-only REST helper sends the existing-account organizer-assignment notice after membership persistence; it uses the verified `mail.pace-yourself.com` sender and escapes database display text before inserting it into HTML.

### Public course registration links

The public catalog allowlists `race_events.website_url` in the lightweight race DTO and uses it for a prominent external `S’inscrire` action on event cards, distance cards, and the course hero. Standalone formats fall back to their validated `races.external_site_url`. Invalid or non-HTTP(S) values produce no outbound action, and the hero keeps planning as the secondary internal action when registration is available.

## Security Posture

Server routes generally use:

- `extractBearerToken` and `fetchSupabaseUser` from `apps/web/lib/supabase.ts`;
- `withSecurityHeaders` from `apps/web/lib/http.ts`;
- service-role requests only in server code;
- route-level rate limiting through `checkRateLimit` or `checkRateLimitAsync`.
- hashed secret-link lookups for public plan recaps; raw share tokens must not be stored in Supabase.
- narrow secret-link mutations for public crew tracking; `crew-state` may update only `departure_time` and `crew_state`.

See [../04-auth-and-security/rls-checklist.md](../04-auth-and-security/rls-checklist.md) before changing a route that bypasses client RLS.

## Organizer form shell

Organizer navigation uses one desktop section level and a matching mobile selector. Section tiles distinguish `À compléter`, `Optionnel`, and `Complet`, while the active tile keeps a visible brand treatment. The route-local form kit owns shared select, file, switch, draft, field-error and sticky polite save-status presentation; it does not change existing autosave, API, entitlement, or publication contracts.

Legacy `TextField`, `NumberField`, and `TextAreaField` remain compatibility wrappers during migration; they now defer red accessible errors until blur or an explicit validation attempt.

Organizer material, bib, access, services, sponsors, partner slots, products, analytics, and import-review editors consume the shared controls. Repeatable additions stay local until valid, and eligible removals expose a six-second undo window.

## Gotchas

- Admin system health (lot 3): pg_cron « succeeded » for a pg_net job only means the HTTP request was queued; whether the route answered 2xx is in `net._http_response`, which keeps neither the URL nor the job, so the console shows HTTP errors for all jobs together. A pg_net job also « succeeds » while the Vault secrets `web_app_url` / `cron_secret` are missing (it sends nothing). The manual run (`/api/admin/system/cron-run`) imports the cron route handlers and calls them in-process: a new cron route must be added to `CRON_RUN_KEYS`, `CRON_RUN_PATHS` and the route's handler map to be relaunchable, and its `maxDuration` must stay ≤ 300 s. The Vercel crons of `vercel.json` are listed from `VERCEL_CRONS`: update both together (a test compares them).
- The organizer brochure prints `demoQrUrl()` (`/courses/supporter-guide/<Trail TST id>?src=plaquette`) as a QR code, so keep that URL, the `src=plaquette` redirect in the guide page and `/demo` stable. App builds that declare the `/courses` universal links / App Links open the guide directly; published builds up to 1.1.2 only declare the `paceyourself://` scheme, so the browser path is what runs until a newer native build ships. `/demo` is a Route Handler that sets `Location` by hand: `NextResponse.redirect` normalizes URLs and must not rewrite the `intent://` target. Its absolute fallback is built from `NEXT_PUBLIC_SITE_URL`, defaulting to `https://pace-yourself.com`, not from `request.nextUrl.origin`, which can be the server bind address (`0.0.0.0`). iOS deliberately skips a `paceyourself://` attempt: without the app, Safari shows an invalid-address alert. Keep the Trail TST demo event public and dated today or later so the scan never lands on a finished race: the hourly refresh moves its current edition to today, edition year included (see [Infrastructure](infrastructure.md#demo-race-refresh)). Its public pages stay reachable but are noindex, absent from the sitemap and suggestions, labelled « Course de démonstration », and carry no registration or official link; it is identified by `isDemoRaceEventId` (`apps/web/lib/demo-race.ts`), not a schema flag.
- The printed business card prints `cardQrUrl()` (`/courses/supporter-guide/<Trail TST id>?src=carte`), so keep that URL, the `src=carte` redirect in the guide page and `/carte-visite` stable too. `/carte-visite` targets installs rather than the organizer pitch: Android gets the same `paceyourself://` intent URL with the Google Play listing (install referrer `utm_source=carte`) as `browser_fallback_url`, iOS gets the public App Store listing, desktop and iPadOS desktop user agents get `/links`. A scan opens the Trail TST guide only when the app link or the Android intent reaches an installed build; an iPhone with a build that predates the `/courses` universal links lands on the App Store page, whose « Ouvrir » button opens the app home.

- `utf8-copy.test.ts` also locks corrected Organizer accents, plain-language analytics help, current section-status copy, and the sticky save-status location.

- The Organizer editor owns the sticky `SaveStatus`; the summary header no longer duplicates autosave state, and its compact navigation remains responsive.

- `RootChrome` owns the single public `<main>` landmark and its `#main-content` skip target. Route pages rendered inside it must not add a second `<main>`. `/admin` and `/admin/*` are standalone: `AdminShell` draws the only header, `<main id="admin-main">` and skip link there, so admin pages must not rely on the site header (the « Admin » entries of `header-auth.tsx` / `header-menu.tsx` still point to `/admin`).
- Admin pages read the token with `useAdminAccessToken()` and render only once `AdminShell` has verified the session; a page component outside the shell (or a test rendering one alone) must provide `AdminAccessProvider`. Desktop navigation keeps account-only destinations, locale, theme and sign-out inside the account menu; unauthenticated organizer links target `/organisateurs`.
- Browser-wide security headers are emitted from `next.config.mjs`. The CSP starts as `Content-Security-Policy-Report-Only` so Stripe, Supabase, PostHog, Google Analytics and Cloudinary violations can be observed before enforcement.
- The shared footer uses grouped, 44 px-tall links and the canonical support address. Cookie consent is a full-width bottom bar so it does not cover the central reading column.

- Keep the public legal identity synchronized with the current business registration and tax regime. Consumer mediation details must not be invented; add the selected mediator before treating the B2C legal surface as complete.
- Admin publication management distinguishes operational Admin, payment Stripe, payment by bank transfer, and Offert. Stripe and bank-transfer origins remain derived from valid payment history; the organizer header renders Admin and Offert separately.
- Never resolve Supabase's relative `/object/sign/...` response against the project origin directly: preserve the `/storage/v1` API prefix before returning the short-lived invoice URL.
- Format-scoped publication authorizes the same two caller classes as the server route: an active event member or a trusted `app_metadata` admin. Database errors remain differentiated as access, readiness, hidden-edition, entitlement, or operational failures.

- Keep `racebook_preview_is_visible` in both Organizer bootstrap and event-detail format projections. Omitting it makes a durably masked format render as private after an event reload. Masked and private states both persist `is_live = false`; preview selection distinguishes organizer-private access, while the publication RPC atomically restores all public flags.
- Keep `analyticsAccess` in both Organizer bootstrap and event-detail edition projections. The client replaces the complete event snapshot on reload, so falling back to the tier alone would incorrectly relock an active complimentary Analytics grant.
- Publication-tier existence checks must project a column that exists on the inspected table. `race_event_edition_branding` uses `edition_id` as its primary key; selecting `id` returns a Supabase Data API 400 before Stripe is called.
- Keep the active pack/source context and bank-transfer API errors inside the open admin purchase dialog as well as in page state, otherwise a rejected duplicate or downgrade has no visible feedback behind the modal.
- Keep editable branding content out of the Organizer bootstrap payload. The bootstrap may expose only the derived published/draft status needed by the tile; the membership-gated draft editor still loads only when its module opens, and its publish action remains Signature-gated.
- Do not reopen the section configurator automatically beside the dashboard guide. The guide owns first-arrival presentation; section configuration opens only from its final action or the explicit `Gérer les sections` control.
- Keep consent and global-prompt coordination inside the shared spotlight boundary: a first guide waits for the cookie decision, and the mobile app prompt stays hidden until the guide closes. Waiting for consent must never mark onboarding complete.
- Do not proxy a branding logo through JSON/base64. If the dormant control is re-enabled, use the existing multipart upload, validate MIME plus binary signature and size server-side, then store the public URL in the service-only projection.
- Do not return an empty blog collection when `content/blog` cannot be located. The sitemap depends on explicit failure to expose a deployment/file-tracing problem instead of silently dropping every article URL.
- Do not infer article language from accents or tags. French copy without accented characters previously received English bylines and CTAs; use validated frontmatter locale with the French default.
- Keep article `seoTitle` at 60 characters or fewer and `seoDescription` at 160 or fewer. These snippets feed metadata and JSON-LD only; keep the editorial H1 and introduction in `title` and `description`.
- Keep locale-specific paths authoritative over the saved language preference: `/en` and `/en/*` must hydrate in English, while `/partenaires` and `/links` must hydrate in French. The route-scoped `Content-Language` header and content-level `lang` remain the server-visible signals until a deliberate multi-root-layout migration can set a route-specific root `<html lang>` without making every page dynamic.
- Keep `/organisateurs` as the indexable French acquisition page. `/organizers` is the authenticated creation workflow and `/race-planner/print/assistance` is a transient print view; both must remain `noindex`.
- Keep organizer social proof fail-open for the acquisition page: an unavailable table or invalid response yields no proof cards, while publication/refresh in admin fails closed. Never call PostHog from the public page or label its distinct-person estimate as official participants.
- Keep the hero demo action anchored to the detailed in-page example; the Google Play destination remains available inside that demo and at the final conversion surface.
- Keep the hero recording muted, inline and user-pausable. Its poster must remain a meaningful static product preview, and reduced-motion preference must stop autoplay rather than hiding the product context.
- Keep the hero phone constrained by viewport height as well as width. A fixed desktop width recreates a roughly 900 px frame that hides the CTA or video controls on common 768 px-high laptop screens.
- Keep touch indicators synchronized in the compressed media itself; a separate DOM overlay would drift after pause, buffering, looping, or browser playback-rate changes.
- `/settings` is the runner nutrition list (« Liste nutrition », 2026-11-23 rework): page header on the `/support` model, a product list section and a 20rem « Ajouter un produit » section side by side from `lg` (stacked below, no nested cards). The list renders 24 products at a time with « Afficher plus » (back to the first page when the search, the Tous / Mes produits filter or the sort changes): compact rows with type badge and carbs · sodium · kcal on phones, a sortable table with the type badge under the name from `sm`. Favorites, local mode, product creation, the zero-value confirmation and their API calls are unchanged; the route keeps its name.
- `/profile` (2026-11-23 rework) shows a sign-in invitation (`AuthCard`) to signed-out visitors instead of a disabled form. Signed in, it is a `max-w-3xl` column with the page header, then `ProfileSection` blocks (subscription, personal details, favorites) from `app/profile/_components/ProfileLayout.tsx`; the favorites picker, Premium and unsubscribe dialogs share `ProfileDialog` (full-screen sheet on phones, centered from `sm`, Escape still handled by the page). A Premium account sees « Résilier » instead of a disabled « S’abonner ». Profile save, favorites, checkout, billing portal and their API calls are unchanged.
- The web app is light-only since 2026-11-23: `ThemeToggle`, `lib/theme.ts` and the theme entry of `header-menu.tsx` are gone, `globals.css` no longer defines `.dark` variables, and nothing adds the `dark` class (a stored `theme` value in `localStorage` is ignored). `tailwind.config.ts` keeps `darkMode: "class"` so the remaining `dark:` utilities stay inert instead of following the OS setting; remove them when a page is reworked rather than in bulk.
- Never render stale race content at a former slug. Resolve its stable race id, verify current public visibility, then issue the permanent redirect before loading discovery links.
- Keep catalog, slug resolution, sitemap, detail visibility, and route ISR aligned to 15 minutes so a refreshed catalog cannot link to a longer-lived negative detail cache. Raw GPX bytes may use the durable one-year data cache only while upload/replacement paths remain immutable and versioned.
- Keep every legacy/blog redirect target inside the route-or-canonical integrity test, and never introduce a redirect chain or a target without a real page.
- The bare `/en` has no page (only `/en/links` and `/en/partners`), so `temporaryPathRedirects` in `next.config.mjs` sends it to `/` with a 307; keep it temporary so a future English home can replace it.
- One overlay at a time on mobile: `MobileAppPrompt` stays hidden for the whole page view when the cookie banner was pending at load (no pop-up right after the answer) and on pages that already carry store buttons (`mobile-app-prompt-paths.ts`: `/livret-coureur`, `/livret-supporter`, `/courses/**`, `/carte-visite`, `/demo`, plus the internal paths). Analytics event names (`mobile_app_prompt_view/dismiss/download`) are unchanged. Since 2026-11-23 it is a thin full-width bottom bar (title on up to two lines, « Télécharger l’app » pill, close button; ~61 px with the safe area) instead of a floating card, so it no longer covers a form; the dismiss duration (14 days) and visibility rules are unchanged, and the `description` / `later` locale keys are no longer rendered.
- Blog dates go through `formatBlogDate(iso, locale)` (fr-FR for French posts, UTC so the day never shifts); the cards and post header show reading time only (no word count, which stays in the JSON-LD `wordCount`). The mobile table of contents is a closed `<details>`.
- Legacy/blog path redirects are served by `staticPathRedirects` in `next.config.mjs`, not middleware. Adding an entry to `lib/legacy-redirects.ts` or `lib/blog/redirects.ts` requires the same entry there; the integrity test fails otherwise.
- `/sign-in` and `/sign-up` must stay statically prerendered: read `?next=` with `readCurrentReturnPath()` at action time, never through the `searchParams` page prop, which makes every visit and header `<Link>` prefetch a billed function run.
- Do not call `headers()` from the root layout solely to localize `<html lang>`; that opts the complete public surface into dynamic rendering. A future server-correct English document language requires a deliberate multi-root-layout route structure.

- Do not store service-role keys in client code. `getSupabaseServiceConfig` is server-only by usage.
- Keep the 3D video-generator route admin-only and lazy. Its public Mapbox token may reach the browser, but Supabase service credentials, GPX Storage paths and raw GPX must not.
- Keep verified-session readiness independent from the entitlement request. Premium consumers must use `isEntitlementsLoading` when they need to wait for effective rights; authenticated surfaces such as Organizer should not wait for that secondary request.
- Do not expose `RESEND_API_KEY` to browser or mobile code; both clients must call server routes.
- `planner_values` is intentionally flexible JSON. Validate route inputs, but do not assume every old plan has every current field.
- `/api/race-catalog` and `/api/races` both write `races`, but the admin route creates public catalog rows and the user route creates private rows.
- Organizer routes can also write public `races`, but only after an active `race_event_organizers` membership check. Claimed public races should not rely on `races.created_by`.
- Keep organizer location text fields and their sibling geocoded JSON objects in sync. Publication checks still read the text columns/strings, while published GPS/Google affordances come from `organizer_details`.
- `race_events` is used by API routes, but this repo only shows a migration altering it, not creating it. See [../02-database/tables/race-events.md](../02-database/tables/race-events.md).
- Organizer event creation inserts a non-live `race_events` row and its owner `race_event_organizers` membership through a service route; keep that path server-side and do not expose service-role writes to client code.
- Admin organizer assignment and autocomplete must resolve e-mails through the server-only Supabase Auth Admin API. Autocomplete requires at least two characters and returns only a bounded matching subset; submission still performs an exact case-insensitive lookup. New-account invitations must send the allowlisted `/reset-password` URL as GoTrue's `redirect_to` query parameter and the canonical race label as `data.event_name`; the latter personalizes the template but never grants access. The password flow sends invite sessions to `/organizer` after password creation. Never return the complete Auth user list or service credential.
- Website import upserts the validated canonical edition, attaches created/updated formats through `edition_id`, and reuses matching cross-year `edition_group_id` series instead of updating another edition's row.
- Do not convert a Trace de Trail `/iframe/{id}` path directly into `/trace/{id}`: iframe ids identify widgets and must first be resolved from the embed HTML. When a single-format page exposes several widgets, import only if they converge on one canonical trace.
- Current two-pass `additionalUrls` are evidence sources, not an authority boundary. Preserve the separate legacy `formatUrls` parser behavior only for backward-compatible one-pass callers.
- Keep `/organizer` compatible with production prerendering. Bootstrap query values should enter through the server page props; using `useSearchParams` directly in `OrganizerDashboard` requires a Suspense boundary and otherwise fails `next build`.
- Keep the invitation password handoff inside the mounted verified-session provider: persist only a successful `/api/auth/session` response, await the queued refresh of those stored tokens, then use App Router navigation to `/organizer`. A hard reload can leave the prerendered `Vérification de session...` fallback visible until hydration and must not be the authentication handoff.
- Keep public catalog creation conservative by default: imported/admin-created events and races should start as non-live until someone publishes them deliberately.
- Organizer JSONB details are server-route managed progressive metadata. Keep public/mobile reads on explicit column lists so these draft details are not exposed by broad selects.
- Keep the emergency contact at event scope as `organizer_details.emergencyContact`; its phone is display-normalized but remains simple operational JSON rather than a normalized user/contact record, and mobile turns the published value into a `tel:` action.
- Keep event website/social link normalization in the shared organizer-details schema so foreground and background saves accept valid domain links without an explicit protocol but still reject arbitrary text and non-HTTP(S) schemes.
- Course discovery has separate web and mobile contracts. Web catalog pages use `web_catalog_is_live` / `is_public` plus the parent-event gate; mobile continues to use `is_live`, preview, edition, and RaceBook flags.
- Never cache an organizer private-publication response as public. Only fully live race/event/RaceBook snapshots receive CDN headers; authenticated responses remain `private, no-store`. Draft writes must not invalidate public tags, because only publication/restoration or an effective visibility/entitlement change can change what runners read.
- Catalog presentation may group formats only by stable `eventId`. Never merge homonymous events or synthesize event identity from display names or locations.
- Keep bib pickup, equipment, and access at event level as the defaults. A format may opt into a complete replacement through the module's `overrideEnabled`; each override participates in the race-scoped autosave plan so navigation cannot discard the checkbox or its fields. Historical access JSON without the flag may still be treated as specific when it contains meaningful format data.
- Preserve the tri-state compatibility of format equipment JSON: `true` is a full replacement, `false` is authoritative inheritance, and only a missing legacy flag may be inferred from old format-specific items or notes.
- Keep the active weather plan on the event-level equipment JSON. Formats may retag items for `cold` / `heat`, but they must not choose a different active plan than the event.
- Keep format access toggles and ravito timing cards aligned with completion/autosave logic; changing one without the others creates broken navigation or misleading scores.
- Keep three-state visibility saves scoped to the switched format. Do not foreground-save an unrelated active draft before moving another format between Masqué, Privé, and Public; the server remains authoritative for entitlement and readiness.
- Do not filter masked formats out of the authorized Organizer workspace. Grey styling and the explicit `Course masquée pour le public` label communicate runner visibility while preserving organizer/admin editing access.
- Keep the organizer request body, server readiness query, stored publication request, and admin queue aligned on the same `race_id`; event-level inference reintroduces cross-edition publication bugs.
- `/courses/[slug]` renders a single `<main>` from `root-chrome.tsx`; the page root must stay a `<div>`, not another `<main>`.
- `GpxRouteMapClient` defaults to non-interactive on the course detail page via `RaceRouteExplorer`; do not remove the "Explorer la carte" activation step, it prevents the map from capturing mobile scroll gestures.
- `AccordionItem` (`apps/web/components/ui/accordion.tsx`) is native `<details>`-based on purpose: content must stay in the server-rendered HTML for SEO, so do not swap it for a client-side conditional-render implementation that hides collapsed panels from the initial markup.
- The Ravitos save plan must PATCH the active race details before PUTting aid stations because start/finish times live in `races.organizer_details.schedule`, not on `race_aid_stations`.
- Relay-point writes must remain on the membership-checked service route. Do not grant organizer clients direct mutations or merge relay points into plan aid stations.
- Keep autosave dirtiness and revisions scoped by event/race, serialize background writes for the same scope, and suppress only success feedback. Errors and `beforeunload` protection must remain visible until the relevant scope is clean.
- Race sidecar and GPX loaders must compare their requested race id with the current active race before applying responses, because navigation no longer waits for prior network work.
- Keep organizer header completion summaries format-scoped. The bootstrap and event detail responses retain lightweight persisted counts for ravitos, SAS and podiums, plus edition service/sponsor/branding status, so selecting another tab or opening a lazy editor is not required to correct a tile.
- Keep organizer ravito cumulative D+ / D- GPX-driven while the current dashboard uses km-based interpolation from the preview trace; letting organizers override those fields manually would desynchronize the saved station metrics from the uploaded course.
- Keep a small UTF-8 regression test near organizer dashboard copy when editing French labels in route-local components; user-facing mojibake on ravito cards should be caught in CI, not by manual QA.
- Organizer-created products are non-live rows attached to source ravitos; do not expose them through public client env or the global catalog API.
- Organizer ravito product refresh is a read-time overlay on `/api/plans`; if the service-role refresh fails, return the stored `organizerAidStationProducts` snapshot instead of blocking plan load.
- Organizer GPX previews are recalculated from the private source GPX; do not add a `races.elevation_profile` column for this dashboard-only curve.
- GPX replacement must update the active distance/D+/D- form state from the successful response and keep the race edition year selected; an event refresh with the same race id does not trigger race-form initialization by itself.
- `react-leaflet` v5 expects React 19 and crashes this app's React 18 runtime during GPX map mount. Keep the organizer map on the React 18-compatible `react-leaflet` 4.x line until the web app itself upgrades React.
- Organizer event image input accepts PNG only in v1; the server route validates the binary, emits a bounded WebP object, and the client must not write to Storage directly. Format and product image routes apply the same WebP/cache normalization to their accepted raster formats.
- On the current Free project, public Storage responses may still expose `Cache-Control: no-cache` even when object metadata contains `max-age=31536000`. Treat smaller versioned assets as the guaranteed egress reduction, and recheck response headers after a plan or CDN change before relying on browser TTL.
- Keep organizer dashboard French labels UTF-8 clean end-to-end, especially in `event-format-editors.tsx`; mojibake such as `Ã©` is a real regression on the event tab because those strings are rendered directly.
- Do not auto-send runner notifications on organizer save or publish. The manual event-update route is the only intended push trigger for this v1.
- The manual notification route additionally requires the selected edition's Pro capability; RaceBook UI must offer the Essential→Complete upgrade (150 € HT) instead of attempting the send.
- Organizer update deletion must stay on the authenticated server route. Do not grant broad client delete access to `race_event_updates`, and do not treat deletion as a recall of already delivered pushes.
- Public plan share pages are unauthenticated by design, but they must display only the bounded snapshot in `plan_share_links`, not live editable plan data.
- Public plan share pages are standalone in `RootChrome` and force light theme variables so a visitor's saved dark preference does not affect crew readability.
- Set `PLAN_SHARE_TOKEN_SECRET` if reusable crew links must survive a service-role key rotation without creating one new stable link on the next re-share.
- Public crew-state updates use the URL token as the secret. Keep the route rate-limited and avoid adding fields that would let a crew viewer edit the private plan.
- Do not include the public crew token or snapshot content in PostHog/Google Analytics events.

- Admin access to the complete Organizer event selector must continue to come from trusted `app_metadata` through `isAdminUser`; never broaden the catalog response for ordinary authenticated users.
- Keep the Organizer bootstrap payload aligned with the existing claims and event-detail read contracts. Do not reintroduce a second authentication or membership lookup after the selected event has been derived from the already-authorized membership set.
- Keep module-specific Organizer reads lazy. Opening the event overview must not download GPX, ravitos, relay points, product data, announcements, or follower totals; late responses must still be scoped to the active race before updating state.
- Keep full sponsor draft reads in the membership-gated lazy model: switching editions must discard the prior edition list, and mobile/public clients must never receive direct `website_url` values or table access. Runner-facing placements remain Signature/effective-module gated; the organizer bootstrap may carry only active-count and aggregate-click summaries for tile status.
- Prefer a freshly loaded sponsor/branding editor summary over the bootstrap projection after a mutation; until then, use the selected edition's bootstrap summary instead of displaying a false empty tile.
- Treat route-local Organizer cache values as immutable snapshots. Invalidate race data after relevant mutations and clear the complete cache at a user-session boundary so organizer-scoped products or draft course data cannot cross accounts.
- Keep the Organizer cache bounds when adding cached sidecars. TTL alone does not cap memory for many event/race selections in a long-lived dashboard session.
- Keep per-format publication controls in the collapsed visibility panel: lightweight state loads with the format list, while the canonical draft comparison and ten-version history load only after the organizer opens the corresponding confirmation or `…` menu.

## Related Docs

- [Session Management](../04-auth-and-security/session-management.md)
- [Auth Flows](../04-auth-and-security/auth-flows.md)
- [Plan Storage](../03-business-rules/plan-storage.md)
- [GPX Import](../03-business-rules/gpx-import.md)
- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Stripe](../05-integrations/stripe.md)
- [Mapbox 3D Admin Course Viewer](../05-integrations/mapbox-3d.md)
- [Automatic Reel Pipeline](../05-integrations/reel-automation.md)

The admin reel can also be rendered in the background on Google Cloud (`/api/admin/video-generator/render-jobs`, the standalone noindex `/render/video/[id]` page opened by a Cloud Run job, per-job HMAC token routes under `/api/video-render/jobs/[id]`, Vercel OIDC federation to Google, no stored Google key); see [Google Cloud Background Reel Render](../05-integrations/google-cloud-video-render.md). `/render/` is a standalone prefix in `RootChrome` (no header or footer). The ElevenLabs voice field keeps a per-browser library of used and named voices. The report-only CSP lists `https://storage.googleapis.com` in `connect-src` for the signed Storage uploads and downloads.

Organizer address autocomplete (`/api/location-search`) queries Photon and Nominatim in parallel server-side and merges their OpenStreetMap results, so partial words and named places (museum, village hall) are found while exact postal addresses keep working; the suggestion popup credits OpenStreetMap. See [Geocoding](../05-integrations/geocoding.md).

The admin voice route adds an ElevenLabs library voice with a single first request before generating two sentences at a time, and retries a transient 409 `already_running`.

Admin reel hook (2026-11-19, `reel-hook.ts`): a highlights reel, or a full one with « Accroche (2 premières secondes) » on, opens on a 2.4 s hook instead of the title card: the camera already flies the hardest climb at 58° from the vertical, one headline figure fills the upper-middle on one line (100 km or more: the distance; else 30 m D+ per km or more: the D+; else the distance) and the short event name slides in at 0.5-0.9 s. The detail route also returns `eventShortName` (`race_events.short_name`), which admins set as « Nom court (vidéo) » in the catalog event dialog (`PATCH /api/admin/race-events/:id`); without it the name is derived from the event name (no year, ® ™ ©, edition marker or sponsor, never truncated). See [Mapbox 3D](../05-integrations/mapbox-3d.md#reel-hook-first-24-s).

Admin reel narration keeps digits for subtitles while the voice route converts numbers, units and times to French words before calling ElevenLabs (`lib/spoken-numbers.ts`), remapping the alignment (end and optional start times) onto the original text; the subtitles are word-timed groups of 2 to 5 words (`subtitle-groups.ts`) in a box centred horizontally and at 77.5 % of the frame height, inside Instagram's safe zones (Reels caption and action column, 4:5 feed crop). In auto mode the reel length targets 30 s + 6.7 s × √km (80 km: 90 s; 2-minute target cap), set in the narration panel before writing, but follows the voice up to 180 s, so a longer narration is never delayed and cut; the script word budget uses the voice pace measured on its last clips (`speech-rate.ts`, per browser), 2.2 words per second until then; legs over budget are revised once, and stations flown over carry the moment the camera reaches them. The told climb is no longer highlighted: no orange route border, no climb card on the map, no framing shot (the camera stays on the chase pose). The narration panel also sets a storytelling style (random by default, so reels vary) and per-race instructions for Claude (`script-notes.ts`, browser only), which override every other prompt rule. Start and finish names are pinned on the map (`place-labels.ts`: organizer start place, else nearest Mapbox settlement).

The admin reel generator saves each race's narration in Supabase (`video_narrations` + private bucket `video-narrations`) and restores it when the race opens; its event picker filters while typing and shows video counts, and formats show GPX availability, videos and saved narration.

## Admin messaging inbox

The admin "Messagerie" tab (`AdminMessagingTab`) replaced "Demandes de course". It has inbox sub-tabs with pending counts from `GET /api/admin/inbox-counts` (shared `useInboxCounts` hook): Bugs and Feedback (`AdminFeedbackTab`, `GET`/`PATCH /api/admin/feedback`), Demandes de course (`AdminRaceRequestsTab`), Démos organisateurs (`AdminDemoRequestsSection`) and Questionnaires. The route returns `bug`, `feedback`, `raceRequests` (runners only), `demoRequests`, `raceRequestsAndDemos` (the former merged total), and the organizer queues `organizerClaims`, `publicationRequests`, `editionRequests`, `organizerTotal` (all `status = pending`), plus since lot 2 of the console the system items of the « À traiter » queue: `failedFlyovers`, `failedPosts`, `draftPosts`, `failedRenders` (renders failed in the last 24 h), since lot 3 `systemIncidents` (systems that are down: the « Système » items of `loadSystemHealth`) and `systemTotal`, read with the same filters as `GET /api/admin/inbox` (`INBOX_FILTERS` and `loadRecentRenderFailures` in `lib/admin-inbox-server.ts`); a system count that cannot be read is `null` instead of failing every badge; the Organisateurs page (`/admin/organizers`) and its two sub-tabs show them as badges, and the console sidebar and bell add them into the « À traiter » total (`inboxTotals`). Lists put pending items first (`is_pending`); handled ones sink below and their row is greyed (`handledRowClassName`). A status change on an item whose author has an account opens `AdminNotificationDialog`, and the reply and status commit together (`review_app_feedback_with_notification` / `review_race_request_with_notification`); "Répondre" sends a reply without changing the status; an author without an account gets a silent status change. Each row shows the last reply sent and its state (`AdminReplyStatus`: read, unread, deleted by the runner). Every prefilled message, including the free message of the Users tab, opens with "Bonjour," and ends with "Faustin de Pace Yourself" (`admin-message-template.ts`). `loadAdminUserIdentities` and `loadLatestReplies` in `lib/admin-user-notifications.ts` serve both list routes.

Pending bugs, feedback and race requests also have a one-click "Clôturer" button: the item goes to completed with no dialog and no message to the runner (`PATCH /api/admin/feedback` without `notification`, `PATCH /api/admin/race-requests` with `silent: true`, a plain service-role update of `status`, `reviewed_at` and `reviewed_by`).

### Admin tab URLs (lot 0 of the console redesign)

Since lot 1 these tab ids only feed the redirects of `admin-redirects.ts` (each tab is now a console page, see « Admin console » below); `?vue=` and `?course=` keep the meaning described here on `/admin/inbox`, `/admin/organizers` and `/admin/catalog/races`. Lot 0 behaviour, for reference: the `/admin` tabs and sub-tabs live in the URL (`admin/admin-tabs.ts`, pure and tested): `?onglet=produits|utilisateurs|messagerie|templates|courses|organisateurs|preuves|partenaires|croissance` (unknown value: `produits`), `&vue=` for the Messagerie (`bugs|feedback|demandes|demos|questionnaires`) and Organisateurs (`publication|acces`) sub-tabs, read on load and written with `history.replaceState`. `?onglet=courses&course=<races.id>` opens that race's « Modifier » dialog in `AdminRaceCatalogSection` and filters the list on its name; the « Corriger » link of each « GPX à traiter » row (`RaceDataGapsCard`, `raceId` of `race-data-gaps.ts` = `races.id`) points there. The « Croissance » tab and the user trend of « Utilisateurs » share the `["admin","growth",token,"last30","",""]` react-query key (Croissance opens on 30 days, `staleTime` 60 s), so switching tabs does not refetch.

### Admin console (lot 1 of the console redesign, 2026-11-22)

Every `/admin/*` page renders inside `AdminShell` (`app/admin/_components/shell/AdminShell.tsx`), mounted by `app/admin/layout.tsx` after the unchanged server check (access-token cookie, `isAdminUser` on `app_metadata`). `RootChrome` treats `/admin` and `/admin/` as standalone, so the site header, footer and `#main-content` landmark are not drawn there; the shell has its own `<main id="admin-main">` and « Aller au contenu » skip link, and a « Retour au site » link in the sidebar. The shell repeats the admin check on the client session (`useVerifiedSession`), shows the sign-in or forbidden message otherwise, and hands the bearer token to the pages through `useAdminAccessToken()` (`AdminAccess.tsx`).

- **Sidebar** (dark green, groups Pilotage, Clients, Catalogue, Contenus, Communication, Système): one table, `ADMIN_NAV` in `app/admin/admin-routes.ts` (pure, tested), also used for the active entry (`findActiveNavItem`, longest href) and the breadcrumb (`breadcrumbFor`). Counts come from `useInboxCounts`: « À traiter » and the bell show messages + organizer requests + system items (`inboxTotals`, same definition as the counted types of the queue; « Données de course » is listed in the queue but not counted), Organisateurs shows `organizerTotal`. Below `lg` the sidebar opens as a `Drawer` from the menu button.
- **Top bar**: breadcrumb, ⌘K / Ctrl+K search (`AdminCommandPalette`: destinations of `ADMIN_NAV`, catalog races from `GET /api/admin/race-catalog` loaded when the palette first opens, runners from `GET /api/admin/users?search=` debounced from 2 characters; a race opens `/admin/catalog/races?course=<id>`, a runner `/admin/runners?recherche=<email>`), test-mode pills (Instagram simulation from `GET /api/admin/instagram` → `dryRun`, same query key as the Publications screens; runner-access simulation from `GET /api/admin/runner-access-mode` when not `real`, linking to `/profile` where it is set), and the bell linking to `/admin/inbox`. Fonts: Bricolage Grotesque and JetBrains Mono through `next/font` variables on `.admin-console` (`globals.css`).
- **Routes** (existing components mounted without rewriting): `/admin` Vue d’ensemble (dashboard since lot 2, see below), `/admin/inbox` (À traiter: the single queue and, under « Traiter les messages », the Messagerie sub-tabs without Questionnaires), `/admin/analytics` (growth), `/admin/billing` (Ventes & facturation, lot 4), `/admin/runners` (Utilisateurs; since lot 5 `?recherche`, filters, `?tri`, `?ordre`, `?page` and the runner profile `?coureur=<userId>&fiche=` in the URL), `/admin/organizers` (`?vue=acces`; since lot 5 `?edition=<id>&fiche=` opens the edition panel), `/admin/organizers/social-proofs`, `/admin/catalog/races` (`?course=`, `?vue=qualite` = former « GPX à traiter »), `/admin/catalog/products`, `/admin/catalog/partners`, `/admin/content` (Agenda + calendar), `/admin/content/studio`, `/admin/content/posts` (`?onglet=reels|carousels|templates|published`, `?post=` / `?element=` highlight; `templates` is the « Carrousel manuel » since lot 6), `/admin/content/renders` (the single render queue, lot 6: `?periode`, `?type`, `?statut`, `?page`, `?rendu=<id>`), `/admin/content/flyovers` (`?commande=<id>` highlights an order), `/admin/messaging` (message history since lot 5), `/admin/messaging/surveys`, `/admin/system/automation` (scheduled tasks table since lot 3, reel and carousel switches), `/admin/system/integrations` (Instagram card, then since lot 3 the other services), `/admin/system/maintenance` (lot 3, see below) and `/admin/system/audit` (Journal, lot 7, see below). `/admin/catalog` and `/admin/system` redirect to their first page.
- **Publications split**: the former client page `app/admin/publications/page.tsx` became `usePublicationsWorkspace` (all its queries, mutations and polling, unchanged keys) and the sections of `PublicationViews.tsx`; « Voir » in the agenda now navigates with `publicationTargetHref` (`publication-tabs.ts`).
- **Redirects**: `resolveLegacyAdminUrl` (`admin-redirects.ts`, pure, tested) maps `/admin?onglet=<lot 0 id>[&vue=][&course=]`, `/admin/publications?onglet=<id>` and `/admin/video-generator`; `/admin/page.tsx`, `/admin/publications/page.tsx` and `/admin/video-generator/page.tsx` call it server-side with `redirect()`.
- **Lot 2: Vue d’ensemble and À traiter.** `GET /api/admin/overview?range=today|7d|30d|custom&from=&to=` (`authorizeVideoAdmin`, Paris days inclusive, previous period of the same length) aggregates existing sources only (`lib/admin-overview-server.ts`, pure builders and the Zod schema shared with the client in `lib/admin-overview.ts`): `get_admin_growth_metrics` through `fetchGrowthMetrics` (`lib/admin-growth.ts`, also used by `/api/admin/growth`, called for the period, the previous period and the last 30 days), paid flyover orders of the period, scheduled `social_posts`, planned reel and carousel automation items, current editions of organizer-managed events (active `race_event_organizers`), renders of the last 24 h, the flyover queue, Instagram credentials, dry run and quota, latest organizer payments, flyover orders, renders and published posts. Each block (`kpis`, `activity`, `funnel`, `revenue`, `agenda`, `health`, `feed`) is `ok` or `error` on its own. Revenue: organizer packs (`netRevenueMinor`, amounts TTC) and flyovers (`amount_cents` of orders paid in the period, refunded ones apart, by payment date); runner purchases store no amount, so that source is `tracked: false` and shown « non suivi ». Health: Instagram, automations, renders, flyovers, and since lot 3 scheduled tasks, e-mails and the Stripe webhook (`loadSystemHealth`, below; `unknown` when it cannot be read). The page (`AdminOverviewPage`, cards in `_components/overview/OverviewCards.tsx`) keeps the period in `?periode=aujourdhui|7j|30j|personnalise&du=&au=` (`overview-period.ts`), shows 6 `KpiTile`, À traiter (5 oldest), Santé, 30-day activity (`TimeSeriesLineChart` with the new `framed={false}` and `interactive` hover tooltip), conversion, revenue by source, the next 7 days and recent activity, with skeletons, empty and error states per card. `GET /api/admin/inbox` (`lib/admin-inbox-server.ts`, mapping, ages, thresholds, sort and filters pure and tested in `lib/admin-inbox.ts`) lists every pending item oldest first: bugs, feedback, race and demo requests, organizer claims, publication and edition requests, failed flyovers, failed posts, drafts to review, renders failed in 24 h, and race data gaps that still block a reel (after the dated items, by deadline); each row links to the screen where it is handled (`/admin/inbox?vue=…`, `/admin/organizers[?vue=acces]`, `/admin/content/posts?post=`, `/admin/content/flyovers`, `/admin/content/renders`, `/admin/catalog/races?course=`), and a source that fails is reported in `sources` without hiding the others. `/admin/inbox` shows it as « File » (chips `?filtre=`, search `?recherche=`) next to « Traiter les messages » (`?vue=bugs|feedback|demandes|demos`, `AdminMessagingTab` with `defaultView={null}` so the sub-tab stays in the URL, `inbox-mode.ts`); `/admin?onglet=messagerie` now redirects to `/admin/inbox?vue=bugs`.
- **Lot 3: Santé des systèmes, Automatisations, Intégrations, Maintenance.** Migration `20261123090000_admin_system_health.sql` adds two service-role-only `SECURITY DEFINER` functions, `admin_cron_job_status()` (one row per `cron.job`: name, schedule, active, last run from `cron.job_run_details` with a 300-character message, runs and failures in 24 h; never the command, which may embed a secret) and `admin_pg_net_response_summary()` (HTTP responses kept by pg_net, about 6 h: count, errors, latest error), and the `transactional_email_log` journal (see [Admin system health functions](../02-database/admin-system-health-functions.md) and [transactional_email_log](../02-database/tables/transactional-email-log.md)). `lib/admin-system-health.ts` (pure, tested) parses cron expressions (`cronPeriodMinutes`, French `describeCronSchedule`, clock times converted from UTC to Paris), names the tasks (`SCHEDULED_TASKS`), lists the Vercel crons of the root `vercel.json` (`VERCEL_CRONS`, a test keeps them in sync; always « Jamais appelée par Vercel », see DECISIONS 2026-11-21) and sets the thresholds: a pg_cron task is `failed` when its last run failed, `late` when its last start is older than 2 periods (or a run is still « running » after max(2 periods, 15 min)), `warning` with failures in 24 h but a successful last run, `never` / `inactive` otherwise. pg_net keeps neither the URL nor the job of a response, so HTTP codes are a global note, not per task. E-mails: error when Resend is not configured or the latest attempt of 24 h failed, warning when one failed since. Payments: error when the Stripe keys are missing or a `runner_billing_events` Stripe row stays unprocessed 15 min (or has `processing_error`) within 7 days, warning on Stripe organizer payments failed or disputed in 7 days; the latest event is the newest of the runner journal, Stripe organizer payments and paid flyover orders (no Stripe API call). `lib/admin-system-health-server.ts` (`loadSystemHealth`) feeds `loadAdminOverview` (the three lines replace the former « suivi au lot 3 » placeholders), the queue (one `system` item per task down, one for e-mails and one for payments in error, type « Système », `?filtre=systeme`, counted) and `GET /api/admin/system/health`. `/admin/system/automation` shows `ScheduledTasksCard` (table on desktop, cards under `md`: readable name, schedule in French, last run relative and absolute, duration, `StatusBadge`, failures 24 h, expandable message and doc link) above the reel and carousel switches. `/admin/system/integrations` adds `IntegrationCards` from `GET /api/admin/system/integrations` (`lib/admin-integrations.ts`: Stripe, Resend, Google Cloud rendering via `getVideoRenderConfig`, Mapbox, ElevenLabs, Anthropic, OpenAI; each variable only as present / absent, never a value; latest e-mails, Stripe events and renders). `/admin/system/maintenance` (`MaintenancePanel`, paging rules in `maintenance-plan.ts`) calls the existing routes unchanged: `POST /api/admin/resend/sync` (dry run first by 10 pages of 100, then the real sync page by page after a confirmation, waiting out the route's 4-per-minute limit), `POST /api/admin/racebook-publications/backfill` (confirmation) and `/cleanup` (25 rows per call, « Continuer »), and the new `POST /api/admin/system/cron-run` (`{ job }` among the six pg_net jobs that call a Next route; the cron handler is invoked in-process with `Authorization: Bearer CRON_SECRET` on the admin request's origin, so the secret never leaves the server; 2 runs per job and minute). The Betrail import stays a script: its commands are shown, no button.
- **Lot 4: Ventes & facturation.** `GET /api/admin/billing` (`authorizeVideoAdmin`, read-only; `lib/admin-billing.ts` pure and tested, `lib/admin-billing-server.ts`) merges one line per transaction, newest first: organizer packs of `organizer_edition_payments` (Stripe and bank transfers; abandoned `expired` Stripe attempts left out), manual invoices of `organizer_invoices` (réglée / à régler / en retard / offert / remplacée), paid, cancelled-after-payment or refunded `flyover_video_orders`, and the runner ledgers `runner_plan_unlocks`, `runner_subscription_accounts` and `runner_support_purchases`, which store no amount (« montant non suivi », counted but never summed). Each line has a normalised status (`StatusBadge`: payé, en attente, échoué, remboursé, contesté, réglée, à régler, offert, plus remplacée and révoqué), a means (Stripe, virement, offert, store), its known HT / TVA / TTC (packs: stored values; manual invoices: VAT-exempt, TTC = net; flyovers: TTC only), a Stripe dashboard link when an id allows it without secret (`pi_`, `in_`, `sub_`…) and the actions of its type. Query `?periode=mois|mois-precedent|30j|annee|tout` (default: current year) or `?du&au` (Paris days), `?source=packs,factures,survols,coureurs`, `?statut=`, `?recherche=` (server-side, also on the full runner e-mail resolved through the Auth admin API, masked `ca***@gmail.com` in every response), `?edition=<id>` (organizer sources only), `?page=` (50 lines), `?export=1` (every match, 5 000 max). The KPI (encaissé net, remboursé and contesté, à encaisser = unsettled invoices + bank transfers waiting, transactions) apply the period, sources, edition and search, not the status filter. Each source is settled on its own; the Stripe webhook line comes from the lot 3 `loadPaymentActivity`. `GET /api/admin/billing/editions` feeds the edition pickers. Data API helpers shared with the health loader moved to `lib/admin-service-rest.ts`. The page `/admin/billing` (`BillingRegister`, `app/admin/_components/billing/`) shows four `KpiTile` (new optional `hint` line), filter chips kept in the URL (plus `?ligne=` for the open line), a table that becomes cards under `md`, a `Drawer` with the existing actions of each line (invoice download: `/api/admin/organizer-invoices/<id>/download` for manual invoices, `/api/organizer/invoices/<id>/download` — admins allowed — for payment-backed and Stripe invoices; PDF regeneration; settlement with date and reference; correction; historical virement invoice; PDF upload for an uploaded virement invoice) and a client-side CSV export. « Nouvelle facture » opens `OrganizerInvoiceDialog` (moved out of `AdminOrganizerClaimsTab`, same routes and rules), « Enregistrer un virement » opens `BankTransferDialog`, the first screen of `POST /api/admin/organizer-payments` (multipart contract unchanged, no amount sent by the browser). In Organisateurs the per-edition invoice and virement cards became `EditionBillingSummary` with a link to `/admin/billing?periode=tout&edition=<id>`, the pack dialog keeps tier, origin and gifted modules only, and `?edition=<id>` narrows the list. The « Paiements » health line and queue item now open `/admin/billing`; an activity-feed payment opens the register filtered on its edition.
- **Lot 5: customer profiles and split screens.** Coureurs: `AdminUsersTab` keeps the table (search, column filters, sort, 20 per page, role checkboxes; cards under `md`) with every parameter in the URL (`runners/runner-url.ts`, pure and tested: `?recherche`, `?email`, `?role=coureur|admin`, `?cree_du|cree_au|actif_du|actif_au`, `?tri=email|role|creation|activite`, `?ordre`, `?page`); it re-reads the URL when the ⌘K palette changes `?recherche=`. A row opens `RunnerProfileDrawer` (`?coureur=<userId>&fiche=resume|acces|messages|retours`), fed by the new `GET /api/admin/users/[id]` (`authorizeVideoAdmin`, read-only; `lib/admin-runner-profile.ts` pure and tested, `lib/admin-runner-profile-server.ts`; 404 for an unknown account; each secondary source settled on its own and listed in `unavailable`; the e-mail is never logged): identity, roles, created / last activity, sign-ins, onboarding (`onboarding_completed_at` or the profile fields), 5 latest plans and their count; Premium status in resolution order (subscription, trial, every grant active / scheduled / ended) with « Accorder Premium », « Modifier » (first screen of `PATCH /api/admin/premium`) and « Révoquer » (`PremiumGrantDialog`, dialogs owned by the page, opened from the panel); runner purchases normalised with `normalizeRunner*` and a link to the register; the latest 50 `user_notifications` with channel and read state; bugs, feedback and race requests with a link to the queue. The former « Voir détails » and « Accorder Premium » dialogs and the table's revoke button are gone. Communication › Messages & notifications (`MessagesHistory`): `GET /api/admin/user-notifications` (same admin guard as its POST; `lib/admin-messages.ts` pure and tested, `lib/admin-messages-server.ts`) pages every `user_notifications` row (all are admin-originated; `kind` = message, race-request reply, questionnaire) with `?recherche=` (title and body), `?type=`, `?destinataire=`, `?page=`; « Nouveau message » picks the runner through `GET /api/admin/users?search=` then opens `AdminNotificationDialog`, the one send dialog of the console (Coureurs, profile and history all call `sendAdminUserNotification`). Organisateurs: `AdminOrganizerClaimsTab` is an orchestrator of `app/admin/_components/organizers/` (module catalog, pending requests, rights per edition, assignment with the missing-account confirmation, active accesses, `useOrganizerAdminData`); an edition opens `EditionDrawer` (`?edition=<id>&fiche=resume|pack|facturation|demandes|activite`; `?edition=` from the register or `/organizer` still narrows the list): Résumé (members, Racebook per format, links to `/organizer?eventId=` and the public page via the new `editionSlug` of `GET /api/admin/event-publication-requests`), Pack & modules (`EditionPackForm`, the former dialog, same calls), Facturation (`EditionBillingSummary`, last payments and invoices, `OrganizerInvoiceDialog` / `BankTransferDialog` rendered beside the panel so its focus trap stays its own), Demandes (same review items as the list), Activité (reader statistics stored by Preuves sociales, no live PostHog query). Catalogue: `AdminRaceCatalogSection` (2 348 → 315 lines) keeps the catalog query, row actions, search and `?course=`; the list and every dialog moved to `app/admin/_components/catalog/` without behaviour change (`race-catalog-model.ts` tested; the Trace de Trail session is shared by the import dialog and the race edit « Importer » through `useTraceDeTrailCredentials`). Shared: `DrawerTabs` (ARIA tabs of a panel, `DetailList`, `DetailSection`). The local react-query shim gained `prefetchQuery` (never rejects); `useQuery`, `refetch`, `invalidateQueries` and `mutate` no longer leave an unhandled rejection when a request fails (tested). `lib/admin-service-rest.ts` gained `getServiceResponse`, now used by the overview and inbox loaders.
- **Lot 7: Journal des actions admin.** Table `admin_audit_log` ([doc](../02-database/tables/admin-audit-log.md), migration `20261123120000_admin_audit_log.sql`, not applied on the remote database: it ships with the merge, with the lot 3 migration). Writing: `lib/admin-audit-log.ts` — `recordAdminAction({ actorUserId, action, target, summary, before, after, request, status, error })` (best-effort, 2 s timeout, never throws) and the `withAdminAudit(handler, spec)` wrapper that every admin write route exports (`export const PATCH = withAdminAudit(patchRoute, { action, targetType, targetId, summary, after })`): it keeps the handler signature and response, reads a clone of the JSON body, names the actor from the access-token claims (`app_metadata` only; the route guard has already accepted it, a 401/403 or any 4xx is not journaled) and writes one line for a 2xx/3xx (`ok`) or a 5xx (`error`, or a route-reported failure such as a cron run answering `ok: false`). `spec.skip` drops read-like calls (previews, dry runs, polling), `noteAdminAudit(request, { before, after, targetId, summary })` lets a handler add what only it knows. Routes covered: roles and Premium (`users`, `premium`), messages (`user-notifications`, `feedback-surveys`), requests (`feedback`, `race-requests`, `organizer-demo-requests`), organizer access, publication requests and packs (`organizer-claims`, `event-publication-requests`, `organizer-feature-catalog`, `organizer-social-proofs`), billing (`organizer-invoices` + `pdf` + `settlement`, `organizer-payments` + `invoice`), catalogue (`/api/race-catalog` and `[id]` PATCH/DELETE, `gpx`, `aid-stations`, `thumbnail`, `race-events/[id]` + `thumbnail`, Betrail / Trace de Trail / UTMB imports, organizer website import), products (`admin/products`, `/api/products`, `[productId]`, `image`), `partner-links`, publications (`social-posts` create / update / schedule / publish / delete), automations (`reel-automation`, `carousel-automation` and their items), renders and studio (`render-jobs` create / start / delete, `narrations`, `voices`), `flyover-orders`, `runner-access-mode` and maintenance (`resend/sync`, `racebook-publications/backfill` and `cleanup`, `system/cron-run`). Left out on purpose: previews and AI generation (`organizer-invoices|payments/preview`, `video-generator/caption|content|script|voice`), the `advance` polling step, dry runs and every GET, the other `/api/organizer/*` routes (an admin editing an event as an organizer, not an admin-only action) and the Stripe / cron routes (not admin actions). Reading: `GET /api/admin/audit` (`authorizeVideoAdmin`, read-only, never journaled; `?du&au&acteur&action&cible&statut&recherche&page&entree&export=1`, `available: false` before the migration). Page `/admin/system/audit` (`AuditLog`): table from `md`, cards below, relative + absolute time, actor (profile name, else masked e-mail), family badge + French action label, target link to the sheet (`/admin/runners?coureur=`, `/admin/organizers?edition=`, `/admin/catalog/races?course=`, `/admin/content/posts?post=`, `/admin/content/renders?rendu=`, `/admin/content/flyovers?commande=`, `/admin/billing?ligne=`), summary; period, family, result, actor, target (`?cible=`) and search chips in the URL; `?entree=<id>` opens `AuditEntryDrawer` with the before/after diff (`diffAuditValues`); CSV export (`;`, BOM, formula cells neutralised like lot 4). The « Activité récente » card of `/admin` adds the 3 latest important admin actions (`IMPORTANT_AUDIT_ACTIONS`, failures always) after the business events, linking to `?entree=`; « Journal → » opens the page. `vitest.config.ts` sets `ADMIN_AUDIT_LOG_DISABLED=1` so route tests that mock `fetch` call by call stay unchanged; the journal tests turn it back on.
- **Lot 6: contents.** Rendus (`/admin/content/renders`, `RendersQueue`): one list of every render, from `GET /api/admin/renders` (`authorizeVideoAdmin`, read-only; `lib/admin-renders.ts` pure and tested, `lib/admin-renders-server.ts`): `video_render_jobs` (manual reels, automatic reels, flyovers) and `carousel_render_jobs`, 300 newest per source. The type is deduced from the columns: `flyover_order_id` gives Survol, a `reel_automation_items.render_job_id` link gives Reel automatique, else Reel manuel (`auto_draft` alone cannot tell, the cron and the studio's « Générer le reel » both set it; it is shown as « brouillon créé automatiquement »), every carousel is Carrousel. The status is normalised (En attente / En cours / Terminé / Échec, chips En cours / Terminés / Échecs), the stage line is the one of `render-activity`, a silent render is marked failed in the base like `render-activity` does (`RENDER_LOST_MESSAGE`), origin links point to the plan item (`/admin/content/posts?element=`), the flyover order (`/admin/content/flyovers?commande=`) or the race, plus the post made from the render (`?post=`). The MP4 of the finished reels of the page and of the open panel is signed for 1 hour like `render-jobs`; without Google Cloud configuration the list still loads (`downloadsAvailable: false`). `?rendu=<id>` opens `RenderDrawer` (also for a render the period or page hides: the server returns it as `focus`); « Supprimer » (finished or failed reels, confirmed in the panel) calls the existing `DELETE /api/admin/video-generator/render-jobs/<id>`. Refresh: 5 s while a render is active, 60 s otherwise. The studio's `BackgroundRenderPanel` keeps its list and adds « Voir tous les rendus → », « Voir dans la file » and « Voir le brouillon » (`GET render-jobs` now also returns `raceId` and `post`); the render cards of Reels and Carrousels are summaries (running + failures of 24 h, `summarizeRenderActivity`) linking to the queue; overview, inbox and « À surveiller » links open the render panel. Studio: after « Générer le reel » the finished message links to the render in the queue; the Instagram panel gets « Créer un brouillon avec ce texte » (`studio-draft.ts`, same `POST /api/admin/social-posts` as « Nouveau brouillon », limits checked with the server schema, confirmation if the render already has a post) and keeps « Copier ». Publications: the `templates` tab is « Carrousel manuel », placed after « Carrousels automatiques », and both tabs show `CarouselKindsNote` (automatic series versus 4 PNG exported by hand). Calendrier: planned flyovers (paid collaboration with a publication slot whose post is not scheduled yet) appear as `◈` entries and open the order; posts open their card, plan items their element, « À surveiller » renders the render panel. Not done: carousel renders have no download or delete here (JPEG slides live with their post; no delete route exists).
- **Primitives** in `components/ui` (`StatusBadge`, `Switch`, `Select`, `Drawer`, `EmptyState`, `KpiTile`, `Toast`, `CommandPalette`): see [Design Components](../07-design-system/components.md). `vitest.config.ts` now also runs `components/**/*.test.ts`.

### Feedback surveys (Questionnaires)

"Messagerie" has a fourth sub-tab, "Questionnaires" (`AdminSurveysTab`). The admin picks an event from `GET /api/admin/feedback-surveys/audiences` (PostHog `racebook opened` readers per `event_id` over the last year), sees the reachable audience from `GET /api/admin/feedback-surveys/audiences?eventId=` (identified readers, accounts, push, e-mail), edits the prefilled message (`surveyDefaultCopy`: greeting and signature from `admin-message-template.ts`, plus a line asking older apps to update) and sends with `POST /api/admin/feedback-surveys`. The route resolves the audience server-side (`lib/feedback-surveys.ts`: PostHog HogQL query API with the organizer-analytics PostHog env, Supabase UUID v4 ids only, then `resolve_feedback_survey_recipients`), upserts the campaign, inserts one `feedback_survey` notification per runner with a derived id, then delivers pending rows with bounded concurrency. The form keeps its campaign id after a failure, so sending again resumes without duplicates. A "Destinataires" switch also offers "Un utilisateur précis (test)": the admin searches an account through `GET /api/admin/users?search=` or picks themselves ("M’envoyer à moi", read from the access token by `accessTokenUser`), checks push/e-mail reachability with `GET /api/admin/feedback-surveys/audiences?userId=`, and sends with `userId` (event optional, used to prefill the copy). That creates a `single_user` campaign through `resolve_feedback_survey_single_recipient`, which allows admin accounts, without querying PostHog. `GET /api/admin/feedback-surveys` returns the last 50 campaigns with counters from `feedback_survey_campaign_stats` (recipients, read, push sent, answers, useful rate) and up to 1000 answers with the runner's profile name, filterable by useful / not useful. See [feedback_survey_campaigns](../02-database/tables/feedback-survey-campaigns.md).

Reel exports (in the browser and in the background render) lay the frame out at the video size ÷ 2 at density 2 (`export-frame.ts`), so Mapbox loads the tile level of the video resolution; the camera is placed in metres, so the framing matches the preview, and the map's fixed pixel sizes are scaled during the export (`applyMapPixelScale`) so the route, icons and bubbles keep their size.

Background renders can be deleted from the reel panel ("Supprimer" on finished or failed renders), and every exported frame re-places the DOM markers after the map is idle so the aid bubbles stay on their station icon.

Reel aid bubbles and place labels are centred by layout inside zero-size markers, so the rasterised export clone keeps them on their station whatever its fonts; the aid bubbles float 28 px above their icon so the tail does not touch it.

Reels light the told climb or descent in the profile slope colours on the map and on the elevation profile while its caption is shown (setting "Pente racontée en couleur"), and no longer show the logo and CTA in the bottom-left corner by default ("Logo et CTA en bas"), where Instagram puts its follow button.

Reel numbers have one source of truth (`app/admin/video-generator/race-figures.ts`): the race record distance and D+ are the announced figures, GPX kilometres and D+ are rescaled to them (fallback to the GPX with a console warning when a race figure is more than 15 % / 35 % away), organizer station kilometres are placed on the GPX through the same scale, and the badge, the counter, the story, the aid cards, the transport bar and the script and caption inputs share one rounding policy. See [Mapbox 3D](../05-integrations/mapbox-3d.md#race-figures-single-source-of-truth).

The reel type ("Parcours complet" / "Temps forts", setting `storyMode`, default full) can switch to a highlights reel: 3 to 5 key moments (hardest climb, refuel station, last climb, biggest descent, night passage, strategic stations) told in 30-50 s with fast transits between them, a script sized for that length (`mode: "highlights"`), and its own saved narration (`video_narrations` keyed by race and mode), with a lighter overlay by default (no title band or profile ticks, aid bubbles with the name only, every readable text at least 32 px). See [Mapbox 3D](../05-integrations/mapbox-3d.md#highlights-reel-temps-forts).

## RaceBook publication checks and partner slots (2026-11-09)

The organizer publish dialog renders `PublicationReview` (blocking checks, warnings, affiliate slots). The Sponsors editor embeds `PartnerSlotsEditor`. New routes: `/api/organizer/editions/:id/partner-slots`, `/api/racebook-partner-slots/:slot/click`, `/api/racebook-partner-slots/impression`.

## Authenticated followed-plan context

The share write binds additive `snapshot.raceId` from the owned `race_plans.race_id` and ignores the client value. Active followers receive a server-derived `raceContext`: current public race/event visibility plus the immutable RaceBook publication resolved through the same effective-module normalizer as `/api/racebook-data`. Missing publications and inactive modules never fall back to draft tables. The public `/share/plan/[token]` rendering remains unchanged.
Organizer follow-up UX keeps autosave validation local, uses the shared file-field kit for organizer uploads, and renders the save status beside the active section title. Runner saved-plan loading restores `planId` in the URL with `router.replace`; no route or persistence contract changed.

The Organizer content workspace now uses a responsive three-column shell: semantic section navigation, a bounded central editor, and a completion rail. Event/edition/visibility controls stay in the compact top banner, statistics remain reachable from the rail, and mobile collapses to a native workspace selector before the editor.

The route-local Organizer kit now supplies responsive field groups and section headers so editors share one visual hierarchy without changing their state ownership or API payloads.

Course/GPX composes existing map/profile and file primitives into a bounded visual rail; it introduces no data or route dependency.

Organizer editors consume one route-local `SwitchRow` primitive for boolean settings; state ownership remains in each existing editor.

The aid-station editor derives a presentation-only course timeline from already loaded sidecars. It does not add a read, cache, or persistence contract.

Organizer finishing layouts reuse existing editor state and endpoints; section headers, Access summaries, sponsor disclosure, service conversion, and branding surfaces add no new route or dependency.

The semantic section tree retains the existing Organizer onboarding/capture anchor and explicit accessible module labels for automation compatibility.

On narrow screens, separate native selectors choose the event/format scope and the active section, preserving the complete desktop navigation hierarchy.

## Brand positioning (2026-11-16)

The default (home) metadata now leads with the Livret coureur and the Livret supporter instead of the nutrition planner, and the home hero copy presents the booklets, the free time estimate and the fueling plan (CTAs unchanged). Home JSON-LD adds a brand description, App/Play Store `sameAs` and a free `MobileApplication` node (`#app`). Signed-out visitors see « Organisateurs » in the header (signed-in users keep « Espace organisateur »); the footer links `/livret-coureur` and `/livret-supporter`.

## Organizer demo requests and auth return (2026-11-16)

`/organisateurs` offers a « Demander une démo » form (e-mail and race link required, phone optional) stored in the service-only `organizer_demo_requests` table and listed in the admin inbox tab « Demandes de course »; it creates no account, membership, entitlement or payment. See [organizer_demo_requests](../02-database/tables/organizer-demo-requests.md). Organizer return paths are remembered like runner returns, and the root hash-token handler resumes the remembered destination instead of always opening `/race-planner`.

Organizer header (2026-11-16): the dashboard header no longer shows the « Aperçu coureur » and « Aperçu accompagnateur » web preview links (« Voir le Livret coureur » and « Télécharger le QR » remain), and its row wraps instead of letting the actions block overlap the edition selector. Presentation only; no data, contract or offer change.

Follow-page fix (2026-11-16): `getPublicSupporterGuide` now reads `/api/supporter-guide` with `next.revalidate` (15 min, edition tag) instead of the `no-store` service loader, which aborted ISR renders with DYNAMIC_SERVER_USAGE and made every « Suivre » page 404 in production.

## Admin Instagram publications (2026-11-19)

The admin header linked to `/admin/publications` (« Publications »), next to the 3D video generator; since lot 1 of the admin console its tabs are the Contenus pages (`/admin/content`, `/admin/content/posts`, `/admin/content/renders`, `/admin/content/flyovers`) and Système (`/admin/system/automation`, `/admin/system/integrations`), and the old URL redirects. The page, protected by the shared admin layout and by `authorizeVideoAdmin` on every route, shows a read-only Instagram status card (`/api/admin/instagram`: System User credentials configured or not, account username and profile and publishing quota read server side from `graph.facebook.com`, linked Page id, Graph version, mode « Simulation » / « Publication réelle »; the token is never returned and there is no connect button), creates drafts from finished background renders (`/api/admin/social-posts`), edits caption, hashtags and cover text with react-hook-form + Zod (Instagram limits checked live and again on the server), previews the MP4 through a 1-hour signed URL, and offers « Publier maintenant », « Programmer » (Europe/Paris wall time, stored UTC), « Annuler la programmation », « Réessayer » and « Supprimer » (`/api/admin/social-posts/[id]`). Data loading uses the local TanStack Query shim; while a post is publishing the page polls the list and advances the post every 30 s. Nothing is published without one of those clicks, and publishing is simulated unless `INSTAGRAM_PUBLISH_DRY_RUN=false`; a post scheduled in one mode fails instead of being published in the other. Once a live publish was requested, any action that would drop the Instagram container (editing a failed post, retrying after a mode change, « Recommencer avec un nouveau conteneur ») gets a 409 `needsConfirmation` from the route, which the page turns into a confirmation dialog before resending with `confirmRestart: true`. The report-only CSP has no `media-src`, so the preview `<video>` from `storage.googleapis.com` may raise a report; it still plays. Flow, limits and setup: [Instagram Reels Publishing](../05-integrations/instagram-publishing.md).

One-click reel (2026-11-19; mode choice 2026-11-20): the generator opens on Temps forts, a « Parcours complet » / « Temps forts » choice sits above the button (★ = advised by the reel rules), and « Générer le reel » (`ReelPipelinePanel`, `reel-pipeline.ts`, `useReelPipeline.ts`) runs text, voice, save and the background render on the same functions as the individual buttons, with a resumable progress list and warnings that never block. The render-jobs POST accepts `autoDraft`; when such a job reaches `done`, the token-authenticated completion route `POST /api/video-render/jobs/<id>` creates one `draft` post through `createAutoDraftForRenderJob` (service role, idempotent, a failure is logged and keeps the job `done`). Details: [Mapbox 3D](../05-integrations/mapbox-3d.md) (« One-click reel »), [Google Cloud render](../05-integrations/google-cloud-video-render.md).

Automatic reels (2026-11-20): `/admin/publications` adds the « Automatisation » card (two switches off by default, caps, upcoming plan with « Exclure » / « Rétablir », planned reels in grey in the month calendar), backed by `/api/admin/reel-automation` and `/api/admin/reel-automation/items/[id]` (`authorizeVideoAdmin`), and the cron route `/api/cron/reel-automation` (`CRON_SECRET`, pg_cron hourly). To run without a browser, the AI writer, voice and race detail route cores moved to `lib/reel-writer.ts`, `lib/reel-voice.ts` and `lib/video-generator-race.ts` (the routes keep their contracts), the editor's race info builder to `app/admin/video-generator/video-race-info.ts`, the Tilequery peak lookup to `place-labels.ts`, and `reel-composition.ts` rebuilds beats, writer requests and the render snapshot from the same pure modules; « Programmer » goes through `scheduleSocialPostDraft`. Since 2026-11-21 a reel no longer needs an aid station (GPX, 30 km or more, live solo future format). See [Automatic Reel Pipeline](../05-integrations/reel-automation.md).

Publications tabs (2026-11-20): the page is split into Agenda, Reels, Carrousels, Publiées and Paramètres tabs (`publication-tabs.ts`, `?onglet=`), with « Rendus en cours » read from `/api/admin/render-activity` (`authorizeVideoAdmin`, `lib/render-activity.ts`); see [Instagram Reels Publishing](../05-integrations/instagram-publishing.md).

Automatic carousels (2026-11-20): the « Automatisation » card gains a « Carrousels » section (`CarouselAutomationSection.tsx`: one switch per series, weekly slots with « Exclure » / « Rétablir », « Générer maintenant » for a chosen race or week) backed by `/api/admin/carousel-automation` and `/api/admin/carousel-automation/items/[id]` (`authorizeVideoAdmin`) and the cron route `/api/cron/carousel-automation` (`CRON_SECRET`, pg_cron hourly at :47). The Cloud Run renderer opens the standalone noindex page `/render/carousel/[id]` (carousel-scoped job token in the fragment, `/api/carousel-render/jobs/[id]`), which draws the slides from a server snapshot and uploads JPEGs. Carousel drafts show their slides in order in the post card; the calendar marks carousels with ▦. See [Automatic Instagram Carousels](../05-integrations/instagram-carousels.md).

## Runtime error boundaries and rate limiting (2026-11-22)

`apps/web/app/error.tsx` and `apps/web/app/global-error.tsx` handle uncaught runtime errors (French copy, retry via `reset()`); `global-error.tsx` renders its own `<html>`/`<body>` with inline styles because it replaces the root layout. `app/organizer/error.tsx`, `app/admin/error.tsx` and `app/(planner)/error.tsx` reuse `components/ErrorFallback.tsx` so each segment keeps its layout chrome. Errors are reported through `lib/error-reporting.ts` into the consent-gated `trackGoogleAnalyticsEvent` (event `client error`, fields `source`, `error_name`, `digest` only; never the message or stack), so nothing is sent without cookie consent.

Public routes (`location-search`, `affiliate/[offerId]`, `affiliate/products/[slug]`, `stripe/price`) and the authenticated `plans/from-catalog` and `products/[productId]/image` routes use the DB-backed `checkRateLimitAsync`; the in-memory `checkRateLimit` is only its fallback and remains in use by admin and trial routes.

## Marketing pages CRO pass (2026-11-22)

Presentation and copy only; no API, schema or analytics-event change. The home hero (`HeroSection`) replaces the static fuel-gauge image with `RaceBookPhoneMockup` (`apps/web/components/landing/RaceBookPhoneMockup.tsx`), the Trail TST phone and muted demo video also used by `/organisateurs` (with the optional supporter card). Both audience CTAs (runner, organizer) sit directly under the subtitle so the organizer route is visible without scrolling on mobile. `HomeProofStrip` renders the first published organizer social proof under the hero (`loadPublishedOrganizerSocialProofs(1)` in `app/page.tsx`, same five-minute cache as `/organisateurs`) and nothing when no proof is published. The "Démo : un plan 50K" gauges are an illustrative, labelled example instead of the zero-valued screenshot.

Home copy that changed (heading, subheading, how-it-works including the Livret coureur, FAQ in "tu" with the 9,99 € / 29,99 € runner prices) lives in `components/landing/home-copy.ts`, layered over `t.landing`; fold it back into `locales/fr.ts` / `locales/en.ts` when convenient. `/organizers` addresses organizers with "vous", has its own noindex title and shows the free-until-publication reassurance using `ORGANIZER_TIER_PRICE_EUR.essential`; `/organisateurs` pricing cards get one CTA each and read prices from the same constant.

- Gotcha: the runner prices in the FAQ copy are literal strings (no shared constant exists); update them with the commercial prices.

## Race funnel analytics (2026-11-22)

`PublicHeroShell` mounts the client-only `RaceFunnelTracker` (page view and delegated estimate CTA click) and `Analytics` mounts `CheckoutReturnTracker`; neither renders UI. The hero and sticky bar links expose `data-estimate-placement`. Web runner funnel analytics (2026-11-22): see [analytics.md](../05-integrations/analytics.md#web-runner-funnel-2026-11-22). `EventEditionSections` passes the edition funnel context (event id, start date, demo flag) to `PublicHeroShell` for both hub and edition pages.

## Organizer partner report (2026-11-22)

`GET /api/organizer/editions/[id]/sponsor-report?format=json|csv|pdf` returns the aggregated Signature partner report as JSON or as a `Content-Disposition: attachment` CSV/PDF with `Cache-Control: private, no-store`. The client card (`dashboard/sponsor-report-card.tsx`, rendered under the Sponsors editor) downloads it with the bearer header through a temporary object URL, since a plain link cannot carry the token. Rules: [Organizer Commercial Offers](../03-business-rules/organizer-commercial-offers.md#rapport-partenaires-2026-11-22).

## Organizer flyover video orders (2026-11-22)

`/survol` (indexable, in the sitemap) sells organizers a 3D flyover reel made from their GPX: a server page with a client form (`flyover-order-form.tsx`: GPX read in the browser with its waypoints pre-filled as aid stations, live 3D preview `flyover-preview.tsx` built on the admin `VideoGeneratorMap` in `preview` mode (the viewer imports the Mapbox CSS itself since 2026-11-22, so its DOM markers are positioned on every page that uses it, the render page included), offer and payment last; the organizer picks the story mode and one of four basemaps, applied live in the preview) posting multipart to `POST /api/flyover-orders` (public, rate-limited, honeypot, Stripe Checkout). Admin › Publications has a « Survols » tab (`FlyoverOrdersCard.tsx`, `GET`/`PATCH /api/admin/flyover-orders`) to follow, cancel, retry, rewrite or resend an order. `/survol/commande/[id]?t=<token>` (noindex) shows the order status and, for the MP4 offer, a download button backed by `GET /api/flyover-orders/[id]/download` (HMAC token, redirect to a short-lived signed GCS URL). A pg_cron job calls `POST /api/cron/flyover-orders` every 10 minutes to write, voice and render the reel. All routes use the service role; the table has no RLS policy. `/api/admin/social-posts` returns `racePublication: null` for a render with no race (flyover renders). Rules, setup and pitfalls: [Organizer Flyover Video Orders](../03-business-rules/flyover-video-orders.md).

## Blog content bundling and crawl-oriented internal links (2026-11-23)

- `next.config.mjs` sets `experimental.outputFileTracingIncludes["/**"] = ["./content/blog/**/*"]`. The blog loader (`lib/blog/posts.tsx`) reads MDX from `apps/web/content/blog` at runtime; before this, Vercel functions did not bundle the folder and every ISR regeneration of `/` and `/blog/[...slug]` threw "Unable to locate the blog content directory" (904 runtime errors from 2026-08-28 to 2026-11-23, seen by Googlebot as 5xx). Keep the include when moving the blog content.
- The home page reads blog metadata with a `.catch(() => [])` guard so a blog read failure never takes `/` down.
- `app/courses/_components/CourseDiscoveryLinks.tsx` (server) renders the indexable distance, region and month landing links (`buildLandingCrossLinks`, same rules as `/courses`) on the home page and under every blog article; blog articles about a specific race add a featured link to its event page (`ARTICLE_EVENT_LINKS` in `app/blog/[...slug]/page.tsx`).
- `app/courses/_components/RaceRelatedArticles.tsx` (server) adds « Pour préparer cette course » on format pages: up to 3 blog guides chosen by distance (`lib/race-related-articles.ts`), matched on the article canonical path, silently omitted when the blog cannot be read.

## Catalogue slug redirects (2026-11-23)

`next.config.mjs` exports `catalogSlugRedirects`, permanent redirects for event hub slugs retired by a data merge. They stay outside `staticPathRedirects`, whose integrity test only covers legacy and blog routes with static targets. First entries: the two suffixed Marathon du Mont-Blanc hubs (`…-08a81d9c`, `…-d1472716`) now redirect to `/courses/evenements/marathon-du-mont-blanc` after migration `20261123200000` merged the duplicate events. The Marathon du Mont-Blanc blog article links to that hub. Covered by `lib/catalog-slug-redirects.test.ts`.

Catalogue slug redirects (2026-11-23, follow-up): `catalogSlugRedirects` also sends the two undated legacy Marathon du Mont-Blanc formats (`/courses/marathon-du-mont-blanc-90k-lunr`, `/courses/marathon-du-mont-blanc-qonc`) to the dated 2027 formats, after migration `20261123210000` unpublished them. The Marathon du Mont-Blanc article's plan CTA (`CATALOG_RACE_MAP`) now targets the 42 km 2027 format.

## Course weather (2026-11-23)

Weather along the course is display-only (MET Norway, 9-day horizon) and never feeds pacing or nutrition. `apps/web/lib/course-weather-client.ts` fetches `GET /api/race-weather?raceId=<uuid>` (`CourseWeatherResponse` from `@trailplanner/shared`) and exposes `useCourseWeather`, a small module cache honouring the response `expiresAt` (no TanStack Query provider is mounted in the planner). Two client mounts, both fetched after hydration: the race planner (`CoursePlanWeather`, below the plan views when the plan is linked to a catalog race) and the public `/courses/[slug]` page (`CourseRaceDayWeather`, upcoming races only, so the ISR page is unchanged). Weather is free: it is not part of the paid plan or the free-preview paywall. The attribution returned by the endpoint (« Données météo : MET Norway (CC BY 4.0) ») is shown wherever a forecast is displayed.
