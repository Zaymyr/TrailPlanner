// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstagramPanel } from "./InstagramPanel";
import { buildStudioDraftRequest, pickStudioDraftSource } from "./studio-draft";

const JOB_ID = "44444444-4444-4444-8444-444444444444";

describe("pickStudioDraftSource", () => {
  const jobs = [
    { id: "other-race", raceId: "race-2", status: "done", finishedAt: "2026-11-23T10:00:00Z" },
    { id: "running", raceId: "race-1", status: "running" },
    { id: JOB_ID, raceId: "race-1", status: "done", finishedAt: "2026-11-22T10:00:00Z", post: { id: "post-1", status: "draft" } },
    { id: "older", raceId: "race-1", status: "done", finishedAt: "2026-11-20T10:00:00Z" },
  ];

  it("takes the newest finished render of the race, with its draft", () => {
    expect(pickStudioDraftSource(jobs, "race-1")).toEqual({ jobId: JOB_ID, finishedAt: "2026-11-22T10:00:00Z", post: { id: "post-1", status: "draft" } });
  });

  it("offers nothing without a race or without a finished render of it", () => {
    expect(pickStudioDraftSource(jobs, undefined)).toBeNull();
    expect(pickStudioDraftSource(jobs, "race-3")).toBeNull();
    expect(pickStudioDraftSource([{ id: "r", raceId: "race-1", status: "failed" }], "race-1")).toBeNull();
  });
});

describe("buildStudioDraftRequest", () => {
  it("builds the request of « Nouveau brouillon » from the panel text", () => {
    const result = buildStudioDraftRequest({ jobId: JOB_ID, caption: "  Le Grand Raid  ", hashtags: ["#trail", "trail", "ultra"], coverText: " Prêt ? " });
    expect(result).toEqual({ ok: true, body: { videoJobId: JOB_ID, caption: "Le Grand Raid", hashtags: ["#trail", "trail", "ultra"], coverText: "Prêt ?" } });
  });

  it("leaves the cover text out for a full reel and refuses an empty or too long text", () => {
    const full = buildStudioDraftRequest({ jobId: JOB_ID, caption: "Texte", hashtags: [] });
    expect(full.ok && "coverText" in full.body).toBe(false);
    expect(buildStudioDraftRequest({ jobId: JOB_ID, caption: "   ", hashtags: [] })).toEqual({ ok: false, message: "Écris d’abord la description." });
    expect(buildStudioDraftRequest({ jobId: JOB_ID, caption: "x".repeat(2_500), hashtags: [] }).ok).toBe(false);
    expect(buildStudioDraftRequest({ jobId: "not-an-id", caption: "Texte", hashtags: [] }).ok).toBe(false);
  });
});

describe("InstagramPanel draft button", () => {
  afterEach(() => vi.unstubAllGlobals());
  const panel = (draftSource: React.ComponentProps<typeof InstagramPanel>["draftSource"], onDraftCreated = vi.fn()) =>
    render(React.createElement(InstagramPanel, {
      caption: "Le Grand Raid",
      hashtags: ["trail"],
      onCaptionChange: vi.fn(),
      onHashtagsChange: vi.fn(),
      state: { status: "idle", message: null },
      accessToken: "token",
      draftSource,
      onDraftCreated,
    }));

  it("keeps « Copier » and explains the draft button when no render is finished", () => {
    panel(null);
    expect(screen.getByRole("button", { name: "Copier description + hashtags" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Créer un brouillon avec ce texte" })).toBeNull();
    expect(screen.getByText(/dès qu’un rendu terminé de cette course existe/)).toBeTruthy();
  });

  it("creates the draft through POST /api/admin/social-posts and links it", async () => {
    const fetcher = vi.fn(async () => Response.json({ post: { id: "post-9" } }, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const onDraftCreated = vi.fn();
    panel({ jobId: JOB_ID, finishedAt: null, post: null }, onDraftCreated);
    fireEvent.click(screen.getByRole("button", { name: "Créer un brouillon avec ce texte" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Voir le brouillon →" }).getAttribute("href")).toBe("/admin/content/posts?post=post-9"));
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/social-posts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ videoJobId: JOB_ID, caption: "Le Grand Raid", hashtags: ["trail"] });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
    expect(onDraftCreated).toHaveBeenCalledTimes(1);
  });

  it("asks before a second draft of the same render and shows the server refusal", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    const fetcher = vi.fn(async () => Response.json({ message: "Cette vidéo n’est pas terminée." }, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    panel({ jobId: JOB_ID, finishedAt: null, post: { id: "post-1", status: "draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer un brouillon avec ce texte" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Créer un brouillon avec ce texte" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Cette vidéo n’est pas terminée."));
  });
});
