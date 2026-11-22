---
title: Admin console redesign (audit and target structure)
scope: decision
last_verified: 2026-11-23
ai_priority: medium
related_files:
  - apps/web/app/admin/layout.tsx
  - apps/web/app/admin/page.tsx
  - apps/web/app/admin/admin-routes.ts
  - apps/web/app/admin/admin-redirects.ts
  - apps/web/app/admin/_components/shell/AdminShell.tsx
  - apps/web/app/admin/_components/pages/AdminOverviewPage.tsx
  - apps/web/app/admin/inbox/page.tsx
  - apps/web/lib/admin-overview.ts
  - apps/web/lib/admin-inbox.ts
  - apps/web/lib/admin-system-health.ts
  - apps/web/app/admin/system/maintenance/page.tsx
---

# Console d'administration : audit et structure cible (2026-11-22)

**Statut : validé par le mainteneur le 2026-11-22**, mis en œuvre par lots 0 à 7 sur la branche `dev/admin-console` (une PR). Chaque lot met à jour la section « Avancement » ci-dessous.


Base : lecture du code (`apps/web/app/admin`, `apps/web/app/api/admin`, surfaces admin hors `/admin`, mobile). Maquette du dashboard : `docs/08-decisions/assets/2026-11-22-admin-dashboard-mockup.html` (valeurs fictives).

## 1. Constat en une phrase

L'admin a grandi par empilement : **3 pages, 9 onglets sans URL, 7 onglets avec URL, ~50 routes API, 6 surfaces admin cachées hors de /admin**, et aucune vue d'ensemble de « ce qui se passe » ni de « ce qui m'attend ».

## 2. Inventaire (ce qui existe aujourd'hui)

### `/admin` — 9 onglets (état local, **pas de lien direct possible**)

| Onglet | Ce qu'on y fait | Taille |
|---|---|---|
| Catalogue produits | Import JSON, liste, en ligne/brouillon/archive, édition | 603 l. |
| Utilisateurs | Liste/recherche/filtres, rôles, Premium (accorder/révoquer), détails, envoyer un message, courbe 30 j | 960 l. |
| Messagerie | Sous-onglets Bugs, Feedback, Demandes de course (+ démos organisateurs), Questionnaires | ~1 200 l. |
| Templates sociaux | Carrousel manuel de 4 PNG à partir d'un de vos plans | ~1 750 l. |
| Catalogue de courses | Création (manuelle, UTMB, Trace de Trail), édition course/événement, GPX, ravitos, images, suppression | **2 348 l.** |
| Organisateurs | 2 sous-onglets : « Publier le livret » (catalogue des modules offerts, demandes de publication, nouvelles éditions, droits par édition + pack + factures + virements) et « Accès » (claims, associer, révoquer) | **1 918 l.** |
| Preuves sociales | Témoignages + stats PostHog, publication sur /organisateurs | 429 l. |
| Liens partenaires | Booking, Decathlon | 198 l. |
| Croissance & Utilisateurs | KPI, courbes, alertes, revenus, funnel, organisateurs à relancer (lecture seule) | 220 l. |

### `/admin/publications` — 7 onglets (`?onglet=`)
Agenda (à surveiller + calendrier), Reels, Carrousels, Survols, GPX à traiter, Publiées, Paramètres (compte Instagram, automatisations).

### `/admin/video-generator` — studio
Choix course, carte 3D, narration IA, voix (pool), export navigateur, rendu en arrière-plan, légende Instagram, composition.

### Admin caché hors `/admin`
- `/profile` (web) et profil mobile : simulation des droits coureur (Réel / Gratuit / Premium) — 2 interfaces pour la même fonction.
- `/race-planner` : créer une course du catalogue, envoyer un GPX.
- `/organizer` : l'admin voit tous les événements, peut **offrir une offre partenaire** (2ᵉ mécanisme d'attribution de pack) et importer depuis un site.
- Mobile : éditer/supprimer n'importe quel produit, aperçu de l'annonce 1.0, infos OTA.

### Routes API sans aucun écran
`organizer-payments` (enregistrer un virement), `premium` GET/PATCH, `racebook-publications/backfill` et `/cleanup`, `resend/sync`, `race-catalog/betrail-import` (scripts). Les 9 crons n'ont aucun suivi visible.

## 3. Problèmes (classés par impact)

