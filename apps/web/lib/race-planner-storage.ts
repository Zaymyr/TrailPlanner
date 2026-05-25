export const RACE_PLANNER_STORAGE_KEY = "trailplanner.racePlannerState";
export const RACE_PLANNER_DRAFT_KEY_PREFIX = "pace-yourself:draft:";

export type RacePlannerStoragePayload<TValues = unknown, TProfile = unknown> = {
  version: number;
  values: TValues;
  elevationProfile: TProfile;
  updatedAt: string;
  planName?: string;
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

export const getRacePlannerDraftKey = (planId?: string | null) =>
  `${RACE_PLANNER_DRAFT_KEY_PREFIX}${planId?.trim() || "new"}`;

export const readRacePlannerDraft = <TValues, TProfile>(
  planId?: string | null
): RacePlannerStoragePayload<TValues, TProfile> | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(getRacePlannerDraftKey(planId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoragePayload(parsed)) return null;
    return parsed as RacePlannerStoragePayload<TValues, TProfile>;
  } catch (error) {
    console.error("Unable to parse race planner draft", error);
    return null;
  }
};

export const writeRacePlannerDraft = <TValues, TProfile>(
  planId: string | null | undefined,
  payload: RacePlannerStoragePayload<TValues, TProfile>
) => {
  if (!isBrowser()) return;

  window.localStorage.setItem(getRacePlannerDraftKey(planId), JSON.stringify(payload));
};

export const clearRacePlannerDraft = (planId?: string | null) => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(getRacePlannerDraftKey(planId));
};

export const clearRacePlannerStorage = () => {
  if (!isBrowser()) return;

  window.localStorage.removeItem(RACE_PLANNER_STORAGE_KEY);
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith(RACE_PLANNER_DRAFT_KEY_PREFIX))
    .forEach((key) => window.localStorage.removeItem(key));
};
