import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const raceId = "11111111-1111-1111-1111-111111111111";
const eventId = "22222222-2222-2222-2222-222222222222";

const organizerMocks = vi.hoisted(() => ({
  loadRaceForOrganizer: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const putRequest = (file: File) => {
  const formData = new FormData();
  formData.append("image", file);
  return new NextRequest(`http://localhost/api/organizer/races/${raceId}/image`, {
    method: "PUT",
    headers: { authorization: "Bearer user-token" },
    body: formData,
  });
};

describe("/api/organizer/races/[id]/image", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.loadRaceForOrganizer.mockResolvedValue({ id: raceId, event_id: eventId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects unsupported image types", async () => {
    const response = await PUT(putRequest(new File(["gif"], "race.gif", { type: "image/gif" })), {
      params: { id: raceId },
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("JPEG");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("uploads a race thumbnail and persists the public URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: raceId,
            thumbnail_url: "https://supabase.example/storage/v1/object/public/race-images/organizer-races/race.jpg",
          },
        ])
      );

    const response = await PUT(putRequest(new File(["jpg"], "race.jpg", { type: "image/jpeg" })), {
      params: { id: raceId },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.thumbnailUrl).toContain("/storage/v1/object/public/race-images/organizer-races/");

    const uploadCall = mockFetch.mock.calls.find(([url]) => String(url).includes("/storage/v1/object/race-images/"));
    expect(uploadCall?.[0]).toContain(`organizer-races/${eventId}/${raceId}/thumbnail-`);
    expect(uploadCall?.[1]?.headers).toMatchObject({ "Content-Type": "image/jpeg", "x-upsert": "true" });

    const patchCall = mockFetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({ thumbnail_url: payload.thumbnailUrl });
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  loadRaceForOrganizer: organizerMocks.loadRaceForOrganizer,
  requireOrganizerAuth: () =>
    Promise.resolve({
      user: { id: "00000000-0000-0000-0000-000000000001" },
      serviceConfig: {
        supabaseUrl: "https://supabase.example",
        supabaseServiceRoleKey: "service-key",
      },
    }),
  serviceHeaders: (_serviceConfig: unknown, contentType = "application/json") => ({
    apikey: "service-key",
    Authorization: "Bearer service-key",
    ...(contentType ? { "Content-Type": contentType } : {}),
  }),
  uuidParamSchema: {
    safeParse: (params: { id?: string }) =>
      typeof params.id === "string" ? { success: true, data: { id: params.id } } : { success: false },
  },
}));
