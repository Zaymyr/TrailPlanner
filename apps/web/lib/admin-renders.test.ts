import { describe, expect, it } from "vitest";

import { publicationTargetHref } from "../app/admin/publications/publication-tabs";
import {
  buildRenderEntries,
  buildRendersPage,
  classifyVideoRender,
  countRenders,
  describeRenderDuration,
  filterRenderEntries,
  paginateRenders,
  readRendersQuery,
  renderPostHref,
  rendersPollInterval,
  writeRendersQuery,
  type AdminRenderEntry,
  type RenderSources,
  type VideoRenderRow,
} from "./admin-renders";

const NOW = Date.parse("2026-11-23T12:00:00Z");
const ago = (minutes: number) => new Date(NOW - minutes * 60_000).toISOString();

const video = (patch: Partial<VideoRenderRow> & { id: string }): VideoRenderRow => ({
  race_title: "Hivernale des Templiers",
  status: "done",
  progress: 1,
  message: null,
  created_at: ago(60),
  updated_at: ago(50),
  started_at: ago(58),
  finished_at: ago(50),
  race_id: "race-1",
  flyover_order_id: null,
  width: 1080,
  height: 1920,
  output_size_bytes: 52_428_800,
  auto_draft: false,
  ...patch,
});

const sources = (patch: Partial<RenderSources> = {}): RenderSources => ({
  videos: [],
  carousels: [],
  reelItems: [],
  carouselItems: [],
  posts: [],
  flyovers: [],
  ...patch,
});

describe("classifyVideoRender", () => {
  it("tells a flyover from its order, an automatic reel from its plan item, else a manual reel", () => {
    expect(classifyVideoRender({ flyoverOrderId: "order-1", planItem: false })).toBe("survol");
    expect(classifyVideoRender({ flyoverOrderId: "order-1", planItem: true })).toBe("survol");
    expect(classifyVideoRender({ flyoverOrderId: null, planItem: true })).toBe("auto");
    expect(classifyVideoRender({ flyoverOrderId: null, planItem: false })).toBe("manuel");
  });
});

