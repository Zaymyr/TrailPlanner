import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const state = vi.hoisted(() => ({
  gate: vi.fn(),
  parse: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {}
  class AuthenticationError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    static AuthenticationError = AuthenticationError;
    beta = { messages: { parse: state.parse } };
  }
  return { default: Anthropic };
});
vi.mock("../../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../../lib/video-render-api")>("../../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: state.gate };
});

const request = (body: unknown) => new NextRequest("http://localhost/api/admin/video-generator/content", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
  body: JSON.stringify(body),
});

const beat = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
  id, kind, title: id, startKm: 0, endKm: 0, facts: [], services: [], cutoffTime: null, narration: "Brouillon.", ...extra,
});

const validBody = {
  mode: "highlights",
  race: { title: "SaintéLyon 2026", subtitle: null, distanceKm: 82, elevationGainM: 2_300, startDetail: "Lyon · 23:30", raceDate: "2026-12-05" },
  targetSeconds: 40,
  shortName: "SaintéLyon",
  shockFigure: "82 km",
  aidStations: [{ name: "Saint-Étienne", km: 62.5, cutoffTime: "Dimanche 06h15" }],
  beats: [
    beat("hl-intro", "intro"),
    beat("hl-1", "climb", { title: "La grosse montée", startKm: 10, endKm: 16, facts: ["6 km", "+600 m"] }),
    beat("hl-outro", "outro"),
  ],
};

const TAGS = ["trail", "trailrunning", "ultratrail", "paceyourself", "saintelyon"];
const output = (patch: Record<string, unknown> = {}) => ({
  hook: "82 km, ça se prépare ?",
  script_segments: [
    { highlight_id: "hl-intro", text: "82 km, ça se prépare ?" },
    { highlight_id: "hl-1", text: "Au km 10, la grosse montée : 600 m, mode diesel." },
    { highlight_id: "hl-outro", text: "Plan de course prêt, lien en bio." },
  ],
  cta: "Plan de course prêt, lien en bio.",
  caption: "Une course de nuit exigeante 🌙\nTu pars sur quel rythme ?\nTon plan de course est prêt dans l’appli Pace Yourself, lien en bio 👆",
  hashtags: TAGS,
  cover_text: "82 km de nuit",
  ...patch,
});
const reply = (parsed_output: unknown) => ({ stop_reason: "end_turn", parsed_output });

describe("POST /api/admin/video-generator/content", () => {
  beforeEach(() => {
    state.parse.mockReset();
    state.gate.mockReset();
    state.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: {} } });
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is reserved to admins and calls nothing otherwise", async () => {
    state.gate.mockResolvedValue({ ok: false, response: Response.json({ message: "Not authorized." }, { status: 403 }) });
    expect((await POST(request(validBody))).status).toBe(403);
    expect(state.parse).not.toHaveBeenCalled();
  });

  it("explains a missing Anthropic key and rejects an invalid or full-mode payload", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await POST(request(validBody))).status).toBe(503);
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    expect((await POST(request({ beats: [] }))).status).toBe(400);
    expect((await POST(request({ ...validBody, mode: "full" }))).status).toBe(400);
    expect(state.parse).not.toHaveBeenCalled();
  });

  it("makes one structured call with the facts, and returns the content without warning", async () => {
    state.parse.mockResolvedValue(reply(output()));
    const response = await POST(request(validBody));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(state.parse).toHaveBeenCalledTimes(1);
    expect(payload.warnings).toEqual([]);
    expect(payload.content).toMatchObject({ hook: "82 km, ça se prépare ?", cover_text: "82 km de nuit" });
    expect(payload.content.hashtags).toEqual(TAGS);
    const params = state.parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.max_tokens).toBe(16_000);
    expect(params.messages[0].content).toContain("\"nomCourt\": \"SaintéLyon\"");
    expect(params.messages[0].content).toContain("\"chiffreChoc\": \"82 km\"");
    expect(params.messages[0].content).toContain("Dimanche 06h15");
    expect(params.system).toMatch(/RÈGLE ABSOLUE sur les chiffres/);
  });

  it("maps the segments to the beats sent: unknown ids dropped, each id once", async () => {
    state.parse.mockResolvedValue(reply(output({
      script_segments: [
        { highlight_id: "hl-intro", text: "82 km, ça se prépare ?" },
        { highlight_id: "hl-1", text: "La grosse montée, mode diesel." },
        { highlight_id: "hl-1", text: "Doublon." },
        { highlight_id: "inconnu", text: "Inventé." },
        { highlight_id: "hl-outro", text: "Plan de course prêt, lien en bio." },
      ],
    })));
    const payload = await (await POST(request(validBody))).json();
    expect(payload.content.script_segments).toEqual([
      { highlight_id: "hl-intro", text: "82 km, ça se prépare ?" },
      { highlight_id: "hl-1", text: "La grosse montée, mode diesel." },
      { highlight_id: "hl-outro", text: "Plan de course prêt, lien en bio." },
    ]);
    expect(payload.warnings).toEqual([]);
  });

  it("revises once when a limit is broken, and keeps the revision when it is valid", async () => {
    state.parse
      .mockResolvedValueOnce(reply(output({ cover_text: "un deux trois quatre cinq six sept huit" })))
      .mockResolvedValueOnce(reply(output({ cover_text: "82 km de nuit" })));
    const payload = await (await POST(request(validBody))).json();

    expect(state.parse).toHaveBeenCalledTimes(2);
    const revisionParams = state.parse.mock.calls[1][0];
    expect(revisionParams.output_config.effort).toBe("low");
    expect(revisionParams.messages.at(-1).content).toMatch(/couverture/);
    expect(payload.content.cover_text).toBe("82 km de nuit");
    expect(payload.warnings).toEqual([]);
  });

  it("revises a figure that is not in the data, then shows it as a warning when it stays", async () => {
    const invented = output({ caption: "Une course de 190 km ⛰️ Prépare ton plan de course (lien en bio) 👆" });
    state.parse.mockResolvedValue(reply(invented));
    const payload = await (await POST(request(validBody))).json();

    expect(state.parse).toHaveBeenCalledTimes(2);
    expect(state.parse.mock.calls[1][0].messages.at(-1).content).toContain("190");
    expect(payload.content.caption).toContain("190");
    expect(payload.warnings).toEqual([expect.objectContaining({ field: "caption", message: expect.stringContaining("190") })]);
  });

  it("keeps the draft and its warnings when the revision fails or is worse", async () => {
    state.parse
      .mockResolvedValueOnce(reply(output({ hashtags: ["trail", "ultra"] })))
      .mockRejectedValueOnce(new Error("boom"));
    const failed = await (await POST(request(validBody))).json();
    expect(failed.content.hashtags).toEqual(["trail", "ultra"]);
    expect(failed.warnings).toEqual([expect.objectContaining({ field: "hashtags" })]);

    state.parse.mockReset();
    state.parse
      .mockResolvedValueOnce(reply(output({ hashtags: ["trail", "ultra"] })))
      .mockResolvedValueOnce(reply(output({ hashtags: ["trail"], cover_text: "un deux trois quatre cinq six sept huit" })));
    const worse = await (await POST(request(validBody))).json();
    expect(worse.content.hashtags).toEqual(["trail", "ultra"]);
  });

  it("refuses when the model refuses", async () => {
    state.parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect((await POST(request(validBody))).status).toBe(502);
  });
});
