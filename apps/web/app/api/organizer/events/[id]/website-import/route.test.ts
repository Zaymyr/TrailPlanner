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

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.preview.source.provider).toBe("utmb");
    expect(payload.preview.races[0].suggestedTargetRaceId).toBe("22222222-2222-2222-2222-222222222222");
    expect(payload.preview.previewHash).toHaveLength(64);
  });

  it("analyzes and deletes temporary organizer documents", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("not a PDF", { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await POST(
      importRequest({
        action: "preview",
        url: "https://utmb.world/races/example",
        documents: [
          {
            path: "00000000-0000-0000-0000-000000000001/temporary-roadbook.pdf",
            fileName: "roadbook.pdf",
            mediaType: "application/pdf",
            sizeBytes: 9,
          },
        ],
      }),
      { params: { id: eventId } }
    );
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.preview.documents[0]).toMatchObject({ fileName: "roadbook.pdf", status: "rejected" });
    expect(
      vi.mocked(fetch).mock.calls.some(
        ([url, init]) =>
          String(url).includes("/storage/v1/object/organizer-imports/00000000-0000-0000-0000-000000000001/temporary-roadbook.pdf") &&
          init?.method === "DELETE"
      )
    ).toBe(true);
  });

  it("builds a signed document-only review against existing formats", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    const response = await POST(importRequest({
      action: "preview",
      url: "",
      documents: [{
        path: "00000000-0000-0000-0000-000000000001/roadbook.png",
        fileName: "roadbook.png",
        mediaType: "image/png",
        sizeBytes: 4,
      }],
    }), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status, JSON.stringify(payload)).toBe(200);
    expect(payload.preview.source.label).toBe("Documents fournis");
    expect(payload.preview.races[0]).toMatchObject({
      key: "existing:22222222-2222-2222-2222-222222222222",
      suggestedTargetRaceId: "22222222-2222-2222-2222-222222222222",
      canCreate: false,
    });
    expect(payload.preview.proposalSignature).toMatch(/^[a-f0-9]{64}$/);
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
    const eventContext = [
        {
          id: eventId,
          name: "Grand Trail",
          location: "Annecy",
          race_date: "2026-09-12",
          organizer_details: { officialWebsiteUrl: null },
          races: [],
        },
      ];
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse(eventContext));
    const previewResponse = await POST(importRequest({ action: "preview", url: "https://example.com/race" }), {
      params: { id: eventId },
    });
    const previewPayload = await previewResponse.json();
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse(eventContext));

    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: "0".repeat(64),
        proposalSnapshot: previewPayload.preview.proposalSnapshot,
        proposalSignature: previewPayload.preview.proposalSignature,
        selectedEventProposalIds: [],
        selectedEditionYear: "2026",
        raceSelections: [],
      }),
      { params: { id: eventId } }
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.message).toContain("revue");
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
        proposalSnapshot: previewPayload.preview.proposalSnapshot,
        proposalSignature: previewPayload.preview.proposalSignature,
        selectedEventProposalIds: [],
        eventRaceDate: "2026-09-20",
        selectedEditionYear: "2026",
        raceSelections: [],
      }),
      { params: { id: eventId } }
    );

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
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
      .mockResolvedValueOnce(buildJsonResponse([{ id: "44444444-4444-4444-4444-444444444444" }], { status: 201 }));

    const selectedProposalIds = previewPayload.preview.proposalSnapshot.proposals
      .filter((proposal: { scope: string; previewRaceKey: string | null }) =>
        proposal.scope === "format" && proposal.previewRaceKey === "race:0:grand-trail-42k"
      )
      .map((proposal: { id: string }) => proposal.id);

    const response = await POST(
      importRequest({
        action: "apply",
        url: "https://example.com/race",
        previewHash: previewPayload.preview.previewHash,
        proposalSnapshot: previewPayload.preview.proposalSnapshot,
        proposalSignature: previewPayload.preview.proposalSignature,
        selectedEventProposalIds: [],
        eventRaceDate: "2027-09-20",
        raceSelections: [
          {
            previewRaceKey: "race:0:grand-trail-42k",
            mode: "create",
            targetRaceId: null,
            selectedProposalIds,
          },
        ],
      }),
      { params: { id: eventId } }
    );

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const raceInsert = vi
      .mocked(fetch)
      .mock.calls.find(([url, init]) => String(url).endsWith("/rest/v1/races") && init?.method === "POST");
    expect(raceInsert).toBeDefined();
    expect(JSON.parse(String(raceInsert?.[1]?.body))).toMatchObject({
      edition_group_id: existingEditionGroupId,
      edition_id: "55555555-5555-5555-5555-555555555555",
      race_date: "2027-09-20",
      series_name: "Grand Trail 42K",
      is_live: true,
      gpx_storage_path: null,
    });
    expect(JSON.parse(String(raceInsert?.[1]?.body)).gpx_path).toMatch(/^organizer\/11111111-1111-1111-1111-111111111111\/.+\.gpx$/);
  });

  it("updates only explicitly selected fields from the signed review", async () => {
    const targetRaceId = "22222222-2222-2222-2222-222222222222";
    const editionId = "55555555-5555-5555-5555-555555555555";
    const eventContext = [{
      id: eventId,
      name: "Grand Trail",
      location: "Annecy",
      race_date: "2026-09-12",
      organizer_details: { officialWebsiteUrl: null },
      race_event_editions: [{
        id: editionId,
        edition_year: 2026,
        start_date: "2026-09-12",
        end_date: "2026-09-13",
        is_current: true,
      }],
      races: [{
        id: targetRaceId,
        edition_id: editionId,
        edition_group_id: "33333333-3333-3333-3333-333333333333",
        series_name: "42K",
        name: "Ancien nom",
        race_date: "2026-09-12",
        distance_km: 41,
        elevation_gain_m: 2200,
        elevation_loss_m: 2100,
        external_site_url: null,
        location_text: "Annecy",
        thumbnail_url: null,
        gpx_storage_path: null,
        organizer_details: null,
        is_live: false,
      }],
    }];

    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse(eventContext));
    const previewResponse = await POST(importRequest({ action: "preview", url: "https://example.com/race" }), {
      params: { id: eventId },
    });
    const previewPayload = await previewResponse.json();
    const distanceProposal = previewPayload.preview.proposalSnapshot.proposals.find(
      (proposal: { previewRaceKey: string | null; field: string }) =>
        proposal.previewRaceKey === "race:0:grand-trail-42k" && proposal.field === "distanceKm"
    );
    expect(distanceProposal).toBeDefined();

    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse(eventContext))
      .mockResolvedValueOnce(buildJsonResponse([{ id: editionId, start_date: "2026-09-12", end_date: "2026-09-13" }]))
      .mockResolvedValueOnce(buildJsonResponse(null));

    const response = await POST(importRequest({
      action: "apply",
      url: "https://example.com/race",
      previewHash: previewPayload.preview.previewHash,
      proposalSnapshot: previewPayload.preview.proposalSnapshot,
      proposalSignature: previewPayload.preview.proposalSignature,
      selectedEventProposalIds: [],
      eventRaceDate: "2026-09-12",
      raceSelections: [{
        previewRaceKey: "race:0:grand-trail-42k",
        mode: "update",
        targetRaceId,
        selectedProposalIds: [distanceProposal.id],
      }],
    }), { params: { id: eventId } });

    expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
    const racePatch = vi.mocked(fetch).mock.calls.find(
      ([url, init]) => String(url).includes(`/rest/v1/races?id=eq.${targetRaceId}`) && init?.method === "PATCH"
    );
    expect(racePatch).toBeDefined();
    const body = JSON.parse(String(racePatch?.[1]?.body));
    expect(body).toEqual({ edition_id: editionId, distance_km: 42 });
  });
});