1. **Pas de tableau de bord.** « Croissance » est le dernier onglet, lecture seule, sans santé technique ni travail en attente.
2. **Le travail à faire est éparpillé** : badges Messagerie (bugs, feedback, demandes de course + démos fusionnées), demandes organisateurs comptées seulement dans le texte d'une carte, Agenda Publications, GPX à traiter, survols, organisateurs à relancer. Aucun total, aucune file unique.
3. **Rien n'est partageable** : les onglets de `/admin` n'ont pas d'URL ; impossible d'envoyer « va voir cette demande ».
4. **Mêmes objets, plusieurs endroits** :
   - Rendus vidéo : 3 listes (studio, Publications › Reels, Agenda) + le sélecteur « Nouveau brouillon ».
   - Légende Instagram : studio (copier) et Publications (brouillon).
   - Carrousels : « Templates sociaux » (manuel) et Publications › Carrousels (auto), sans lien.
   - Pack organisateur : « Gérer le pack » (admin) et « Offrir une offre partenaire » (/organizer), 2 routes d'action.
   - Factures : factures manuelles + factures de virement dans la même ligne d'édition ; KPI revenus ailleurs.
   - Écrire à un utilisateur : 4 points d'entrée (utilisateurs, feedback, demandes de course, questionnaires).
   - Recherche d'utilisateur : 3 backends différents.
   - Données de course : éditées dans Catalogue, diagnostiquées dans « GPX à traiter » **sans lien vers l'édition**, dans le studio et sur /race-planner.
5. **Écrans géants** : 3 composants > 1 900 lignes, dialogues dans des dialogues (pack + facture + virement).
6. **Pas de briques UI admin** : pas de Badge/Statut, Switch, Select, Drawer, Table de données ; chaque écran refait les siennes (styles et comportements différents).
7. **Système invisible** : crons, envois d'e-mails, quotas Instagram, files de rendu, mode simulation — aucun écran ne dit « tout va bien » ou « ça casse depuis 3 h ».
8. **Incohérences** : onglet « Croissance & Utilisateurs » titré « Croissance & activation » ; textes i18n de croissance inutilisés ; courbe de croissance chargée deux fois.

## 4. Structure proposée : une console à barre latérale

Principe : **un domaine = une entrée**, chaque vue a son URL, la liste reste à gauche et le détail s'ouvre dans un panneau latéral (pas de modale empilée), et une **file « À traiter » unique** alimente le dashboard.

```
Pace Yourself · Admin                      [⌘K Rechercher…]  [● Instagram : simulation]  [🔔 12]
├─ Vue d'ensemble                /admin
├─ À traiter (12)                /admin/inbox          ← file unique, filtres par type
│
├─ PILOTAGE
│  ├─ Analytique                 /admin/analytics      ← croissance, funnel, revenus, organisateurs
│  └─ Ventes & facturation       /admin/billing        ← registre unique : Stripe, virements,
│                                                         factures, remboursements, survols
├─ CLIENTS
│  ├─ Coureurs                   /admin/runners        ← liste + fiche (plans, Premium, messages)
│  └─ Organisateurs              /admin/organizers     ← comptes & accès · éditions & packs ·
│                                                         démos & relances · preuves sociales
├─ CATALOGUE
│  ├─ Courses & événements       /admin/catalog/races  ← + onglet « Qualité des données »
│  ├─ Produits nutrition         /admin/catalog/products
│  └─ Liens partenaires          /admin/catalog/partners
│
├─ CONTENUS
│  ├─ Calendrier                 /admin/content        ← agenda + calendrier éditorial
│  ├─ Studio vidéo               /admin/content/studio
│  ├─ Publications               /admin/content/posts  ← reels, carrousels, publiées (filtres)
│  ├─ Rendus                     /admin/content/renders← UNE seule file de rendus
│  └─ Vidéos de survol           /admin/content/flyovers
│
├─ COMMUNICATION
│  ├─ Messages & notifications   /admin/messaging      ← historique + nouveau message
│  └─ Questionnaires             /admin/messaging/surveys
│
└─ SYSTÈME
   ├─ Automatisations            /admin/system/automation ← reels, carrousels, crons (dernier
   │                                                        passage, échecs), interrupteurs
   ├─ Intégrations               /admin/system/integrations← Instagram, Stripe, Resend, GCP, Mapbox
   ├─ Maintenance                /admin/system/maintenance ← backfill livrets, nettoyage, sync
   │                                                        Resend, imports Betrail (APIs sans écran)
   └─ Journal                    /admin/system/audit       ← qui a fait quoi (nouveau)
```

