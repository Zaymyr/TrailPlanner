# Décisions

> **Règle : toute décision structurante prise dans une conversation Claude doit être ajoutée ici.**

Journal en ajout seul, la plus récente en haut. Format : `## AAAA-MM-JJ — Titre`, puis Contexte / Décision / Conséquence (2 à 4 lignes chacun). Les décisions d'architecture détaillées (ADR) vont dans [docs/08-decisions/](../08-decisions/README.md).

## 2026-11-23 — Planificateur web : aperçu résultat d'abord, paywall course d'abord, landing

**Contexte.** L'audit de conversion du planificateur web : l'aperçu gratuit montrait d'abord les étapes de réglage, perdait les ravitos du catalogue et le D+ réel (valeur par défaut de 2200 m), proposait trois boutons d'enregistrement, et la modale premium vendait seulement l'abonnement avec un prix de repli faux (« 7,99 $/mois »). La démo Trail TST avait des GPX de 13 points (≈ 24 km pour la course de 42 km).

**Décision.** Le visiteur voit d'abord le résultat : frise du plan avec départ et 1er ravito déjà remplis (remplissage automatique une seule fois à l'ouverture), réglages repliés après, une seule action « Garder mon plan ». L'aperçu lit les ravitos et le D+ du catalogue. La modale premium met « Débloquer cette course » (prix course) en premier quand un plan est ouvert, l'annuel en second ; prix de repli « 9,99 € la course ou 29,99 €/an ». L'état vide devient une landing (`PlannerLanding`). GPX de démo régénérés (script) ; l'envoi en production attend le go du mainteneur.

**Conséquence.** Aucune migration ni changement de droits ; la route publique des ravitos du catalogue renvoie aussi `solid_available` et `assistance_allowed`. Les produits organisateurs restent réservés aux comptes. Les événements analytics checkout portent l'offre réellement choisie. Voir `docs/03-business-rules/runner-monetization.md` et `plan-storage.md`.

## 2026-11-23 — Fusion des deux événements Marathon du Mont-Blanc

**Contexte.** Le Marathon du Mont-Blanc existait en double en base : l’édition 2026 sous un événement (import catalogue de mars), l’édition 2027 sous un autre (import de novembre). La page événement permanente était donc coupée en deux URL suffixées.

**Décision.** Le fondateur confirme qu’il s’agit du même événement : fusion dans l’événement de l’édition 2027, sous le slug `marathon-du-mont-blanc`.

**Conséquence.** Migration `20261123200000` ; les deux anciennes URL redirigent en 301 vers `/courses/evenements/marathon-du-mont-blanc`. Les futurs doublons suivent la même procédure (voir `docs/02-database/tables/race-events.md`).

## 2026-11-23 — Aperçu gratuit du plan sur le web (invité et compte gratuit)

**Contexte.** Sur le planificateur web, un invité qui choisissait une course ne voyait rien se passer ; l’estimation finissait sur un mur de compte et le compte gratuit ne voyait qu’un aperçu figé. Rien ne donnait envie d’aller jusqu’à l’achat.

**Décision.** Parcours sans compte : course → estimation (allure ou temps sur 10 km plat) → « Voir mon plan de course », le vrai planificateur où le départ et le 1er ravito sont personnalisables, la suite floutée derrière une carte d’appel. Enregistrer demande un compte gratuit ; le compte gratuit garde la même expérience et débloque la course pour aller plus loin. Les réglages du 1er ravito restent sur l’appareil jusqu’à l’achat (aucun changement de base : le trigger `sanitize_runner_free_plan` est conservé).

**Conséquence.** La règle « aucun contrôle éditable dans l’aperçu gratuit » est remplacée sur le web par cet échantillon. L’App mobile garde son aperçu actuel. Les réglages d’un compte gratuit ne suivent pas d’un appareil à l’autre avant l’achat.

## 2026-11-23 — Site web en thème clair uniquement, bandeau app réduit

**Contexte.** L’audit des pages coureur du site a montré que le thème sombre reprenait l’ancienne palette (bleu nuit, émeraude) et ne ressemblait ni au thème clair ni à l’App ; le bandeau « télécharger l’app » recouvrait le bas des formulaires sur mobile.

