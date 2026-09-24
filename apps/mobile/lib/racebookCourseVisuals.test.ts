import { describe, expect, it } from 'vitest';

import {
  getElevationBounds,
  getCourseProgressAtDistance,
  elevationProfileFromRoute,
  interpolateElevationAtDistance,
  projectDistanceOnRoute,
} from './racebookCourseVisuals';

describe('RaceBook course visual helpers', () => {
  const route = [
    { lat: 45, lng: 6, elevationM: 800, distanceKm: 0 },
    { lat: 46, lng: 7, elevationM: 1_200, distanceKm: 10 },
    { lat: 47, lng: 8, elevationM: 900, distanceKm: 20 },
  ];

  it('projects an aid station between the surrounding GPX points', () => {
    expect(projectDistanceOnRoute(route, 5)).toEqual({ lat: 45.5, lng: 6.5, distanceKm: 5 });
  });

  it('does not place an aid station beyond the measured trace at the endpoint', () => {
    expect(projectDistanceOnRoute(route, 99)).toBeNull();
  });

  it('interpolates the altitude used by an aid-station marker', () => {
    expect(interpolateElevationAtDistance(route.map(({ distanceKm, elevationM }) => ({ distanceKm, elevationM: elevationM! })), 15)).toBe(1_050);
  });

  it('returns cumulative gain and loss at any distance on the profile', () => {
    expect(getCourseProgressAtDistance(route, 15)).toEqual({
      distanceKm: 15,
      elevationM: 1_050,
      elevationGainM: 400,
      elevationLossM: 150,
    });
  });

  it('ignores sub-metre elevation noise in cumulative progress', () => {
    expect(getCourseProgressAtDistance([
      { distanceKm: 0, elevationM: 800 },
      { distanceKm: 1, elevationM: 800.5 },
      { distanceKm: 2, elevationM: 810.5 },
    ], 2)).toMatchObject({ elevationGainM: 10, elevationLossM: 0 });
  });

  it('interpolates progress smoothly inside a significant elevation segment', () => {
    expect(getCourseProgressAtDistance([
      { distanceKm: 0, elevationM: 800 },
      { distanceKm: 10, elevationM: 900 },
    ], 0.05)).toMatchObject({ elevationGainM: 0.5, elevationLossM: 0 });
  });

  it('summarizes the visible altitude range', () => {
    expect(getElevationBounds(route.map(({ distanceKm, elevationM }) => ({ distanceKm, elevationM: elevationM! })))).toEqual({
      minElevationM: 800,
      maxElevationM: 1_200,
    });
  });

  it('builds a profile from route points while ignoring missing elevation', () => {
    expect(elevationProfileFromRoute([
      ...route,
      { lat: 48, lng: 9, elevationM: null, distanceKm: 25 },
    ])).toEqual([
      { distanceKm: 0, elevationM: 800 },
      { distanceKm: 10, elevationM: 1_200 },
      { distanceKm: 20, elevationM: 900 },
    ]);
  });
});
