---
title: Mode opératoire Livret coureur organisateur
scope: workflow
last_verified: 2026-11-09
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
  - race_supporter_points
---

# Mode opératoire Livret coureur organisateur

Dans l'écran des points de course, l'édition et la sauvegarde automatique restent suspendues jusqu'au chargement complet des ravitos, relais et points de suivi du format actif. Une sauvegarde du même format ne vide plus brièvement l'écran et ne peut plus envoyer une collection vide transitoire.

Les modifications sont enregistrées automatiquement après une courte pause de saisie. L'état de sauvegarde reste visible et propose **Réessayer** en cas d'échec ; il n'y a plus de bouton général **Sauvegarder**. Un nouveau format reprend uniquement la date, le lieu et éventuellement le site de l'événement, avec des métriques vides. Son site officiel reste facultatif.

Les formulaires affichent d'abord l'essentiel. Utilise les boutons **+ Ajouter…** pour ouvrir les informations facultatives sans effacer leur contenu en les retirant. Dans **Matériel** et **Dossard**, tout contenu saisi reste visible et modifiable sur place : les groupes, lieux, dates et horaires se lisent sans ouvrir **Détails**. Les ravitos gardent leurs informations clés visibles et réservent **Détails** au sous-formulaire long. Pour un format, le contenu commun apparaît en résumé ; choisis **Personnaliser pour ce format** seulement lorsqu'une différence est nécessaire.

> Terminologie : les textes français destinés aux utilisateurs emploient **Livret coureur** et les textes anglais **Race Book**. Les identifiants techniques stables — routes, événements analytics, objets de base de données et valeurs historiques — conservent `racebook`.

## Purpose

Ce document accompagne le PDF utilisateur [`docs/mode-operatoire-racebook-organisateur.pdf`](../mode-operatoire-racebook-organisateur.pdf). Il décrit sa portée et sa régénération lorsque l’interface organisateur évolue.

## Key Concepts

- Le guide vise une nouvelle organisation qui découvre le dashboard.
- Les captures proviennent de l’interface web réelle avec des réponses API fictives et locales. Quatre encadrés numérotés relient visuellement chaque capture aux quatre actions expliquées sous l’image.
- Aucune donnée Supabase de production n’est lue ou modifiée pendant la génération.
- Le parcours couvre la création, la navigation, les sections, les trois modules communs de l’offre Essentiel (`Matériel`, `Dossard`, `Accès`), un format/GPX, les ravitaillements et la publication.
- L’entrée publique est intitulée `Espace organisateur`; la page de création distingue `Créer mon événement` de l’ajout ultérieur de formats.

## Steps

1. Démarrer l’application web en local avec `npm run dev:web`.
2. Dans un second terminal, exécuter `node scripts/generate-racebook-organizer-manual.mjs`.
3. Le script capture l’interface à `http://127.0.0.1:3000` et génère :
   - neuf captures dans `docs/assets/racebook-organizer-manual/` ;
   - la source HTML imprimable dans ce même dossier ;
   - le PDF final dans `docs/mode-operatoire-racebook-organisateur.pdf`.
4. Pour une autre URL locale, définir `RACEBOOK_MANUAL_BASE_URL` avant l’exécution.

## Validation

- Dans **Gérer la visibilité**, vérifier que chaque format affiche `Informations à jour` en vert ou `Publier les modifications` lorsqu'un brouillon diffère de la version en ligne.
- Ouvrir `Publier les modifications` et contrôler que la confirmation liste les champs et sections modifiés avant de proposer `Annuler` ou `Publier`.
- Utiliser le menu `…` placé après les contrôles de visibilité pour consulter l'historique des dix versions et restaurer une ancienne publication sans changer d'onglet.
- Utiliser `Publier tous les formats modifiés` pour une transaction d’édition.
- Une restauration crée une nouvelle version et conserve le brouillon actuel ; aucune prévisualisation globale du brouillon n’est ajoutée.

