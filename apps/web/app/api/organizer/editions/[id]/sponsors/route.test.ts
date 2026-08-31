import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireEventOrganizer: vi.fn(),
  requireOrganizerEditionCapability: vi.fn(),
  requireOrganizerAuth: vi.fn(),
}));

vi.mock("../../../../../../lib/organizer-entitlements", () => ({
  requireOrganizerEditionCapability: mocks.requireOrganizerEditionCapability,
}));

vi.mock("../../../../../../lib/organizer", () => ({
  jsonError: (message: string, status: number) => NextResponse.json({ message }, { status }),
  requireEventOrganizer: mocks.requireEventOrganizer,
  requireOrganizerAuth: mocks.requireOrganizerAuth,
  serviceHeaders: () => ({}),
  uuidParamSchema: { safeParse: (value: { id?: string }) => ({ success: Boolean(value.id), data: value }) },
}));

const editionId = "33333333-3333-4333-8333-333333333333";
const eventId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  mocks.requireOrganizerEditionCapability.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const sponsorRow = (index: number, loading = false) => ({
  id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  edition_id: editionId,
  name: `Sponsor ${index}`,
  logo_url: `https://example.com/${index}.png`,
  website_url: null,
  is_active: loading,
  show_on_loading: loading,
  show_in_banner: true,
  position: index,
  click_count: 0,
});

const sponsorForm = (loading = false) => {
  const formData = new FormData();
  formData.set("name", "New sponsor");
  formData.set("showOnLoading", String(loading));
  formData.set("showInBanner", "true");
  formData.set("image", new File(["png"], "logo.png", { type: "image/png" }));
  return formData;
};

describe("organizer edition sponsor routes", () => {
  it("requires an active membership on the parent event", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1" },
      serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue({ error: NextResponse.json({ message: "Forbidden" }, { status: 403 }) });
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }));

    const response = await GET(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/sponsors`), { params: { id: editionId } });
    expect(response.status).toBe(403);
  });

  it("requires an active Pro entitlement before loading sponsors", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1" },
      serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    mocks.requireOrganizerEditionCapability.mockResolvedValue(false);
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 })
    );

    const response = await GET(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/sponsors`), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects unsupported logo formats before uploading", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1" },
      serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }));
    const formData = new FormData();
    formData.set("name", "Sponsor PDF");
    formData.set("showInBanner", "true");
    formData.set("image", new File(["not-an-image"], "logo.pdf", { type: "application/pdf" }));

    const response = await POST(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/sponsors`, {
      method: "POST",
      body: formData,
    }), { params: { id: editionId } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: expect.stringContaining("PNG") });
  });

  it("rejects an eleventh sponsor before uploading", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1" },
      serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 10 }, (_, index) => sponsorRow(index))), { status: 200 }));

    const response = await POST(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/sponsors`, {
      method: "POST",
      body: sponsorForm(),
    }), { params: { id: editionId } });
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects a third active loading sponsor before uploading", async () => {
    mocks.requireOrganizerAuth.mockResolvedValue({
      user: { id: "user-1" },
      serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
    });
    mocks.requireEventOrganizer.mockResolvedValue(true);
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([sponsorRow(1, true), sponsorRow(2, true)]), { status: 200 }));

    const response = await POST(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/sponsors`, {
      method: "POST",
      body: sponsorForm(true),
    }), { params: { id: editionId } });
    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