**Décision.** Le site web n’a plus qu’un thème clair : plus de bascule, plus de variables `.dark`, préférence système et valeur enregistrée ignorées. Le bandeau devient une barre fine en bas d’écran (titre, bouton, croix), mêmes règles d’affichage et mêmes événements analytics.

**Conséquence.** Les ~900 classes `dark:` restantes sont inertes (`darkMode: "class"` conservé) et seront retirées page par page lors des lots d’harmonisation. Aucune nouvelle classe `dark:` ni couleur brute sur le web.

## 2026-11-23 — Journal des actions admin

**Contexte.** Aucune trace de qui avait modifié un rôle, accordé du Premium, envoyé un message, changé un pack ou publié un post ; seuls les champs `created_by` / `reviewed_by` de quelques tables gardaient un acteur, sans avant/après.

**Décision.** Table `admin_audit_log` (service role seulement, ajout seul, purge à 365 jours), alimentée en best-effort par un wrapper `withAdminAudit` que chaque route admin d’écriture exporte (une ligne par action réussie ou en échec serveur ; les refus 4xx, les aperçus, les générations IA et les lectures ne sont pas journalisés). Les valeurs avant/après sont assainies avant stockage : jamais de secret, de contenu de message, de fichier ni d’adresse e-mail complète. Lecture par `GET /api/admin/audit` et la page `/admin/system/audit` (filtres dans l’URL, fiche avec diff, export CSV) ; les actions importantes alimentent « Activité récente » de la vue d’ensemble.

**Conséquence.** Toute nouvelle route admin d’écriture doit passer par `withAdminAudit` et déclarer son action dans `AUDIT_ACTIONS` (un test l’impose). Un incident du journal ne fait jamais échouer une requête. L’état « avant » n’est enregistré que là où la route le connaît. La migration ne part qu’au merge, avec celle du lot 3.

## 2026-11-23 — Console admin : bilan des lots 0 à 7

**Contexte.** La console à barre latérale décidée le 2026-11-22 est livrée sur `dev/admin-console` (une PR) : coque et primitives, vue d’ensemble et file « À traiter », santé des systèmes, ventes et facturation, fiches coureur et organisateur, file de rendus unique, journal des actions.

**Décision.** Aucun changement de cap par rapport à l’ADR : les écarts restants (liste dans la section « Avancement » de l’ADR) sont des suites à planifier, pas des blocages. Deux migrations partent avec le merge : `20261123090000_admin_system_health.sql` (lot 3) et `20261123120000_admin_audit_log.sql` (lot 7), avec leurs scripts SQL de contrôle.

**Conséquence.** Détail et table des routes finale : [ADR console admin](../08-decisions/2026-11-22-admin-console.md).

## 2026-11-23 — Santé des systèmes : journal des e-mails, crons lus dans pg_cron

**Contexte.** Aucun écran ne disait si les tâches planifiées, les e-mails ou le webhook Stripe fonctionnaient ; aucun envoi d’e-mail ne laissait de trace.

**Décision.** La console lit `cron.job_run_details` et `net._http_response` par deux fonctions réservées au service role, et chaque e-mail transactionnel est journalisé dans `transactional_email_log` (catégorie, statut, code, destinataire masqué, jamais le contenu), en best-effort et purgé après 90 jours. Les paiements se lisent dans les journaux que le webhook écrit déjà, sans appel Stripe. Une tâche en échec ou en retard (dernier passage au-delà de 2 périodes), des e-mails ou un webhook en erreur deviennent un élément « Système » de la file « À traiter ».

**Conséquence.** pg_net ne garde ni l’URL ni la tâche d’une réponse : les erreurs HTTP sont affichées pour toutes les tâches ensemble. Les crons Vercel restent affichés « jamais appelés ». Une tâche pg_net peut être relancée depuis Maintenance (appel côté serveur avec `CRON_SECRET`).

## 2026-11-22 — Console admin à barre latérale, une URL par écran

**Contexte.** L’admin tenait en 3 pages et 16 onglets sans vue d’ensemble ni file de travail ; plusieurs onglets n’avaient pas d’URL.

**Décision.** Console à barre latérale (Pilotage, Clients, Catalogue, Contenus, Communication, Système), une route par écran sous `/admin/*`, recherche ⌘K et pastilles de mode simulation en haut ; les écrans existants sont montés sans réécriture et les anciennes URL redirigées. Livraison par lots 0 à 7 sur une seule PR.