describe("buildRenderEntries", () => {
  const entries = buildRenderEntries(sources({
    videos: [
      video({ id: "manual" }),
      video({ id: "auto", auto_draft: true, race_id: "race-2", race_title: "SaintéLyon" }),
      video({ id: "oneclick", auto_draft: true, race_id: "race-3" }),
      video({ id: "flyover", race_id: null, flyover_order_id: "order-1", race_title: "Trail du Mont" }),
      video({ id: "queued", status: "queued", progress: 0, started_at: null, finished_at: null }),
      video({ id: "uploading", status: "uploading", progress: 0, started_at: null, finished_at: null }),
      video({ id: "running", status: "running", progress: 0.42, finished_at: null }),
      video({ id: "failed", status: "failed", message: "Chrome a planté", finished_at: ago(55) }),
    ],
    carousels: [
      { id: "car-auto", series: "plan", title: "SaintéLyon", status: "done", slide_count: 4, message: null, created_at: ago(30), started_at: ago(29), finished_at: ago(28), race_id: null, auto_draft: true, created_by: null },
      { id: "car-manual", series: "week", title: "Semaine", status: "failed", slide_count: 2, message: "Polices", created_at: ago(20), started_at: null, finished_at: ago(19), race_id: null, auto_draft: false, created_by: null },
    ],
    reelItems: [{ id: "item-1", render_job_id: "auto", social_post_id: "post-1", planned_publish_date: "2026-12-05" }],
    carouselItems: [{ id: "citem-1", carousel_job_id: "car-auto", social_post_id: null, planned_publish_date: "2026-12-02" }],
    posts: [
      { id: "post-1", video_job_id: "auto", carousel_job_id: null, status: "draft", media_type: "reel" },
      { id: "post-2", video_job_id: "manual", carousel_job_id: null, status: "published", media_type: "reel" },
      { id: "post-3", video_job_id: null, carousel_job_id: "car-auto", status: "scheduled", media_type: "carousel" },
    ],
    flyovers: [{ id: "order-1", race_name: "Trail du Mont", status: "ready" }],
  }));
  const byId = (id: string) => entries.find((entry) => entry.id === id) as AdminRenderEntry;

  it("deduces the type of each render from its columns and links", () => {
    expect(byId("manual").type).toBe("manuel");
    expect(byId("auto").type).toBe("auto");
    // A one-click reel has auto_draft but no plan item: it is launched by hand.
    expect(byId("oneclick").type).toBe("manuel");
    expect(byId("oneclick").autoDraft).toBe(true);
    expect(byId("flyover").type).toBe("survol");
    expect(byId("car-auto").type).toBe("carrousel");
    expect(byId("car-manual").type).toBe("carrousel");
  });

  it("normalises the statuses of both sources", () => {
    expect(["manual", "queued", "uploading", "running", "failed"].map((id) => byId(id).status)).toEqual(["termine", "en_attente", "en_attente", "en_cours", "echec"]);
    expect(byId("car-auto").status).toBe("termine");
    expect(byId("car-manual").status).toBe("echec");
  });

  it("links each render to its origin and to its post", () => {
    expect(byId("auto").origin).toEqual({ label: expect.stringContaining("Élément du plan"), href: "/admin/content/posts?element=item-1" });
    expect(byId("auto").post).toMatchObject({ href: "/admin/content/posts?post=post-1", status: "draft" });
    expect(byId("manual").origin).toEqual({ label: "Fiche de la course", href: "/admin/catalog/races?course=race-1" });
    expect(byId("manual").post?.href).toBe("/admin/content/posts?onglet=published&post=post-2");
    expect(byId("flyover").origin).toEqual({ label: "Commande de survol · Trail du Mont", href: "/admin/content/flyovers?commande=order-1" });
    expect(byId("car-auto").origin?.href).toBe("/admin/content/posts?onglet=carousels&element=citem-1");
    expect(byId("car-auto").post?.href).toBe("/admin/content/posts?onglet=carousels&post=post-3");
    expect(byId("car-manual").origin).toBeNull();
    expect(byId("queued").post).toBeNull();
  });

  it("keeps the stage line of the Publications screens and only deletes finished reels", () => {
    expect(byId("running").stage).toBe("Rendu vidéo · 42 %");
    expect(byId("failed").stage).toBe("Échec : Chrome a planté");
    expect(byId("failed").message).toBe("Chrome a planté");
    expect(byId("manual").message).toBeNull();
    expect(["manual", "failed"].every((id) => byId(id).canDelete)).toBe(true);
    expect(["running", "queued", "car-auto", "car-manual"].some((id) => byId(id).canDelete)).toBe(false);
    expect(byId("car-auto").slideCount).toBe(4);
    expect(byId("manual").sizeBytes).toBe(52_428_800);
  });

  it("agrees with the calendar on the console URL of a post", () => {
    const post = { id: "p1", status: "scheduled", media_type: "carousel" };
    expect(renderPostHref(post)).toBe(publicationTargetHref({ tab: "carousels", postId: "p1" }));
    expect(renderPostHref({ id: "p2", status: "published", media_type: "reel" })).toBe(publicationTargetHref({ tab: "published", postId: "p2" }));
    expect(renderPostHref({ id: "p3", status: "draft", media_type: "reel" })).toBe(publicationTargetHref({ tab: "reels", postId: "p3" }));
  });
});

describe("renders query", () => {
  it("reads the URL, ignoring unknown values, and writes it back without defaults", () => {
    const query = readRendersQuery(new URLSearchParams("periode=30j&type=auto,survol,inconnu&statut=echec&page=3&rendu=1f0e4a2c-aaaa-bbbb-cccc-123456789abc"));
    expect(query).toEqual({ period: "30j", types: ["auto", "survol"], statuses: ["echec"], page: 3, focusId: "1f0e4a2c-aaaa-bbbb-cccc-123456789abc" });
    expect(writeRendersQuery(query).toString()).toBe("periode=30j&type=auto%2Csurvol&statut=echec&page=3&rendu=1f0e4a2c-aaaa-bbbb-cccc-123456789abc");
    expect(readRendersQuery(new URLSearchParams("periode=jamais&page=-2&rendu=<script>"))).toEqual({ period: "7j", types: [], statuses: [], page: 1, focusId: null });
    expect(writeRendersQuery(readRendersQuery(new URLSearchParams())).toString()).toBe("");
  });
});

