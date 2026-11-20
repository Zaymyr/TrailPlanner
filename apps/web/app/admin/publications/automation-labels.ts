import type { ReelAutomationItemView } from "./publications-api";
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
