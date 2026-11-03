import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const authState = vi.hoisted(() => ({ isAdmin: true }));

const request = (body: unknown, withToken = true) => new NextRequest("http://localhost/api/admin/video-generator/voice", {
  method: "POST",
  headers: { "content-type": "application/json", ...(withToken ? { authorization: "Bearer admin-token" } : {}) },
  body: JSON.stringify(body),
});

const items = [{ id: "intro", text: "SaintéLyon 2026." }, { id: "finish", text: "Dernier effort." }];

describe("POST /api/admin/video-generator/voice", () => {
  beforeEach(() => {
    authState.isAdmin = true;
    vi.stubEnv("ELEVENLABS_API_KEY", "eleven-key");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is reserved to admins", async () => {
    expect((await POST(request({ voiceId: null, items }, false))).status).toBe(401);
    authState.isAdmin = false;
    expect((await POST(request({ voiceId: null, items }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains a missing ElevenLabs key instead of failing silently", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    const response = await POST(request({ voiceId: null, items }));
    expect(response.status).toBe(503);
    expect((await response.json()).message).toMatch(/ELEVENLABS_API_KEY/);
  });

  it("returns one clip per sentence with its spoken duration and neighbouring context", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(Response.json({ audio_base64: "AAA", alignment: { character_end_times_seconds: [0.4, 1.2] } }))
      .mockResolvedValueOnce(Response.json({ audio_base64: "BBB", alignment: { character_end_times_seconds: [0.9] } }));

    const response = await POST(request({ voiceId: "abcdefghij1234567890", items }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.clips).toEqual([
      { id: "intro", text: "SaintéLyon 2026.", audioBase64: "AAA", durationMs: 1_350 },
      { id: "finish", text: "Dernier effort.", audioBase64: "BBB", durationMs: 1_050 },
    ]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/v1/text-to-speech/abcdefghij1234567890/with-timestamps");
    expect(JSON.parse(String(init?.body))).toMatchObject({ text: "SaintéLyon 2026.", next_text: "Dernier effort." });
  });

  it("turns ElevenLabs plan and key errors into actionable messages", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ detail: { code: "paid_plan_required", status: "payment_required" } }), { status: 402 }));
    const planResponse = await POST(request({ voiceId: null, items }));
    expect(planResponse.status).toBe(400);
    expect((await planResponse.json()).message).toMatch(/plan gratuit/);

    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ detail: { code: "invalid_api_key", status: "api_key_id_used_as_api_key" } }), { status: 400 }));
    expect((await (await POST(request({ voiceId: null, items }))).json()).message).toMatch(/sk_/);
  });

  it("retries a sentence when the plan's parallel request limit is reached", async () => {
    vi.useFakeTimers();
    const busy = () => new Response(JSON.stringify({ detail: { code: "concurrent_limit_exceeded", status: "too_many_concurrent_requests" } }), { status: 429 });
    vi.mocked(fetch)
      .mockResolvedValueOnce(busy())
      .mockImplementation(async () => Response.json({ audio_base64: "AAA", alignment: { character_end_times_seconds: [1] } }));

    const pending = POST(request({ voiceId: null, items }));
    await vi.runAllTimersAsync();
    const response = await pending;
    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect((await response.json()).clips).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("rejects an invalid voice id before calling ElevenLabs", async () => {
    const response = await POST(request({ voiceId: "../../admin", items }));
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
});

vi.mock("../../../../../lib/http", () => ({ withSecurityHeaders: (response: Response) => response }));
vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://supabase.example", supabaseAnonKey: "anon-key" }),
  extractBearerToken: (header: string | null) => header?.replace(/^Bearer\s+/i, "") ?? null,
  fetchSupabaseUser: () => Promise.resolve({ id: "99999999-9999-4999-8999-999999999999" }),
  isAdminUser: () => authState.isAdmin,
}));
