export type PlanPreviewStation = { id?: string | null };
export type PreviewLimitReason = 'scroll' | 'press';

export type PlanPreviewBoundary = {
  departureIndex: number;
  firstSectionStartIndex: number | null;
  ghostStationIndexes: number[];
  hasGhostContent: boolean;
};

export function getPreviewBoundaryTop(activeViewTop: number, boundaryLocalTop: number): number {
  return activeViewTop + boundaryLocalTop;
}

export function resolvePlanPreviewBoundary(
  stations: readonly PlanPreviewStation[],
  departId: string,
): PlanPreviewBoundary {
  const departureIndex = stations.findIndex((station) => station.id === departId);
  const firstSectionStartIndex = departureIndex >= 0 && stations[departureIndex + 1]
    ? departureIndex
    : null;
  const ghostStationIndexes = stations
    .map((_, index) => index)
    .filter((index) => index !== departureIndex);

  return {
    departureIndex,
    firstSectionStartIndex,
    ghostStationIndexes,
    hasGhostContent: ghostStationIndexes.length > 0,
  };
}

export function shouldStickPreviewUnlock(
  scrollY: number,
  boundaryTop: number | null,
  stickyTop: number,
): boolean {
  return boundaryTop !== null && scrollY + stickyTop >= boundaryTop;
}
