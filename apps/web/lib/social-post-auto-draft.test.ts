import { describe, expect, it, vi } from "vitest";

import { createAutoDraftForRenderJob } from "./social-post-auto-draft";
import type { SocialPostRepository, SocialPostRow } from "./social-posts";

const content = {
  hook: "Prêt ?",
  script_segments: [{ highlight_id: "hl-intro", text: "Prêt ?" }],
  cta: "Lien en bio.",
  caption: "La SaintéLyon en 40 secondes.",
  hashtags: ["#saintelyon", "trail"],
  cover_text: "82 km de nuit",
};
const job = {
  id: "44444444-4444-4444-8444-444444444444",
  race_id: "33333333-3333-4333-8333-333333333333",
  race_title: "SaintéLyon",
  content,
  created_by: "55555555-5555-4555-8555-555555555555",
  auto_draft: true,
};
const postRow = { id: "p1", video_job_id: job.id, auto_generated: true } as unknown as SocialPostRow;
const config = { supabaseUrl: "https://db.example", supabaseServiceRoleKey: "service-key" };

const repository = (overrides: Partial<SocialPostRepository> = {}) => ({
  findAutoDraft: vi.fn().mockResolvedValue(null),
  insert: vi.fn().mockResolvedValue(postRow),
  ...overrides,
}) as unknown as SocialPostRepository & { findAutoDraft: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };

describe("createAutoDraftForRenderJob", () => {
  it("inserts one draft pre-filled from the reel content, owned by the job creator", async () => {
    const repo = repository();
    const result = await createAutoDraftForRenderJob(config, job, repo);
    expect(result).toEqual({ post: postRow, created: true });
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.insert.mock.calls[0][0]).toMatchObject({
      race_id: job.race_id,
      video_job_id: job.id,
      status: "draft",
      caption: content.caption,
      hashtags: ["saintelyon", "trail"],
      cover_text: "82 km de nuit",
      content,
      video_url: `jobs/${job.id}/reel.mp4`,
      created_by: job.created_by,
      auto_generated: true,
    });
    // Never scheduled nor published: no date, no status other than draft.
    expect(repo.insert.mock.calls[0][0]).not.toHaveProperty("scheduled_at");
  });

  it("does nothing without the flag or without content", async () => {
    const repo = repository();
    expect(await createAutoDraftForRenderJob(config, { ...job, auto_draft: false }, repo)).toBeNull();
    expect(await createAutoDraftForRenderJob(config, { ...job, content: null }, repo)).toBeNull();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("is idempotent: an existing automatic draft is returned, nothing is inserted", async () => {
    const repo = repository({ findAutoDraft: vi.fn().mockResolvedValue(postRow) });
    expect(await createAutoDraftForRenderJob(config, job, repo)).toEqual({ post: postRow, created: false });
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it("treats a lost race on the unique index as success, and rethrows other failures", async () => {
    const raced = repository({
      findAutoDraft: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(postRow),
      insert: vi.fn().mockRejectedValue(new Error("Unable to create social post (409).")),
    });
    expect(await createAutoDraftForRenderJob(config, job, raced)).toEqual({ post: postRow, created: false });

    const broken = repository({ insert: vi.fn().mockRejectedValue(new Error("Unable to create social post (500).")) });
    await expect(createAutoDraftForRenderJob(config, job, broken)).rejects.toThrow("(500)");
  });
});
