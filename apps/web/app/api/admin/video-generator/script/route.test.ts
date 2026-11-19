import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const state = vi.hoisted(() => ({
  isAdmin: true,
  parse: vi.fn(),
}));

const request = (body: unknown) => new NextRequest("http://localhost/api/admin/video-generator/script", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
  body: JSON.stringify(body),
});

const validBody = {
  race: { title: "SaintéLyon 2026", subtitle: null, distanceKm: 82, elevationGainM: 2_300, startDetail: "Lyon · 23:30" },
  targetSeconds: 60,
  beats: [
    { id: "intro", kind: "intro", title: "SaintéLyon", startKm: 0, endKm: 0, facts: [], services: [], cutoffTime: null, narration: "Brouillon." },
    { id: "climb-1", kind: "climb", title: "Montée", startKm: 10, endKm: 16, facts: ["6 km", "+600 m"], services: [], cutoffTime: null, narration: "Brouillon." },
  ],
};

describe("POST /api/admin/video-generator/script", () => {
  beforeEach(() => {
    state.isAdmin = true;
    state.parse.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("is reserved to admins", async () => {
    state.isAdmin = false;
    expect((await POST(request(validBody))).status).toBe(403);
    expect(state.parse).not.toHaveBeenCalled();
  });

  it("explains a missing Anthropic key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const response = await POST(request(validBody));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("asks Claude for structured narration and keeps only known beats", async () => {
    state.parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { beats: [
        { id: "intro", narration: " La SaintéLyon, 82 kilomètres de nuit. " },
        { id: "climb-1", narration: "Première montée : 600 mètres à gravir." },
        { id: "unknown", narration: "Inventé." },
      ] },
    });

    const response = await POST(request(validBody));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.beats).toEqual([
      { id: "intro", narration: "La SaintéLyon, 82 kilomètres de nuit." },
      { id: "climb-1", narration: "Première montée : 600 mètres à gravir." },
    ]);
    const params = state.parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.fallbacks).toBe("default");
    expect(params.messages[0].content).toMatch(/"maxWords": \d+/);
    expect(params.system).toMatch(/continu/);
  });

  it("passes the admin instructions first and uses the chosen storytelling style", async () => {
    state.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "intro", narration: "Allez !" }] } });
    const payload = await (await POST(request({ ...validBody, notes: " Bâtons interdits. ", style: "coach" }))).json();
    const params = state.parse.mock.calls[0][0];
    expect(params.messages[0].content).toContain("\"consignes\": \"Bâtons interdits.\"");
    expect(params.system).toMatch(/consignes .* passent avant toutes les autres règles/);
    expect(params.system).toMatch(/coach de trail/);
    expect(payload.style).toBe("coach");
  });

  it("picks a storytelling style at random when none is chosen, and reports it", async () => {
    state.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "intro", narration: "Allez !" }] } });
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
    const payload = await (await POST(request(validBody))).json();
    random.mockRestore();
    expect(payload.style).toBe("chambreur");
    expect(state.parse.mock.calls[0][0].system).toMatch(/chambreur qui charrie/);
    expect(state.parse.mock.calls[0][0].messages[0].content).not.toContain("consignes");
  });

  it("sizes the words to the target length at the voice's measured pace", async () => {
    state.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { beats: [] } });
    const legWords = (call: number) => {
      const input = JSON.parse(String(state.parse.mock.calls[call][0].messages[0].content).replace(/^[^{]*/, ""));
      return input.troncons[1].maxWords as number;
    };
    await POST(request({ ...validBody, targetSeconds: 20 }));
    await POST(request({ ...validBody, targetSeconds: 20, wordsPerSecond: 1.6 }));
    // 20 s minus 2 s of gaps, at 2.2 then 1.6 words per second, minus the intro's 18 words.
    expect(legWords(0)).toBe(22);
    expect(legWords(1)).toBe(11);
  });

  it("tells a highlights reel moment by moment, sized for 30-45 s, without inventing numbers", async () => {
    state.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { beats: [] } });
    const moment = (id: string, kind: string, startKm: number) => ({
      id, kind, title: id, startKm, endKm: startKm + 4, facts: ["4 km", "+300 m"], services: [], cutoffTime: null, narration: "Brouillon.",
    });
    const body = {
      ...validBody,
      mode: "highlights",
      targetSeconds: 40,
      beats: [
        validBody.beats[0],
        moment("hl-hardestClimb-100", "climb", 10),
        moment("hl-aid-x", "aid", 30),
        moment("hl-biggestDescent-400", "descent", 40),
        moment("hl-night-500", "night", 50),
        moment("hl-lastClimb-600", "climb", 60),
        { ...validBody.beats[0], id: "outro", kind: "outro" },
      ],
    };
    await POST(request(body));
    const params = state.parse.mock.calls[0][0];
    const input = JSON.parse(String(params.messages[0].content).replace(/^[^{]*/, ""));
    const words = input.troncons.map((troncon: { maxWords: number }) => troncon.maxWords);
    // 40 s minus 6 transits of 1.2 s and 4.5 s of silences, at 2.2 words/s, minus 18 fixed words.
    expect(words).toEqual([10, 8, 8, 8, 8, 8, 8]);
    const spokenSeconds = words.reduce((sum: number, value: number) => sum + value, 0) / 2.2;
    expect(spokenSeconds + 6 * 1.2 + 4.5).toBeLessThanOrEqual(45);
    expect(params.system).toMatch(/temps forts/);
    expect(params.system).toMatch(/n'invente rien/);
    expect(params.system).toMatch(/ne cite aucun chiffre absent/);
    expect(params.system).not.toMatch(/tronçons consécutifs/);
    // The hook: first sentence a question or a strong statement, 12 words at most, no new figure.
    expect(params.system).toMatch(/question ou une affirmation forte de 12 mots au plus, sans aucun chiffre absent de course/);
    expect(params.system).not.toMatch(/accroche en une phrase avec la distance et le dénivelé/);
  });

  it("sends back the legs over their word budget once, and tells when the camera reaches a station", async () => {
    const long = Array.from({ length: 60 }, () => "bla").join(" ");
    state.parse
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "intro", narration: "Allez !" }, { id: "climb-1", narration: long }] } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "intro", narration: "Allez !" }, { id: "climb-1", narration: "Ça grimpe." }] } });
    const body = {
      ...validBody,
      beats: [validBody.beats[0], { ...validBody.beats[1], passages: [{ name: "Saint-Genou", km: 13, moment: 0.42 }] }],
    };

    const payload = await (await POST(request(body))).json();

    expect(payload.beats[1].narration).toBe("Ça grimpe.");
    expect(state.parse).toHaveBeenCalledTimes(2);
    expect(state.parse.mock.calls[0][0].messages[0].content).toContain("\"momentDuTroncon\": \"42 %\"");
    const revision = state.parse.mock.calls[1][0];
    expect(revision.messages).toHaveLength(3);
    expect(revision.messages[2].content).toMatch(/climb-1 \(60 mots, max \d+\)/);
    expect(revision.output_config.effort).toBe("low");
  });

  it("keeps the draft when the revision fails", async () => {
    const long = Array.from({ length: 60 }, () => "bla").join(" ");
    state.parse
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "climb-1", narration: long }] } })
      .mockRejectedValueOnce(new Error("overloaded"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect((await response.json()).beats[0].narration).toBe(long);
  });

  it("allows v3 performance tags only for the expressive voice", async () => {
    state.parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { beats: [{ id: "intro", narration: "[excited] Allez !" }] } });
    await POST(request(validBody));
    expect(state.parse.mock.calls[0][0].system).not.toContain("[excited]");
    await POST(request({ ...validBody, voiceModel: "v3" }));
    expect(state.parse.mock.calls[1][0].system).toContain("[excited]");
    expect(state.parse.mock.calls[1][0].system).toMatch(/télécharger l.appli/);
  });

  it("leaves room for thinking and explains a script cut short", async () => {
    state.parse.mockRejectedValue(new Error("Failed to parse structured output: SyntaxError: Unterminated string in JSON"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(502);
    expect((await response.json()).message).toMatch(/coupé/);
    expect(state.parse.mock.calls[0][0].max_tokens).toBeGreaterThanOrEqual(16_000);
  });

  it("reports a refusal instead of returning an empty script", async () => {
    state.parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect((await POST(request(validBody))).status).toBe(502);
  });

  it("rejects an invalid payload", async () => {
    expect((await POST(request({ beats: [] }))).status).toBe(400);
  });
});

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
vi.mock("../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve({ id: "99999999-9999-4999-8999-999999999999" }),
  isAdminUser: () => state.isAdmin,
}));
