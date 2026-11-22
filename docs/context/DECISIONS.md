# Décisions

> **Règle : toute décision structurante prise dans une conversation Claude doit être ajoutée ici.**

Journal en ajout seul, la plus récente en haut. Format : `## AAAA-MM-JJ — Titre`, puis Contexte / Décision / Conséquence (2 à 4 lignes chacun). Les décisions d'architecture détaillées (ADR) vont dans [docs/08-decisions/](../08-decisions/README.md).

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
