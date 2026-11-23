export type PlanLocale = "fr" | "en";

const intlLocale = (locale: PlanLocale) => (locale === "fr" ? "fr-FR" : "en-US");

export function formatDecimal(value: number, locale: PlanLocale, digits = 1): string {
  return value.toLocaleString(intlLocale(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatInteger(value: number, locale: PlanLocale): string {
  return Math.round(value).toLocaleString(intlLocale(locale), { maximumFractionDigits: 0 });
}

/** « 3 h 26 » (fr) / « 3h 26 » (en); under one hour « 45 min ». */
export function formatDurationMinutes(totalMinutes: number, locale: PlanLocale): string {
  const total = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  const mm = String(minutes).padStart(2, "0");
  return locale === "fr" ? `${hours} h ${mm}` : `${hours}h ${mm}`;
}

/** Clock time relative to the start: « 0:45 », « 12:05 ». */
export function formatClock(minute: number): string {
  const total = Math.max(0, Math.round(minute));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
