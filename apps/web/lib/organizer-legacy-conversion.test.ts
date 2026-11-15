import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { convertOrganizerLegacyBlock, OrganizerLegacyConversionError } from "./organizer-legacy-conversion";

const openAiResponse = (proposal: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(proposal) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });

describe("convertOrganizerLegacyBlock", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a parking capacity and shuttle frequency in the structured proposal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(openAiResponse({
      parkings: [{ name: "Parking des Glières", address: "Route du col", capacity: 250, paid: false, note: null }],
      shuttleLines: [{ from: "Gare", to: "Départ", startTime: "06:00", endTime: "08:00", frequencyMinutes: 15, bookingUrl: null, free: true, note: null }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const proposal = await convertOrganizerLegacyBlock({ block: "access", text: "Parking 250 places. Navette toutes les 15 minutes.", apiKey: "test" });

    expect(proposal).toMatchObject({ parkings: [{ capacity: 250 }], shuttleLines: [{ frequencyMinutes: 15 }] });
    const request = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(request.response_format.json_schema).toMatchObject({ strict: true, name: "organizer_access_proposal" });
  });

  it("accepts a normalized 9h cutoff as 09:00", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(openAiResponse({
      amenities: { toilets: false, shelter: false, medical: false, hotDrinks: false, hotFood: false },
      dropBagAvailable: false,
      maxStopMinutes: null,
      supportersAccess: null,
      cutoffTime: "09:00",
      cutoffDayOffset: 0,
      note: null,
    })));

    await expect(convertOrganizerLegacyBlock({ block: "aid_station", text: "Barrière à 9h", apiKey: "test" })).resolves.toMatchObject({ cutoffTime: "09:00", cutoffDayOffset: 0 });
  });

  it("rejects empty text without calling OpenAI", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(convertOrganizerLegacyBlock({ block: "equipment", text: "   ", apiKey: "test" })).rejects.toBeInstanceOf(OrganizerLegacyConversionError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
