import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const createRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/organizer/edition-requests", {
    method: "POST",
    headers: {
      authorization: "Bearer user-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("/api/organizer/edition-requests POST", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a pending event edition request", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: "11111111-1111-1111-1111-111111111111",
              event_id: "22222222-2222-2222-2222-222222222222",
              source_year: 2026,
              requested_start_date: "2027-06-20",
              status: "pending",
              reviewer_notes: null,
            },
          ]),
          { status: 201, headers: { "content-type": "application/json" } }
        )
      );

    const response = await POST(
      createRequest({
        eventId: "22222222-2222-2222-2222-222222222222",
        sourceYear: 2026,
        requestedStartDate: "2027-06-20",
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.editionRequest.status).toBe("pending");
    const insertCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url).includes("/rest/v1/race_event_edition_requests") && init?.method === "POST"
    );
    expect(insertCall).toBeTruthy();
    expect(JSON.parse(insertCall?.[1]?.body as string)).toMatchObject({
      user_id: "00000000-0000-0000-0000-000000000001",
      event_id: "22222222-2222-2222-2222-222222222222",
      source_year: 2026,
      requested_start_date: "2027-06-20",
      status: "pending",
    });
  });
});

vi.mock("../../../../lib/http", () => ({
  withSecurityHeaders: (response: Response) => response,
}));

vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireEventOrganizer: () => Promise.resolve(true),
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
}));
