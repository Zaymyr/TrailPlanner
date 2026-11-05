import { describe, expect, it, vi } from "vitest";

import { readNarration, readVideoRaceStats, saveNarration } from "./video-narrations";

const supabase = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };
const raceId = "33333333-3333-4333-8333-333333333333";
const clip = { beatId: "intro", text: "Allez !", audioBase64: "AAA", durationMs: 1_200 };

describe("saved narrations", () => {
  it("stores the clips in the private bucket, then upserts the row with their count", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    await saveNarration(supabase, raceId, "user-1", {
      settings: { durationMode: "auto" },
      narrationOverrides: { intro: "Allez !" },
      voice: { voiceId: null, model: "v3", expressiveness: 0.9 },
      clips: [clip],
    }, fetcher);

    const [uploadUrl, upload] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(uploadUrl).toBe(`https://db.example/storage/v1/object/video-narrations/${raceId}.json`);
    expect((upload.headers as Record<string, string>)["x-upsert"]).toBe("true");
    const [rowUrl, rowRequest] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(rowUrl).toContain("video_narrations?on_conflict=race_id");
    expect(JSON.parse(String(rowRequest.body))).toMatchObject({ race_id: raceId, clip_count: 1, updated_by: "user-1" });
  });

  it("keeps the saved clips on a text-only save", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    await saveNarration(supabase, raceId, "user-1", {
      settings: {}, narrationOverrides: {}, voice: { voiceId: null, model: "v3", expressiveness: 0.9 },
    }, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body))).not.toHaveProperty("clip_count");
  });

  it("restores the text even when the clips object is missing", async () => {
    const row = { race_id: raceId, settings: {}, narration_overrides: { intro: "Allez !" }, voice: { model: "v3" }, clip_count: 3, updated_at: "2026-11-05T10:00:00Z" };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([row]))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));
    const saved = await readNarration(supabase, raceId, fetcher);
    expect(saved).toMatchObject({ narrationOverrides: { intro: "Allez !" }, clips: [] });
    expect(await readNarration(supabase, raceId, vi.fn(async () => Response.json([])))).toBeNull();
  });

  it("counts finished videos and saved narrations per race", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([{ race_id: "a" }, { race_id: "a" }, { race_id: "b" }]))
      .mockResolvedValueOnce(Response.json([{ race_id: "a", clip_count: 0 }, { race_id: "c", clip_count: 12 }]));
    expect(await readVideoRaceStats(supabase, fetcher)).toEqual({
      a: { videos: 2, narration: true, voice: false },
      b: { videos: 1, narration: false, voice: false },
      c: { videos: 0, narration: true, voice: true },
    });
    expect(String(fetcher.mock.calls[0][0])).toContain("status=eq.done");
  });
});
