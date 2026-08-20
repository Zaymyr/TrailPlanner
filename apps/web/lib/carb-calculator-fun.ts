export const CARB_COMPARISONS = [
  {
    id: "kilian-utmb-2022",
    athlete: "Kilian Jornet",
    race: "UTMB Mont-Blanc",
    year: 2022,
    finishTime: "19 h 49 min 30 s",
    finishSeconds: 19 * 3600 + 49 * 60 + 30,
    distanceKm: 170.3,
    elevationGainM: 10050,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.utmb-montblancutmb-.2022",
  },
  {
    id: "mathieu-utmb-2022",
    athlete: "Mathieu Blanchard",
    race: "UTMB Mont-Blanc",
    year: 2022,
    finishTime: "19 h 54 min 50 s",
    finishSeconds: 19 * 3600 + 54 * 60 + 50,
    distanceKm: 170.3,
    elevationGainM: 10050,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.utmb-montblancutmb-.2022",
  },
  {
    id: "jim-utmb-2023",
    athlete: "Jim Walmsley",
    race: "UTMB Mont-Blanc",
    year: 2023,
    finishTime: "19 h 37 min 43 s",
    finishSeconds: 19 * 3600 + 37 * 60 + 43,
    distanceKm: 171,
    elevationGainM: 9963,
    sourceUrl: "https://utmb.world/es/utmb-index/races/142.daciautmb-montblancutmb.2023",
  },
  {
    id: "courtney-utmb-2023",
    athlete: "Courtney Dauwalter",
    race: "UTMB Mont-Blanc",
    year: 2023,
    finishTime: "23 h 29 min 14 s",
    finishSeconds: 23 * 3600 + 29 * 60 + 14,
    distanceKm: 171,
    elevationGainM: 9963,
    sourceUrl: "https://utmb.world/es/utmb-index/races/142.daciautmb-montblancutmb.2023",
  },
  {
    id: "katie-utmb-2024",
    athlete: "Katie Schide",
    race: "UTMB Mont-Blanc",
    year: 2024,
    finishTime: "22 h 09 min 31 s",
    finishSeconds: 22 * 3600 + 9 * 60 + 31,
    distanceKm: 173.3,
    elevationGainM: 9525,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.hokautmb-montblancutmb.2024",
  },
] as const;

export const CARB_JOKES = [
  { id: "nutella", text: "ouvrir le Nutella, perdre le couteau et finir la tartine sans se presser" },
  { id: "buffet", text: "faire deux tours du buffet du ravito et demander la carte des desserts" },
  { id: "gps", text: "laisser son GPS recalculer trois fois, puis lui expliquer qui commande" },
  { id: "headlamp", text: "recharger sa frontale, même en plein jour, juste pour le principe" },
  { id: "marmot", text: "donner une conférence TED à une marmotte sur la gestion d’allure" },
  { id: "soup", text: "attendre que la soupe refroidisse et débattre du meilleur fromage à y tremper" },
  { id: "poles", text: "démêler ses bâtons, les replier, puis les redémêler par nostalgie" },
  { id: "strava", text: "publier sur Strava, répondre aux kudos et corriger le titre de la sortie" },
  { id: "gel-tax", text: "instaurer une taxe sur les gels goût cola au prochain ravito" },
  { id: "chairlift", text: "chercher un télésiège, constater qu’il est fermé et monter quand même" },
  { id: "volunteer", text: "apprendre le prénom de tous les bénévoles avant de repartir" },
  { id: "ego", text: "laisser ton ego reprendre son souffle avant la dernière descente" },
] as const;

export type CarbComparison = (typeof CARB_COMPARISONS)[number];
export type CarbComparisonId = CarbComparison["id"];
export type CarbJoke = (typeof CARB_JOKES)[number];
export type CarbJokeId = CarbJoke["id"];

export type CarbComparisonContext = {
  duration: number;
  distance: number;
  elevation: number;
  jokeId: CarbJokeId;
};

export type SharedCarbCalculatorState = {
  duration: number;
  tolerance: number;
  distance: number;
  elevation: number;
  comparisonId: CarbComparisonId;
  jokeId: CarbJokeId;
};

const DURATION_MIN = 0.5;
const DURATION_MAX = 30;
const DURATION_STEP = 0.5;
const TOLERANCE_MIN = 0;
const TOLERANCE_MAX = 100;
const TOLERANCE_STEP = 5;
const DISTANCE_MIN = 5;
const DISTANCE_MAX = 200;
const DISTANCE_STEP = 5;
const ELEVATION_MIN = 0;
const ELEVATION_MAX = 15000;
const ELEVATION_STEP = 100;

const isStepAligned = (value: number, min: number, step: number) => {
  const stepCount = (value - min) / step;
  return Math.abs(stepCount - Math.round(stepCount)) < 1e-9;
};

const isValidSteppedValue = (value: number, min: number, max: number, step: number) =>
  Number.isFinite(value) && value >= min && value <= max && isStepAligned(value, min, step);

export function getCarbComparison(id: string | null | undefined): CarbComparison | null {
  return CARB_COMPARISONS.find((comparison) => comparison.id === id) ?? null;
}

export function getCarbJoke(id: string | null | undefined): CarbJoke | null {
  return CARB_JOKES.find((joke) => joke.id === id) ?? null;
}

function selectRandomWithoutImmediateRepeat<T extends { id: string }>(
  values: readonly T[],
  previousId: string | null | undefined,
  randomValue: number,
): T {
  const candidates = previousId ? values.filter((value) => value.id !== previousId) : [...values];
  const normalizedRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999) : 0;
  return candidates[Math.floor(normalizedRandom * candidates.length)] ?? candidates[0]!;
}

