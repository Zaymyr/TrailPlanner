import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";

const organizerMocks = vi.hoisted(() => ({
  buildPreview: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const importRequest = (body: Record<string, unknown>) =>
  new NextRequest(`http://localhost/api/organizer/events/${eventId}/website-import`, {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

vi.mock("server-only", () => ({}));

describe("/api/organizer/events/[id]/website-import preview", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.buildPreview.mockResolvedValue({
      source: { provider: "utmb", url: "https://utmb.world/races/example", label: "UTMB" },
      event: {
        name: "Grand Trail",
        location: "Chamonix",
        raceDate: "2026-08-20",
        officialWebsiteUrl: "https://utmb.world/races/example",
        thumbnailUrl: null,
      },
      races: [
        {
          key: "race:42k",
          name: "42K",
          seriesName: "42K",
          raceDate: "2026-08-20",
          locationText: "Chamonix",
          distanceKm: 42,
          elevationGainM: 2400,
          elevationLossM: 2200,
          externalSiteUrl: "https://utmb.world/races/example",
          thumbnailUrl: null,
          aidStations: [],
          gpxContent: null,
          gpxStorageLabel: "utmb",
          hasReliableGpx: true,
          missingFields: [],
        },
      ],
      missingFields: [],
      warnings: [],
      canApply: true,
    });

    vi.mocked(fetch).mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Chamonix",
          race_date: "2026-08-20",
          organizer_details: { officialWebsiteUrl: null },
          races: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              edition_group_id: "33333333-3333-3333-3333-333333333333",
              series_name: "42K",
              name: "42K",
              race_date: "2026-08-20",
              distance_km: 42,
              elevation_gain_m: 2400,
              elevation_loss_m: 2200,
              external_site_url: null,
              location_text: "Chamonix",
              thumbnail_url: null,
              gpx_storage_path: null,
              is_live: false,
            },
          ],
        },
      ])
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a normalized preview with suggested target race ids", async () => {
    const response = await POST(importRequest({ action: "preview", url: "https://utmb.world/races/example" }), {
      params: { id: eventId },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.preview.source.provider).toBe("utmb");
    expect(payload.preview.races[0].suggestedTargetRaceId).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.preview.previewHash).toHaveLength(64);
  });
});

