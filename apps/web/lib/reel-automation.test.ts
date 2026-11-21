import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_REEL_AUTOMATION_SETTINGS,
  diffPlan,
  getPlannedPublishLocal,
  REEL_AUTOMATION_MAX_ATTEMPTS,
  ReelAutomationSkip,
  runReelAutomationTick,
  toParisDay,
  type PlannerCatalog,
  type ReelAutomationDeps,
  type ReelAutomationItem,
  type ReelAutomationRepository,
  type ReelAutomationSettings,
  type ReelRenderJobState,
} from "./reel-automation";
import type { PlannerFormat } from "./reel-planner";

const NOW = new Date("2026-11-20T09:17:00Z"); // Friday, 10:17 in Paris
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const format = (n: number, overrides: Partial<PlannerFormat> = {}): PlannerFormat => ({
  raceId: uuid(n),
  name: `Format ${n}`,
  distanceKm: 80,
  isLive: true,
  hasGpx: true,
  raceDate: "2026-12-06",
  editionStartDate: null,
  eventDate: null,
  eventId: uuid(900 + n),
  editionId: uuid(800 + n),
  ...overrides,
});

/** In-memory twin of the PostgREST repository: guards are evaluated on status and lease. */
const createMemoryRepository = (initial: ReelAutomationItem[], settings: ReelAutomationSettings) => {
  let items = initial.map((item) => ({ ...item }));
  let counter = 500;
  const matches = (item: ReelAutomationItem, filter?: string) => {
    if (!filter) return true;
    if (filter.startsWith("status=eq.")) return item.status === filter.slice("status=eq.".length);
    if (filter.startsWith("or=(status.eq.planned")) return item.status === "planned" || (item.status === "skipped" && (item.reason === "too_late" || item.reason === "duplicate"));
    throw new Error(`Unknown filter ${filter}`);
  };
  const repository: ReelAutomationRepository = {
    getSettings: async () => settings,
    updateSettings: async (patch) => ({ ...settings, ...patch }),
    listItems: async () => items.map((item) => ({ ...item })),
    getItem: async (id) => items.find((item) => item.id === id) ?? null,
    insertItems: async (rows) => {
      rows.forEach((row) => {
        if (items.some((item) => item.race_id === row.race_id && item.edition_key === row.edition_key)) return;
        counter += 1;
        items.push({
          id: uuid(counter), step: null, attempts: 0, error: null, work: null, render_job_id: null, social_post_id: null,
          locked_until: null, created_at: NOW.toISOString(), updated_at: NOW.toISOString(), reason: null, races: null,
          ...row,
        } as ReelAutomationItem);
      });
    },
    updateItem: async (id, patch, filter) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item || !matches(item, filter)) return null;
      Object.assign(item, patch);
      return { ...item };
    },
    deleteItems: async (ids, filter) => {
      items = items.filter((item) => !(ids.includes(item.id) && matches(item, filter)));
    },
    claimItem: async (id, now, until) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item || !["planned", "generating"].includes(item.status)) return null;
      if (item.locked_until && Date.parse(item.locked_until) >= now.getTime()) return null;
      Object.assign(item, { status: "generating", locked_until: until.toISOString() });
      return { ...item };
    },
  };
  return { repository, all: () => items };
};

const setup = ({ settings = {}, items = [], catalog = {}, jobs = new Map<string, ReelRenderJobState>() }: {
  settings?: Partial<ReelAutomationSettings>;
  items?: ReelAutomationItem[];
  catalog?: Partial<PlannerCatalog>;
  jobs?: Map<string, ReelRenderJobState>;
} = {}) => {
  const fullSettings = { ...DEFAULT_REEL_AUTOMATION_SETTINGS, updated_by: uuid(77), ...settings };
  const memory = createMemoryRepository(items, fullSettings);
  const deps = {
    now: () => NOW,
    repository: memory.repository,
    loadCatalog: vi.fn(async () => ({ formats: [], priorReels: [], scheduledPosts: [], ...catalog })),
    loadRaceReels: vi.fn(async () => []),
    steps: {
      content: vi.fn(async () => ({ content: "texte" })),
      voice: vi.fn(async (_item, work) => ({ ...work, voice: "v" })),
      render: vi.fn(async () => uuid(321)),
    },
    getRenderJobs: vi.fn(async () => jobs),
    isRenderJobStale: vi.fn(() => false),
    ensureAutoDraft: vi.fn(async () => ({ id: uuid(654) })),
    schedulePost: vi.fn(async () => ({ ok: true as const })),
  } satisfies ReelAutomationDeps;
  return { deps, memory };
};

