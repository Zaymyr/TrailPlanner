/**
 * French formatting shared by the carousel builders (pure). Numbers use a no-break space as the
 * thousands separator so a figure never wraps, and a decimal comma.
 */

const NBSP = " ";

/** 2500 → "2 500", 16.2 → "16,2" (one decimal at most, ",0" dropped). */
export const formatNumber = (value: number, decimals = 0) => {
  const rounded = decimals > 0 ? Number(value.toFixed(decimals)) : Math.round(value);
  const [integer, fraction] = String(Math.abs(rounded)).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${rounded < 0 ? "-" : ""}${grouped}${fraction ? `,${fraction}` : ""}`;
};

/** Kilometre of a station: whole from 10 km on, one decimal below or when it is not whole. */
export const formatKm = (km: number) => formatNumber(km, Number.isInteger(Number(km.toFixed(1))) ? 0 : 1);

const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const WEEKDAYS = ["DIM.", "LUN.", "MAR.", "MER.", "JEU.", "VEN.", "SAM."];

const parseDay = (day: string) => {
  const [year, month, date] = day.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
};

/** "2026-11-28" → "28 NOV." */
export const formatDayMonth = (day: string) => {
  const date = parseDay(day);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

/** "2026-11-28" → "SAM. 28 NOV." */
export const formatWeekdayDayMonth = (day: string) => `${WEEKDAYS[parseDay(day).getUTCDay()]} ${formatDayMonth(day)}`;

/** Monday and Sunday → "23–29 NOV.", or "30 NOV.–6 DÉC." across two months. */
export const formatWeekRange = (monday: string, sunday: string) => {
  const start = parseDay(monday);
  const end = parseDay(sunday);
  if (start.getUTCMonth() === end.getUTCMonth()) return `${start.getUTCDate()}–${end.getUTCDate()} ${MONTHS[end.getUTCMonth()]}`;
  return `${formatDayMonth(monday)}–${formatDayMonth(sunday)}`;
};

/** ISO 8601 week number of a day. */
export const isoWeekNumber = (day: string) => {
  const date = parseDay(day);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstWeekday + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
};

/** Hours as an objective label: "12 h", "3 h 30". */
export const formatObjective = (hours: number) => {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${String(m).padStart(2, "0")}`;
};

/** Upper case for labels, French accents kept. */
export const upper = (text: string) => text.toLocaleUpperCase("fr-FR");
