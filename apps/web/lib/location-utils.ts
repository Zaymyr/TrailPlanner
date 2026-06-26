export type OrganizerLocationSource = "manual" | "autocomplete";

export type OrganizerLocationShape = {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  googleMapsUrl?: string | null;
  source?: OrganizerLocationSource | null;
};

const GOOGLE_MAPS_SEARCH_URL = "https://www.google.com/maps/search/";

const trimText = (value?: string | null) => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeCoordinate = (value?: number | null) =>
  typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(6)) : null;

export const hasCoordinates = (location?: OrganizerLocationShape | null) =>
  typeof location?.lat === "number" &&
  Number.isFinite(location.lat) &&
  typeof location?.lng === "number" &&
  Number.isFinite(location.lng);

export const buildGoogleMapsUrl = ({
  label,
  lat,
  lng,
}: {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
}) => {
  const trimmedLabel = trimText(label);
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);

  if (normalizedLat !== null && normalizedLng !== null) {
    return `${GOOGLE_MAPS_SEARCH_URL}?api=1&query=${encodeURIComponent(`${normalizedLat},${normalizedLng}`)}`;
  }

  if (!trimmedLabel) return null;
  return `${GOOGLE_MAPS_SEARCH_URL}?api=1&query=${encodeURIComponent(trimmedLabel)}`;
};

export const buildOrganizerLocation = ({
  label,
  lat,
  lng,
  source,
}: {
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  source?: OrganizerLocationSource | null;
}): Required<OrganizerLocationShape> => {
  const trimmedLabel = trimText(label);
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);

  return {
    label: trimmedLabel,
    lat: normalizedLat,
    lng: normalizedLng,
    googleMapsUrl: buildGoogleMapsUrl({ label: trimmedLabel, lat: normalizedLat, lng: normalizedLng }),
    source: trimmedLabel ? source ?? (normalizedLat !== null && normalizedLng !== null ? "autocomplete" : "manual") : null,
  };
};

export const formatCoordinates = (lat?: number | null, lng?: number | null) => {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  if (normalizedLat === null || normalizedLng === null) return null;
  return `${normalizedLat.toFixed(5)}, ${normalizedLng.toFixed(5)}`;
};
