import { describe, expect, it, vi } from "vitest";

import { runFlyoverTick, type FlyoverDeps } from "./flyover-generation";
import { FLYOVER_MAX_ATTEMPTS, type FlyoverOrderRepository, type FlyoverOrderRow } from "./flyover-orders";

const NOW = new Date("2026-11-22T10:00:00Z");

const order = (patch: Partial<FlyoverOrderRow> = {}): FlyoverOrderRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  offer: "download",
  amount_cents: 5999,
  status: "paid",
  race_name: "Trail des Crêtes",
  race_date: null,
  contact_email: "orga@example.fr",
  instagram_handle: null,
  map_preset: "signature",
  story_mode: null,
  terrain_exaggeration: 1.8,
  publish_local: null,
  aid_stations: [],
  gpx_storage_path: "flyover/x.gpx",
  distance_km: 30,
  elevation_gain_m: 1200,
  elevation_loss_m: 1200,
  stripe_checkout_session_id: null,
  stripe_checkout_url: null,
  stripe_payment_intent_id: null,
  paid_at: "2026-11-22T09:00:00Z",
  work: null,
  attempts: 0,
  error: null,
  locked_until: null,
  render_job_id: null,
  social_post_id: null,
  ready_at: null,
  paid_email_sent_at: null,
  ready_email_sent_at: null,
  created_at: "2026-11-22T08:59:00Z",
  updated_at: "2026-11-22T09:00:00Z",
  ...patch,
});

/** In-memory repository applying the status filters the executor relies on. */
const memoryRepository = (rows: FlyoverOrderRow[]) => {
  const store = new Map(rows.map((row) => [row.id, { ...row }]));
  const matches = (row: FlyoverOrderRow, filter?: string) => {
    const status = filter?.match(/status=eq\.([a-z_]+)/)?.[1];
    return !status || row.status === status;
  };
  const repository: FlyoverOrderRepository = {
    get: async (id) => store.get(id) ?? null,
    insert: async () => { throw new Error("unused"); },
    update: async (id, patch, filter) => {
      const row = store.get(id);
      if (!row || !matches(row, filter)) return null;
      const next = { ...row, ...patch } as FlyoverOrderRow;
      store.set(id, next);
      return next;
    },
    listByStatus: async (statuses) => [...store.values()].filter((row) => statuses.includes(row.status)),
    findByPaymentIntent: async () => [],
    listReadyWithoutEmail: async () => [...store.values()].filter((row) => row.status === "ready" && !row.ready_email_sent_at),
  };
  return { store, repository };
};

const deps = (repository: FlyoverOrderRepository, patch: Partial<FlyoverDeps> = {}): FlyoverDeps => ({
  now: () => NOW,
  orders: repository,
  writeContent: vi.fn(async () => ({ content: { caption: "x" } })),
  startRender: vi.fn(async () => "22222222-2222-4222-8222-222222222222"),
  getRenderJob: vi.fn(async () => null),
  publishCollab: vi.fn(async () => ({ postId: "post-1", scheduled: true, message: null })),
  sendEmail: vi.fn(async () => true),
  orderUrl: (id) => `https://pace-yourself.com/survol/commande/${id}?t=x`,
  ...patch,
});

describe("runFlyoverTick", () => {
  it("writes the text of a paid order, then starts its render at the next tick", async () => {
    const { store, repository } = memoryRepository([order()]);
    const d = deps(repository);
    await runFlyoverTick(d);
    expect(store.get(order().id)?.status).toBe("scripted");
    expect(store.get(order().id)?.work).toEqual({ content: { caption: "x" } });
    await runFlyoverTick(d);
    expect(store.get(order().id)).toMatchObject({ status: "rendering", render_job_id: "22222222-2222-4222-8222-222222222222", locked_until: null });
  });

  it("skips an order whose lease is held by another tick", async () => {
    const { repository } = memoryRepository([order({ locked_until: "2026-11-22T10:05:00Z" })]);
    const d = deps(repository);
    const result = await runFlyoverTick(d);
    expect(result.step).toBeNull();
    expect(d.writeContent).not.toHaveBeenCalled();
  });

  it("retries a failed step, then fails the order and tells the team", async () => {
    const { store, repository } = memoryRepository([order({ attempts: FLYOVER_MAX_ATTEMPTS - 2 })]);
    const d = deps(repository, { writeContent: vi.fn(async () => { throw new Error("IA indisponible"); }) });
    await runFlyoverTick(d);
    expect(store.get(order().id)).toMatchObject({ status: "paid", attempts: FLYOVER_MAX_ATTEMPTS - 1, error: "IA indisponible" });
    await runFlyoverTick(d);
    expect(store.get(order().id)?.status).toBe("failed");
    expect(d.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `flyover/failed/${order().id}` }));
  });

  it("delivers a finished download order and emails the organizer once", async () => {
    const { store, repository } = memoryRepository([order({ status: "rendering", render_job_id: "job-1" })]);
    const d = deps(repository, {
      getRenderJob: vi.fn(async () => ({ id: "job-1", status: "done" as const, message: null, created_at: "", updated_at: "", finished_at: "2026-11-22T09:50:00Z", content: null })),
    });
    const result = await runFlyoverTick(d);
    expect(result.finished).toEqual([order().id]);
    expect(store.get(order().id)).toMatchObject({ status: "ready", ready_email_sent_at: NOW.toISOString() });
    expect(d.publishCollab).not.toHaveBeenCalled();
    expect(d.sendEmail).toHaveBeenCalledTimes(1);
    expect(d.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "orga@example.fr", idempotencyKey: `flyover/ready/${order().id}` }));
  });

  it("schedules a finished collab order, and flags it when Instagram scheduling is refused", async () => {
    const collab = order({ offer: "collab", status: "rendering", render_job_id: "job-1", instagram_handle: "trail_cretes", publish_local: "2026-11-25T18:00" });
    const { store, repository } = memoryRepository([collab]);
    const d = deps(repository, {
      getRenderJob: vi.fn(async () => ({ id: "job-1", status: "done" as const, message: null, created_at: "", updated_at: "", finished_at: "2026-11-22T09:50:00Z", content: null })),
      publishCollab: vi.fn(async () => ({ postId: "post-1", scheduled: false, message: "Choisis une date dans le futur." })),
    });
    await runFlyoverTick(d);
    expect(store.get(collab.id)).toMatchObject({ status: "ready", social_post_id: "post-1", error: "Programmation Instagram à faire à la main." });
    expect(d.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: `flyover/schedule-failed/${collab.id}` }));
  });

  it("sends the render back to the voice step when the job failed", async () => {
    const { store, repository } = memoryRepository([order({ status: "rendering", render_job_id: "job-1" })]);
    const d = deps(repository, {
      getRenderJob: vi.fn(async () => ({ id: "job-1", status: "failed" as const, message: "GPU perdu", created_at: "", updated_at: "", finished_at: null, content: null })),
      startRender: vi.fn(async () => "job-2"),
    });
    await runFlyoverTick(d);
    // Same tick: back to scripted, then the free order restarts its render.
    expect(store.get(order().id)).toMatchObject({ status: "rendering", render_job_id: "job-2", attempts: 1 });
  });
});
