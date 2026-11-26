import type { CourseTerrainClass } from "@trailplanner/shared";

export type CourseTerrainLocale = "fr" | "en";

export type CourseTerrainCopy = {
  title: string;
  pending: string;
  bandLabel: string;
  organizerCorrected: string;
  offPathHint: string;
  surface: string;
  kmUnit: string;
  classLabel: Record<CourseTerrainClass, string>;
  /** Common OSM `surface` values; any other raw value is hidden from tooltips. */
  surfaceLabel: Record<string, string>;
};

// Local copy (fr/en), same pattern as course-weather: the block is mounted from two screens.
export const courseTerrainCopy: Record<CourseTerrainLocale, CourseTerrainCopy> = {
  fr: {
    title: "Nature du terrain",
    pending: "Analyse du terrain en cours",
    bandLabel: "Nature du terrain le long du parcours",
    organizerCorrected: "Corrigé par l'organisateur",
    offPathHint: "Aucun chemin cartographié à proximité du tracé (plage, champs, hors-sentier).",
    surface: "surface",
    kmUnit: "km",
    classLabel: { road: "Route", track: "Piste", trail: "Sentier", technical: "Technique", off_path: "Hors chemin" },
    surfaceLabel: {
      asphalt: "asphalte",
      paved: "revêtu",
      concrete: "béton",
      paving_stones: "pavés",
      sett: "pavés",
      cobblestone: "pavés",
      unpaved: "non revêtu",
      compacted: "compacté",
      gravel: "gravier",
      fine_gravel: "gravier fin",
      dirt: "terre",
      ground: "terre",
      earth: "terre",
      mud: "boue",
      grass: "herbe",
      sand: "sable",
      rock: "roche",
      stone: "pierre",
      scree: "éboulis",
      pebblestone: "galets",
      wood: "bois",
    },
  },
  en: {
    title: "Terrain",
    pending: "Terrain analysis in progress",
    bandLabel: "Terrain along the course",
    organizerCorrected: "Corrected by the organizer",
    offPathHint: "No mapped path near the track (beach, fields, cross-country).",
    surface: "surface",
    kmUnit: "km",
    classLabel: { road: "Road", track: "Track", trail: "Trail", technical: "Technical", off_path: "Off path" },
    surfaceLabel: {
      asphalt: "asphalt",
      paved: "paved",
      concrete: "concrete",
      paving_stones: "paving stones",
      sett: "setts",
      cobblestone: "cobblestone",
      unpaved: "unpaved",
      compacted: "compacted",
      gravel: "gravel",
      fine_gravel: "fine gravel",
      dirt: "dirt",
      ground: "ground",
      earth: "earth",
      mud: "mud",
      grass: "grass",
      sand: "sand",
      rock: "rock",
      stone: "stone",
      scree: "scree",
      pebblestone: "pebbles",
      wood: "wood",
    },
  },
};
