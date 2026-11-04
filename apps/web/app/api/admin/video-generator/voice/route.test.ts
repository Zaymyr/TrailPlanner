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
    expect(JSON.parse(String(init?.body))).toMatchObject({
      // The year is read in words; the clip keeps the digits for the subtitles.
      text: "SaintéLyon deux mille vingt-six.",
      next_text: "Dernier effort.",
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.4, style: 0.4, use_speaker_boost: true },
    });
  });

  it("uses the expressive v3 model and returns exact character timing when it matches the text", async () => {
    const text = "Allez !";
    vi.mocked(fetch).mockImplementation(async () => Response.json({
      audio_base64: "AAA",
      alignment: { character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] },
    }));
    const response = await POST(request({ voiceId: null, model: "v3", expressiveness: 0.9, items: [{ id: "intro", text }] }));
    const payload = await response.json();
    expect(payload.clips[0].characterEndMs).toEqual([100, 200, 300, 400, 500, 600, 700]);
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model_id: "eleven_v3", voice_settings: { stability: 0 } });
    expect(body.previous_text).toBeUndefined();
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

  it("adds a library voice with one request before going parallel, and retries while it is being added", async () => {
    vi.useFakeTimers();
    const adding = () => new Response(JSON.stringify({ detail: { type: "conflict", code: "already_running", status: "already_running" } }), { status: 409 });
    const inFlight: string[] = [];
    const firstSpoken = "SaintéLyon deux mille vingt-six.";
    let firstDone = false;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const text = JSON.parse(String(init?.body)).text as string;
      inFlight.push(text);
      // Nothing else may start while the first sentence (which adds the voice) is pending.
      if (!firstDone && text !== firstSpoken) throw new Error("parallel request before the voice was added");
      if (inFlight.filter((value) => value === text).length === 1 && text === items[1].text) return adding();
      if (text === firstSpoken) firstDone = true;
      return Response.json({ audio_base64: "AAA", alignment: { character_end_times_seconds: [1] } });
    });

    const pending = POST(request({ voiceId: "abcdefghij1234567890", items }));
    await vi.runAllTimersAsync();
    const response = await pending;
    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect((await response.json()).clips).toHaveLength(2);
    expect(inFlight).toEqual([firstSpoken, items[1].text, items[1].text]);
  });

  it("sends numbers and units in words to the voice, and times the original subtitles", async () => {
    const text = "Puis 6 km.";
    const spoken = "Puis six kilomètres.";
    vi.mocked(fetch).mockImplementation(async () => Response.json({
      audio_base64: "AAA",
      alignment: { character_end_times_seconds: [...spoken].map((_, index) => (index + 1) / 100) },
    }));

    const payload = await (await POST(request({ voiceId: null, items: [{ id: "leg", text }] }))).json();

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).text).toBe(spoken);
    expect(payload.clips[0].text).toBe(text);
    expect(payload.clips[0].characterEndMs).toHaveLength(text.length);
    expect(payload.clips[0].characterEndMs.at(-1)).toBe(200);
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
