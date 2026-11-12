import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: vi.fn(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabaseServiceRoleKey: "service-key",
  })),
}));

vi.mock("../../../../../../lib/tracedetrail-gpx-enrichment", () => {
  class TraceDeTrailEnrichmentError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number
    ) {
      super(message);
    }
  }
  return {
    enrichExistingRaceWithTraceDeTrailGpx: vi.fn(),
    TraceDeTrailEnrichmentError,
  };
});

import {
  enrichExistingRaceWithTraceDeTrailGpx,
  TraceDeTrailEnrichmentError,
} from "../../../../../../lib/tracedetrail-gpx-enrichment";
import { POST } from "./route";

const firstRaceId = "11111111-1111-4111-8111-111111111111";
const secondRaceId = "22222222-2222-4222-8222-222222222222";
const mockedEnrich = vi.mocked(enrichExistingRaceWithTraceDeTrailGpx);

describe("Trace de Trail server-to-server enrichment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TRACEDETRAIL_ENRICHMENT_SECRET", "dedicated-secret");
    vi.stubEnv("TRACEDETRAIL_LOGIN", "");
    vi.stubEnv("TRACEDETRAIL_PASSWORD", "");
  });

  it("rejects requests that do not carry the dedicated bearer secret", async () => {
    const response = await POST(
      new Request("http://localhost/api/internal/race-catalog/tracedetrail/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ raceIds: [firstRaceId] }),
      })
    );

    expect(response.status).toBe(401);
    expect(mockedEnrich).not.toHaveBeenCalled();
  });

  it("returns an individual result for every race and keeps partial failures isolated", async () => {
    mockedEnrich
      .mockResolvedValueOnce({
        race: { id: firstRaceId } as never,
        enriched: true,
        unchanged: false,
        storageVerified: true,
        gpxAccessMode: "public",
      })
      .mockRejectedValueOnce(
        new TraceDeTrailEnrichmentError("PROVIDER_ERROR", "Fournisseur indisponible.", 502)
      );

    const response = await POST(
      new Request("http://localhost/api/internal/race-catalog/tracedetrail/enrich", {
        method: "POST",
        headers: {
          authorization: "Bearer dedicated-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ raceIds: [firstRaceId, secondRaceId] }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: false,
      summary: { requested: 2, imported: 1, unchanged: 0, failed: 1 },
      results: [
        {
          raceId: firstRaceId,
          ok: true,
          status: "imported",
          enriched: true,
          storageVerified: true,
        },
        { raceId: secondRaceId, ok: false, status: "error", code: "PROVIDER_ERROR" },
      ],
    });
    expect(mockedEnrich).toHaveBeenNthCalledWith(1, expect.objectContaining({ raceId: firstRaceId }));
    expect(mockedEnrich).toHaveBeenNthCalledWith(2, expect.objectContaining({ raceId: secondRaceId }));
  });
});
