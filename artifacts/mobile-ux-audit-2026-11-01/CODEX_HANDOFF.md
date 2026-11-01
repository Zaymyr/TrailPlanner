# Audit UX/UI mobile — consignes d'implémentation

> Audit réalisé le 2026-11-01 sur l'app de développement (`com.paceyourself.app.dev`, v1.1.1), Pixel 10, Android 16, densité 356, police 100 % (+ un contrôle à 130 %).
> Revérifié le même jour sur la dernière OTA de la branche EAS `development` (groupe `15283094-cafc-46a4-b90e-949502c8dabc`, commit `193a6beb`, branche Git `dev/launch-popup-footer`). Tous les constats ci-dessous sont présents dans cette version.
> ⚠️ Cette version contient 14 commits absents de `origin/main` (achat de course, premium annuel, aperçu des plans, annonce de lancement), dont des changements dans `apps/mobile/hooks/useProfileScreen.ts`, `apps/mobile/app/(app)/profile.tsx` et la facturation. Les corrections doivent partir de cette base, pas de `origin/main` seul.
> Périmètre : les 4 onglets racine (Courses, Plans, Nutrition, Profil). Hors périmètre : éditeur/Récap de plan, Livret coureur, onboarding, iOS.
> Sources : **Vu** = observé sur l'appareil ; **Code** = confirmé dans le code ; **Hypothèse** = risque à vérifier.

## Règles à respecter avant tout