- Vérifier que le PDF contient douze pages A4.
- Vérifier que les accents français sont corrects.
- Vérifier que chaque capture porte la mention ou les données de démonstration.
- Vérifier que chaque capture comporte les repères `1`, `2`, `3` et `4`, sans masquer le libellé de l’action ciblée.
- Comparer les boutons et libellés du guide aux composants listés dans `related_files`.
- Vérifier que la première étape emploie toujours le vocabulaire `événement`, puis `format`, et non la création de course personnelle du planificateur coureur.
- Sur un navigateur sans consentement enregistré, confirmer que le guide attend la réponse cookies puis que la promotion d'installation mobile reste masquée jusqu'à sa fermeture.
- Rejouer les six étapes en 1440 × 900 et 390 × 844 : la cible et la carte doivent rester entièrement dans le viewport sans se chevaucher. L'étape éditeur cible seulement son en-tête; l'étape visibilité ouvre les contrôles puis les referme en sortie.
- Vérifier au clavier que le titre reçoit le focus à chaque étape, que Tab reste dans la carte, qu'Échap ferme le guide, que le document ne défile pas et que le focus initial est restauré.
- Confirmer que les trois états restent `Masqué`, `Privé` et `Public`.
- Depuis `Actions > Créer une nouvelle édition`, lancer une duplication et confirmer que la fenêtre reste ouverte avec `Duplication de l’édition en cours…`, un indicateur animé et le formulaire désactivé jusqu’à la fin de la création.
- Avec Essentiel déjà actif, confirmer que `Publier` et le passage d'un format à `Public` publient directement, que les sections Complet/Signature restent privées et qu'aucune erreur opérationnelle ne rouvre la fenêtre d'achat.
- Dans l'app avec le compte organisateur, confirmer qu'un événement reste visible hors catalogue, qu'un format `Masqué` est légèrement grisé sans bouton Livret coureur, qu'un format `Privé` garde un bouton Livret coureur grisé mais fonctionnel, et qu'un format `Public` a le rendu coureur normal.
- Dans `Formats & GPX`, confirmer que les interrupteurs `Afficher le parcours` et `Afficher le profil altimétrique` peuvent être combinés librement et que le Livret coureur masque uniquement les visuels désactivés sans retirer le GPX source.
- Avec un GPX source existant, cliquer sur `Supprimer le GPX`, annuler une première fois pour vérifier la confirmation, puis confirmer. Vérifier que la carte et le profil disparaissent du dashboard et du Livret coureur, tandis que distance, D+/D- et ravitaillements restent présents.


- Dans la tuile `Départ, ravitos, suivi coureur & relais`, confirmer que l'onglet `Ravitos` est sélectionné par défaut à l'ouverture et après un changement de format. Dans `Suivi coureur`, créer un brouillon incomplet et vérifier son avertissement, puis soit sélectionner un ravito existant, soit garder `Créer un nouveau point` et saisir son nom/kilomètre. Cocher `Accès supporters au même endroit que le point de course` pour reprendre automatiquement la coordonnée du GPX à ce kilomètre; sans GPX exploitable, l'avertissement doit rester visible. Pour un parking ou accès différent, décocher l'option et choisir une adresse géocodée. Ajouter au moins une permission pour rendre le point publiable. Vérifier aussi que le départ commun utilise un sélecteur horaire, que `9h`/`10h15`/`11:10:00` sont présentés en `HH:mm`, et qu'une ancienne valeur contenant plusieurs horaires reste visible avec l'instruction de créer des SAS au lieu d'être écrasée.

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

## Avant de publier (2026-11-09)

La fenêtre de publication liste désormais les points bloquants (ravito encore nommé « Nouveau ravito », ravito à 0 km) à corriger avant de pouvoir publier, les points à vérifier (même lieu à deux kilomètres différents entre ravitos et suivi coureur, date du format hors de l’édition, noms commençant par une minuscule) et les emplacements partenaires qui afficheront encore les liens Decathlon / Booking proposés par Pace Yourself. Avec l’offre Signature, la section Sponsors permet de les remplacer par ses partenaires ou de les masquer.
