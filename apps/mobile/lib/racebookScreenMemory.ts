import type { ElevationPoint } from '../components/plan-form/profile-utils';
import type { MobileGpxPreviewPoint } from './gpx';
import type { ResolvedPartnerLink } from './partnerLinks';
import type { RacebookScreenData } from './racebook';
import type { RacebookSponsorPresentation } from './racebookSponsors';

export type RacebookScreenSnapshot = {
  data: RacebookScreenData;
  elevationProfile: ElevationPoint[];
  partnerLinks: ResolvedPartnerLink[];
  routePreviewPoints: MobileGpxPreviewPoint[];
  sponsorPresentation: RacebookSponsorPresentation;
};

const MAX_SNAPSHOTS = 8;
const snapshotsByRaceId = new Map<string, RacebookScreenSnapshot>();
const scrollOffsetsByView = new Map<string, number>();

function buildScrollKey(raceId: string, tab: string, courseTab: string) {
  return `${raceId}:${tab}:${tab === 'course' ? courseTab : '-'}`;
}

export function getRacebookScreenSnapshot(raceId: string | null | undefined) {
  if (!raceId) return null;
  return snapshotsByRaceId.get(raceId) ?? null;
}

export function setRacebookScreenSnapshot(raceId: string, snapshot: RacebookScreenSnapshot) {
  snapshotsByRaceId.delete(raceId);
  snapshotsByRaceId.set(raceId, snapshot);

  while (snapshotsByRaceId.size > MAX_SNAPSHOTS) {
    const oldestRaceId = snapshotsByRaceId.keys().next().value as string | undefined;
    if (!oldestRaceId) break;
    snapshotsByRaceId.delete(oldestRaceId);
  }
}

export function getRacebookScrollOffset(raceId: string, tab: string, courseTab: string) {
  return scrollOffsetsByView.get(buildScrollKey(raceId, tab, courseTab)) ?? 0;
}

export function setRacebookScrollOffset(raceId: string, tab: string, courseTab: string, offset: number) {
  if (!Number.isFinite(offset)) return;
  scrollOffsetsByView.set(buildScrollKey(raceId, tab, courseTab), Math.max(0, offset));
}

export function resetRacebookScreenMemoryForTests() {
  snapshotsByRaceId.clear();
  scrollOffsetsByView.clear();
}