1. Lire `AGENTS.md` puis `docs/AGENTS.md`. Après le contrôle `git status`, créer la branche de travail sur une base qui contient `193a6beb` (voir l'avertissement en tête). La base exacte est fixée par le mainteneur.
2. Beaucoup de fichiers touchés ci-dessous sont dans les `related_files` de `docs/01-architecture/mobile-app.md` et `docs/06-workflows/mobile-ux-audit.md` : mettre ces docs à jour dans le même commit (protocole de maintenance documentaire), puis `npm run docs:check`.
3. Réutiliser les composants et tokens existants (`packages/design-system`, `apps/mobile/components`). Aucun nouveau composant global sans besoin sur plusieurs écrans.
4. Tout texte visible passe par `apps/mobile/locales/fr.ts`, `en.ts` et `types.ts`.
5. Conserver les `testID` existants (le flow Maestro `apps/mobile/.maestro/flows/authenticated-shell.yaml` en dépend) et les événements analytics existants.
6. Les deux lots sont validés par le mainteneur. Les choix du Lot 2 sont tranchés : ne pas proposer d'alternative.
7. Vérification : `npm run test -w @trailplanner/mobile`, `npm run typecheck -w @trailplanner/mobile`, `npm run lint -w @trailplanner/mobile`, puis `npm run verify` avant la remise.
8. Commits conseillés : un commit par tâche ou groupe cohérent (T1-T6, puis D1, D2, D3, D4, D5), chacun avec ses docs.

---

## Lot 1 — Corrections rapides

### T1. Trier les plans par date de départ — Haute
- **Constat (Vu + Code)** : les sections sont triées par nom d'événement (`localeCompare`) dans `apps/mobile/hooks/usePlansScreen.ts` (~l. 213). « GRAND RAID RÉUNION 2026 — Départ passé » apparaît en tête, devant des courses dans 12 jours.
- **Attendu** :
  - Sections triées par le prochain départ à venir parmi leurs plans (le plus proche en premier).
  - Les sections dont tous les plans sont passés vont dans un groupe final « Courses passées » / « Past races », replié par défaut.
  - Dans une section, plans triés par départ croissant.
  - Les plans sans date de départ restent après les plans datés à venir, avant les passés.
  - La section orpheline (`__orphan__`) garde sa place en fin de liste.
- **Indice** : la date de départ est déjà utilisée par `formatDepartureCountdown` dans `apps/mobile/components/plans/PlansList.tsx` (voir aussi `apps/mobile/lib/planDeparture.ts`).
- **Tests** : extraire le tri dans une fonction pure et la couvrir en Vitest (à venir / passé / sans date / orphelin).

### T2. Compte à rebours lisible — Moyenne
- **Constat (Vu + Code)** : `formatDepartureCountdown` (`PlansList.tsx` ~l. 343) affiche `12J 21H 04Min 44S`, rafraîchi chaque seconde (`setInterval` 1 s, ~l. 118). Tronqué sur certaines cartes (`329J 20H 04Min 4…`). Unités hétérogènes.
- **Attendu** :
  - ≥ 2 jours : « dans 12 j » / « in 12 d ».
  - < 48 h : « dans 21 h 04 min ».
  - < 1 h : minutes et secondes autorisées.
  - Passé : inchangé (« Départ passé »).
  - Intervalle de rafraîchissement adapté (60 s par défaut, 1 s seulement sous 1 h).
- **Hypothèse** : le rafraîchissement chaque seconde a empêché `uiautomator dump` de stabiliser l'écran ; il peut aussi gêner TalkBack. Vérifier après correction.

### T3. Menu flottant « … » : bouton retour et recouvrement — Moyenne
- **Constat (Vu, reproduit 2 fois)** : sur Nutrition, menu ouvert puis bouton retour Android → l'app change d'onglet (`backBehavior="history"` dans `apps/mobile/app/(app)/_layout.tsx`) au lieu de fermer le menu. Le bouton fermé recouvre la fin des lignes de la liste (« 1 produi », chevrons).
- **Attendu** :
  - Dans `apps/mobile/components/navigation/FloatingActionMenu.tsx`, quand le menu est ouvert, `BackHandler` le ferme et consomme l'événement.
  - Ce composant reste utilisé ailleurs (au moins `apps/mobile/components/PlanForm.tsx`), donc cette correction s'applique même si D2 le retire des onglets racine.
  - Le problème de recouvrement sur Nutrition et Profil est réglé par D2 (plus de bouton flottant sur les onglets racine).

### T4. Réglages : liens légaux en double et raison technique — Moyenne
- **Constat (Vu)** : « Politique de confidentialité » et « Conditions d'utilisation (EULA) » apparaissent dans la carte Abonnement (`apps/mobile/components/profile/ProfilePremiumSection.tsx`) **et** dans la carte Langue (`apps/mobile/components/profile/ProfileLanguageSection.tsx`).
- **Attendu** : garder les liens dans la carte Abonnement (les stores exigent ces liens à proximité de l'abonnement) et les retirer de la carte Langue.
- **Constat (Code)** : `apps/mobile/hooks/useProfileScreen.ts` (~l. 1057) affiche la valeur brute de `premiumGrant.reason` (ex. `Raison : trial_extension`) à tout utilisateur ayant un Premium offert.
- **Attendu** : mapper les raisons connues vers des libellés traduits (ex. `trial_extension` → « Prolongation de ton essai »), sinon utiliser `adminGrantReasonFallback`. Ne jamais afficher la clé brute. Rechercher les valeurs possibles de `reason` dans `supabase/migrations` et `apps/web` ; ne pas en inventer.

### T5. Libellés de la barre d'onglets tronqués en grande police — Haute
- **Constat (Vu, police 130 %)** : « Pla.. », « Nutrit… », « Pr… » alors que chaque onglet dispose d'un quart de la largeur.
- **Attendu** : dans `apps/mobile/app/(app)/_layout.tsx`, le libellé utilise toute la largeur de l'onglet ; aucun libellé n'est tronqué à 130 %. Si nécessaire, limiter l'agrandissement du libellé de la barre (`maxFontSizeMultiplier` autour de 1.3) plutôt que tronquer. Vérifier à 100 %, 130 % et 200 %.

### T6. Finitions d'affichage — Basse
- Distances de la liste des plans : format localisé avec une décimale maximum (`180,7 km` en français), via `Intl.NumberFormat` ou un utilitaire existant s'il y en a un (`PlansList.tsx`).
- Profil > Performance : le libellé « Secondes » (`comfortableFlatPaceSecondsLabel`) se coupe en « SECONDE / S », et la pastille `min/km` dépasse du bord de la carte. Le libellé doit tenir sur une ligne et la pastille rester dans le padding de la carte (`apps/mobile/app/(app)/profile.tsx` ou le composant de section concerné).

---

## Lot 2 — Évolutions validées (choix tranchés par le mainteneur)

### D1. Un seul bouton d'enregistrement dans Profil — Moyenne
- **Constat (Vu)** : icône disquette dans l'en-tête (`apps/mobile/app/(app)/profile.tsx` ~l. 487) **et** bouton « Enregistrer » en bas (~l. 473). Ce bouton est aussi visible dans l'onglet Réglages, où rien n'est modifiable, et son état désactivé est peu lisible.
- **Choix retenu** : un seul bouton « Enregistrer ».
- **Attendu** :
  - Supprimer l'action disquette de l'en-tête de Profil.
  - Le bouton est fixe en bas de l'écran, au-dessus de la barre d'onglets et de la zone de sécurité.
  - Il apparaît seulement quand le formulaire a été modifié (Infos perso ou Performance). Il est absent de l'onglet Réglages.
  - Il reste en place quand le clavier est ouvert (vérifier `NumericKeyboardAccessory` sur iOS).
  - Les erreurs de validation existantes (âge, poids, taille dans `apps/mobile/hooks/useProfileScreen.ts`) s'affichent près du champ concerné.
  - Après l'enregistrement : confirmation courte, puis le bouton disparaît.
  - Si l'utilisateur change de sous-onglet ou d'onglet avec des modifications non enregistrées, elles sont conservées (pas de perte silencieuse).

### D2. Bouton « ? » dans l'en-tête des 4 onglets — Moyenne
- **Constat (Vu)** : le bouton d'en-tête change de rôle selon l'onglet :
  - Courses : demander une course ✈.
  - Plans : entraînement 🚶, qui fait doublon avec la carte « Démarrer un entraînement » juste en dessous.
  - Nutrition : ajouter +.
  - Profil : enregistrer 💾.
- Aide et Bug sont dans un menu flottant « … » sur Nutrition et Profil seulement, qui recouvre le contenu.
- **Choix retenu** : une icône « ? » dans l'en-tête, identique sur les 4 onglets racine, qui ouvre le menu Aide / Signaler un bug / Demander une course.
- **Attendu** :
  - `apps/mobile/components/navigation/RootCollapsibleHeader.tsx` accepte une action d'aide à gauche, à la place de l'icône décorative actuelle (`iconSurface`). Elle reste visible et touchable en mode déplié **et** en mode compact.
  - Cible tactile d'au moins 44 points, `accessibilityLabel` traduit, `testID` stable (ex. `root-help-menu`).
  - Le menu réutilise les entrées et les gestionnaires de `apps/mobile/components/navigation/RootScreenActionMenu.tsx` : aide contextuelle, `FeedbackHeaderButton`, `RaceRequestHeaderButton`. Les trois entrées sont présentes sur les 4 onglets. Garder le `contextLabel` propre à chaque écran pour le feedback.
  - Le menu se ferme avec le bouton retour Android, par un toucher à l'extérieur et après le choix d'une entrée.
  - Supprimer le bouton flottant « … » de Nutrition et Profil.
  - L'action de droite de l'en-tête ne garde que l'action principale de l'écran :
    - Courses : aucune (Demander une course passe dans le menu « ? »).
    - Plans : aucune (supprimer le doublon entraînement ; la carte « Démarrer un entraînement » reste).
    - Nutrition : + (inchangé).
    - Profil : aucune (voir D1).
  - Conserver les événements analytics existants de l'aide, du feedback et de la demande de course.
  - En mode onboarding de Courses (`onboardingMode`), l'en-tête reste tel quel, sans « ? ». Ne l'ajouter que si cela ne gêne pas le parcours guidé, après vérification.
  - Mettre à jour le flow Maestro si un `testID` d'en-tête disparaît (`catalog-request-race`).

### D3. Catalogue Nutrition — Moyenne
- **Constat (Vu)** :
  - Le sur-titre « MARQUE » est répété sur chaque carte.
  - Des aliments génériques sont rangés comme des marques : Amandes, Banane Séchée, Saucisson, Bonbon, Barres, et « Gresssin -25gr » (faute de frappe).
  - Les noms en vert signalent un produit vérifié (`brandTitleOfficial` dans `apps/mobile/components/nutrition/NutritionContent.tsx`), sans légende.
  - Les puces de type filtrent, mais la liste reste groupée par marque en accordéons.
- **Attendu** :
  - Supprimer le sur-titre « MARQUE ».
  - Remplacer la couleur seule par un badge textuel « Vérifié » / « Verified » sur les marques qui ont un produit vérifié (`isVerifiedProduct`).
  - Quand une puce de type autre que « Tous » est active, ou quand la recherche contient du texte, afficher une liste plate de produits (nom du produit et marque en sous-titre) au lieu des accordéons par marque.
  - « Tous » sans recherche garde le regroupement par marque.
- **Hors code** : le nettoyage des données (marques génériques, faute de frappe) relève de la base et de l'admin. Ne pas coder de contournement.

### D4. Courses : recherche toujours visible et sélecteur de date natif — Moyenne
- **Constat (Vu)** :
  - La recherche et les filtres défilent avec la liste (`apps/mobile/app/(app)/catalog.tsx`).
  - Les dates se saisissent en texte « JJ/MM/AAAA » dans trois écrans : filtres, demande de course, date de naissance.
- **Choix retenu** : sélecteur de date natif.
- **Attendu, recherche** : la barre de recherche et la rangée de puces restent visibles sous l'en-tête compact quand la liste défile.
- **Attendu, dates** :
  - Ajouter `@react-native-community/datetimepicker` avec `npx expo install` (version compatible avec Expo SDK 54). Aucun sélecteur n'est installé aujourd'hui.
  - L'utiliser pour :
    - « Date min » et « Date max » des filtres ;
    - « Quand ? » dans la demande de course ;
    - « Date de naissance » dans Profil.
  - Le champ affiche la date au format local et ouvre le sélecteur au toucher. Pas de clavier.
  - Les dates des filtres et de la demande de course doivent pouvoir être effacées.
  - Bornes : date de naissance ≤ aujourd'hui ; date max des filtres ≥ date min.
  - Le format stocké et envoyé à Supabase et à l'API ne change pas.
  - Retirer le texte « Formats acceptés : JJ/MM/AAAA ou AAAA-MM-JJ », devenu inutile.
  - Accessibilité : chaque champ annonce son libellé et sa valeur.
- **Conséquence native** : c'est un module natif. Le documenter dans `docs/01-architecture/mobile-app.md` (section Framework Setup). Préciser dans la remise qu'il faut :
  - un nouveau build `development` pour tester ;
  - un nouveau build store pour que les utilisateurs l'aient (pas de livraison OTA possible).
  - Si une mise à jour OTA part avant ce build, le code doit éviter le crash quand le module natif est absent, ou cette partie doit attendre le build. Signaler le choix fait.

### D5. Fiche des formats d'une course — Moyenne
- **Constat (Vu + Code)** : dans la fiche (`catalog.tsx` ~l. 1224-1281, `apps/mobile/components/race/RaceEventSummaryCard.tsx`), « Livret coureur » et « Créer un plan » sont à droite du nom et prennent environ 60 % de la largeur. Les noms passent sur deux lignes (« La Balade de / Dumnorix »).
- **Attendu** :
  - Mêmes actions et mêmes conditions d'affichage (`canShowRacebook`, dénivelé connu), mêmes analytics, même parcours d'onboarding.
  - Disposition : nom du format sur toute la largeur, puis distance et D+, puis une rangée avec les deux boutons côte à côte, « Livret coureur » à gauche (secondaire) et « Créer un plan » à droite (principal).
  - Si un seul bouton est disponible, il prend toute la largeur.
  - Ne pas rendre la ligne entière cliquable : le Livret coureur serait caché.

## Hors code / à ignorer
- Bandeau `[RevenueCat] Error fetching offerings`, LogBox « linking configured in multiple places », section « Push details » : environnement de dev ou réservé aux admins, non retenus dans l'audit.
- Données catalogue : « morvan » en minuscules, noms de course en majuscules — à corriger dans les données, pas dans le code.
- Cartes de course sans photo : l'espace vide de la vignette est un point de finition à arbitrer plus tard.

## Validation sur appareil après corrections
Relancer `npm run test:e2e:ux -w @trailplanner/mobile` avec `APP_ID=com.paceyourself.app.dev`, `CLEAR_STATE=false`, `SKIP_DEEP_LINK=true` (voir `docs/06-workflows/mobile-ux-audit.md`). Puis vérifier manuellement :
- l'ordre des plans ;
- le compte à rebours ;
- le bouton retour avec un menu ouvert (« ? » sur les onglets, « … » dans le formulaire de plan) ;
- les liens légaux en un seul exemplaire ;
- la barre d'onglets à 130 % ;
- le bouton « ? » sur les 4 onglets, en-tête déplié et compact, avec les trois entrées ;
- Profil : bouton Enregistrer visible seulement après une modification, absent de Réglages, clavier ouvert ;
- Nutrition : liste plate avec une puce de type ou une recherche, badge « Vérifié » ;
- Courses : recherche visible pendant le défilement, fiche des formats avec les noms sur une ligne ;
- sélecteurs de date dans les filtres, la demande de course et la date de naissance (nécessite le nouveau build `development`).

La remise de Codex doit lister :
- ce qui est livrable en OTA ;
- ce qui attend un build natif (D4).
