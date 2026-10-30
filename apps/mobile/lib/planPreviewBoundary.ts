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

type PreviewUnlockPlacementInput = {
  boundaryTopInSection: number | null;
  scrollY: number;
  sectionTop: number;
  stickyHeaderTop: number;
  stickyToolbarHeight: number;
  toolbarIsSticky: boolean;
};

export function resolvePreviewUnlockPlacement({
  boundaryTopInSection,
  scrollY,
  sectionTop,
  stickyHeaderTop,
  stickyToolbarHeight,
  toolbarIsSticky,
}: PreviewUnlockPlacementInput): 'inline' | 'sticky' {
  if (!toolbarIsSticky || boundaryTopInSection === null) return 'inline';
  const boundaryViewportTop = sectionTop + boundaryTopInSection - scrollY;
  const stickyToolbarBottom = stickyHeaderTop + stickyToolbarHeight;
  return boundaryViewportTop <= stickyToolbarBottom ? 'sticky' : 'inline';
}

export function getPreviewReachableContentMinHeight(
  boundaryContentTop: number | null,
  viewportHeight: number,
  pinnedTabsBottom: number,
): number | undefined {
  if (
    boundaryContentTop === null
    || !Number.isFinite(boundaryContentTop)
    || viewportHeight <= 0
    || !Number.isFinite(viewportHeight)
    || !Number.isFinite(pinnedTabsBottom)
  ) {
    return undefined;
  }
  return Math.max(0, Math.ceil(boundaryContentTop + viewportHeight - pinnedTabsBottom + 1));
}