export function selectCarbComparison(
  previousId?: CarbComparisonId | null,
  randomValue = Math.random(),
): CarbComparison {
  return selectRandomWithoutImmediateRepeat(CARB_COMPARISONS, previousId, randomValue);
}

export function selectCarbJoke(previousId?: CarbJokeId | null, randomValue = Math.random()): CarbJoke {
  return selectRandomWithoutImmediateRepeat(CARB_JOKES, previousId, randomValue);
}

export function formatDurationDifference(totalSeconds: number): string {
  const roundedMinutes = Math.max(1, Math.round(Math.abs(totalSeconds) / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function getAverageSpeed(distanceKm: number, durationHours: number): number {
  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationHours) || distanceKm <= 0 || durationHours <= 0) {
    return 0;
  }
  return distanceKm / durationHours;
}

export function formatAverageSpeed(speedKph: number): string {
  return `${speedKph.toFixed(1).replace(".", ",")} km/h`;
}

export function formatCarbComparison(comparison: CarbComparison, context: CarbComparisonContext): string {
  const runnerSpeed = getAverageSpeed(context.distance, context.duration);
  const eliteSpeed = getAverageSpeed(comparison.distanceKm, comparison.finishSeconds / 3600);
  const projectedEliteSeconds = (context.distance / eliteSpeed) * 3600;
  const runnerSeconds = context.duration * 3600;
  const differenceSeconds = runnerSeconds - projectedEliteSeconds;
  const runnerElevationDensity = context.elevation / context.distance;
  const eliteElevationDensity = comparison.elevationGainM / comparison.distanceKm;
  const joke = getCarbJoke(context.jokeId) ?? CARB_JOKES[0];

  let paceSentence: string;
  if (Math.abs(differenceSeconds) < 5 * 60) {
    paceSentence = `À quelques minutes près, ton allure moyenne colle à celle de ${comparison.athlete} sur l’${comparison.race} ${comparison.year}. Le jury vous départage en vous demandant de ${joke.text}.`;
  } else if (differenceSeconds > 0) {
    paceSentence = `À son allure de ${formatAverageSpeed(eliteSpeed)} sur l’${comparison.race} ${
      comparison.year
    }, ${comparison.athlete} couvrirait tes ${context.distance} km en ${formatDurationDifference(
      projectedEliteSeconds,
    )}, soit ${formatDurationDifference(differenceSeconds)} avant toi. Assez pour ${joke.text}.`;
  } else {
    paceSentence = `Sur le papier, tes ${formatAverageSpeed(runnerSpeed)} dépassent les ${formatAverageSpeed(
      eliteSpeed,
    )} de ${comparison.athlete} sur l’${comparison.race} ${comparison.year}. Ton téléphone vient de demander si tu avais coché l’option hélicoptère. ${comparison.athlete} aurait tout de même le temps de ${joke.text} pour encaisser le choc.`;
  }

  if (runnerElevationDensity > eliteElevationDensity * 1.2) {
    return `${paceSentence} Avec ${Math.round(runnerElevationDensity)} m de D+/km, le tribunal des quadris t’accorde quand même de larges circonstances atténuantes.`;
  }

  if (runnerElevationDensity < eliteElevationDensity * 0.65) {
    return `${paceSentence} Ton parcours grimpe nettement moins par kilomètre : aucun sapin assez large pour cacher la comparaison.`;
  }

  return `${paceSentence} Côté pente, vous jouez presque dans la même catégorie — seulement côté pente.`;
}

export function parseSharedCarbCalculatorState(
  input: string | URLSearchParams,
): SharedCarbCalculatorState | null {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const comparison = getCarbComparison(params.get("comparison"));
  const joke = getCarbJoke(params.get("joke"));
  const durationRaw = params.get("duration");
  const toleranceRaw = params.get("tolerance");
  const distanceRaw = params.get("distance");
  const elevationRaw = params.get("elevation");

  if (!comparison || !joke || durationRaw === null || toleranceRaw === null || distanceRaw === null || elevationRaw === null) {
    return null;
  }

  const duration = Number(durationRaw);
  const tolerance = Number(toleranceRaw);
  const distance = Number(distanceRaw);
  const elevation = Number(elevationRaw);
  if (!isValidSteppedValue(duration, DURATION_MIN, DURATION_MAX, DURATION_STEP)) return null;
  if (!isValidSteppedValue(tolerance, TOLERANCE_MIN, TOLERANCE_MAX, TOLERANCE_STEP)) return null;
  if (!isValidSteppedValue(distance, DISTANCE_MIN, DISTANCE_MAX, DISTANCE_STEP)) return null;
  if (!isValidSteppedValue(elevation, ELEVATION_MIN, ELEVATION_MAX, ELEVATION_STEP)) return null;

  return {
    duration,
    tolerance,
    distance,
    elevation,
    comparisonId: comparison.id,
    jokeId: joke.id,
  };
}

export function buildCarbCalculatorShareUrl(baseUrl: string, state: SharedCarbCalculatorState): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("duration", String(state.duration));
  url.searchParams.set("tolerance", String(state.tolerance));
  url.searchParams.set("distance", String(state.distance));
  url.searchParams.set("elevation", String(state.elevation));
  url.searchParams.set("comparison", state.comparisonId);
  url.searchParams.set("joke", state.jokeId);
  return url.toString();
}