const item = (overrides: Partial<ReelAutomationItem> = {}): ReelAutomationItem => ({
  id: uuid(1),
  race_id: uuid(11),
  edition_key: `edition:${uuid(811)}`,
  mode: "highlights",
  planned_publish_date: "2026-11-23",
  status: "planned",
  step: null,
  attempts: 0,
  error: null,
  reason: null,
  work: null,
  render_job_id: null,
  social_post_id: null,
  locked_until: null,
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  ...overrides,
});

const job = (status: string, extra: Partial<ReelRenderJobState> = {}): ReelRenderJobState => ({
  id: uuid(321), status, message: null, created_at: NOW.toISOString(), updated_at: NOW.toISOString(), finished_at: null, ...extra,
});

describe("plan refresh", () => {
  it("inserts the plan and the automatic skips even when generation is off, and does nothing else", async () => {
    const { deps, memory } = setup({ catalog: { formats: [format(1, { raceDate: "2027-02-06" }), format(2, { raceDate: "2026-11-28" })] } });
    const result = await runReelAutomationTick(deps);
    expect(result.generationEnabled).toBe(false);
    expect(result.advanced).toBeNull();
    expect(memory.all().map((row) => [row.race_id, row.status, row.reason, row.planned_publish_date]).sort()).toEqual([
      [uuid(1), "planned", null, "2027-01-30"],
      [uuid(2), "skipped", "too_late", "2026-11-21"],
    ]);
    expect(deps.steps.content).not.toHaveBeenCalled();
  });

  it("handles an empty catalog", async () => {
    const { deps, memory } = setup();
    await expect(runReelAutomationTick(deps)).resolves.toMatchObject({ plan: { planned: 0, skipped: 0 } });
    expect(memory.all()).toEqual([]);
  });

  it("moves planned items, deletes those gone from the plan, and never touches locked ones", () => {
    const moved = item({ id: uuid(1), race_id: uuid(1), edition_key: `edition:${uuid(801)}`, planned_publish_date: "2027-01-01" });
    const gone = item({ id: uuid(2), race_id: uuid(2), edition_key: "edition:x" });
    const excluded = item({ id: uuid(3), race_id: uuid(3), edition_key: "edition:y", status: "skipped", reason: "excluded" });
    const changes = diffPlan([moved, gone, excluded], {
      planned: [{ raceId: uuid(1), editionKey: `edition:${uuid(801)}`, mode: "highlights", plannedPublishDate: "2027-01-30", generateOn: "2027-01-27", eventStart: "2027-02-06", raceName: "A", distanceKm: 80 }],
      skipped: [],
    });
    expect(changes.updates).toEqual([{ id: uuid(1), patch: expect.objectContaining({ planned_publish_date: "2027-01-30", status: "planned" }) }]);
    expect(changes.deletes).toEqual([uuid(2)]);
    expect(changes.inserts).toEqual([]);
  });

  it("keeps an excluded item excluded on the next plan and frees its day", async () => {
    const excluded = item({ race_id: uuid(1), edition_key: `edition:${uuid(801)}`, status: "skipped", reason: "excluded", planned_publish_date: "2027-01-30" });
    const { deps, memory } = setup({ items: [excluded], catalog: { formats: [format(1, { raceDate: "2027-02-06" }), format(2, { raceDate: "2027-02-06" })] } });
    await runReelAutomationTick(deps);
    const rows = memory.all();
    expect(rows.find((row) => row.race_id === uuid(1))).toMatchObject({ status: "skipped", reason: "excluded" });
    expect(rows.find((row) => row.race_id === uuid(2))).toMatchObject({ status: "planned", planned_publish_date: "2027-01-30" });
  });

  it("skips a race that already has a manual reel", async () => {
    const { deps, memory } = setup({ catalog: { formats: [format(1, { raceDate: "2027-02-06" })], priorReels: [{ raceId: uuid(1), createdAt: "2026-11-10T08:00:00Z" }] } });
    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "skipped", reason: "duplicate" });
  });

  it("counts manual scheduled posts in the caps, but not the automatic ones", async () => {
    const { deps, memory } = setup({ catalog: {
      formats: [format(1, { raceDate: "2027-02-06" })],
      scheduledPosts: [{ id: uuid(70), scheduledAt: "2027-01-30T17:00:00Z" }],
    } });
    await runReelAutomationTick(deps);
    expect(memory.all()[0].planned_publish_date).toBe("2027-01-29");
  });
});

