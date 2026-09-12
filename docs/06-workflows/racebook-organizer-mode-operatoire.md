---
title: Mode opératoire RaceBook organisateur
scope: workflow
last_verified: 2026-09-12
ai_priority: medium
related_files:
  - scripts/generate-racebook-organizer-manual.mjs
  - apps/web/app/organizers/page.tsx
  - apps/web/app/organizer/_components/OrganizerDashboard.tsx
  - apps/web/app/organizer/_components/dashboard/shell.tsx
  - apps/web/app/organizer/_components/dashboard/event-format-editors.tsx
  - apps/web/app/organizer/_components/dashboard/aid-stations-editor.tsx
related_tables:
  - race_events
  - race_event_editions
  - races
  - race_aid_stations
---

# Mode opératoire RaceBook organisateur

## Purpose

Ce document accompagne le PDF utilisateur [`docs/mode-operatoire-racebook-organisateur.pdf`](../mode-operatoire-racebook-organisateur.pdf). Il décrit sa portée et sa régénération lorsque l’interface organisateur évolue.

## Key Concepts

- Le guide vise une nouvelle organisation qui découvre le dashboard.
- Les captures proviennent de l’interface web réelle avec des réponses API fictives et locales. Quatre encadrés numérotés relient visuellement chaque capture aux quatre actions expliquées sous l’image.
- Aucune donnée Supabase de production n’est lue ou modifiée pendant la génération.
- Le parcours couvre la création, la navigation, les sections, les trois modules communs de l’offre Essentiel (`Matériel`, `Dossard`, `Accès`), un format/GPX, les ravitaillements et la publication.
- Le téléphone RaceBook de l’espace organisateur reflète localement les brouillons non enregistrés; il peut être contrôlé en français ou anglais sans publier ni déclencher de lien externe.

## Steps

1. Démarrer l’application web en local avec `npm run dev:web`.
2. Dans un second terminal, exécuter `node scripts/generate-racebook-organizer-manual.mjs`.
3. Le script capture l’interface à `http://127.0.0.1:3000` et génère :
   - neuf captures dans `docs/assets/racebook-organizer-manual/` ;
   - la source HTML imprimable dans ce même dossier ;
   - le PDF final dans `docs/mode-operatoire-racebook-organisateur.pdf`.
4. Pour une autre URL locale, définir `RACEBOOK_MANUAL_BASE_URL` avant l’exécution.

## Validation

- Vérifier que le PDF contient douze pages A4.
- Vérifier que les accents français sont corrects.
- Vérifier que chaque capture porte la mention ou les données de démonstration.
- Vérifier que chaque capture comporte les repères `1`, `2`, `3` et `4`, sans masquer le libellé de l’action ciblée.
- Comparer les boutons et libellés du guide aux composants listés dans `related_files`.
- Sur un navigateur sans consentement enregistré, confirmer que le guide attend la réponse cookies puis que la promotion d'installation mobile reste masquée jusqu'à sa fermeture.
- Rejouer les six étapes en 1440 × 900 et 390 × 844 : la cible et la carte doivent rester entièrement dans le viewport sans se chevaucher. L'étape éditeur cible seulement son en-tête; l'étape visibilité ouvre les contrôles puis les referme en sortie.
- Vérifier au clavier que le titre reçoit le focus à chaque étape, que Tab reste dans la carte, qu'Échap ferme le guide, que le document ne défile pas et que le focus initial est restauré.
- Confirmer que les trois états restent `Masqué`, `Privé` et `Public`.
- Avec Essentiel déjà actif, confirmer que `Publier` et le passage d'un format à `Public` publient directement, que les sections Complet/Signature restent privées et qu'aucune erreur opérationnelle ne rouvre la fenêtre d'achat.
- Dans l'app avec le compte organisateur, confirmer qu'un événement reste visible hors catalogue, qu'un format `Masqué` est légèrement grisé sans bouton RaceBook, qu'un format `Privé` garde un bouton RaceBook grisé mais fonctionnel, et qu'un format `Public` a le rendu coureur normal.
- Dans la tuile `Départ, ravitos & relais`, confirmer que l'onglet `Ravitos` est sélectionné par défaut à l'ouverture et après un changement de format.
- Dans le dashboard, modifier un texte, une couleur, un ravito et une liste structurée sans enregistrer : le téléphone doit suivre immédiatement, signaler un module `draftOnly` hors de l’écran, et ne proposer que les interactions internes (onglets/accordéons).

## Do Not

- Ne pas présenter les origines Admin et Offert comme équivalentes dans une future capture de l’administration ; Stripe et virement doivent rester adossés à un paiement réel.

- Ne pas capturer un compte ou un événement réel.
- Ne pas inclure de jeton, e-mail personnel ou URL privée dans les captures.
- Ne pas présenter `Privé` comme une publication coureur : cet état est réservé à l’aperçu organisateur.
- Ne pas affirmer qu’une section masquée est supprimée ; son contenu est conservé.
- Ne pas modifier le PDF manuellement sans répercuter le changement dans le script source.

## Related Docs

- [Organizer Race Management](../03-business-rules/organizer-race-management.md)
- [Organizer Commercial Offers](../03-business-rules/organizer-commercial-offers.md)
- [Web App](../01-architecture/web-app.md)
