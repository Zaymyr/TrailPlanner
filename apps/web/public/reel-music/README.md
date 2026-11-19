# Musique des reels

Ce dossier contient les pistes que le générateur de reels (`/admin/video-generator`) peut mixer sous la voix. Il est vide par défaut : sans piste, l'export se comporte comme avant (voix seule, mixage normalisé à -14 LUFS).

## Licence (obligatoire)

Chaque piste doit être **libre de droits pour un usage commercial sur les réseaux sociaux**, sans obligation de reversement : par exemple Pixabay Music (licence Pixabay) ou une œuvre CC0. Exclure toute licence « non commercial » (CC BY-NC) et toute piste pouvant déclencher un Content ID sur Instagram. Garder la preuve de la licence (URL de la page de la piste) dans le champ `source`.

## Ajouter une piste

1. Déposer le fichier (`.mp3`, `.m4a`, `.ogg` ou `.wav`, idéalement 1 à 3 minutes, boucle propre) dans ce dossier.
2. L'ajouter à `manifest.json` :

```json
{
  "tracks": [
    {
      "id": "montee-calme",
      "file": "montee-calme.mp3",
      "mood": "calme",
      "title": "Montée calme",
      "license": "Pixabay Content License",
      "source": "https://pixabay.com/music/..."
    }
  ]
}
```

- `id` : minuscules, chiffres et tirets, stable (il est enregistré dans les réglages des reels).
- `license` est obligatoire ; une entrée invalide fait ignorer tout le manifeste (pas de musique, pas d'erreur).

3. Le sélecteur « Musique » du panneau de composition liste la piste. « Auto » en choisit une de façon déterministe à partir de l'identifiant de la course.

La piste est bouclée ou coupée à la durée de la vidéo, mixée à -24 LUFS sous la voix (-16 LUFS), baissée de 10 dB quand la voix parle, avec un fondu d'entrée de 0,5 s et de sortie de 1,5 s. Le fichier est servi depuis `/reel-music/<fichier>` : le rendu en arrière-plan (Cloud Run) le charge sur la même origine que l'aperçu.
