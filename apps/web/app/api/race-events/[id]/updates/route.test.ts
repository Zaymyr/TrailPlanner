import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";
const updateId = "22222222-2222-2222-2222-222222222222";

const { mockGetSupabaseAnonConfig } = vi.hoisted(() => ({
  mockGetSupabaseAnonConfig: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

describe("/api/race-events/[id]/updates", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    mockGetSupabaseAnonConfig.mockReturnValue({
      supabaseUrl: "https://supabase.example",
      supabaseAnonKey: "anon-key",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns updates for a live event", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(buildJsonResponse([{ id: eventId }]))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: updateId,
            event_id: eventId,
            message: "Départ avancé de 15 minutes.",
            created_at: "2026-06-29T10:00:00.000Z",
          },
        ])
      );

    const response = await GET(new Request(`http://localhost/api/race-events/${eventId}/updates`), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.updates).toHaveLength(1);
    expect(payload.updates[0].id).toBe(updateId);
  });

  it("returns 404 when the event is not live or missing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(buildJsonResponse([]));

    const response = await GET(new Request(`http://localhost/api/race-events/${eventId}/updates`), { params: { id: eventId } });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.message).toBe("Race event not found.");
  });
});

vi.mock("../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../lib/supabase", () => ({
  getSupabaseAnonConfig: mockGetSupabaseAnonConfig,
}));
