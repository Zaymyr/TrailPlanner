import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tick: vi.fn(), deps: vi.fn() }));

vi.mock("../../../../lib/reel-automation", () => ({ runReelAutomationTick: mocks.tick }));
vi.mock("../../../../lib/reel-generation", () => ({ createReelAutomationDeps: mocks.deps }));

import { GET } from "./route";

const call = (authorization: string) => GET(new Request("http://localhost/api/cron/reel-automation", { headers: { authorization } }));

describe("reel automation cron", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects requests without the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    expect((await call("Bearer wrong")).status).toBe(401);
    expect(mocks.tick).not.toHaveBeenCalled();
  });

  it("rejects every request when CRON_SECRET is not set", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("runs one tick behind the cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("SUPABASE_URL", "https://db.example.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    mocks.deps.mockReturnValue({ fake: true });
    mocks.tick.mockResolvedValue({ generationEnabled: false, plan: { planned: 2 }, tracked: [], advanced: null });
    const response = await call("Bearer secret");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, generationEnabled: false });
    expect(mocks.tick).toHaveBeenCalledWith({ fake: true });
  });

  it("answers 500 without details when the tick throws", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    vi.stubEnv("SUPABASE_URL", "https://db.example.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    mocks.tick.mockRejectedValue(new Error("boom"));
    const response = await call("Bearer secret");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ message: "Unable to run the reel automation." });
  });
});