**Conséquence.** Le header du site n’apparaît plus sur `/admin` (la console a sa propre coque) ; les primitives admin (`StatusBadge`, `Switch`, `Drawer`, `KpiTile`, `Toast`, `CommandPalette`…) sont dans `components/ui`. Détail : [ADR console admin](../08-decisions/2026-11-22-admin-console.md).
## 2026-11-22 — Pas d’offre « l’organisateur paie le plan de ses coureurs »
**Contexte.** L’audit du 2026-11-22 proposait une offre B2B2C où l’organisateur Signature offrirait le plan de course payant à ses coureurs.
**Décision.** Écartée par le fondateur. Le plan coureur reste vendu au coureur (9,99 € la course, 29,99 € par an) ; les offres organisateurs restent Essentiel / Complet / Signature.
**Conséquence.** Aucun code de déblocage organisateur ni droit coureur offert par édition. À ne pas reproposer sans nouveau contexte.
## 2026-11-22 — Pages événement permanentes, pages région et mois
**Contexte.** Chaque édition avait sa propre URL indexable (`…-2026`, puis `…-2027`) : l'autorité et les requêtes (« UTMB temps ») se dispersaient chaque année. Seules trois pages distance existaient, dont une de 1,35 Mo sans pagination.
**Décision.** Chaque événement reçoit un slug permanent sans année (`race_events.slug`, immuable, jamais égal à un slug d'édition) et une page hub `/courses/evenements/<slug-événement>`, seule page événement indexable : prochaine édition (formats, Livrets), historique des éditions. Toutes les pages d'édition restent accessibles (200) mais canonicalisent vers le hub ; aucune redirection. Le hub publie le `SportsEvent` de l'édition mise en avant, sans `EventSeries`. Pages région (codes INSEE) et mois (`/courses/mois/mai-2027`) rejoignent les pages distance : courses à venir uniquement, 5 minimum, pagination `/page/<n>`, `ItemList`.
**Conséquence.** Le sitemap liste les hubs au lieu des éditions, plus chaque page de sélection. Les URL de format gardent leur année (suite possible). Un événement ne peut pas changer de slug tant qu'aucune table de redirection d'événement n'existe. Détail : [Public Race Discovery](../03-business-rules/public-race-discovery.md#permanent-event-hubs-2026-11-22).
## 2026-11-22 — Rapport partenaires inclus dans Signature
**Contexte.** Les organisateurs Signature avaient des compteurs agrégés d'impressions et de clics par partenaire et des statistiques de lecture, mais rien à remettre à leurs sponsors après la course.
**Décision.** Signature inclut un « Rapport partenaires » téléchargeable (PDF et CSV) par édition, agrégé et anonyme : lecteurs du Livret coureur, impressions, clics et meilleurs placements. Même verrou que le module Sponsors (Signature ou cadeau `module.sponsors`) ; les lecteurs n'y figurent que si les statistiques sont incluses. Aucun nouveau prix, droit ou table.
**Conséquence.** Carte verrouillée sous l'éditeur Sponsors pour les offres inférieures (fenêtre d'offres existante) ; carte Signature de /organisateurs complétée. Détail : [Organizer Commercial Offers](../03-business-rules/organizer-commercial-offers.md#rapport-partenaires-2026-11-22).

## 2026-11-22 — Ouverture courte, tracé gris puis vert, sous-titres à 86 %

**Contexte.** Premiers retours sur l'ouverture « vue d'ensemble » : 5 s trop longues, tracé peu visible, point de progression disparu, sous-titres encore trop hauts.

**Décision.** Ouverture fixe de 3 s : la course est annoncée sur la vue d'ensemble (tracé entier en couleur opaque), puis la caméra plonge ; le tracé restant devient gris opaque et le tracé vert avance dessus. Sous-titres centrés à 86 %. La feuille CSS de Mapbox est chargée par le lecteur lui-même.

**Conséquence.** Le point de progression, les bulles de ravitos et les noms de lieux réapparaissent sur /survol et dans les rendus Cloud Run (ils sortaient du cadre faute de CSS). Détail : [ADR reels, point 20](../08-decisions/2026-11-19-reel-highlights-and-figures.md).

## 2026-11-22 — Toutes les vidéos s'ouvrent sur la vue d'ensemble du tracé

**Contexte.** En « Temps forts », la vidéo démarrait directement sur l'accroche (2,4 s sur la plus grosse montée), trop vite ; les sous-titres étaient jugés trop hauts et le tracé pixelisé ; les fonds de carte satellite de la vidéo de survol se ressemblaient trop.

**Décision.** Toute vidéo (éditeur, reels automatiques, survol) commence par une vue large de tout le tracé, au moins 5 s, puis zoome sur le départ ou le premier temps fort ; l'accroche devient une option explicite. Sous-titres centrés à 82 % de la hauteur. Tracé dessiné en 3D au-dessus du sol. Survol : quatre fonds tranchés (Pace Yourself, Satellite, Carte rando, Nocturne) et choix Temps forts / Parcours complet par l'organisateur.

**Conséquence.** Les deux lignes de sous-titres débordent un peu sous la légende Instagram et le recadrage 4:5 du fil. Détail : [ADR reels, point 20](../08-decisions/2026-11-19-reel-highlights-and-figures.md), [règles du survol](../03-business-rules/flyover-video-orders.md).

## 2026-11-22 — Vidéo de survol organisateurs, produit indépendant

**Contexte.** Les organisateurs demandent une vidéo 3D de leur parcours pour l'annoncer sur les réseaux ; le pipeline de reels automatiques (texte IA, voix, rendu Cloud Run) existe déjà côté admin.

**Décision.** Produit vendu sur `/survol`, hors catalogue et hors offres Essentiel / Complet / Signature : 29,99 € (publication sur le compte Instagram Pace Yourself en collaboration avec le compte de l'événement) ou 59,99 € (MP4 téléchargeable 30 jours), paiement Stripe, livraison sous 24 h. Il réutilise le pipeline reel (`writeReelWork`, `synthesizeReelClips`, `launchReelRender`) via une tâche pg_cron toutes les 10 minutes ; pas d'écran admin pour l'instant (suivi par requête SQL, e-mail en cas d'échec).

**Conséquence.** Nouvelle table `flyover_video_orders`, `video_render_jobs.race_id` nullable (+ `flyover_order_id`), `social_posts.collaborators`, deux Prix Stripe (`STRIPE_FLYOVER_COLLAB_PRICE_ID`, `STRIPE_FLYOVER_DOWNLOAD_PRICE_ID`) à créer, webhook routé sur `purchase_type = flyover_video`. Voir `docs/03-business-rules/flyover-video-orders.md`.

## 2026-11-22 — Démo Trail TST hors index, courses passées sans statut « programmé »

**Contexte.** L'audit catalogue du 22/11 : la démo Trail TST (cible des QR codes imprimés) apparaissait comme une vraie course (inscription vers un site factice, sitemap, suggestions), les formats passés publiaient `EventScheduled`, et la démo aurait été bloquée au 31/12 (l'année d'édition doit suivre la date de début).

**Décision.** La démo reste publique mais est marquée « Course de démonstration », sans lien d'inscription ni lien officiel ni `SportsEvent`, en `noindex,follow` et hors sitemap et suggestions ; elle est identifiée par son id fixe (`isDemoRaceEventId`), sans drapeau en base. Le rafraîchissement quotidien garde l'horizon « aujourd'hui » et met aussi à jour `edition_year`. Une course ou édition passée garde son `SportsEvent` factuel mais sans `eventStatus` ni `Offer` (schema.org n'a pas de statut « terminé »).

