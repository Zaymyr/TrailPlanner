import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("/api/organizer/publication-requests POST", () => {
  it("keeps the legacy endpoint closed to new requests", async () => {
    const response = await POST(new NextRequest("http://localhost/api/organizer/publication-requests", {
      method: "POST",
      headers: { authorization: "Bearer user-token", "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "11111111-1111-1111-1111-111111111111",
        raceId: "33333333-3333-3333-3333-333333333333",
      }),
    }));

    expect(response.status).toBe(410);
    expect((await response.json()).message).toContain("RaceBook");
  });
});

vi.mock("../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => Response.json({ message }, { status }),
  requireOrganizerAuth: () => Promise.resolve({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    serviceConfig: { supabaseUrl: "https://supabase.example", supabaseServiceRoleKey: "service-key" },
  }),
}));
