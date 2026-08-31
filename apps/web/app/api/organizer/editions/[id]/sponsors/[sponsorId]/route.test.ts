import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  requireEventOrganizer: vi.fn(),
  requireOrganizerEditionCapability: vi.fn(),
  requireOrganizerAuth: vi.fn(),
}));

vi.mock("../../../../../../../lib/organizer-entitlements", () => ({
  requireOrganizerEditionCapability: mocks.requireOrganizerEditionCapability,
}));

vi.mock("../../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => NextResponse.json({ message }, { status }),
  requireEventOrganizer: mocks.requireEventOrganizer,
  requireOrganizerAuth: mocks.requireOrganizerAuth,
  serviceHeaders: () => ({}),
}));

const editionId = "33333333-3333-4333-8333-333333333333";
const eventId = "22222222-2222-4222-8222-222222222222";
const sponsorId = "44444444-4444-4444-8444-444444444444";
const oldLogo = `https://db.example.com/storage/v1/object/public/race-images/organizer-sponsors/${editionId}/old.png`;
const sponsor = (logoUrl = oldLogo) => ({
  id: sponsorId,
  edition_id: editionId,
  name: "Sponsor",
  logo_url: logoUrl,
  website_url: "https://example.com",
  is_active: true,
  show_on_loading: true,
  show_in_banner: true,
  position: 0,
  click_count: 4,
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const prepareAuthorization = () => {
  mocks.requireOrganizerAuth.mockResolvedValue({
    user: { id: "user-1" },
    serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
  });
  mocks.requireEventOrganizer.mockResolvedValue(true);
  mocks.requireOrganizerEditionCapability.mockResolvedValue(true);
};

describe("organizer sponsor mutation route", () => {
  it("requires an active Pro entitlement before loading the sponsor", async () => {
    prepareAuthorization();
    mocks.requireOrganizerEditionCapability.mockResolvedValue(false);
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ event_id: eventId }]), { status: 200 })
    );

    const response = await DELETE(new NextRequest("http://localhost/sponsor"), { params: { id: editionId, sponsorId } });
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a sponsor from another edition", async () => {
    prepareAuthorization();
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));

    const response = await DELETE(new NextRequest("http://localhost/sponsor"), { params: { id: editionId, sponsorId } });
    expect(response.status).toBe(404);
  });

  it("replaces the logo and removes the prior Storage object", async () => {
    prepareAuthorization();
    const newLogo = `https://db.example.com/storage/v1/object/public/race-images/organizer-sponsors/${editionId}/new.png`;
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([sponsor()]), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([sponsor(newLogo)]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const formData = new FormData();
    formData.set("image", new File(["png"], "new.png", { type: "image/png" }));

    const response = await PUT(new NextRequest("http://localhost/sponsor", { method: "PUT", body: formData }), {
      params: { id: editionId, sponsorId },
    });
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[4]?.[0]).toContain("organizer-sponsors/33333333-3333-4333-8333-333333333333/old.png");
  });

  it("deletes the row before cleaning its logo", async () => {
    prepareAuthorization();
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([sponsor()]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    const response = await DELETE(new NextRequest("http://localhost/sponsor"), { params: { id: editionId, sponsorId } });
    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "DELETE" });
    expect(fetchMock.mock.calls[3]?.[0]).toContain("organizer-sponsors/33333333-3333-4333-8333-333333333333/old.png");
  });
});