describe("executor", () => {
  const dueItem = () => item({ planned_publish_date: "2026-11-23" }); // generate on 11-20 = today

  const catalogFor = () => ({ formats: [format(11, { raceDate: "2026-11-30", editionId: uuid(811) })] });

  it("does no work when generation is off", async () => {
    const { deps } = setup({ items: [dueItem()], catalog: catalogFor() });
    await runReelAutomationTick(deps);
    expect(deps.steps.content).not.toHaveBeenCalled();
    expect(deps.steps.render).not.toHaveBeenCalled();
  });

  it("runs content, voice and render on three ticks, one step each", async () => {
    const { deps, memory } = setup({ settings: { generation_enabled: true }, items: [dueItem()], catalog: catalogFor() });
    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "generating", step: "voice", work: { content: "texte" }, locked_until: null });
    expect(deps.steps.voice).not.toHaveBeenCalled();

    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "generating", step: "render", work: { content: "texte", voice: "v" } });

    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "rendering", render_job_id: uuid(321), step: null });
    expect(deps.steps.content).toHaveBeenCalledTimes(1);
    expect(deps.steps.render).toHaveBeenCalledTimes(1);
  });

  it("does not start an item before its generation day", async () => {
    const { deps } = setup({ settings: { generation_enabled: true }, catalog: { formats: [format(11, { raceDate: "2027-02-06", editionId: uuid(811) })] } });
    await runReelAutomationTick(deps);
    expect(deps.steps.content).not.toHaveBeenCalled();
  });

  it("leaves an item alone while another tick holds its lease", async () => {
    const locked = item({ status: "generating", step: "voice", locked_until: "2026-11-20T09:20:00Z" });
    const { deps } = setup({ settings: { generation_enabled: true }, items: [locked], catalog: catalogFor() });
    await runReelAutomationTick(deps);
    expect(deps.steps.voice).not.toHaveBeenCalled();
  });

  it("skips a race that got a reel before the text, and again before the render", async () => {
    for (const step of [null, "render"] as const) {
      const { deps, memory } = setup({ settings: { generation_enabled: true }, items: [item({ status: step ? "generating" : "planned", step, work: { a: 1 } })], catalog: catalogFor() });
      deps.loadRaceReels.mockResolvedValue([{ raceId: uuid(11), createdAt: "2026-11-19T10:00:00Z" }] as never);
      await runReelAutomationTick(deps);
      expect(memory.all()[0]).toMatchObject({ status: "skipped", reason: "duplicate" });
      expect(deps.steps.content).not.toHaveBeenCalled();
      expect(deps.steps.render).not.toHaveBeenCalled();
    }
  });

  it("retries a failed step at the next tick, then fails after the last attempt", async () => {
    const { deps, memory } = setup({ settings: { generation_enabled: true }, items: [dueItem()], catalog: catalogFor() });
    deps.steps.content.mockRejectedValue(new Error("Claude indisponible"));
    for (let attempt = 1; attempt <= REEL_AUTOMATION_MAX_ATTEMPTS; attempt += 1) {
      await runReelAutomationTick(deps);
      expect(memory.all()[0]).toMatchObject({ attempts: attempt, error: "Claude indisponible", step: "content", locked_until: null });
    }
    expect(memory.all()[0].status).toBe("failed");
    await runReelAutomationTick(deps);
    expect(deps.steps.content).toHaveBeenCalledTimes(REEL_AUTOMATION_MAX_ATTEMPTS);
  });

  it("marks a race the server cannot tell as skipped", async () => {
    const { deps, memory } = setup({ settings: { generation_enabled: true }, items: [dueItem()], catalog: catalogFor() });
    deps.steps.content.mockRejectedValue(new ReelAutomationSkip("GPX sans altitudes"));
    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "skipped", reason: "ineligible", error: "GPX sans altitudes" });
  });

  it("stops new work when generation is turned off but lets the render finish and links its draft", async () => {
    const rendering = item({ status: "rendering", render_job_id: uuid(321) });
    const waiting = item({ id: uuid(2), race_id: uuid(12), edition_key: "edition:other", status: "generating", step: "voice", work: {} });
    const { deps, memory } = setup({ items: [rendering, waiting], jobs: new Map([[uuid(321), job("done", { finished_at: NOW.toISOString() })]]) });
    await runReelAutomationTick(deps);
    expect(memory.all().find((row) => row.id === uuid(1))).toMatchObject({ status: "drafted", social_post_id: uuid(654) });
    expect(deps.steps.voice).not.toHaveBeenCalled();
    expect(deps.schedulePost).not.toHaveBeenCalled();
  });

  it("schedules the draft at the planned slot when automatic publication is on", async () => {
    const rendering = item({ status: "rendering", render_job_id: uuid(321), planned_publish_date: "2026-11-23" });
    const { deps, memory } = setup({
      settings: { generation_enabled: true, auto_publish_enabled: true, publish_time: "18:00:00" },
      items: [rendering],
      jobs: new Map([[uuid(321), job("done")]]),
    });
    await runReelAutomationTick(deps);
    expect(deps.schedulePost).toHaveBeenCalledWith(uuid(654), "2026-11-23T18:00");
    expect(memory.all()[0]).toMatchObject({ status: "scheduled" });
  });

  it("keeps the draft for review when scheduling is refused", async () => {
    const drafted = item({ status: "drafted", social_post_id: uuid(654) });
    const { deps, memory } = setup({ settings: { generation_enabled: true, auto_publish_enabled: true }, items: [drafted] });
    deps.schedulePost.mockResolvedValue({ ok: false, message: "Choisis une date dans le futur." } as never);
    await runReelAutomationTick(deps);
    expect(memory.all()[0]).toMatchObject({ status: "drafted", error: "Programmation automatique impossible : Choisis une date dans le futur." });
  });

  it("never schedules without automatic publication", async () => {
    const drafted = item({ status: "drafted", social_post_id: uuid(654) });
    const { deps } = setup({ settings: { generation_enabled: true }, items: [drafted] });
    await runReelAutomationTick(deps);
    expect(deps.schedulePost).not.toHaveBeenCalled();
  });

  it("fails the item when its render fails, disappears or goes silent", async () => {
    const cases: Array<[Map<string, ReelRenderJobState>, boolean, string]> = [
      [new Map([[uuid(321), job("failed", { message: "GPU" })]]), false, "Rendu en échec : GPU"],
      [new Map(), false, "Le rendu a été supprimé."],
      [new Map([[uuid(321), job("running")]]), true, "Le rendu ne donne plus de nouvelles."],
    ];
    for (const [jobs, stale, error] of cases) {
      const { deps, memory } = setup({ items: [item({ status: "rendering", render_job_id: uuid(321) })], jobs });
      deps.isRenderJobStale.mockReturnValue(stale);
      await runReelAutomationTick(deps);
      expect(memory.all()[0]).toMatchObject({ status: "failed", error });
    }
  });

  it("waits while the finished render has no draft yet", async () => {
    const { deps, memory } = setup({ items: [item({ status: "rendering", render_job_id: uuid(321) })], jobs: new Map([[uuid(321), job("done")]]) });
    deps.ensureAutoDraft.mockResolvedValue(null as never);
    await runReelAutomationTick(deps);
    expect(memory.all()[0].status).toBe("rendering");
  });
});

describe("helpers", () => {
  it("reads Paris days and the planned publication wall time", () => {
    expect(toParisDay("2027-01-30T23:30:00Z")).toBe("2027-01-31");
    expect(getPlannedPublishLocal({ planned_publish_date: "2027-01-30" }, { publish_time: "18:00:00" })).toBe("2027-01-30T18:00");
  });
});