**Conséquence.** Aucune migration : l'audit des dates `races.race_date` en 2025 portait sur l'ancienne édition 2025 de la démo, pas sur l'édition courante. Les suggestions « distance similaire » n'affichent que des formats à venir ou non datés. Détail : [Public Race Discovery](../03-business-rules/public-race-discovery.md#trail-tst-demo-and-catalogue-data-quality-2026-11-22).

## 2026-11-22 — Nouvelle grille tarifaire

**Contexte.** La grille organisateurs 99 / 199 / 349 € HT sous-valorisait le livret coureur, et l'offre coureur était décrite de façon incohérente (achat unique seul, abonnement annuel).

**Décision.** Organisateurs : Essentiel 199 €, Complet 349 €, Signature 499 € HT par édition ; les montées en gamme facturent la différence (150 / 300 / 150 €). Coureurs : 9,99 € la course ou 29,99 € par an.

**Conséquence.** `ORGANIZER_TIER_PRICE_EUR` reste l'unique source des montants organisateurs (checkout, factures virement, dashboard, page /organisateurs). Six nouveaux Prix Stripe organisateurs et les variables Vercel associées doivent être en place au moment du merge ; les paiements et factures déjà émis gardent leur montant.

## 2026-11-21 — Tâches planifiées web via pg_cron, pas Vercel Cron

**Contexte.** Les crons déclarés dans `vercel.json` ne reçoivent aucun appel de Vercel en production (17–21/11) ; la démo Trail TST est restée figée au 18/11 alors que toutes les tâches pg_cron tournent.

**Décision.** `demo-race-refresh` passe sur pg_cron + pg_net (toutes les heures à :05, idempotent) et sort de `vercel.json`. Les nouvelles tâches planifiées web utilisent pg_cron.

**Conséquence.** La démo se recale dans la première heure de chaque jour. RevenueCat et Trace de Trail restent dans `vercel.json`, non exécutés tant que leur migration pg_cron n’est pas décidée.

## 2026-11-21 — Reels sans ravitos obligatoires

**Contexte.** Le choix des courses à mettre en reel exigeait au moins un ravito, ce qui bloquait les formats dont l'organisateur n'a pas encore saisi ses ravitos.

**Décision.** Un reel (automatique ou en un clic) demande seulement un format en ligne, solo, avec GPX, de 30 km ou plus et à venir. Les ravitos restent affichés quand ils existent.

**Conséquence.** Plus de formats éligibles aux reels ; l'onglet « GPX à traiter » ne signale plus les ravitos manquants pour un reel, seulement pour le carrousel « Le brief ». Détail : [ADR reels, point 19](../08-decisions/2026-11-19-reel-highlights-and-figures.md).

## 2026-11-20 — Centraliser le contexte IA dans docs/context/

**Contexte.** Le contexte projet était dispersé entre le repo, le projet claude.ai, les tâches planifiées et un Space ChatGPT de suivi.

**Décision.** `docs/context/` devient la source unique de contexte lue par toutes les surfaces IA. Le suivi des tâches vit dans la Claude Sheet « Pace Yourself — Suivi de projet ». Le suivi dans le Space ChatGPT est abandonné.

**Conséquence.** Chaque tâche commence par la lecture de `docs/context/README.md`. Aucun suivi de tâches dans le repo.

## 2026-11 — Arrêt de la prospection e-mail de masse

**Contexte.** Une campagne de prospection organisateurs tournait via un job Apps Script.

**Décision.** Le job de campagne Apps Script est désinstallé. Les relances se font au cas par cas, via une tâche planifiée qui crée uniquement des brouillons Gmail.

**Conséquence.** Aucun e-mail n'est envoyé automatiquement ; chaque relance est relue et envoyée à la main. Voir [OPS.md](OPS.md).

## 2026-09 — Grille tarifaire organisateurs et pilotes gratuits

**Contexte.** Besoin d'une offre B2B lisible pour le livret coureur.

**Décision.** Trois niveaux par édition : Essentiel 99 € HT / Complet 199 € / Signature 350 €, négociables. Pilotes gratuits pour obtenir des références.

**Conséquence.** Les droits sont portés par édition (`organizer_edition_entitlements`, tiers `essential` / `complete` / `signature`). Voir [DATA-MODEL.md](DATA-MODEL.md).

## TODO (date) — Monétisation coureurs : achat unique par nouveau plan

**Contexte.** Monétiser les coureurs sans pénaliser les utilisateurs existants.

**Décision.** Achat unique (~9,99 €) pour chaque nouveau plan ; les plans existants restent gratuits.

**Conséquence.** Déverrouillage par format/édition (`runner_plan_unlocks`) et grand-fathering des plans existants (`runner_launch_grandfathered_plans`). Migrations du 2026-10-30 au 2026-11-02.

## TODO (date) — Poudres de nutrition calculées au poids

**Contexte.** Les poudres sont dosées par portion fixe, ce qui empêche de sur- ou sous-doser.

**Décision.** Les poudres doivent être calculées au poids pour permettre le sur/sous-dosage.

**Conséquence.** Pas encore implémenté. Voir [docs/03-business-rules/nutrition-algorithm.md](../03-business-rules/nutrition-algorithm.md).
