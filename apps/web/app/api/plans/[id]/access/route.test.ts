import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), plan: vi.fn(), access: vi.fn(), mode: vi.fn() }));
vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: () => ({ supabaseUrl: "https://example.test", supabaseAnonKey: "key" }),
  extractBearerToken: (header: string | null) => header?.replace("Bearer ", "") ?? null,
  fetchSupabaseUser: mocks.user,
  isAnonymousUser: (user: { isAnonymous?: boolean }) => user.isAnonymous === true,
}));
vi.mock("../../../../../lib/runner-access", () => ({ getOwnedRunnerPlan: mocks.plan, getRunnerPlanAccess: mocks.access, getRunnerAdminMode: mocks.mode }));
import { GET } from "./route";
const planId = "11111111-1111-4111-8111-111111111111";
const request = () => new Request("https://example.test/api/plans/access", { headers: { Authorization: "Bearer token" } });

describe("plan access authorization", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.mode.mockResolvedValue("real"); });
  it("requires a verified identified account", async () => {
    mocks.user.mockResolvedValue({ id: "guest", isAnonymous: true });
    expect((await GET(request(), { params: { id: planId } })).status).toBe(401);
    expect(mocks.plan).not.toHaveBeenCalled();
  });
  it("does not reveal the rights of another owner's plan", async () => {
    mocks.plan.mockResolvedValue(null);
    expect((await GET(request(), { params: { id: planId } })).status).toBe(404);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("resolves the owned course scope and session simulation", async () => {
    mocks.plan.mockResolvedValue({ id: planId, planKey: "race:course:edition:edition" });
    mocks.mode.mockResolvedValue("free");
    mocks.access.mockResolvedValue({ enabled: true, canEdit: false, canViewDetails: false });
    const response = await GET(request(), { params: { id: planId } });
    expect(response.status).toBe(200);
    expect(mocks.access).toHaveBeenCalledWith("owner", planId, { planKey: "race:course:edition:edition", adminMode: "free" });
  });
  it("does not turn an access outage into a paid grant", async () => {
    mocks.plan.mockRejectedValue(new Error("Database unavailable"));
    expect((await GET(request(), { params: { id: planId } })).status).toBe(503);
  });
});
