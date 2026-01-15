import type { RacePlannerTranslations } from "../../../../locales/types";

export const formatClockTime = (totalMinutes: number) => {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const paddedMinutes = String(minutes).padStart(2, "0");
  return `${hours}:${paddedMinutes}`;
};

export function formatMinutes(totalMinutes: number, units: RacePlannerTranslations["units"]) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  return `${hours}${units.hourShort} ${minutes.toString().padStart(2, "0")}${units.minuteShort}`;
}
