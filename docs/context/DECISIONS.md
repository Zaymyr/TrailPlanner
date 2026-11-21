# Décisions

> **Règle : toute décision structurante prise dans une conversation Claude doit être ajoutée ici.**

Journal en ajout seul, la plus récente en haut. Format : `## AAAA-MM-JJ — Titre`, puis Contexte / Décision / Conséquence (2 à 4 lignes chacun). Les décisions d'architecture détaillées (ADR) vont dans [docs/08-decisions/](../08-decisions/README.md).

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
