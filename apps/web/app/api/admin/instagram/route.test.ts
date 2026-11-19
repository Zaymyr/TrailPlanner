import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ gate: vi.fn() }));

vi.mock("../../../../lib/video-render-api", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/video-render-api")>("../../../../lib/video-render-api");
  return { ...actual, authorizeVideoAdmin: mocks.gate };
});

import { GET } from "./route";

const TOKEN = "EAAGsystemusertoken123";
const request = () => new Request("http://localhost/api/admin/instagram", { headers: { authorization: "Bearer admin" } });

describe("Instagram status route", () => {
  beforeEach(() => {
    mocks.gate.mockResolvedValue({ ok: true, value: { userId: "admin", supabase: { supabaseUrl: "https://db", supabaseServiceRoleKey: "s" } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls nothing and stays in simulation without credentials", async () => {
    vi.stubEnv("IG_SYSTEM_USER_TOKEN", "");
    vi.stubEnv("IG_USER_ID", "");
    vi.stubEnv("INSTAGRAM_PUBLISH_DRY_RUN", "false");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ credentialsConfigured: false, dryRun: true, profile: null, quota: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reads the profile and quota without ever returning the token", async () => {
    vi.stubEnv("IG_SYSTEM_USER_TOKEN", TOKEN);
    vi.stubEnv("IG_USER_ID", "17841400000");
    vi.stubEnv("FB_PAGE_ID", "1234");
    vi.stubEnv("INSTAGRAM_PUBLISH_DRY_RUN", "false");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      const body = url.includes("content_publishing_limit")
        ? { data: [{ quota_usage: 2, config: { quota_total: 50, quota_duration: 86400 } }] }
        : { username: "pace_your.self", name: "Pace Yourself", id: "17841400000" };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const response = await GET(request());
    const text = await response.text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text)).toMatchObject({
      credentialsConfigured: true,
      dryRun: false,
      pageId: "1234",
      profile: { username: "pace_your.self" },
      quota: { usage: 2, total: 50 },
    });
  });

  it("explains a rejected token without leaking it", async () => {
    vi.stubEnv("IG_SYSTEM_USER_TOKEN", TOKEN);
    vi.stubEnv("IG_USER_ID", "17841400000");
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({
      error: { message: `Invalid OAuth access token ${TOKEN}`, type: "OAuthException", code: 190 },
    }), { status: 400 }));
    const text = await (await GET(request())).text();
    expect(text).not.toContain(TOKEN);
    expect(JSON.parse(text).profileError).toContain("vérifier IG_SYSTEM_USER_TOKEN");
  });
});
