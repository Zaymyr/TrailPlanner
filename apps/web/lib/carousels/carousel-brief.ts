import { formatDayMonth, formatKm, formatNumber, upper } from "./carousel-format";

/**
 * « Le brief » (pure): cover, cutoffs or aid stations, then the livret coureur or the plan de course.
 * Rules: docs/05-integrations/instagram-carousels.md (« Le brief »). Dates are absolute: never a
 * relative « J−8 ».
 */

export type BriefPalette = "night" | "day";

export type BriefStation = {
  name: string;
  km: number;
  waterAvailable: boolean;
  solidAvailable: boolean;
  cutoffTime: string | null;
};

export type BriefInput = {
  eventName: string;
  raceTitle: string;
  shortLabel: string;
  raceDate: string;
  distanceKm: number;
  elevationGainM: number | null;
  stations: BriefStation[];
  finishCutoffTime: string | null;
  nightStart: boolean;
  /** Organizer livret coureur: bought (paid tier with RaceBook) and published for this format. */
  livret: { available: boolean; equipment: boolean; bibPickup: boolean; access: boolean; services: boolean };
};

export type BriefChip = { text: string; tone: "ok" | "warn" };
export type BriefRow = { kmLabel: string; big: string; name: string; chips: BriefChip[] };
export type BriefSign = { title: string; detail: string };

export type BriefSnapshot = {
  series: "brief";
  palette: BriefPalette;
  label: string;
  cover: { eyebrow: string; headline: string; km: string; dplus: string | null; third: { value: string; label: string } };
  stations: { kind: "cutoffs" | "ravitos"; title: string; lead: string; density: "tall" | "medium" | "compact"; rows: BriefRow[]; more: number };
  closing: { kind: "livret" | "plan"; title: string; lead: string; cta: string; signs: BriefSign[] };
};

/** Station rows: tall up to 5, medium up to 8, compact up to 12; the rest is counted. */
export const BRIEF_ROWS_MAX = 12;

/** Night palette when the start is at night, otherwise day. */
export const selectBriefPalette = (nightStart: boolean): BriefPalette => (nightStart ? "night" : "day");

/** "04:00", "7h05" → "04:00", "07:05"; anything else stays as written. */
export const formatCutoff = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : value.trim();
};

export const stationChips = (station: Pick<BriefStation, "waterAvailable" | "solidAvailable">): BriefChip[] => {
  if (station.waterAvailable && station.solidAvailable) return [{ text: "SOLIDE", tone: "ok" }, { text: "EAU", tone: "ok" }];
  if (station.waterAvailable) return [{ text: "EAU SEULEMENT", tone: "warn" }];
  if (station.solidAvailable) return [{ text: "SOLIDE SEULEMENT", tone: "warn" }];
  return [{ text: "SANS RAVITAILLEMENT", tone: "warn" }];
};

const densityOf = (count: number): BriefSnapshot["stations"]["density"] => (count <= 5 ? "tall" : count <= 8 ? "medium" : "compact");

const countWord = (count: number, singular: string, plural: string) => `${count} ${count > 1 ? plural : singular}`;

