import { afterEach, describe, expect, it, vi } from "vitest";

import { loadOrganizerPublicationRequirement } from "./organizer-publication-tier";

const loadOrganizerModuleSettings = vi.hoisted(() => vi.fn());

vi.mock("./organizer-module-settings", () => ({
  loadOrganizerModuleSettings,
}));

const editionId = "22222222-2222-4222-8222-222222222222";
const eventId = "11111111-1111-4111-8111-111111111111";

describe("loadOrganizerPublicationRequirement", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses the edition_id primary key when checking edition branding", async () => {
    loadOrganizerModuleSettings.mockResolvedValue({
      edition: {
        equipment: false,
        bib_pickup: false,
        access: false,
        services: false,
        branding: true,
        sponsors: false,
      },
      races: {},
    });

    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes("/races?")) return Response.json([]);
      if (url.includes("/race_event_editions?")) return Response.json([{ event_id: eventId }]);
      if (url.includes("/race_events?")) return Response.json([{ organizer_details: null }]);
      if (url.includes("/race_edition_services?")) return Response.json([]);
      if (url.includes("/race_event_edition_sponsors?")) return Response.json([]);
      if (url.includes("/race_event_edition_branding?")) {
        if (!url.includes("select=edition_id")) {
          return Response.json({ message: "column race_event_edition_branding.id does not exist" }, { status: 400 });
        }
        return Response.json([{ edition_id: editionId }]);
      }

      return Response.json({ message: `Unexpected request: ${url}` }, { status: 500 });
    }));

    const result = await loadOrganizerPublicationRequirement({
      supabaseUrl: "https://project.supabase.co",
      supabaseServiceRoleKey: "service-role-key",
    }, editionId);

    expect(result.tier).toBe("signature");
    expect(result.usedModules).toContain("branding");
    expect(requestedUrls).toContain(
      `https://project.supabase.co/rest/v1/race_event_edition_branding?edition_id=eq.${editionId}&select=edition_id&limit=1`,
    );
  });
});
