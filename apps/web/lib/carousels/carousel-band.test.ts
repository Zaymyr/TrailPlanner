import { describe, expect, it } from "vitest";

import {
  BAND_TOP,
  buildBand,
  buildSkyStops,
  buildStones,
  buildThirds,
  DAY_SKY,
  isNightStart,
  layoutSigns,
  parisStartUtcMs,
  scaleProfile,
  selectBandLevel,
  skyColorAt,
} from "./carousel-band";

const profile = Array.from({ length: 81 }, (_, km) => ({ km: km * 0.98, elevationM: 300 + Math.sin(km / 8) * 200 }));
const stations = [17, 32, 46, 60, 67].map((km, index) => ({ km, name: ["Saint-Christo", "Sainte-Catherine", "Saint-Genou", "Soucieu", "Chaponost"][index] }));

describe("band level", () => {
  it("draws the real profile with a GPX, a flat path with stations, stones with neither", () => {
    expect(selectBandLevel({ profile, stations })).toBe(1);
    expect(selectBandLevel({ profile: null, stations })).toBe(2);
    expect(selectBandLevel({ profile: [], stations: [] })).toBe(3);
  });

  it("never draws a profile without a GPX: levels 2 and 3 are flat paths", () => {
    const band = buildBand({ slideCount: 3, totalKm: 30, elevationGainM: 1_270, profile: null, stations: [{ km: 8, name: "Possession" }], startLabel: "Le Port", finishLabel: "Saint-Denis", clock: null });
    expect(band.ridgePath).toBe("M0 1290 L3240 1290");
    expect(band.decor).toHaveLength(2);
    expect(band.stones).toEqual([]);
    const bare = buildBand({ slideCount: 3, totalKm: 60, elevationGainM: null, profile: null, stations: [], startLabel: "Départ", finishLabel: "Arrivée", clock: null });
    expect(bare.level).toBe(3);
    expect(bare.decor).toEqual([]);
    expect(bare.stones.map((stone) => stone.km)).toEqual([10, 20, 30, 40, 50]);
  });
});

describe("profile scaling", () => {
  it("stretches the GPX to the announced distance and keeps the ridge inside the band", () => {
    const scaled = scaleProfile(profile, 80, 3_240);
    expect(scaled.points[0].x).toBe(0);
    expect(scaled.points[scaled.points.length - 1].x).toBe(3_240);
    scaled.points.forEach((point) => {
      expect(point.y).toBeGreaterThanOrEqual(1_188);
      expect(point.y).toBeLessThanOrEqual(1_338);
    });
    // The highest GPX point lands at the top of the ridge band.
    expect(Math.min(...scaled.points.map((point) => point.y))).toBeCloseTo(1_188, 0);
  });

  it("draws a flat ridge for a GPX without relief", () => {
    expect(scaleProfile([{ km: 0, elevationM: 100 }, { km: 10, elevationM: 100 }], 10, 3_240).groundYAt(5)).toBe(1_290);
  });
});

describe("sign plates", () => {
  const flat = () => 1_290;
  const flags = { start: "Départ", finish: "Arrivée" };

  it("writes the full « KM 17 · Name » plates when they fit", () => {
    const { signs, compact } = layoutSigns(stations, 80, 3_240, flat, flags);
    expect(compact).toBe(false);
    expect(signs[0].label).toBe("KM 17 · Saint-Christo");
    expect(signs.every((sign) => sign.plate && sign.top >= BAND_TOP + 34)).toBe(true);
  });

  it("switches every plate to « KM 58 » when two full plates would overlap", () => {
    const close = [{ km: 21, name: "La Comelle" }, { km: 25, name: "Millay" }, { km: 58, name: "Villapourçon" }];
    const { signs, compact } = layoutSigns(close, 185, 3_240, flat, flags);
    expect(compact).toBe(true);
    expect(signs.map((sign) => sign.label)).toEqual(["KM 21", "KM 25", "KM 58"]);
  });

  it("lifts a short plate that still overlaps, and keeps only the post when no row is free", () => {
    const crowded = [{ km: 50, name: "A" }, { km: 50.5, name: "B" }, { km: 51, name: "C" }];
    const { signs } = layoutSigns(crowded, 100, 3_240, flat, flags);
    expect(signs[1].top).toBeLessThan(signs[0].top);
    expect(signs[2].plate).toBe(false);
  });

  it("uses short plates for a long station name", () => {
    expect(layoutSigns([{ km: 40, name: "Roussillon-en-Morvan sur la colline" }], 80, 3_240, flat, flags).compact).toBe(true);
  });
});

describe("sky from the race clock", () => {
  // SaintéLyon-like: start 23:30 on 28 Nov near Saint-Étienne, 12 h at a steady pace.
  const startUtcMs = parisStartUtcMs("2026-11-28", "23:30") as number;
  const clock = { startUtcMs, lat: 45.43, lon: 4.39, timeline: [{ km: 0, seconds: 0 }, { km: 80, seconds: 12 * 3_600 }] };

  it("reads the start in Paris wall time", () => {
    expect(new Date(startUtcMs).toISOString()).toBe("2026-11-28T22:30:00.000Z");
    expect(parisStartUtcMs("2026-11-28", null)).toBeNull();
  });

  it("goes from night at the start to day at the finish", () => {
    const stops = buildSkyStops(clock, 80);
    expect(stops[0]).toEqual({ offset: 0, color: "#0E1A06" });
    expect(stops[stops.length - 1].offset).toBe(1);
    expect(stops[stops.length - 1].color).not.toBe("#0E1A06");
    expect(isNightStart(startUtcMs, 45.43, 4.39)).toBe(true);
  });

  it("is a plain day sky without a start time", () => {
    expect(buildSkyStops(null, 80)).toBe(DAY_SKY);
    expect(isNightStart(null, 45, 4)).toBe(false);
  });

  it("maps the sun elevation to night, dawn and day colours", () => {
    expect(skyColorAt(-30)).toBe("#0E1A06");
    expect(skyColorAt(2)).toBe("#E8A36A");
    expect(skyColorAt(30)).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("markers", () => {
  it("labels each slide with its kilometre range and places stones every 5 km under 30 km", () => {
    expect(buildThirds(80, 3)).toEqual(["KM 0 → 27", "KM 27 → 53", "KM 53 → 80"]);
    expect(buildStones(25, 3_240).map((stone) => stone.km)).toEqual([5, 10, 15, 20]);
  });
});
