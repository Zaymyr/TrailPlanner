import { describe, expect, it, vi } from "vitest";

import {
  buildFullCaption,
  canPublishNow,
  checkCaption,
  createSocialPostRepository,
  createSocialPostSchema,
  getLatestPublishTime,
  normalizeHashtags,
  parisLocalToUtc,
  parseHashtagInput,
  planEdit,
  planRetry,
  socialPostActionSchema,
  utcToParisLocal,
  validateSchedule,
} from "./social-posts";

describe("caption and hashtags", () => {
  it("normalizes hashtags like the caption generator", () => {
    expect(normalizeHashtags(["#Trail", "trail", "Ultra-Trail", "Écotrail", "x"])).toEqual(["trail", "ultratrail", "ecotrail"]);
    expect(parseHashtagInput("#trail, #TrailRunning  paceyourself")).toEqual(["trail", "trailrunning", "paceyourself"]);
  });

  it("appends the hashtags after a blank line", () => {
    expect(buildFullCaption("  Le parcours ", ["trail", "ultra"])).toBe("Le parcours\n\n#trail #ultra");
    expect(buildFullCaption("Le parcours", [])).toBe("Le parcours");
  });

  it("enforces 2,200 characters, 30 hashtags and 20 mentions", () => {
    expect(checkCaption("ok", ["trail"]).problems).toEqual([]);
    expect(checkCaption("a".repeat(2_195), ["trail"]).problems[0]).toContain("2200");
    const tags = Array.from({ length: 31 }, (_, index) => `tag${index}`);
    expect(checkCaption("texte", tags).problems[0]).toContain("30 hashtags");
    expect(checkCaption("texte #inline", tags.slice(0, 29)).hashtagCount).toBe(30);
    expect(checkCaption("texte #inline", tags.slice(0, 30)).problems).toHaveLength(1);
    const mentions = Array.from({ length: 21 }, (_, index) => `@user${index}`).join(" ");
    expect(checkCaption(mentions, []).problems[0]).toContain("20 mentions");
    expect(checkCaption("contact@pace-yourself.com", []).mentionCount).toBe(0);
  });

  it("rejects an over-limit draft at the API boundary", () => {
    const videoJobId = "33333333-3333-4333-8333-333333333333";
    expect(createSocialPostSchema.safeParse({ videoJobId, caption: "Le parcours", hashtags: ["#Trail"] })).toMatchObject({
      success: true,
      data: { hashtags: ["trail"] },
    });
    expect(createSocialPostSchema.safeParse({ videoJobId, caption: "a".repeat(2_190), hashtags: ["trailrunning"] }).success).toBe(false);
    expect(createSocialPostSchema.safeParse({ videoJobId: "nope", caption: "", hashtags: [] }).success).toBe(false);
  });
});

describe("Europe/Paris scheduling", () => {
  it("converts Paris wall time to UTC in winter and summer", () => {
    expect(parisLocalToUtc("2026-12-03T18:30")?.toISOString()).toBe("2026-12-03T17:30:00.000Z");
    expect(parisLocalToUtc("2027-07-14T09:00")?.toISOString()).toBe("2027-07-14T07:00:00.000Z");
    expect(utcToParisLocal("2026-12-03T17:30:00.000Z")).toBe("2026-12-03T18:30");
    expect(utcToParisLocal("2027-07-14T07:00:00.000Z")).toBe("2027-07-14T09:00");
  });

  it("refuses a time skipped by the spring change and resolves the autumn one", () => {
    expect(parisLocalToUtc("2027-03-28T02:30")).toBeNull();
    expect(parisLocalToUtc("2027-10-31T02:30")?.toISOString()).toBe("2027-10-31T00:30:00.000Z");
    expect(parisLocalToUtc("2027-13-01T10:00")).toBeNull();
    expect(parisLocalToUtc("demain")).toBeNull();
  });

  it("accepts a future time before the video leaves storage", () => {
    const check = validateSchedule({ local: "2026-11-25T12:00", finishedAt: "2026-11-18T10:00:00Z", now: new Date("2026-11-19T10:00:00Z") });
    expect(check).toEqual({ ok: true, scheduledAt: new Date("2026-11-25T11:00:00Z") });
  });

  it("refuses the past and anything beyond the 30-day storage lifetime minus 24 h", () => {
    const now = new Date("2026-11-19T10:00:00Z");
    expect(validateSchedule({ local: "2026-11-19T10:00", finishedAt: "2026-11-18T10:00:00Z", now }).ok).toBe(false);
    expect(getLatestPublishTime("2026-11-18T10:00:00Z").toISOString()).toBe("2026-12-17T10:00:00.000Z");
    expect(validateSchedule({ local: "2026-12-17T11:00", finishedAt: "2026-11-18T10:00:00Z", now }).ok).toBe(true);
    const late = validateSchedule({ local: "2026-12-17T11:01", finishedAt: "2026-11-18T10:00:00Z", now });
    expect(late.ok).toBe(false);
    expect(late.ok ? "" : late.message).toContain("supprimée du stockage");
    expect(validateSchedule({ local: "2026-11-25T12:00", finishedAt: null, now }).ok).toBe(false);
  });

  it("allows publishing now only while the video stays available", () => {
    expect(canPublishNow("2026-11-18T10:00:00Z", new Date("2026-11-19T10:00:00Z"))).toBe(true);
    expect(canPublishNow("2026-10-19T10:00:00Z", new Date("2026-11-19T10:00:00Z"))).toBe(false);
    expect(canPublishNow(null)).toBe(false);
  });

  it("validates the action payloads", () => {
    expect(socialPostActionSchema.safeParse({ action: "schedule", scheduledAtLocal: "2026-11-25T12:00" }).success).toBe(true);
    expect(socialPostActionSchema.safeParse({ action: "schedule", scheduledAtLocal: "2026-11-25 12:00" }).success).toBe(false);
    expect(socialPostActionSchema.safeParse({ action: "publish" }).success).toBe(false);
  });
});