describe("filters, counts and paging", () => {
  const entries = buildRenderEntries(sources({
    videos: [
      video({ id: "recent-manual", created_at: ago(120) }),
      video({ id: "old-auto", created_at: ago(8 * 24 * 60), finished_at: ago(8 * 24 * 60 - 5) }),
      video({ id: "running", status: "running", progress: 0.1, created_at: ago(10), finished_at: null }),
      video({ id: "stuck-old-active", status: "running", progress: 0.1, created_at: ago(9 * 24 * 60), finished_at: null }),
      video({ id: "failed", status: "failed", message: "x", created_at: ago(300), finished_at: ago(290) }),
    ],
    carousels: [{ id: "car", series: "brief", title: "Brief", status: "done", slide_count: 3, message: null, created_at: ago(40), started_at: null, finished_at: ago(39), race_id: null, auto_draft: false, created_by: null }],
    reelItems: [{ id: "i", render_job_id: "old-auto", social_post_id: null, planned_publish_date: "2026-11-10" }],
  }));
  const base = { period: "7j" as const, types: [], statuses: [] };

  it("sorts active renders first, then newest, and keeps an old active render in any period", () => {
    expect(filterRenderEntries(entries, base, NOW).map((entry) => entry.id)).toEqual(["running", "stuck-old-active", "car", "recent-manual", "failed"]);
    expect(filterRenderEntries(entries, { ...base, period: "tout" }, NOW)).toHaveLength(6);
    expect(filterRenderEntries(entries, { ...base, period: "24h" }, NOW).map((entry) => entry.id)).toContain("failed");
  });

  it("filters by type and by status chip", () => {
    expect(filterRenderEntries(entries, { ...base, types: ["carrousel"] }, NOW).map((entry) => entry.id)).toEqual(["car"]);
    expect(filterRenderEntries(entries, { ...base, statuses: ["echec"] }, NOW).map((entry) => entry.id)).toEqual(["failed"]);
    expect(filterRenderEntries(entries, { ...base, statuses: ["actif"] }, NOW).map((entry) => entry.id)).toEqual(["running", "stuck-old-active"]);
    expect(filterRenderEntries(entries, { ...base, period: "tout", types: ["auto"] }, NOW).map((entry) => entry.id)).toEqual(["old-auto"]);
  });

  it("counts the period before the type and status filters", () => {
    expect(countRenders(entries.filter((entry) => entry.id !== "old-auto"))).toEqual({
      total: 5,
      byType: { manuel: 4, auto: 0, survol: 0, carrousel: 1 },
      byStatus: { actif: 2, termine: 2, echec: 1 },
    });
    const page = buildRendersPage(entries, { ...base, types: ["manuel"], focusId: "old-auto", page: 1 }, NOW);
    expect(page.counts.total).toBe(5);
    expect(page.activeCount).toBe(2);
    // The focused render is found even when the period hides it.
    expect(page.focus?.id).toBe("old-auto");
    expect(page.page.total).toBe(4);
  });

  it("pages the list and clamps a page out of range", () => {
    const items = Array.from({ length: 60 }, (_, index) => index);
    expect(paginateRenders(items, 1)).toMatchObject({ page: 1, pageCount: 3, total: 60 });
    expect(paginateRenders(items, 3).items).toHaveLength(10);
    expect(paginateRenders(items, 9)).toMatchObject({ page: 3 });
    expect(paginateRenders([], 4)).toMatchObject({ page: 1, pageCount: 1, items: [] });
  });
});

describe("refresh rhythm and durations", () => {
  it("refreshes every 5 s while a render is active and once a minute otherwise", () => {
    expect(rendersPollInterval(true)).toBe(5_000);
    expect(rendersPollInterval(false)).toBe(60_000);
  });

  it("shows the computing time of a finished render and the time so far of an active one", () => {
    expect(describeRenderDuration({ status: "termine", createdAt: ago(60), startedAt: ago(58), finishedAt: ago(52) }, NOW)).toBe("6 min 00 s");
    expect(describeRenderDuration({ status: "en_cours", createdAt: ago(10), startedAt: ago(4), finishedAt: null }, NOW)).toBe("4 min 00 s");
    expect(describeRenderDuration({ status: "en_attente", createdAt: ago(1), startedAt: null, finishedAt: null }, NOW)).toBe("1 min 00 s");
    expect(describeRenderDuration({ status: "echec", createdAt: ago(10), startedAt: null, finishedAt: null }, NOW)).toBeNull();
  });
});
