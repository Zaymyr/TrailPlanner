import type { FuelType } from './types';

export const FREE_FAVORITE_LIMIT = 2;

export const FUEL_TYPE_LABELS: Record<FuelType | 'all', string> = {
  all: 'Tous',
  gel: 'Gel',
  drink_mix: 'Boisson',
  electrolyte: 'Électrolyte',
  capsule: 'Capsule',
  bar: 'Barre',
  real_food: 'Aliment',
  other: 'Autre',
};

export const FUEL_FILTERS: Array<FuelType | 'all'> = [
  'all',
  'gel',
  'drink_mix',
  'electrolyte',
  'capsule',
  'bar',
  'real_food',
  'other',
];

export const FUEL_TYPE_OPTIONS: FuelType[] = [
  'gel',
  'drink_mix',
  'electrolyte',
  'capsule',
  'bar',
  'real_food',
  'other',
];

export function parseNonNegativeDecimalInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
