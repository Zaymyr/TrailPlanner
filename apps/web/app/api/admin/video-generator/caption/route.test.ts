import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const state = vi.hoisted(() => ({
  isAdmin: true,
  parse: vi.fn(),
}));

const request = (body: unknown) => new NextRequest("http://localhost/api/admin/video-generator/caption", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer admin-token" },
  body: JSON.stringify(body),
});

const validBody = {
  race: { title: "Trail des Druides 2026", subtitle: null, distanceKm: 40, elevationGainM: 900, startDetail: "Musée de Bibracte · 15 mai · 8:00", raceDate: "2026-05-15" },
  legs: [
    { kind: "start", title: "Musée de Bibracte", facts: ["8 km"], narration: "On part du Musée de Bibracte." },
    { kind: "climb", title: "Mont Beuvray", facts: ["6,7 km", "+465 m"], narration: "Et là, ça grimpe." },
  ],
};

describe("POST /api/admin/video-generator/caption", () => {
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

  it("returns a story caption and clean, unique hashtags", async () => {
    state.parse.mockResolvedValue({
      stop_reason: "end_turn",
      parsed_output: { caption: " ⛰️ 40 bornes autour de Bibracte… ", hashtags: ["#Trail", "trail", "Trail des Druides", "Bourgogne-Franche-Comté", "paceyourself"] },
    });
    const response = await POST(request(validBody));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.caption).toBe("⛰️ 40 bornes autour de Bibracte…");
    expect(payload.hashtags).toEqual(["trail", "traildesdruides", "bourgognefranchecomte", "paceyourself"]);
    const params = state.parse.mock.calls[0][0];
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.max_tokens).toBeGreaterThanOrEqual(16_000);
    expect(params.system).toMatch(/lien en bio/);
  });

  it("rejects an invalid payload", async () => {
    expect((await POST(request({ legs: [] }))).status).toBe(400);
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
