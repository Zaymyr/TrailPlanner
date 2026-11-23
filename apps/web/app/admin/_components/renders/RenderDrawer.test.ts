// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AdminRenderEntry } from "../../../../lib/admin-renders";
import { RenderDrawer } from "./RenderDrawer";

// The shared UI primitives are written for the automatic JSX runtime of Next; vitest compiles them with the classic one.
(globalThis as { React?: typeof React }).React = React;

const NOW = Date.parse("2026-11-23T12:00:00Z");
const entry = (patch: Partial<AdminRenderEntry> = {}): AdminRenderEntry => ({
  id: "11111111-1111-4111-8111-111111111111",
  source: "video",
  type: "auto",
  title: "SaintéLyon",
  status: "termine",
  stage: "Terminé",
  progress: 1,
  message: null,
  width: 1080,
  height: 1920,
  sizeBytes: 52_428_800,
  slideCount: null,
  autoDraft: true,
  createdAt: "2026-11-23T11:00:00Z",
  startedAt: "2026-11-23T11:02:00Z",
  finishedAt: "2026-11-23T11:08:00Z",
  origin: { label: "Élément du plan · 5 déc.", href: "/admin/content/posts?element=item-1" },
  post: { label: "Reel · brouillon", href: "/admin/content/posts?post=post-1", status: "draft" },
  downloadUrl: "https://storage.example/reel.mp4",
  canDelete: true,
  ...patch,
});

const drawer = (props: Partial<React.ComponentProps<typeof RenderDrawer>> = {}) =>
  render(React.createElement(RenderDrawer, {
    accessToken: "token",
    entry: entry(),
    missing: false,
    nowMs: NOW,
    downloadsAvailable: true,
    onClose: vi.fn(),
    onDeleted: vi.fn(),
    ...props,
  }));

describe("RenderDrawer", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the status, the signed download and the links to the origin and the draft", () => {
    drawer();
    expect(screen.getByRole("dialog", { name: "SaintéLyon" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Télécharger le MP4" }).getAttribute("href")).toBe("https://storage.example/reel.mp4");
    expect(screen.getAllByRole("link", { name: /Élément du plan/ })[0].getAttribute("href")).toBe("/admin/content/posts?element=item-1");
    expect(screen.getAllByRole("link", { name: /Reel · brouillon/ })[0].getAttribute("href")).toBe("/admin/content/posts?post=post-1");
    expect(screen.getByText("Brouillon Instagram créé automatiquement à la fin du rendu.")).toBeTruthy();
    expect(screen.getByText("6 min 00 s · 8 min 00 s avec l’attente")).toBeTruthy();
  });

  it("confirms in the panel, then calls the existing DELETE route with the session token", async () => {
    const fetcher = vi.fn(async () => Response.json({ deleted: true, filesDeleted: false }));
    vi.stubGlobal("fetch", fetcher);
    const onDeleted = vi.fn();
    drawer({ onDeleted });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Confirmer la suppression" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("Rendu supprimé. Les fichiers seront effacés au bout de 30 jours."));
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/video-generator/render-jobs/11111111-1111-4111-8111-111111111111");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token");
  });

  it("keeps the panel open and shows the refusal when the route says no", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Ce rendu est en cours : attends sa fin pour le supprimer." }, { status: 409 })));
    const onDeleted = vi.fn();
    drawer({ onDeleted });
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    fireEvent.click(screen.getByRole("button", { name: "Supprimer définitivement" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("attends sa fin"));
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("offers no deletion for an active render or a carousel, and explains a missing link", () => {
    drawer({ entry: entry({ status: "en_cours", stage: "Rendu vidéo · 42 %", progress: 0.42, canDelete: false, downloadUrl: null, finishedAt: null }) });
    expect(screen.queryByRole("button", { name: "Supprimer" })).toBeNull();
    expect(screen.getByRole("progressbar", { name: "Avancement du rendu" }).getAttribute("aria-valuenow")).toBe("42");
    cleanup();
    drawer({ entry: entry({ downloadUrl: null }), downloadsAvailable: false });
    expect(screen.getByText(/Google Cloud n’est pas configuré/)).toBeTruthy();
  });

  it("says so when the URL names a render that does not exist", () => {
    drawer({ entry: null, missing: true });
    expect(screen.getByRole("dialog", { name: "Rendu introuvable" })).toBeTruthy();
  });
});
