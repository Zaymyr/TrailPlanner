import type { ChangelogEntry } from './types';

export type UserProfile = {
  full_name: string | null;
  age: number | null;
  birth_date: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  water_bag_liters: number | null;
  utmb_index: number | null;
  comfortable_flat_pace_min_per_km: number | null;
  default_carbs_g_per_hour: number | null;
  default_water_ml_per_hour: number | null;
  default_sodium_mg_per_hour: number | null;
  role: string | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
};

export const WATER_BAG_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5];

export function formatDate(value: string | Date, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function getRemainingDays(iso: string): number {
  const endTime = new Date(iso).getTime();
  if (!Number.isFinite(endTime)) return 0;
  return Math.max(0, Math.ceil((endTime - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function formatBirthDateInput(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseIsoBirthDateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, yearValue, monthValue, dayValue] = match;
  return {
    year: Number(yearValue),
    month: Number(monthValue),
    day: Number(dayValue),
  };
}

export function normalizeBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function parseBirthDateInput(value: string): string | null {
  const trimmedValue = value.trim();
  const frenchMatch = /^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/.exec(trimmedValue);
  const isoMatch = /^(\d{4})[\/.\-](\d{2})[\/.\-](\d{2})$/.exec(trimmedValue);

  let day: string;
  let month: string;
  let year: string;

  if (frenchMatch) {
    [, day, month, year] = frenchMatch;
  } else if (isoMatch) {
    [, year, month, day] = isoMatch;
  } else {
    const digits = trimmedValue.replace(/\D/g, '');
    if (digits.length !== 8) return null;
    day = digits.slice(0, 2);
    month = digits.slice(2, 4);
    year = digits.slice(4, 8);
  }

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  if (
    !Number.isInteger(yearNumber) ||
    !Number.isInteger(monthNumber) ||
    !Number.isInteger(dayNumber)
  ) {
    return null;
  }

  const date = new Date(Date.UTC(yearNumber, monthNumber - 1, dayNumber));
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getUTCFullYear() !== yearNumber ||
    date.getUTCMonth() + 1 !== monthNumber ||
    date.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function calculateAgeFromBirthDate(birthDate: string): number {
  const birthParts = parseIsoBirthDateParts(birthDate);
  if (!birthParts) return 0;

  const today = new Date();
  let age = today.getFullYear() - birthParts.year;
  const hasHadBirthdayThisYear =
    today.getMonth() + 1 > birthParts.month ||
    (today.getMonth() + 1 === birthParts.month && today.getDate() >= birthParts.day);

  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function splitPaceMinutesPerKm(value: number | null | undefined): { minutes: string; seconds: string } {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return { minutes: '', seconds: '' };
  }

  const totalSeconds = Math.round(value * 60);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return {
    minutes: String(minutes),
    seconds: String(seconds).padStart(2, '0'),
  };
}

export function parseComfortableFlatPace(minutesInput: string, secondsInput: string): number | null {
  const trimmedMinutes = minutesInput.trim();
  const trimmedSeconds = secondsInput.trim();

  if (!trimmedMinutes && !trimmedSeconds) return null;
  if (!trimmedMinutes) return Number.NaN;

  const minutes = Number(trimmedMinutes);
  const seconds = trimmedSeconds ? Number(trimmedSeconds) : 0;

  if (
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return Number.NaN;
  }

  const totalMinutes = minutes + seconds / 60;
  return totalMinutes > 0 ? totalMinutes : Number.NaN;
}

export function parseOptionalNonNegativeInteger(value: string): number | null {
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  const nextValue = Number(trimmedValue);
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    return Number.NaN;
  }

  return nextValue;
}

export function getChangelogDetail(entry: ChangelogEntry, snapshotFallbackLabel: string): string {
  const trimmedDetail = entry.detail?.trim();
  if (trimmedDetail) return entry.detail;
  return snapshotFallbackLabel.replace('{version}', entry.version);
}
