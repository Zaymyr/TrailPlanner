import { describe, expect, it, vi } from "vitest";

import { DEFAULT_REEL_AUTOMATION_SETTINGS, type ReelAutomationSettings } from "../reel-automation";
import {
  advanceCarouselItem,
  CarouselAutomationSkip,
  pickDueCarousel,
  runCarouselAutomationTick,
  type CarouselAutomationDeps,
  type CarouselItem,
  type CarouselItemRepository,
} from "./carousel-automation";

const NOW = new Date("2026-11-21T10:00:00Z"); // Saturday in Paris
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const item = (overrides: Partial<CarouselItem> = {}): CarouselItem => ({
  id: uuid(1), series: "plan", planned_publish_date: "2026-11-24", race_id: uuid(50), edition_key: "edition:x", week_start: null,
  status: "planned", step: null, attempts: 0, error: null, reason: null, work: null, carousel_job_id: null, social_post_id: null,
  locked_until: null, created_at: "", updated_at: "", ...overrides,
});

const settings = (overrides: Partial<ReelAutomationSettings> = {}): ReelAutomationSettings => ({
  ...DEFAULT_REEL_AUTOMATION_SETTINGS, generation_enabled: true, plan_carousel_enabled: true, ...overrides,
});

const memory = (initial: CarouselItem[]) => {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  const repository: CarouselItemRepository = {
    list: async () => Array.from(rows.values()).map((row) => ({ ...row })),
    get: async (id) => rows.get(id) ?? null,
    insert: async () => undefined,
    update: async (id, patch, filter) => {
      const row = rows.get(id);
      if (!row) return null;
      if (filter === "status=eq.generating" && row.status !== "generating") return null;
      Object.assign(row, patch);
      return { ...row };
    },
    remove: async () => undefined,
    claim: async (id, _now, until) => {
      const row = rows.get(id);
      if (!row || (row.status !== "planned" && row.status !== "generating")) return null;
      Object.assign(row, { status: "generating", locked_until: until.toISOString() });
      return { ...row };
    },
  };
  return { repository, rows };
};

const deps = (repository: CarouselItemRepository, overrides: Partial<CarouselAutomationDeps> = {}): CarouselAutomationDeps => ({
  now: () => NOW,
  items: repository,
  getSettings: async () => settings(),
  loadCatalog: vi.fn(async () => ({ formats: [], coverage: [], occupiedDates: [], weekEventCounts: {} })),
  hasDuplicate: vi.fn(async () => false),
  steps: { content: vi.fn(async () => ({ snapshot: {} })), render: vi.fn(async () => uuid(99)) },
  getJobs: vi.fn(async () => new Map()),
  isJobStale: () => false,
  ensureAutoDraft: vi.fn(async () => ({ id: uuid(77) })),
  schedulePost: vi.fn(async () => ({ ok: true as const })),
  ...overrides,
});

describe("carousel executor", () => {
  it("starts a slot lead_days before its day, only for an enabled series", () => {
    expect(pickDueCarousel([item()], settings(), "2026-11-21", NOW)?.id).toBe(uuid(1));
    expect(pickDueCarousel([item({ planned_publish_date: "2026-11-26" })], settings(), "2026-11-21", NOW)).toBeNull();
    expect(pickDueCarousel([item()], settings({ plan_carousel_enabled: false }), "2026-11-21", NOW)).toBeNull();
  });

  it("writes the content, then launches the render", async () => {
    const { repository, rows } = memory([item()]);
    const d = deps(repository);
    await advanceCarouselItem(d, settings(), await repository.list(), "2026-11-21");
    expect(rows.get(uuid(1))).toMatchObject({ status: "generating", step: "render", work: { snapshot: {} }, locked_until: null });
    await advanceCarouselItem(d, settings(), await repository.list(), "2026-11-21");
    expect(rows.get(uuid(1))).toMatchObject({ status: "rendering", carousel_job_id: uuid(99) });
  });

  it("skips a duplicate edition and a race that cannot be covered", async () => {
    const duplicate = memory([item()]);
    await advanceCarouselItem(deps(duplicate.repository, { hasDuplicate: vi.fn(async () => true) }), settings(), [item()], "2026-11-21");
    expect(duplicate.rows.get(uuid(1))).toMatchObject({ status: "skipped", reason: "duplicate" });

    const missing = memory([item()]);
    const d = deps(missing.repository, { steps: { content: vi.fn(async () => { throw new CarouselAutomationSkip("D+ inconnu."); }), render: vi.fn() } });
    await advanceCarouselItem(d, settings(), [item()], "2026-11-21");
    expect(missing.rows.get(uuid(1))).toMatchObject({ status: "skipped", reason: "ineligible", error: "D+ inconnu." });
  });

  it("fails after three attempts", async () => {
    const { repository, rows } = memory([item({ attempts: 2 })]);
    const d = deps(repository, { steps: { content: vi.fn(async () => { throw new Error("Anthropic down"); }), render: vi.fn() } });
    await advanceCarouselItem(d, settings(), await repository.list(), "2026-11-21");
    expect(rows.get(uuid(1))).toMatchObject({ status: "failed", attempts: 3 });
  });

  it("drafts a finished render and schedules it at the slot when automatic publication is on", async () => {
    const { repository, rows } = memory([item({ status: "rendering", carousel_job_id: uuid(99) })]);
    const d = deps(repository, {
      getSettings: async () => settings({ auto_publish_enabled: true, publish_time: "18:00:00" }),
      getJobs: vi.fn(async () => new Map([[uuid(99), { id: uuid(99), status: "done", message: null, created_at: NOW.toISOString() }]])),
    });
    await runCarouselAutomationTick(d);
    expect(d.schedulePost).toHaveBeenCalledWith(uuid(77), "2026-11-24T18:00");
    expect(rows.get(uuid(1))).toMatchObject({ status: "scheduled", social_post_id: uuid(77) });
  });
});
