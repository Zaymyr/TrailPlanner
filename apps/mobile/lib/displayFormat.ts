export type AppLocale = 'fr' | 'en';

function localeTag(locale: AppLocale) {
  return locale === 'fr' ? 'fr-FR' : 'en-US';
}

export function formatDistanceValue(distanceKm: number, locale: AppLocale): string {
  const safeDistance = Number.isFinite(distanceKm) ? distanceKm : 0;
  return new Intl.NumberFormat(localeTag(locale), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(safeDistance);
}

export function formatDistance(distanceKm: number, locale: AppLocale): string {
  return `${formatDistanceValue(distanceKm, locale)} km`;
}

export function formatDistanceRange(startKm: number, endKm: number, locale: AppLocale): string {
  return `${formatDistanceValue(startKm, locale)}–${formatDistanceValue(endKm, locale)} km`;
}

export function parseLocalizedDecimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeClockDisplay(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return value;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
