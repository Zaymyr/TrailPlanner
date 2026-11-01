import type { RacebookSupporterPoint } from './racebook';

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseRacebookSupporterPoints(rows: unknown): RacebookSupporterPoint[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((raw) => {
      const row = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      return {
        id: String(row.id ?? ''),
        name: text(row.name) ?? '',
        km: number(row.km) ?? Number.NaN,
        encouragementAllowed: row.encouragement_allowed === true,
        assistanceAllowed: row.assistance_allowed === true,
        accessLabel: text(row.access_label),
        latitude: number(row.latitude) ?? Number.NaN,
        longitude: number(row.longitude) ?? Number.NaN,
        googleMapsUrl: text(row.google_maps_url),
        accessNote: text(row.access_note),
        planUrl: text(row.plan_url),
        orderIndex: number(row.order_index) ?? 0,
      };
    })
    .filter((row) => row.id.length > 0 && row.name.length > 0 && Number.isFinite(row.km) && Number.isFinite(row.latitude) && Number.isFinite(row.longitude) && (row.encouragementAllowed || row.assistanceAllowed))
    .sort((left, right) => left.orderIndex - right.orderIndex || left.km - right.km);
}

export function buildSupporterDirectionsUrl(point: Pick<RacebookSupporterPoint, 'googleMapsUrl' | 'latitude' | 'longitude'>) {
  return point.googleMapsUrl
    ?? `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
}
