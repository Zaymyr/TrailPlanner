import type { CourseTerrainOverridesInput, OrganizerCourseTerrain } from "@trailplanner/shared";

export class OrganizerCourseTerrainError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
    this.name = "OrganizerCourseTerrainError";
  }
}

type FetchLike = typeof fetch;

const terrainUrl = (raceId: string) => `/api/organizer/races/${encodeURIComponent(raceId)}/terrain`;

const isOrganizerCourseTerrain = (value: unknown): value is OrganizerCourseTerrain => {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<OrganizerCourseTerrain>;
  return Boolean(payload.terrain && typeof payload.terrain === "object" && Array.isArray(payload.overrides) && Array.isArray(payload.osmSegments));
};

async function readTerrain(response: Response): Promise<OrganizerCourseTerrain> {
  const payload = (await response.json().catch(() => null)) as (OrganizerCourseTerrain & { message?: string }) | null;
  if (!response.ok || !isOrganizerCourseTerrain(payload)) {
    throw new OrganizerCourseTerrainError(
      (payload && typeof payload.message === "string" && payload.message) || "Terrain indisponible pour le moment.",
      response.status,
    );
  }
  return payload;
}

export async function fetchOrganizerCourseTerrain(
  raceId: string,
  headers: Record<string, string>,
  options: { signal?: AbortSignal; fetchImpl?: FetchLike } = {},
): Promise<OrganizerCourseTerrain> {
  const response = await (options.fetchImpl ?? fetch)(terrainUrl(raceId), { headers, cache: "no-store", signal: options.signal });
  return readTerrain(response);
}

export async function saveOrganizerCourseTerrainOverrides(
  raceId: string,
  input: CourseTerrainOverridesInput,
  headers: Record<string, string>,
  options: { fetchImpl?: FetchLike } = {},
): Promise<OrganizerCourseTerrain> {
  const response = await (options.fetchImpl ?? fetch)(terrainUrl(raceId), {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readTerrain(response);
}
