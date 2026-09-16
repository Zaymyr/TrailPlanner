import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildOrganizerAnalyticsWindow,
  getPostHogOrganizerAnalyticsConfig,
  loadPostHogOrganizerAnalytics,
  ORGANIZER_RACEBOOK_ANALYTICS_HOGQL,
  PostHogOrganizerAnalyticsError,
} from "./posthog-organizer-analytics";

const input = {
  eventId: "11111111-1111-4111-8111-111111111111",
  editionId: "22222222-2222-4222-8222-222222222222",
  editionStartDate: "2026-09-12",
  editionEndDate: "2026-09-13",
  raceIds: ["33333333-3333-4333-8333-333333333333"],
  selectedRaceId: null,
  dateFrom: "2026-08-17",
  dateTo: "2026-09-15",
};

const config = {
  apiKey: "secret-key",
  projectId: "176628",
  apiHost: "https://eu.posthog.com",
  endpointName: "organizer-racebook-analytics",
};

afterEach(() => vi.restoreAllMocks());

describe("PostHog organizer analytics client", () => {
  it("exports the complete named Endpoint query contract", () => {
    for (const variable of [
      "event_id",
      "edition_id",
      "edition_start_date",
      "edition_end_date",
      "race_ids_csv",
      "race_id",
      "date_from",
      "date_to",
    ]) {
      expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain(`{variables.${variable}}`);
    }
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("has(allowed_race_ids, toString(properties.race_id))");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("toDate(properties.race_date) >= toDate(edition_start_date)");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("toDate(properties.race_date) <= toDate(edition_end_date)");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("properties.$internal_or_test_user = true");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("event = 'racebook closed' AND properties.engaged = true");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).toContain("INTERVAL 1 DAY AS range_end_exclusive");
    expect(ORGANIZER_RACEBOOK_ANALYTICS_HOGQL).not.toContain("grouping(");
  });

  it("builds inclusive UTC date windows", () => {
    expect(buildOrganizerAnalyticsWindow("7d", new Date("2026-09-15T23:30:00Z"))).toEqual({
      from: "2026-09-09",
      to: "2026-09-15",
    });
  });

  it("requires a server-only API origin and credentials", () => {
    expect(() => getPostHogOrganizerAnalyticsConfig({
      POSTHOG_API_KEY: "secret",
      POSTHOG_PROJECT_ID: "176628",
      POSTHOG_API_HOST: "https://eu.posthog.com/api",
    } as NodeJS.ProcessEnv)).toThrow(PostHogOrganizerAnalyticsError);
  });

  it("accepts the existing server-only personal API key variable", () => {
    expect(getPostHogOrganizerAnalyticsConfig({
      POSTHOG_PERSONAL_API_KEY: "secret",
      POSTHOG_PROJECT_ID: "176628",
      POSTHOG_API_HOST: "https://eu.posthog.com",
    } as NodeJS.ProcessEnv)).toMatchObject({ apiKey: "secret", projectId: "176628" });
  });

  it("calls one named endpoint with bounded variables and maps its rows", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(Response.json({
      results: [
        { kind: "daily", date: "2026-09-14", unique_readers: 4, total_opens: 7, average_active_seconds: null, engagement_rate: null },
        { kind: "summary", date: null, unique_readers: 9, total_opens: 15, average_active_seconds: 82.4, engagement_rate: 0.625 },
      ],
      columns: ["kind", "date", "unique_readers", "total_opens", "average_active_seconds", "engagement_rate"],
      hasMore: false,
    }));

    const result = await loadPostHogOrganizerAnalytics(input, config);

    expect(result).toEqual({
      summary: { uniqueReaders: 9, totalOpens: 15, averageActiveSeconds: 82.4, engagementRate: 0.625 },
      daily: [{ date: "2026-09-14", uniqueReaders: 4, totalOpens: 7 }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://eu.posthog.com/api/environments/176628/endpoints/organizer-racebook-analytics/run");
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer secret-key" }));
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({
      refresh: "cache",
      variables: expect.objectContaining({
        event_id: input.eventId,
        edition_id: input.editionId,
        race_ids_csv: input.raceIds[0],
        race_id: "",
      }),
    }));
  });

  it("returns an empty payload without contacting PostHog when an edition has no formats", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    await expect(loadPostHogOrganizerAnalytics({ ...input, raceIds: [] }, config)).resolves.toEqual({
      summary: { uniqueReaders: 0, totalOpens: 0, averageActiveSeconds: null, engagementRate: null },
      daily: [],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps the positional rows returned by live SQL endpoints", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({
      results: [
        ["daily", "2026-09-14", 4, 7, null, null],
        ["summary", "", 9, 15, 82.4, 0.625],
      ],
      columns: ["kind", "date", "unique_readers", "total_opens", "average_active_seconds", "engagement_rate"],
    }));

    await expect(loadPostHogOrganizerAnalytics(input, config)).resolves.toEqual({
      summary: { uniqueReaders: 9, totalOpens: 15, averageActiveSeconds: 82.4, engagementRate: 0.625 },
      daily: [{ date: "2026-09-14", uniqueReaders: 4, totalOpens: 7 }],
    });
  });

  it("rejects malformed endpoint results", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(Response.json({ results: [{ kind: "summary" }] }));
    await expect(loadPostHogOrganizerAnalytics(input, config)).rejects.toMatchObject({ reason: "response" });
  });
});
