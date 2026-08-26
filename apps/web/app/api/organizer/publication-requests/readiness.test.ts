import { afterEach, describe, expect, it, vi } from "vitest";

import { validateOrganizerEventPublication } from "../../../../lib/organizer-publication";

const serviceConfig = {
  supabaseUrl: "https://supabase.example",
  supabaseServiceRoleKey: "service-key",
};

const eventRow = (distanceKm: number) => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Trail test",
  location: "Fort test",
  race_event_editions: [
    {
      id: "22222222-2222-2222-2222-222222222222",
      start_date: "2026-05-17",
      end_date: "2026-05-17",
      is_current: false,
    },
    {
      id: "33333333-3333-3333-3333-333333333333",
      start_date: "2027-03-27",
      end_date: "2027-03-28",
      is_current: true,
    },
  ],
  races: [
    {
      id: "44444444-4444-4444-4444-444444444444",
      edition_id: "22222222-2222-2222-2222-222222222222",
      name: "Les 2 Savoies",
      distance_km: distanceKm,
      elevation_gain_m: 2167,
    },
  ],
});

const eventRowWithCurrentEditionRace = (distanceKm: number) => {
  const row = eventRow(25);
  row.races = [
    {
      id: "55555555-5555-5555-5555-555555555555",
      edition_id: "33333333-3333-3333-3333-333333333333",
      name: "Les 2 Savoies",
      distance_km: distanceKm,
      elevation_gain_m: 2167,
    },
  ];
  return row;
};

describe("organizer publication readiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates the requested format edition instead of the current edition", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([eventRow(25)])));

    await expect(
      validateOrganizerEventPublication(
        serviceConfig,
        "11111111-1111-1111-1111-111111111111",
        "44444444-4444-4444-4444-444444444444"
      )
    ).resolves.toEqual({
      ok: true,
      publishableRaceCount: 1,
      raceId: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("rejects only when the requested format itself is incomplete", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([eventRow(0)])));

    const readiness = await validateOrganizerEventPublication(
      serviceConfig,
      "11111111-1111-1111-1111-111111111111",
      "44444444-4444-4444-4444-444444444444"
    );

    expect(readiness).toMatchObject({ ok: false, status: 409 });
  });

  it("validates the current edition and any complete format when no raceId is given", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([eventRowWithCurrentEditionRace(25)])));

    await expect(
      validateOrganizerEventPublication(serviceConfig, "11111111-1111-1111-1111-111111111111")
    ).resolves.toEqual({
      ok: true,
      publishableRaceCount: 1,
      raceId: null,
    });
  });

  it("rejects the event-level request when the current edition has no complete format", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([eventRowWithCurrentEditionRace(0)])));

    const readiness = await validateOrganizerEventPublication(serviceConfig, "11111111-1111-1111-1111-111111111111");

    expect(readiness).toMatchObject({ ok: false, status: 409 });
  });
});