/** Slide 2: the cutoffs when the organizer gave them, otherwise « Les ravitos » with their services. */
export const buildStationsSlide = (input: Pick<BriefInput, "stations" | "finishCutoffTime" | "distanceKm">): BriefSnapshot["stations"] => {
  const sorted = [...input.stations].sort((left, right) => left.km - right.km);
  const withCutoff = sorted.filter((station) => station.cutoffTime && station.cutoffTime.trim());
  if (withCutoff.length > 0) {
    const rows: BriefRow[] = withCutoff.map((station) => ({
      kmLabel: `KM ${formatKm(station.km)}`,
      big: formatCutoff(station.cutoffTime as string),
      name: station.name,
      chips: stationChips(station),
    }));
    if (input.finishCutoffTime?.trim()) {
      rows.push({ kmLabel: `KM ${formatKm(input.distanceKm)}`, big: formatCutoff(input.finishCutoffTime), name: "Arrivée", chips: [] });
    }
    const shown = rows.slice(0, BRIEF_ROWS_MAX);
    return {
      kind: "cutoffs",
      title: "Les barrières horaires.",
      lead: "Passé l’heure, ta course s’arrête au ravito. Note-les, ou laisse ton plan les surveiller.",
      density: densityOf(shown.length),
      rows: shown,
      more: rows.length - shown.length,
    };
  }
  const rows: BriefRow[] = sorted.map((station) => ({ kmLabel: "KM", big: formatKm(station.km), name: station.name, chips: stationChips(station) }));
  const shown = rows.slice(0, BRIEF_ROWS_MAX);
  return {
    kind: "ravitos",
    title: "Les ravitos.",
    lead: `${countWord(sorted.length, "ravito", "ravitos")} sur ${formatKm(input.distanceKm)} km : entre deux, tu es en autonomie. Prévois ce qu’il faut dans le sac.`,
    density: densityOf(shown.length),
    rows: shown,
    more: rows.length - shown.length,
  };
};

/** Slide 3: the organizer's livret coureur when it was bought and is published, otherwise the plan de course. */
export const buildClosingSlide = (livret: BriefInput["livret"]): BriefSnapshot["closing"] => {
  if (livret.available) {
    const signs: BriefSign[] = [
      ...(livret.equipment ? [{ title: "Matériel", detail: "la liste officielle" }] : []),
      ...(livret.bibPickup ? [{ title: "Dossard", detail: "où, quand, quels papiers" }] : []),
      { title: "Course", detail: "carte, profil, ravitos" },
      ...(livret.access ? [{ title: "Accès", detail: "parkings, navettes" }] : []),
      ...(livret.services ? [{ title: "Services", detail: "infos pratiques" }] : []),
    ];
    return {
      kind: "livret",
      title: "Tout le reste tient dans ta poche.",
      lead: "Le livret coureur officiel de la course, tenu à jour par l’organisation jusqu’au départ.",
      cta: "Livret + plan · lien en bio",
      signs: signs.slice(0, 5),
    };
  }
  return {
    kind: "plan",
    title: "Ton plan de course, prêt pour celle-ci.",
    lead: "Ton allure, ta nutrition et tes marges, calculées pour ce parcours et ton objectif.",
    cta: "Ton plan · lien en bio",
    signs: [
      { title: "Allure", detail: "tes heures de passage" },
      { title: "Nutrition", detail: "quoi manger, et quand" },
      { title: "Ravitos", detail: "ce que tu y trouves" },
      { title: "Barrières", detail: "ta marge à chaque point" },
      { title: "Hors ligne", detail: "même sans réseau" },
    ],
  };
};

export const buildBriefSnapshot = (input: BriefInput): BriefSnapshot => {
  const stations = buildStationsSlide(input);
  const cutoffCount = stations.kind === "cutoffs" ? stations.rows.length + stations.more : 0;
  return {
    series: "brief",
    palette: selectBriefPalette(input.nightStart),
    label: `LE BRIEF · ${input.shortLabel}`,
    cover: {
      eyebrow: `${upper(input.eventName)} · ${formatDayMonth(input.raceDate)}`,
      headline: `${input.raceTitle} : ce qu’il faut savoir.`,
      km: formatKm(input.distanceKm),
      dplus: input.elevationGainM !== null ? formatNumber(input.elevationGainM) : null,
      third: stations.kind === "cutoffs"
        ? { value: String(cutoffCount), label: cutoffCount > 1 ? "BARRIÈRES" : "BARRIÈRE" }
        : { value: String(input.stations.length), label: input.stations.length > 1 ? "RAVITOS" : "RAVITO" },
    },
    stations,
    closing: buildClosingSlide(input.livret),
  };
};