describe("social post repository", () => {
  const supabase = { supabaseUrl: "https://db.example.co", supabaseServiceRoleKey: "service" };

  it("claims the lease atomically with a status and expiry guard", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("[]", { status: 200 }));
    const result = await createSocialPostRepository(supabase, fetcher).claim(
      "11111111-1111-4111-8111-111111111111",
      new Date("2026-11-19T10:00:00Z"),
      new Date("2026-11-19T10:01:30Z"),
    );
    expect(result).toBeNull();
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toContain("social_posts?id=eq.11111111-1111-4111-8111-111111111111&status=eq.publishing&or=(locked_until.is.null,locked_until.lt.2026-11-19T10%3A00%3A00.000Z)");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ locked_until: "2026-11-19T10:01:30.000Z" });
  });

  it("promotes only due posts scheduled in the current mode and fails the others", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response("[]", { status: 200 }));
    await createSocialPostRepository(supabase, fetcher).promoteDue(new Date("2026-11-19T10:00:00Z"), false);
    const [promoteUrl, promoteInit] = fetcher.mock.calls[0];
    expect(promoteUrl).toContain("status=eq.scheduled&scheduled_at=lte.2026-11-19T10%3A00%3A00.000Z&dry_run=eq.false");
    const promoteBody = JSON.parse(promoteInit.body);
    expect(promoteBody).toMatchObject({ status: "publishing" });
    expect(promoteBody).not.toHaveProperty("dry_run");
    const [refuseUrl, refuseInit] = fetcher.mock.calls[1];
    expect(refuseUrl).toContain("&dry_run=eq.true");
    expect(JSON.parse(refuseInit.body)).toMatchObject({ status: "failed", error: "Programmée en simulation — reprogramme-la pour publier sur Instagram." });
  });
});

describe("starting over after a publish request", () => {
  const failed = {
    status: "failed" as const,
    publish_requested_at: "2026-11-19T09:00:00Z",
    ig_media_id: null,
    ig_container_id: "container-1",
    dry_run: false,
  };

  it("resumes a retry in the same mode without confirmation", () => {
    expect(planRetry(failed, false)).toEqual({ kind: "proceed", dropContainer: false });
  });

  it("requires a confirmation before dropping a requested container", () => {
    expect(planRetry(failed, true)).toEqual({ kind: "needs_confirmation" });
    expect(planRetry(failed, true, true)).toEqual({ kind: "proceed", dropContainer: true });
    expect(planRetry(failed, false, true)).toEqual({ kind: "proceed", dropContainer: true });
    expect(planEdit(failed)).toEqual({ kind: "needs_confirmation" });
    expect(planEdit(failed, true)).toEqual({ kind: "proceed", dropContainer: true });
  });

  it("needs no confirmation when nothing reached Meta", () => {
    expect(planRetry({ ...failed, publish_requested_at: null }, true)).toEqual({ kind: "proceed", dropContainer: true });
    expect(planRetry({ ...failed, dry_run: true }, false)).toEqual({ kind: "proceed", dropContainer: true });
    expect(planEdit({ ...failed, publish_requested_at: null })).toEqual({ kind: "proceed", dropContainer: true });
    expect(planEdit({ ...failed, status: "draft", ig_container_id: null })).toEqual({ kind: "proceed", dropContainer: false });
  });
});
