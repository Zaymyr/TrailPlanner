export const CARB_COMPARISONS = [
  {
    id: "kilian-utmb-2022",
    athlete: "Kilian Jornet",
    race: "UTMB Mont-Blanc",
    year: 2022,
    finishTime: "19 h 49 min 30 s",
    finishSeconds: 19 * 3600 + 49 * 60 + 30,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.utmb-montblancutmb-.2022",
    playfulAside: "finir une tartine de Nutella parfaitement imaginaire au ravito",
  },
  {
    id: "mathieu-utmb-2022",
    athlete: "Mathieu Blanchard",
    race: "UTMB Mont-Blanc",
    year: 2022,
    finishTime: "19 h 54 min 50 s",
    finishSeconds: 19 * 3600 + 54 * 60 + 50,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.utmb-montblancutmb-.2022",
    playfulAside: "ranger ses gels par couleur avant la photo d’arrivée",
  },
  {
    id: "jim-utmb-2023",
    athlete: "Jim Walmsley",
    race: "UTMB Mont-Blanc",
    year: 2023,
    finishTime: "19 h 37 min 43 s",
    finishSeconds: 19 * 3600 + 37 * 60 + 43,
    sourceUrl: "https://utmb.world/es/utmb-index/races/142.daciautmb-montblancutmb.2023",
    playfulAside: "revenir vérifier qu’il n’a oublié personne dans la dernière montée",
  },
  {
    id: "courtney-utmb-2023",
    athlete: "Courtney Dauwalter",
    race: "UTMB Mont-Blanc",
    year: 2023,
    finishTime: "23 h 29 min 14 s",
    finishSeconds: 23 * 3600 + 29 * 60 + 14,
    sourceUrl: "https://utmb.world/es/utmb-index/races/142.daciautmb-montblancutmb.2023",
    playfulAside: "saluer tous les bénévoles et repartir avec le sourire",
  },
  {
    id: "katie-utmb-2024",
    athlete: "Katie Schide",
    race: "UTMB Mont-Blanc",
    year: 2024,
    finishTime: "22 h 09 min 31 s",
    finishSeconds: 22 * 3600 + 9 * 60 + 31,
    sourceUrl: "https://utmb.world/fr/utmb-index/races/142.hokautmb-montblancutmb.2024",
    playfulAside: "demander si la soupe est assez salée avant de repartir",
  },
] as const;

export type CarbComparison = (typeof CARB_COMPARISONS)[number];
export type CarbComparisonId = CarbComparison["id"];

export type SharedCarbCalculatorState = {
  duration: number;
  tolerance: number;
  comparisonId: CarbComparisonId;
};

const DURATION_MIN = 0.5;
const DURATION_MAX = 30;
const DURATION_STEP = 0.5;
const TOLERANCE_MIN = 0;
const TOLERANCE_MAX = 100;
const TOLERANCE_STEP = 5;

const isStepAligned = (value: number, min: number, step: number) => {
  const stepCount = (value - min) / step;
  return Math.abs(stepCount - Math.round(stepCount)) < 1e-9;
};

export function getCarbComparison(id: string | null | undefined): CarbComparison | null {
  return CARB_COMPARISONS.find((comparison) => comparison.id === id) ?? null;
}

export function selectCarbComparison(
  previousId?: CarbComparisonId | null,
  randomValue = Math.random(),
): CarbComparison {
  const candidates = previousId
    ? CARB_COMPARISONS.filter((comparison) => comparison.id !== previousId)
    : [...CARB_COMPARISONS];
  const normalizedRandom = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999) : 0;
  return candidates[Math.floor(normalizedRandom * candidates.length)] ?? candidates[0]!;
}

export function formatDurationDifference(totalSeconds: number): string {
  const roundedMinutes = Math.max(1, Math.round(Math.abs(totalSeconds) / 60));
  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function formatCarbComparison(comparison: CarbComparison, durationHours: number): string {
  const differenceSeconds = Math.round(durationHours * 3600) - comparison.finishSeconds;

  if (Math.abs(differenceSeconds) < 60) {
    return `Photo-finish imaginaire avec ${comparison.athlete}. On compare des parcours différents, mais l’ego prend quand même la médaille.`;
  }

  if (differenceSeconds > 0) {
    return `Si ton chrono était celui de l’UTMB, ${comparison.athlete} te mettrait ${formatDurationDifference(
      differenceSeconds,
    )} — assez pour ${comparison.playfulAside}.`;
  }

  return `Ton chrono est ${formatDurationDifference(-differenceSeconds)} plus court que cet UTMB de ${
    comparison.athlete
  }. Comparaison officiellement annulée par le jury des pommes et des gels.`;
}

export function parseSharedCarbCalculatorState(
  input: string | URLSearchParams,
): SharedCarbCalculatorState | null {
  const params = typeof input === "string" ? new URLSearchParams(input) : input;
  const durationRaw = params.get("duration");
  const toleranceRaw = params.get("tolerance");
  const comparison = getCarbComparison(params.get("comparison"));

  if (durationRaw === null || toleranceRaw === null || !comparison) return null;

  const duration = Number(durationRaw);
  const tolerance = Number(toleranceRaw);
  const validDuration =
    Number.isFinite(duration) &&
    duration >= DURATION_MIN &&
    duration <= DURATION_MAX &&
    isStepAligned(duration, DURATION_MIN, DURATION_STEP);
  const validTolerance =
    Number.isFinite(tolerance) &&
    tolerance >= TOLERANCE_MIN &&
    tolerance <= TOLERANCE_MAX &&
    isStepAligned(tolerance, TOLERANCE_MIN, TOLERANCE_STEP);

  if (!validDuration || !validTolerance) return null;

  return { duration, tolerance, comparisonId: comparison.id };
}

export function buildCarbCalculatorShareUrl(baseUrl: string, state: SharedCarbCalculatorState): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("duration", String(state.duration));
  url.searchParams.set("tolerance", String(state.tolerance));
  url.searchParams.set("comparison", state.comparisonId);
  return url.toString();
}
