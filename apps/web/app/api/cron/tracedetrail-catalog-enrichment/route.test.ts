import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const scheduledFormats = [
  { raceId: "703eaeb0-5ec5-4e3d-bd2b-939afe25ad17", format: "Trace des Maquisards — 100 km" },
  { raceId: "2883746f-099d-4a88-bda2-66cd513ceab6", format: "Trace des Maquisards — 65 km" },
  { raceId: "3a9b9aab-9784-45f8-acc6-5e4abc50c427", format: "Trace des Maquisards — 42 km" },
  { raceId: "9d4fb6cc-e6c9-4c43-b821-e78b5d5ba4ad", format: "Trace des Maquisards — 30 km" },
  { raceId: "eb91d0cd-493b-412e-94a9-499a7872697e", format: "Trace des Maquisards — 18 km" },
  { raceId: "dddc05d4-3ef9-4b53-952f-9ea6b791ce76", format: "Trace des Maquisards — 7 km" },
] as const;

describe("Trace de Trail catalog enrichment cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects requests without the Vercel cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("TRACEDETRAIL_ENRICHMENT_SECRET", "enrichment-secret");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://pace-yourself.com/api/cron/tracedetrail-catalog-enrichment")
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the authenticated internal service for the six reviewed 2027 formats", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("TRACEDETRAIL_ENRICHMENT_SECRET", "enrichment-secret");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: false,
          summary: { requested: 6, imported: 1, unchanged: 4, failed: 1 },
          results: [
            { raceId: scheduledFormats[0].raceId, status: "imported", storageVerified: true },
            { raceId: scheduledFormats[1].raceId, status: "error", code: "OFFICIAL_GPX_REQUIRED" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("https://pace-yourself.com/api/cron/tracedetrail-catalog-enrichment", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://pace-yourself.com/api/internal/race-catalog/tracedetrail/enrich"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer enrichment-secret" }),
        body: JSON.stringify({ raceIds: scheduledFormats.map(({ raceId }) => raceId) }),
      })
    );
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      summary: { requested: 6, imported: 1, unchanged: 4, failed: 1 },
      results: [
        {
          raceId: scheduledFormats[0].raceId,
          format: "Trace des Maquisards — 100 km",
          status: "imported",
        },
        {
          raceId: scheduledFormats[1].raceId,
          format: "Trace des Maquisards — 65 km",
          status: "error",
          code: "OFFICIAL_GPX_REQUIRED",
        },
      ],
    });
  });

  it("does not leak the enrichment secret when the internal service fails", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.stubEnv("TRACEDETRAIL_ENRICHMENT_SECRET", "enrichment-secret");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 })));

    const response = await GET(
      new Request("https://pace-yourself.com/api/cron/tracedetrail-catalog-enrichment", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );

    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("enrichment-secret");
  });
});
