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