describe("/api/organizer/events/[id]/website-import two-pass workflow", () => {
  const editionId = "55555555-5555-5555-5555-555555555555";
  const raceId = "44444444-4444-4444-4444-444444444444";
  const sessionId = "66666666-6666-6666-6666-666666666666";

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
        logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
      },
      races: [{
        key: "race:42k",
        name: "42K",
        seriesName: "42K",
        raceDate: "2026-08-20",
        locationText: "Chamonix",
        distanceKm: 42,
        elevationGainM: 2400,
        elevationLossM: 2200,
        externalSiteUrl: "https://utmb.world/races/example/42k",
        thumbnailUrl: null,
        aidStations: [],
        gpxContent: null,
        gpxStorageLabel: null,
        hasReliableGpx: false,
        missingFields: [],
      }],
      missingFields: [],
      warnings: [],
      canApply: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an incomplete draft first, then completes it from signed field claims", async () => {
    let session: Record<string, unknown> | null = null;
    let race: Record<string, unknown> | null = null;
    let applyRpcBody: Record<string, unknown> | null = null;
    let sessionDeleted = false;
    const eventPayload = () => [{
      id: eventId,
      name: "Grand Trail",
      location: "Chamonix",
      race_date: "2026-08-20",
      organizer_details: {},
      race_event_editions: [{
        id: editionId,
        edition_year: 2026,
        start_date: "2026-08-20",
        end_date: "2026-08-20",
        is_current: true,
      }],
      races: race ? [race] : [],
    }];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/rest/v1/race_events?")) return buildJsonResponse(eventPayload());
      if (url.endsWith("/rest/v1/organizer_import_sessions") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        session = {
          id: sessionId,
          event_id: eventId,
          edition_id: editionId,
          created_by: "00000000-0000-0000-0000-000000000001",
          ...body,
          expires_at: String(body.expires_at).replace("Z", "+00:00"),
          created_at: "2026-08-24T12:00:00.123+00:00",
          updated_at: "2026-08-24T12:00:00.123+00:00",
        };
        return buildJsonResponse([session], { status: 201 });
      }
      if (url.includes("/rest/v1/organizer_import_sessions?") && (!init?.method || init.method === "GET")) {
        return buildJsonResponse(sessionDeleted || !session ? [] : [session]);
      }
      if (url.includes("/rest/v1/organizer_import_sessions?") && init?.method === "PATCH") {
        session = { ...session, ...JSON.parse(String(init.body)) };
        return buildJsonResponse([session]);
      }
      if (url.includes("/rest/v1/organizer_import_sessions?") && init?.method === "DELETE") {
        sessionDeleted = true;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/rest/v1/rpc/confirm_organizer_import_formats")) {
        const body = JSON.parse(String(init?.body));
        const format = body.p_formats[0];
        race = {
          id: raceId,
          edition_id: editionId,
          edition_group_id: raceId,
          series_name: format.name,
          name: format.name,
          race_date: "2026-08-20",
          distance_km: 0,
          elevation_gain_m: 0,
          elevation_loss_m: null,
          external_site_url: null,
          location_text: null,
          thumbnail_url: null,
          gpx_storage_path: null,
          organizer_details: {},
          is_live: false,
          data_status: "draft",
          missing_required_fields: ["distance_km", "elevation_gain_m"],
        };
        const confirmedFormat = {
          formatKey: format.formatKey,
          candidateKeys: format.candidateKeys,
          raceId,
          name: format.name,
          mode: format.mode,
          dataStatus: "draft",
          missingRequiredFields: ["distance_km", "elevation_gain_m"],
        };
        session = { ...session, status: "formats_confirmed", confirmed_formats: [confirmedFormat] };
        return buildJsonResponse({
          sessionId,
          formats: [confirmedFormat],
          createdCount: 1,
          boundExistingCount: 0,
        });
      }
      if (url.endsWith("/rest/v1/rpc/apply_organizer_import_field_patches")) {
        applyRpcBody = JSON.parse(String(init?.body));
        return buildJsonResponse({
          sessionId,
          formatsUpdated: 1,
          draftsRemaining: 0,
          formatsCompleted: 1,
        });
      }
      throw new Error(`Unexpected fetch: ${init?.method ?? "GET"} ${url}`);
    });

    const discoveryResponse = await POST(importRequest({
      action: "discover-formats",
      editionId,
      url: "https://utmb.world/races/example",
      formatUrls: [],
      documents: [],
    }), { params: { id: eventId } });
    const discovery = await discoveryResponse.json();
    expect(discoveryResponse.status, JSON.stringify(discovery)).toBe(200);
    expect(discovery.workflow.candidates).toHaveLength(1);
    expect(discovery.workflow.candidates[0]).toMatchObject({
      candidateKey: "race:42k",
      completeness: { missingRequiredFields: [] },
    });

    const tamperedSnapshot = {
      ...discovery.workflow.discoverySnapshot,
      candidates: discovery.workflow.discoverySnapshot.candidates.map(
        (candidate: Record<string, unknown>) => ({ ...candidate, proposedName: "Format falsifié" })
      ),
    };
    const tamperedResponse = await POST(importRequest({
      action: "confirm-formats",
      sessionId,
      discoverySnapshot: tamperedSnapshot,
      discoverySignature: discovery.workflow.discoverySignature,
      confirmedFormats: [{ candidateKeys: ["race:42k"], mode: "create", name: "42K" }],
    }), { params: { id: eventId } });
    expect(tamperedResponse.status).toBe(409);
    expect(race).toBeNull();

    const confirmResponse = await POST(importRequest({
      action: "confirm-formats",
      sessionId,
      discoverySnapshot: discovery.workflow.discoverySnapshot,
      discoverySignature: discovery.workflow.discoverySignature,
      confirmedFormats: [{ candidateKeys: ["race:42k"], mode: "create", name: "42K" }],
    }), { params: { id: eventId } });
    const confirmed = await confirmResponse.json();
    expect(confirmResponse.status, JSON.stringify(confirmed)).toBe(200);
    expect(confirmed.workflow.confirmedFormats[0]).toMatchObject({
      raceId,
      dataStatus: "draft",
      missingRequiredFields: ["distance_km", "elevation_gain_m"],
    });

    const analyzeResponse = await POST(importRequest({
      action: "analyze-fields",
      sessionId,
    }), { params: { id: eventId } });
    const analysis = await analyzeResponse.json();
    expect(analyzeResponse.status, JSON.stringify(analysis)).toBe(200);
    const formatReport = analysis.workflow.formatReports[0];
    const distance = formatReport.resolutions.find((resolution: { field: string }) => resolution.field === "distanceKm");
    const elevation = formatReport.resolutions.find((resolution: { field: string }) => resolution.field === "elevationGainM");
    expect(distance).toMatchObject({ status: "safe", currentValue: null });
    expect(elevation).toMatchObject({ status: "safe", currentValue: null });

    const applyResponse = await POST(importRequest({
      action: "apply-fields",
      sessionId,
      fieldSnapshot: analysis.workflow.fieldSnapshot,
      fieldSignature: analysis.workflow.fieldSignature,
      selections: [
        { scope: "format", raceId, field: "distanceKm", decision: "claim", claimId: distance.claims[0].id },
        { scope: "format", raceId, field: "elevationGainM", decision: "claim", claimId: elevation.claims[0].id },
      ],
    }), { params: { id: eventId } });
    const applied = await applyResponse.json();
    expect(applyResponse.status, JSON.stringify(applied)).toBe(200);
    expect(applied.applied).toMatchObject({ formatsCompleted: 1, draftsRemaining: 0 });
    expect(applyRpcBody).toMatchObject({
      p_session_id: sessionId,
      p_race_patches: [{
        raceId,
        fields: { distanceKm: 42, elevationGainM: 2400 },
        missingRequiredFields: [],
      }],
    });
    expect(sessionDeleted).toBe(true);
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
    requireAdminAuth: () =>
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
