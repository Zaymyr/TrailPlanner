/** Organizer form values are intentionally normalised only at interaction boundaries. */
export function normalizeInstagramUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const handle = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  if (!handle.includes("://") && !handle.startsWith("instagram.com/")) {
    return `https://instagram.com/${handle.replace(/^\/+/, "")}`;
  }
  if (handle.startsWith("instagram.com/")) return `https://${handle}`;
  return handle;
}

export function isValidInstagramUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(normalizeInstagramUrl(value));
    const identifier = url.pathname.replace(/^\/+|\/+$/g, "");
    return url.protocol === "https:"
      && (url.hostname === "instagram.com" || url.hostname === "www.instagram.com")
      && /^[A-Za-z0-9._]+$/.test(identifier);
  } catch {
    return false;
  }
}

export function isValidDraft<T>(draft: T, validate: (value: T) => boolean): boolean {
  return validate(draft);
}

export function isOutsideDateRange(date: string, startDate: string, endDate: string): boolean {
  if (!date || !startDate || !endDate) return false;
  return date < startDate || date > endDate;
}

export function hasSignificantDistanceMismatch(declaredKm: number, gpxKm?: number | null): boolean {
  if (!Number.isFinite(declaredKm) || declaredKm <= 0 || !gpxKm || !Number.isFinite(gpxKm) || gpxKm <= 0) return false;
  const difference = Math.abs(declaredKm - gpxKm);
  return difference >= 2 && difference / Math.max(declaredKm, gpxKm) >= 0.15;
}

export function hasSuspiciousEqualElevation(gainM: number, lossM: number): boolean {
  return gainM > 0 && lossM > 0 && Math.abs(gainM - lossM) < 0.01;
}
