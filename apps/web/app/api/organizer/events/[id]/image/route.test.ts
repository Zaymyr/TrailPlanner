import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

const eventId = "11111111-1111-1111-1111-111111111111";

const organizerMocks = vi.hoisted(() => ({
  requireEventOrganizer: vi.fn(),
}));

const buildJsonResponse = (payload: unknown, options: { status?: number } = {}) =>
  new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: { "content-type": "application/json" },
  });

const putRequest = (file: File) => {
  const formData = new FormData();
  formData.append("image", file);
  return new NextRequest(`http://localhost/api/organizer/events/${eventId}/image`, {
    method: "PUT",
    headers: { authorization: "Bearer user-token" },
    body: formData,
  });
};

describe("/api/organizer/events/[id]/image", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    organizerMocks.requireEventOrganizer.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects users without active event membership", async () => {
    organizerMocks.requireEventOrganizer.mockResolvedValueOnce({
      error: Response.json({ message: "Not authorized for this event." }, { status: 403 }),
    });

    const response = await PUT(putRequest(new File(["png"], "event.png", { type: "image/png" })), {
      params: { id: eventId },
    });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.message).toContain("Not authorized");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("rejects non-PNG images", async () => {
    const response = await PUT(putRequest(new File(["jpg"], "event.jpg", { type: "image/jpeg" })), {
      params: { id: eventId },
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.message).toContain("PNG");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it("uploads a PNG and persists the public event thumbnail URL", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        buildJsonResponse([
          {
            id: eventId,
            thumbnail_url: "https://supabase.example/storage/v1/object/public/race-images/organizer-events/event.png",
          },
        ])
      );

    const response = await PUT(putRequest(new File(["png"], "event.png", { type: "image/png" })), {
      params: { id: eventId },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.thumbnailUrl).toContain("/storage/v1/object/public/race-images/organizer-events/");

    const uploadCall = mockFetch.mock.calls.find(([url]) => String(url).includes("/storage/v1/object/race-images/"));
    expect(uploadCall?.[0]).toContain(`organizer-events/${eventId}/thumbnail-`);
    expect(uploadCall?.[1]?.headers).toMatchObject({ "Content-Type": "image/png", "x-upsert": "true" });

    const patchCall = mockFetch.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({ thumbnail_url: payload.thumbnailUrl });
  });
});

vi.mock("../../../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: organizerMocks.requireEventOrganizer,
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
