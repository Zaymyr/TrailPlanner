import { DEFAULT_FATIGUE_LEVEL, estimateEffortDurationSeconds } from "./pacing";

/**
 * Quick, account-free race estimate used by the public course page and the
 * anonymous planner entry. It reuses the planner effort model (equivalent flat
 * distance + fatigue) so the figure matches what the full planner shows before
 * any per-section adjustment or aid-station pause.
 */

export type QuickEstimatePoint = { distanceKm: number; elevationM: number | null };
export type QuickEstimateStation = { name: string; distanceKm: number };

export type QuickEstimateCourse = {
  distanceKm: number | null;
  elevationGainM: number | null;
  elevationLossM: number | null;
  points?: QuickEstimatePoint[] | null;
  aidStations?: QuickEstimateStation[] | null;
};

export type QuickEstimateCheckpoint = { name: string; distanceKm: number; elapsedSeconds: number };

export type QuickEstimateResult = {
  flatPaceMinPerKm: number;
  totalSeconds: number;
  averagePaceMinPerKm: number;
  checkpoints: QuickEstimateCheckpoint[];
};

/**
 * Approximate comfortable flat pace from a UTMB Index. The index is a
 * performance ratio (1000 ≈ best elite level), so pace scales inversely with
 * it. The 3.2 min/km reference is calibrated so an index around 950 lands near
 * elite finishing times on long mountain ultras with this effort model.
 */
export const UTMB_INDEX_REFERENCE_PACE_MIN_PER_KM = 3.2;
export const UTMB_INDEX_MIN = 150;
export const UTMB_INDEX_MAX = 1000;
export const FLAT_PACE_MIN = 3;
export const FLAT_PACE_MAX = 15;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function flatPaceFromUtmbIndex(utmbIndex: number): number | null {
  if (!Number.isFinite(utmbIndex) || utmbIndex <= 0) return null;
  const index = clamp(utmbIndex, UTMB_INDEX_MIN, UTMB_INDEX_MAX);
  return clamp((UTMB_INDEX_REFERENCE_PACE_MIN_PER_KM * 1000) / index, FLAT_PACE_MIN, FLAT_PACE_MAX);
}

export function isValidFlatPace(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= FLAT_PACE_MIN && value <= FLAT_PACE_MAX;
}

type Profile = { km: number[]; gain: number[]; loss: number[] };

function buildCumulativeProfile(points: QuickEstimatePoint[]): Profile | null {
  const usable = points
    .filter((point) => Number.isFinite(point.distanceKm) && typeof point.elevationM === "number" && Number.isFinite(point.elevationM))
    .sort((a, b) => a.distanceKm - b.distanceKm);
  if (usable.length < 2) return null;
  const km = [usable[0].distanceKm];
  const gain = [0];
  const loss = [0];
  for (let index = 1; index < usable.length; index += 1) {
    const delta = (usable[index].elevationM as number) - (usable[index - 1].elevationM as number);
    km.push(usable[index].distanceKm);
    gain.push(gain[index - 1] + Math.max(0, delta));
    loss.push(loss[index - 1] + Math.max(0, -delta));
  }
  return { km, gain, loss };
}

function interpolate(profile: Profile, values: number[], km: number) {
  const { km: kms } = profile;
  if (km <= kms[0]) return values[0];
  const last = kms.length - 1;
  if (km >= kms[last]) return values[last];
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (kms[mid] <= km) low = mid;
    else high = mid;
  }
  const span = kms[high] - kms[low];
  const ratio = span > 0 ? (km - kms[low]) / span : 0;
  return values[low] + (values[high] - values[low]) * ratio;
}

export function estimateCourseTime(
  course: QuickEstimateCourse,
  flatPaceMinPerKm: number,
  fatigueLevel = DEFAULT_FATIGUE_LEVEL,
): QuickEstimateResult | null {
  if (!isValidFlatPace(flatPaceMinPerKm)) return null;
  const profile = buildCumulativeProfile(course.points ?? []);
  const profileDistance = profile ? profile.km[profile.km.length - 1] : null;
  const totalKm = course.distanceKm && course.distanceKm > 0 ? course.distanceKm : profileDistance;
  if (!totalKm || totalKm <= 0) return null;

  // The public preview is down-sampled, so its raw D+/D- under-reads the
  // official figures. Scale the profile shape to the published totals.
  const rawGain = profile ? profile.gain[profile.gain.length - 1] : 0;
  const rawLoss = profile ? profile.loss[profile.loss.length - 1] : 0;
  const gainScale = profile && rawGain > 0 && course.elevationGainM !== null ? course.elevationGainM / rawGain : 1;
  const lossScale = profile && rawLoss > 0 && course.elevationLossM !== null ? course.elevationLossM / rawLoss : 1;
  const kmScale = profile && profileDistance && profileDistance > 0 ? profileDistance / totalKm : 1;

  const elevationAt = (officialKm: number) => {
    if (!profile) {
      const ratio = officialKm / totalKm;
      return { gain: (course.elevationGainM ?? 0) * ratio, loss: (course.elevationLossM ?? 0) * ratio };
    }
    const profileKm = officialKm * kmScale;
    return {
      gain: interpolate(profile, profile.gain, profileKm) * gainScale,
      loss: interpolate(profile, profile.loss, profileKm) * lossScale,
    };
  };

  const stations = (course.aidStations ?? [])
    .filter((station) => Number.isFinite(station.distanceKm) && station.distanceKm > 0 && station.distanceKm < totalKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
  const targets: QuickEstimateStation[] = [...stations, { name: "Arrivée", distanceKm: totalKm }];

  const paceSeconds = flatPaceMinPerKm * 60;
  let elapsedSeconds = 0;
  let previousKm = 0;
  let previousElevation = { gain: 0, loss: 0 };
  const checkpoints: QuickEstimateCheckpoint[] = [];
  for (const target of targets) {
    if (target.distanceKm <= previousKm) continue;
    const elevation = elevationAt(target.distanceKm);
    elapsedSeconds += estimateEffortDurationSeconds(paceSeconds, {
      distKm: target.distanceKm - previousKm,
      dPlus: elevation.gain - previousElevation.gain,
      dMinus: elevation.loss - previousElevation.loss,
      elapsedBeforeSeconds: elapsedSeconds,
      fatigueLevel,
    });
    checkpoints.push({ name: target.name, distanceKm: target.distanceKm, elapsedSeconds: Math.round(elapsedSeconds) });
    previousKm = target.distanceKm;
    previousElevation = elevation;
  }

  const totalSeconds = Math.round(elapsedSeconds);
  return {
    flatPaceMinPerKm,
    totalSeconds,
    averagePaceMinPerKm: totalSeconds / 60 / totalKm,
    checkpoints,
  };
}

/** Reference runner levels shown on public course pages (comfortable flat pace). */
export const REFERENCE_FLAT_PACES = [
  { key: "confirmed", label: "Confirmé", flatPaceMinPerKm: 5 },
  { key: "regular", label: "Régulier", flatPaceMinPerKm: 6.5 },
  { key: "discovery", label: "Découverte", flatPaceMinPerKm: 8 },
] as const;

export function formatDurationHm(totalSeconds: number) {
  const totalMinutes = Math.max(0, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${String(minutes).padStart(2, "0")}`;
}

export function formatPaceMinPerKm(pace: number) {
  const totalSeconds = Math.round(pace * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")} /km`;
}