describe("/api/organizer/events/[id]/website-import apply", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.buildPreview.mockResolvedValue({
      source: { provider: "generic", url: "https://example.com/race", label: "Site detecte" },
      event: {
        name: "Grand Trail",
        location: "Annecy",
        raceDate: "2026-09-12",
        officialWebsiteUrl: "https://example.com/race",
        thumbnailUrl: null,
      },
      races: [
        {
          key: "race:0:grand-trail-42k",
          name: "Grand Trail 42K",
          seriesName: "42K",
          raceDate: "2026-09-12",
          locationText: "Annecy",
          distanceKm: 42,
          elevationGainM: 2500,
          elevationLossM: 2400,
          externalSiteUrl: "https://example.com/race/42k",
          thumbnailUrl: null,
          aidStations: [],
          gpxContent: null,
          gpxStorageLabel: null,
          hasReliableGpx: false,
          missingFields: [],
        },
      ],
      missingFields: [],
      warnings: [],
      canApply: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an invalid organizer-selected event date", async () => {
    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: "valid-looking-preview-hash",
        eventRaceDate: "2026-02-31",
        selectedEditionYear: "2026",
        raceSelections: [],
      }),
      { params: { id: eventId } }
    );

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects stale preview hashes", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      buildJsonResponse([
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          organizer_details: { officialWebsiteUrl: null },
          races: [],
        },
      ])
    );

    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: "stale-preview-hash-0001",
        selectedEditionYear: "2026",
        raceSelections: [],
      }),
      { params: { id: eventId } }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.message).toContain("preview");
  });

  it("applies an organizer-selected event date without changing the preview hash", async () => {
    const eventContext = [
      {
        id: eventId,
        name: "Grand Trail",
        location: "Annecy",
        race_date: "2026-09-12",
        organizer_details: { officialWebsiteUrl: null },
        race_event_editions: [{
          id: "55555555-5555-5555-5555-555555555555",
          edition_year: 2026,
          start_date: "2026-09-12",
          end_date: "2026-09-13",
          is_current: true,
        }],
        races: [],
      },
    ];
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse(eventContext));
    const previewResponse = await POST(importRequest({ action: "preview", url: "https://example.com/race" }), {
      params: { id: eventId },
    });
    const previewPayload = await previewResponse.json();

    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse(eventContext))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "55555555-5555-5555-5555-555555555555", start_date: "2026-09-20", end_date: "2026-09-20" }]))
      .mockResolvedValueOnce(buildJsonResponse(null));

    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: previewPayload.preview.previewHash,
        eventRaceDate: "2026-09-20",
        selectedEditionYear: "2026",
        raceSelections: [],
      }),
      { params: { id: eventId } }
    );

    expect(response.status).toBe(200);
    const editionPatch = vi
      .mocked(fetch)
      .mock.calls.find(([url, init]) => String(url).includes("/rest/v1/race_event_editions?") && init?.method === "PATCH");
    expect(editionPatch).toBeDefined();
    expect(JSON.parse(String(editionPatch?.[1]?.body))).toMatchObject({ start_date: "2026-09-20" });
  });

  it("creates a missing edition in the event year and reuses the existing format series", async () => {
    const existingEditionGroupId = "33333333-3333-3333-3333-333333333333";
    const eventContext = [
      {
        id: eventId,
        name: "Grand Trail",
        location: "Annecy",
        race_date: "2025-09-20",
        organizer_details: { officialWebsiteUrl: null },
        races: [
          {
            id: "22222222-2222-2222-2222-222222222222",
            edition_group_id: existingEditionGroupId,
            series_name: "42K",
            name: "Grand Trail 42K",
            race_date: "2025-09-12",
            distance_km: 42,
            elevation_gain_m: 2500,
            elevation_loss_m: 2400,
            external_site_url: null,
            location_text: "Annecy",
            thumbnail_url: null,
            gpx_storage_path: null,
            is_live: false,
          },
        ],
      },
    ];

    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse(eventContext));
    const previewResponse = await POST(importRequest({ action: "preview", url: "https://example.com/race" }), {
      params: { id: eventId },
    });
    const previewPayload = await previewResponse.json();
    expect(previewPayload.preview.races[0].suggestedTargetRaceId).toBeNull();

    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse(eventContext))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "55555555-5555-5555-5555-555555555555", start_date: "2027-09-20", end_date: "2027-09-20" }], { status: 201 }))
      .mockResolvedValueOnce(buildJsonResponse(null))
      .mockResolvedValueOnce(buildJsonResponse([{ id: "44444444-4444-4444-4444-444444444444" }], { status: 201 }));

    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: previewPayload.preview.previewHash,
        eventRaceDate: "2027-09-20",
        raceSelections: [
          {
            previewRaceKey: "race:0:grand-trail-42k",
            mode: "create",
            targetRaceId: null,
          },
        ],
      }),
      { params: { id: eventId } }
    );

    expect(response.status).toBe(200);
    const raceInsert = vi
      .mocked(fetch)
      .mock.calls.find(([url, init]) => String(url).endsWith("/rest/v1/races") && init?.method === "POST");
    expect(raceInsert).toBeDefined();
    expect(JSON.parse(String(raceInsert?.[1]?.body))).toMatchObject({
      edition_group_id: existingEditionGroupId,
      edition_id: "55555555-5555-5555-5555-555555555555",
      race_date: "2027-09-20",
      series_name: "42K",
      is_live: false,
      gpx_storage_path: null,
    });
    expect(JSON.parse(String(raceInsert?.[1]?.body)).gpx_path).toMatch(/^organizer\/11111111-1111-1111-1111-111111111111\/.+\.gpx$/);
  });
});

vi.mock("../../../../../../lib/http", () => ({
  checkRateLimitAsync: () => Promise.resolve({ allowed: true, remaining: 5 }),
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer-website-import", async () => {
  const original = await vi.importActual<typeof import("../../../../../../lib/organizer-website-import")>(
    "../../../../../../lib/organizer-website-import"
  );
  return {
    ...original,
    buildOrganizerWebsiteImportPreview: organizerMocks.buildPreview,
  };
});

vi.mock("../../../../../../lib/organizer", async () => {
  const { z } = await import("zod");
  return {
    buildSlug: (value: string) => `slug-${value}`,
    jsonError: (message: string, status: number) => Response.json({ message }, { status }),
    optionalTextOrNull: z.string().nullable().optional(),
    optionalUrlOrNull: z.string().nullable().optional(),
    requireEventOrganizer: () => Promise.resolve(true),
    requireOrganizerAuth: () =>
      Promise.resolve({
        user: { id: "00000000-0000-0000-0000-000000000001" },
        serviceConfig: {
          supabaseUrl: "https://supabase.example",
          supabaseServiceRoleKey: "service-key",
        },
      }),
    serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
      apikey: "service-key",
      Authorization: "Bearer service-key",
      ...(contentType ? { "Content-Type": contentType } : {}),
    }),
    uuidParamSchema: {
      safeParse: (params: { id?: string }) =>
        typeof params.id === "string" ? { success: true, data: { id: params.id } } : { success: false },
    },
  };
});
