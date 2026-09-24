import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  isModuleEnabled: vi.fn(),
}));

vi.mock("../../../../lib/http", async () => {
  const actual = await vi.importActual<typeof import("../../../../lib/http")>("../../../../lib/http");
  return { ...actual, checkRateLimit: mocks.checkRateLimit };
});
vi.mock("../../../../lib/organizer", () => ({ serviceHeaders: () => ({}) }));
vi.mock("../../../../lib/organizer-module-settings", () => ({
  isOrganizerEditionModuleEnabled: mocks.isModuleEnabled,
}));
vi.mock("../../../../lib/supabase", () => ({
  getSupabaseServiceConfig: () => ({ supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" }),
}));

const sponsorId = "44444444-4444-4444-8444-444444444444";
const raceId = "11111111-1111-4111-8111-111111111111";
const viewId = "55555555-5555-4555-8555-555555555555";
const editionId = "33333333-3333-4333-8333-333333333333";

const request = (overrides: Record<string, unknown> = {}) => new NextRequest(
  "http://localhost/api/racebook-sponsors/impression",
  {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.1" },
    body: JSON.stringify({ raceId, sponsorId, viewId, placement: "hero", tier: "official", ...overrides }),
  },
);

beforeEach(() => {
  mocks.isModuleEnabled.mockResolvedValue(true);
  mocks.checkRateLimit.mockReturnValue({ allowed: true, remaining: 1 });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/racebook-sponsors/impression", () => {
  it("counts one eligible viewable presentation", async () => {
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        edition_id: editionId,
        show_on_loading: true,
        show_in_banner: true,
        contextual_placement: "services",
      }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(1), { status: 200 }));

    const response = await POST(request());

    expect(response.status).toBe(204);
    expect(mocks.checkRateLimit).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("increment_racebook_sponsor_impression");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      p_sponsor_id: sponsorId,
      p_race_id: raceId,
      p_placement: "hero",
    });
  });

  it("deduplicates a repeated view without calling the counter", async () => {
    mocks.checkRateLimit
      .mockReturnValueOnce({ allowed: false, remaining: 0 })
      .mockReturnValueOnce({ allowed: true, remaining: 599 });
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{
      edition_id: editionId,
      show_on_loading: true,
      show_in_banner: true,
      contextual_placement: "none",
    }]), { status: 200 }));

    expect((await POST(request())).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a placement the sponsor did not configure", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{
      edition_id: editionId,
      show_on_loading: false,
      show_in_banner: true,
      contextual_placement: "none",
    }]), { status: 200 }));

    expect((await POST(request({ placement: "loading" }))).status).toBe(204);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires an exact contextual section match", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{
      edition_id: editionId,
      show_on_loading: false,
      show_in_banner: true,
      contextual_placement: "services",
    }]), { status: 200 }));

    expect((await POST(request({ placement: "access" }))).status).toBe(204);
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores impressions while the sponsor module is inactive", async () => {
    mocks.isModuleEnabled.mockResolvedValue(false);
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{
      edition_id: editionId,
      show_on_loading: true,
      show_in_banner: true,
      contextual_placement: "services",
    }]), { status: 200 }));

    expect((await POST(request())).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed payloads", async () => {
    const fetchMock = vi.spyOn(global, "fetch");
    const response = await POST(request({ viewId: "not-a-uuid" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
