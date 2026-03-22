export const RACE_PLANNER_STORAGE_KEY = "trailplanner.racePlannerState";

export type RacePlannerStoragePayload<TValues = unknown, TProfile = unknown> = {
  version: number;
  values: TValues;
  elevationProfile: TProfile;
  updatedAt: string;
};

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isStoragePayload = (value: unknown): value is RacePlannerStoragePayload => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.version === "number" &&
    typeof record.updatedAt === "string" &&
    "values" in record &&
    "elevationProfile" in record
  );
};

export const readRacePlannerStorage = <TValues, TProfile>():
  | RacePlannerStoragePayload<TValues, TProfile>
  | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(RACE_PLANNER_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoragePayload(parsed)) return null;
    return parsed as RacePlannerStoragePayload<TValues, TProfile>;
  } catch (error) {
    console.error("Unable to parse race planner storage", error);
    return null;
  }
};

export const writeRacePlannerStorage = <TValues, TProfile>(
  payload: RacePlannerStoragePayload<TValues, TProfile>
) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(RACE_PLANNER_STORAGE_KEY, JSON.stringify(payload));
};

export const clearRacePlannerStorage = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(RACE_PLANNER_STORAGE_KEY);
};
