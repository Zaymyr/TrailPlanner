import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getTraceDeTrailRaceData } from "../../../../../lib/tracedetrail-race-import";

const protectedDownloadResponse = () =>
  new Response(
    JSON.stringify({
      success: 0,
      msg: "Connectez-vous pour télécharger ce fichier",
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );

describe("getTraceDeTrailRaceData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rebuilds an embedded GPX when authenticated and public downloads stay protected", async () => {
    const pageHtml = `
      <div id="traceNom">W100</div>
      <script>
        const trace = {
          geometry: '[{"lon":0,"lat":0,"x":0,"y":100},{"lon":1113.1949,"lat":0,"x":1.1,"y":120}]',
          dataPi: '[]'
        };
      </script>
    `;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === "https://tracedetrail.fr/fr/trace/316035") {
        return new Response(pageHtml, { status: 200, headers: { "content-type": "text/html" } });
      }
      if (url === "https://tracedetrail.fr/user/login") {
        return new Response(JSON.stringify({ success: 1 }), {
          status: 200,
          headers: { "content-type": "application/json", "set-cookie": "session=test; Path=/; HttpOnly" },
        });
      }
      if (url === "https://tracedetrail.fr/download/getFile/tracedetrail") {
        expect(init?.method).toBe("POST");
        return protectedDownloadResponse();
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await getTraceDeTrailRaceData("https://tracedetrail.fr/fr/trace/316035", {
      credentials: { login: "runner@example.com", password: "secret" },
    });

    expect(result.gpxAccessMode).toBe("embedded");
    expect(result.gpxContent).toContain("<gpx");
    expect(result.distanceKm).toBeGreaterThan(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).includes("/download/getFile/tracedetrail"))
    ).toHaveLength(2);
  });
});