### Ce que deviennent les écrans actuels

| Aujourd'hui | Demain |
|---|---|
| Croissance & Utilisateurs | Vue d'ensemble (synthèse) + Analytique (détail) |
| Utilisateurs | Coureurs (fiche en panneau latéral : plans, Premium, messages, activité) |
| Messagerie › Bugs / Feedback / Demandes | À traiter (file unique) ; historique dans Communication |
| Messagerie › Questionnaires | Communication › Questionnaires |
| Organisateurs (2 sous-onglets, 1 918 l.) | Organisateurs › Comptes & accès / Éditions & packs ; la facturation part dans Ventes & facturation |
| « Offrir une offre partenaire » (/organizer) | Supprimé : une seule action « Gérer le pack » |
| Preuves sociales | Organisateurs › Preuves sociales |
| Catalogue de courses + GPX à traiter | Catalogue › Courses (onglet Qualité, chaque ligne ouvre l'édition) |
| Catalogue produits, Liens partenaires | Catalogue |
| Templates sociaux | Contenus › Publications › « Carrousel manuel » |
| /admin/publications (7 onglets) | Contenus (Calendrier, Publications, Rendus, Survols) ; Paramètres → Système |
| /admin/video-generator | Contenus › Studio vidéo (son panneau « Rendus » renvoie vers la file unique) |
| Simulation des droits (/profile, mobile) | Bandeau global « Mode test » dans la barre du haut (le mobile garde son raccourci) |

## 5. Le dashboard (« Vue d'ensemble »)

Inspirations : Stripe Dashboard, Linear, Vercel, PostHog, Shopify Admin. Règle : **en 5 secondes, savoir si tout va bien, ce qui a bougé, et ce qui m'attend.**

1. **Barre de période** (Aujourd'hui · 7 j · 30 j · Personnalisé) + comparaison automatique à la période précédente.
2. **6 indicateurs** avec valeur, écart vs période précédente (flèche colorée) et mini-courbe : Coureurs actifs, Nouveaux comptes, Plans créés, Revenus nets, Premium actifs, Livrets publiés.
3. **À traiter** (gauche) : compteur par type, les 5 plus anciens avec leur âge (« depuis 3 j »), bouton d'action directe.
4. **Santé** (droite) : un voyant par système (crons, rendus, Instagram + quota, e-mails, paiements/webhook), « dernier passage il y a 4 min », et le **mode** (simulation Instagram, simulation de droits).
5. **Activité** : courbe 30 j (comptes, actifs, plans) + **funnel** inscription → plan → Premium.
6. **Revenus par source** : coureurs (plans, abonnements), organisateurs (packs), survols — encaissé, remboursé.
7. **Les 7 prochains jours** : publications programmées, courses des organisateurs clients, rendus planifiés.
8. **Fil d'activité** : derniers événements (paiement, inscription, claim, commande, échec) cliquables.

## 6. Règles UX/UI de la console

- **Chaque vue a une URL** (onglets, filtres, élément ouvert) : partageable et compatible bouton retour.
- **Liste + panneau de détail** (drawer à droite) à la place des modales ; actions principales en haut du panneau.
- **Table de données unique** : recherche, filtres en chips, tri, pagination, sélection multiple et actions groupées, état vide avec action.
- **Statuts normalisés** : un seul composant `StatusBadge` (couleur et libellé par statut), mêmes verbes partout (Approuver, Refuser, Relancer, Annuler).
- **Palette de commandes ⌘K** : aller à une course, un utilisateur, un événement, une commande ; actions rapides.
- **Confirmation proportionnée** : annulable (toast « Annuler ») pour les actions légères, dialogue explicite pour l'irréversible (supprimer, rembourser, publier sans relecture).
- **Mode simulation visible en permanence** (bandeau) dès qu'Instagram est en simulation ou qu'une simulation de droits est active.
- **Journal d'audit** de toutes les actions admin (qui, quoi, quand, avant/après).
- **Responsive** : barre latérale repliable, tables qui passent en cartes sur mobile ; thème clair/sombre ; dates relatives + absolues au survol.
- **Primitives à créer dans `components/ui`** : AdminShell (sidebar + topbar), StatusBadge, Switch, Select, Drawer, DataTable, KpiTile (avec sparkline), EmptyState, CommandPalette, Toast.

## 7. Plan de mise en œuvre (par lots livrables)

| Lot | Contenu | Effort |
|---|---|---|
| 0 · Gains rapides | URL sur les onglets de /admin ; lien « Corriger » dans GPX à traiter ; compteurs organisateurs dans l'inbox ; libellé Croissance ; 1 seul chargement de la courbe | 0,5 j |
| 1 · Coque | AdminShell (sidebar, topbar, ⌘K, bandeau simulation) + primitives ; écrans actuels déplacés **sans changement** sous les nouvelles URL (redirections depuis les anciennes) | 2 j |
| 2 · Vue d'ensemble + À traiter | Route d'agrégation `/api/admin/overview` (réutilise growth, inbox-counts, render-activity, race-data-gaps, organizer-claims, flyover-orders, social-posts, instagram) ; file unique | 2–3 j |
| 3 · Santé système | Lecture des derniers passages pg_cron (`cron.job_run_details` via RPC service), échecs d'e-mails, quotas ; page Automatisations + Intégrations + Maintenance (boutons pour les APIs sans écran) | 2 j |
| 4 · Ventes & facturation | Registre unique (Stripe coureurs, abonnements, packs, virements, factures, survols, remboursements) ; sortir la facturation de l'onglet Organisateurs | 3 j |
| 5 · Fiches clients | Coureur et Organisateur en panneau latéral (tout l'historique au même endroit), découpe des composants géants | 3 j |
| 6 · Contenus | File de rendus unique, studio relié, carrousel manuel dans Publications | 2 j |
| 7 · Journal d'audit | Table `admin_audit_log` + écriture dans chaque route admin | 1–2 j |

Chaque lot = une PR, sans casser l'existant (anciennes URL redirigées).

## Avancement

| Lot | État | Notes |
|---|---|---|
| 0 | fait | Onglets de `/admin` et sous-onglets Messagerie / Organisateurs pilotés par `?onglet=` / `?vue=` (`admin-tabs.ts`) ; `?onglet=courses&course=<id>` ouvre l'édition, lien « Corriger » dans GPX à traiter ; `inbox-counts` sépare demandes de course et démos et ajoute claims, publications et nouvelles éditions (badges sur Organisateurs et la Messagerie, nouvel onglet « Démos organisateurs ») ; onglet renommé « Croissance », courbe partagée (même clé react-query, Croissance s'ouvre sur 30 j). Écart : `t.admin.growth.*` partiellement inutilisé, non supprimé. |
| 1 | fait | Coque `AdminShell` (`_components/shell/`) montée par `layout.tsx` après la vérification serveur inchangée : barre latérale (`ADMIN_NAV` de `admin-routes.ts`, groupes du §4, élément actif, compteurs « À traiter » = messages + organisateurs et Organisateurs), tiroir sous `lg`, barre du haut (fil d’Ariane, ⌘K, pastilles « Instagram : simulation » et « Droits : Gratuit/Premium », cloche vers `/admin/inbox`), polices Bricolage Grotesque / JetBrains Mono. `RootChrome` laisse `/admin` en autonome (plus de double en-tête ; le lien « Admin » du site est inchangé). Primitives `components/ui` : `StatusBadge`, `Switch`, `Select`, `Drawer`, `EmptyState`, `KpiTile` (+ `kpi-delta.ts`), `Toast`, `CommandPalette` (+ `command-palette-filter.ts`), `focus-trap.ts`. Page Publications découpée en `usePublicationsWorkspace` (mêmes clés de requête) + `PublicationViews.tsx` ; studio déplacé dans `VideoGeneratorStudio.tsx` (les modules de `video-generator/` ne bougent pas). Redirections `admin-redirects.ts` (testées) depuis `/admin?onglet=`, `/admin/publications?onglet=`, `/admin/video-generator`. Routes : voir le tableau ci-dessous. Écarts : `/admin` montre la section Croissance (dashboard au lot 2) ; « Qualité des données » est un onglet de `/admin/catalog/races` (pas une carte à côté de la liste) ; `/admin/messaging` est un renvoi vers Coureurs ; le Toast et les autres primitives ne sont encore utilisés que par la coque. |
| 2 | fait | `GET /api/admin/overview` (`lib/admin-overview.ts` pur + schéma Zod partagé, `lib/admin-overview-server.ts`) : KPI de la période et de la période précédente (mêmes durées, jours de Paris), courbe 30 j, funnel coureurs (comptes → fenêtre 24 h écoulée → premier plan en 24 h) et organisateurs (celui de la fonction growth), revenus par source (organisateurs = `netRevenueMinor` TTC, survols = commandes payées de la période, coureurs « non suivi » : aucun montant stocké), 7 prochains jours (posts programmés, créneaux reels/carrousels prévus, éditions des événements ayant un organisateur), santé (Instagram : identifiants, simulation, quota, échecs ; automatisations ; rendus 24 h ; survols en cours/échecs/retard > 24 h ; crons, e-mails et webhook Stripe affichés « suivi au lot 3 » sans valeur), activité récente (paiements organisateurs, commandes de survol, rendus terminés/échoués, posts publiés, comptes du jour). Chaque bloc est `ok`/`error` indépendamment. Appel RPC extrait dans `lib/admin-growth.ts` (contrat de `/api/admin/growth` inchangé). Page `/admin` fidèle à la maquette (période dans `?periode=`, squelettes, vides et erreurs par carte, infobulle au survol de la courbe via `TimeSeriesLineChart` `interactive`). File unique `GET /api/admin/inbox` (`lib/admin-inbox.ts` pur et testé : mapping, âge, seuils de retard par type, tri, filtres ; `lib/admin-inbox-server.ts`) et page `/admin/inbox` : onglet « File » (puces `?filtre=`, recherche `?recherche=`) et « Traiter les messages » (`?vue=`, Messagerie existante). `inbox-counts` + `inboxTotals` comptent aussi survols en échec, posts en échec, brouillons et rendus échoués 24 h (mêmes filtres que la file). Écarts : « Données de course » (reel encore possible, GPX manquant) est dans la file mais hors compteur (calcul trop lourd pour le badge) ; revenus en TTC (montants stockés), pas HT ; visiteurs du planner (PostHog) absents du funnel ; la salutation n’a pas de prénom (aucun nom en session) ; `/admin?onglet=messagerie` redirige vers `/admin/inbox?vue=bugs`. |
| 3 | fait | Migration `20261123090000_admin_system_health.sql` (non appliquée sur la base distante, elle part avec le merge) : `admin_cron_job_status()` (un job par ligne : planification, actif, dernier passage début/fin/statut/message tronqué à 300 caractères, passages et échecs 24 h ; jamais la commande, qui contient un secret pour 2 jobs) et `admin_pg_net_response_summary()` (réponses pg_net, erreurs, dernière erreur), `SECURITY DEFINER`, `search_path` vide, service role seulement ; table `transactional_email_log` (RLS sans politique) écrite en best-effort par `lib/resend.ts` (`recordTransactionalEmail`, catégorie = paramètre `category` ou clé d’idempotence sans ses id, destinataire masqué `fa***@gmail.com`, aucun contenu, délai max 2,5 s, jamais d’échec de l’envoi), purgée après 90 j par le job pg_cron `transactional-email-log-purge` ; contrôle `supabase/tests/admin_system_health_checks.sql`. `lib/admin-system-health.ts` (pur, testé) : période et libellé français des expressions cron (heures converties en heure de Paris), catalogue des tâches, crons Vercel (`VERCEL_CRONS`, synchronisés avec `vercel.json` par un test, statut « Jamais appelée par Vercel »), seuils (échec si le dernier passage a échoué ; en retard au-delà de 2 périodes ou passage bloqué au-delà de max(2 périodes, 15 min) ; avertissement si échecs 24 h ; e-mails en erreur si Resend absent ou si le dernier envoi de 24 h a échoué ; paiements en erreur si clés Stripe absentes ou événement du journal coureur non traité après 15 min sur 7 j, avertissement si paiement organisateur Stripe en échec ou contesté sur 7 j). `loadSystemHealth` remplace `UNTRACKED_SYSTEMS` dans `loadAdminOverview`, alimente la file (type « Système », `?filtre=systeme`, compté, une ligne par tâche en panne + e-mails + paiements) et `inbox-counts` (`systemIncidents`). Pages : Automatisations (tableau des tâches au-dessus des interrupteurs), Intégrations (cartes Stripe, Resend, Google Cloud, Mapbox, ElevenLabs, Anthropic, OpenAI : présent/absent, jamais de valeur ; derniers e-mails, événements Stripe, rendus), Maintenance (relance d’une tâche pg_net via `POST /api/admin/system/cron-run` qui appelle le handler en mémoire avec `CRON_SECRET` ; synchro Resend en simulation puis réelle page par page ; rattrapage et nettoyage des livrets ; commande Betrail affichée). Écarts : pas de code HTTP par tâche (pg_net ne garde ni l’URL ni la tâche ; résumé global affiché) ; « succeeded » d’une tâche pg_net veut dire « requête partie » ; `processing_error` n’est jamais écrit par le webhook aujourd’hui (seul le « non traité après 15 min » détecte une panne) ; les rappels push (Edge Function) et les crons Vercel ne sont pas relançables ; `cron.job_run_details` n’est pas purgé ; OpenAI ajouté aux intégrations (import organisateur). |
| 4 | à faire | |
| 5 | à faire | |
| 6 | à faire | |
| 7 | à faire | |

### Routes après le lot 1

| Route | Contenu (composant existant) | Ancienne URL redirigée |
|---|---|---|
| `/admin` | Vue d’ensemble (lot 2 : tableau de bord, `?periode=`) | — (`/admin?onglet=<inconnu>` → `/admin`) |
| `/admin/inbox` (`?filtre=`, `?recherche=` ; `?vue=bugs\|feedback\|demandes\|demos`) | Lot 2 : file unique `InboxQueue` + onglet « Traiter les messages » (`AdminMessagingTab` sans Questionnaires) | `/admin?onglet=messagerie[&vue=]` (→ `?vue=bugs` par défaut) |
| `/admin/analytics` | `AdminGrowthSection` | `/admin?onglet=croissance` |
| `/admin/billing` | Attente lot 4 → Organisateurs | — |
| `/admin/runners` (`?recherche=`) | `AdminUsersTab` | `/admin?onglet=utilisateurs` |
| `/admin/organizers` (`?vue=acces`) | `AdminOrganizerClaimsTab` | `/admin?onglet=organisateurs[&vue=]` |
| `/admin/organizers/social-proofs` | `AdminOrganizerSocialProofsTab` | `/admin?onglet=preuves` |
| `/admin/catalog/races` (`?course=`, `?vue=qualite`) | `AdminRaceCatalogSection` / `RaceDataGapsCard` | `/admin?onglet=courses[&course=]`, `/admin/publications?onglet=gpx` |
| `/admin/catalog/products` | `AdminProductsTab` | `/admin?onglet=produits` |
| `/admin/catalog/partners` | `AdminPartnerLinksTab` | `/admin?onglet=partenaires` |
| `/admin/content` | `PublicationsAgenda` (à surveiller + calendrier) | `/admin/publications`, `?onglet=agenda` |
| `/admin/content/studio` | `VideoGeneratorStudio` | `/admin/video-generator` |
| `/admin/content/posts` (`?onglet=carousels\|published\|templates`, `?post=`, `?element=`) | `ReelsPanel`, `CarouselsPanel`, `PublishedPanel`, `AdminSocialTemplatesSection` | `/admin/publications?onglet=reels\|carousels\|published`, `/admin?onglet=templates` |
| `/admin/content/renders` | `RendersPanel` (2 × `RenderActivityCard`, provisoire → lot 6) | — |
| `/admin/content/flyovers` | `FlyoverOrdersCard` | `/admin/publications?onglet=flyovers` |
| `/admin/messaging` | Attente lot 5 → Coureurs | — |
| `/admin/messaging/surveys` | `AdminSurveysTab` | `/admin?onglet=messagerie&vue=questionnaires` |
| `/admin/system/automation` | Lot 3 : `ScheduledTasksCard` + `ReelAutomationSettings` + `CarouselSeriesSettings` | `/admin/publications?onglet=settings` |
| `/admin/system/integrations` | `InstagramStatusCard` + lot 3 : `IntegrationCards` | — |
| `/admin/system/maintenance` | Lot 3 : `MaintenancePanel` (relance cron, synchro Resend, livrets, Betrail) | — |
| `/admin/system/audit` | Attente lot 7 | — |
| `/admin/catalog`, `/admin/system` | Redirigent vers leur première page | — |
