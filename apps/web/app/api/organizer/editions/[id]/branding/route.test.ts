import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET, PATCH, POST, PUT } from "./route";

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
const brandingRow = {
  edition_id: editionId,
  draft_logo_url: "https://db.example.com/storage/v1/object/public/race-images/organizer-branding/edition/new.png",
  draft_primary_color: "#123456",
  draft_accent_color: "#ABCDEF",
  published_logo_url: "https://db.example.com/storage/v1/object/public/race-images/organizer-branding/edition/old.png",
  published_primary_color: "#654321",
  published_accent_color: "#FEDCBA",
  published_at: "2026-09-06T12:00:00.000Z",
  updated_at: "2026-09-07T12:00:00.000Z",
};

beforeEach(() => {
  mocks.requireOrganizerAuth.mockResolvedValue({
    user: { id: "user-1" },
    serviceConfig: { supabaseUrl: "https://db.example.com", supabaseServiceRoleKey: "service" },
  });
  mocks.requireEventOrganizer.mockResolvedValue(true);
  mocks.requireOrganizerEditionCapability.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("organizer RaceBook branding route", () => {
  it("requires the Pro branding capability", async () => {
    mocks.requireOrganizerEditionCapability.mockResolvedValue(false);
    vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }));
    const response = await GET(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/branding`), { params: { id: editionId } });
    expect(response.status).toBe(403);
    expect(mocks.requireOrganizerEditionCapability).toHaveBeenCalledWith(expect.anything(), editionId, "branding.manage");
  });

  it("returns defaults when no branding row exists", async () => {
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const response = await GET(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/branding`), { params: { id: editionId } });
    expect(await response.json()).toMatchObject({ branding: { draft: { primaryColor: "#2D5016", accentColor: "#B45309" }, publishedAt: null } });
  });

  it("rejects malformed colors before writing a draft", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }));
    const response = await PATCH(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/branding`, {
      method: "PATCH",
      body: JSON.stringify({ primaryColor: "red", accentColor: "#B45309" }),
    }), { params: { id: editionId } });
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a spoofed image MIME type before upload", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }));
    const formData = new FormData();
    formData.set("image", new File(["not a png"], "logo.png", { type: "image/png" }));
    const response = await PUT(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/branding`, {
      method: "PUT",
      body: formData,
    }), { params: { id: editionId } });
    expect(response.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("publishes the full draft and removes the superseded published logo", async () => {
    const published = {
      ...brandingRow,
      published_logo_url: brandingRow.draft_logo_url,
      published_primary_color: brandingRow.draft_primary_color,
      published_accent_color: brandingRow.draft_accent_color,
      published_at: "2026-09-07T13:00:00.000Z",
    };
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: editionId, event_id: eventId }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([brandingRow]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(published), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const response = await POST(new NextRequest(`http://localhost/api/organizer/editions/${editionId}/branding`, {
      method: "POST",
      body: JSON.stringify({ action: "publish" }),
    }), { params: { id: editionId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ branding: { published: { logoUrl: brandingRow.draft_logo_url }, hasUnpublishedChanges: false } });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "https://db.example.com/rest/v1/rpc/publish_racebook_edition_branding", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://db.example.com/storage/v1/object/race-images/organizer-branding/edition/old.png", expect.objectContaining({ method: "DELETE" }));
  });
});
