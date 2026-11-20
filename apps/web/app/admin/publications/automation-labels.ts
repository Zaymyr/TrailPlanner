import type { CarouselItemView, CarouselSeriesKey, ReelAutomationItemView } from "./publications-api";
import { PLANNED_CALENDAR_STATUSES, type PlannedCalendarEntry } from "./publication-calendar";

const STEP_LABELS: Record<NonNullable<ReelAutomationItemView["step"]>, string> = { content: "texte", voice: "voix", render: "rendu" };

/** « ven. 30 janv. » of a calendar day. */
export const formatAutomationDay = (day: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));

export type AutomationTone = "muted" | "active" | "done" | "warning" | "error";

/** French status line of an automation item, with the reason of a skip or a failure. */
export const describeAutomationItem = (item: ReelAutomationItemView): { label: string; tone: AutomationTone } => {
  switch (item.status) {
    case "planned":
      return { label: `Prévu · génération le ${formatAutomationDay(item.generateOn)}`, tone: "muted" };
    case "generating":
      return item.error
        ? { label: `Génération (${STEP_LABELS[item.step ?? "content"]}) · nouvel essai après : ${item.error}`, tone: "warning" }
        : { label: `Génération en cours (${STEP_LABELS[item.step ?? "content"]})`, tone: "active" };
    case "rendering":
      return { label: "Rendu en cours", tone: "active" };
    case "drafted":
      return item.error ? { label: `Brouillon prêt · ${item.error}`, tone: "warning" } : { label: "Brouillon prêt, à relire", tone: "done" };
    case "scheduled":
      return { label: "Programmé sur Instagram", tone: "done" };
    case "failed":
      return { label: `Échec : ${item.error ?? "raison inconnue"}`, tone: "error" };
    default:
      if (item.reason === "too_late") return { label: "Trop tard — à faire à la main", tone: "warning" };
      if (item.reason === "duplicate") return { label: "Ignoré : un reel existe déjà pour cette course", tone: "muted" };
      if (item.reason === "excluded") return { label: "Exclu", tone: "muted" };
      return { label: `Non générable automatiquement${item.error ? ` : ${item.error}` : ""}`, tone: "warning" };
  }
};

/** Grey calendar entries: automatic reels still waiting for their slot (a scheduled one shows as its post). */
export const toPlannedCalendarEntries = (items: ReelAutomationItemView[], publishTime: string): PlannedCalendarEntry[] =>
  items
    .filter((item) => (PLANNED_CALENDAR_STATUSES as readonly string[]).includes(item.status))
    .map((item) => ({ id: item.id, day: item.plannedPublishDate, label: item.raceName ?? "Course", time: publishTime }));

export const CAROUSEL_SERIES_NAMES: Record<CarouselSeriesKey, string> = {
  plan: "Le plan chiffré",
  brief: "Le brief",
  week: "La semaine qui vient",
};

/** Mark of a carousel in the calendar and the lists (distinct from reels). */
export const CAROUSEL_MARK = "▦";

/** French status line of a carousel slot. */
export const describeCarouselItem = (item: CarouselItemView): { label: string; tone: AutomationTone } => {
  switch (item.status) {
    case "planned":
      return { label: `Prévu · génération le ${formatAutomationDay(item.generateOn)}`, tone: "muted" };
    case "generating":
      return item.error
        ? { label: `Génération (${item.step === "render" ? "rendu" : "texte"}) · nouvel essai après : ${item.error}`, tone: "warning" }
        : { label: "Génération en cours", tone: "active" };
    case "rendering":
      return { label: "Rendu des images en cours", tone: "active" };
    case "drafted":
      return item.error ? { label: `Brouillon prêt · ${item.error}`, tone: "warning" } : { label: "Brouillon prêt, à relire", tone: "done" };
    case "scheduled":
      return { label: "Programmé sur Instagram", tone: "done" };
    case "failed":
      return { label: `Échec : ${item.error ?? "raison inconnue"}`, tone: "error" };
    default:
      if (item.reason === "too_late") return { label: "Trop tard — semaine sautée", tone: "warning" };
      if (item.reason === "no_candidate") return { label: "Semaine sautée : aucune course ne convient", tone: "muted" };
      if (item.reason === "occupied") return { label: "Semaine sautée : une autre publication occupe ce jour", tone: "muted" };
      if (item.reason === "duplicate") return { label: "Ignoré : un carrousel de cette série existe déjà pour cette course", tone: "muted" };
      if (item.reason === "excluded") return { label: "Exclu", tone: "muted" };
      return { label: `Non générable${item.error ? ` : ${item.error}` : ""}`, tone: "warning" };
  }
};

/** Subject of a carousel slot: its race, or its week. */
export const carouselSubject = (item: CarouselItemView) =>
  item.series === "week" ? `Semaine du ${item.weekStart ? formatAutomationDay(item.weekStart) : "?"}` : item.raceName ?? "Course à choisir";

/** Grey calendar entries of carousel slots still waiting for their slot, marked as carousels. */
export const toPlannedCarouselEntries = (items: CarouselItemView[], publishTime: string): PlannedCalendarEntry[] =>
  items
    .filter((item) => (PLANNED_CALENDAR_STATUSES as readonly string[]).includes(item.status))
    .map((item) => ({ id: item.id, day: item.plannedPublishDate, label: `${CAROUSEL_SERIES_NAMES[item.series]} · ${carouselSubject(item)}`, time: publishTime, kind: "carousel" as const }));
