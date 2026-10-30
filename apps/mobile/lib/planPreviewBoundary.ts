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
  boundaryHeight: number;
  boundaryTopInSection: number | null;
  scrollY: number;
  sectionTop: number;
  targetCenterY: number;
  toolbarIsSticky: boolean;
};

export function resolvePreviewUnlockPlacement({
  boundaryHeight,
  boundaryTopInSection,
  scrollY,
  sectionTop,
  targetCenterY,
  toolbarIsSticky,
}: PreviewUnlockPlacementInput): 'inline' | 'sticky' {
  if (!toolbarIsSticky || boundaryTopInSection === null) return 'inline';
  const boundaryCenterInViewport = sectionTop + boundaryTopInSection + boundaryHeight / 2 - scrollY;
  return boundaryCenterInViewport <= targetCenterY ? 'sticky' : 'inline';
}

export type CenteredPreviewUnlockGeometry = {
  centerY: number;
  top: number;
  usefulBottom: number;
  usefulTop: number;
};

export function resolveCenteredPreviewUnlockGeometry(
  viewportHeight: number,
  pinnedTabsBottom: number,
  ctaHeight: number,
  margin = 12,
): CenteredPreviewUnlockGeometry {
  const safeViewportHeight = Math.max(0, viewportHeight);
  const safeCtaHeight = Math.max(0, ctaHeight);
  const usefulTop = Math.min(safeViewportHeight, Math.max(0, pinnedTabsBottom + margin));
  const usefulBottom = Math.max(usefulTop, safeViewportHeight - margin);
  const idealTop = usefulTop + (usefulBottom - usefulTop - safeCtaHeight) / 2;
  const maxTop = Math.max(0, safeViewportHeight - safeCtaHeight);
  const top = Math.min(maxTop, Math.max(0, idealTop));

  return {
    centerY: top + safeCtaHeight / 2,
    top,
    usefulBottom,
    usefulTop,
  };
}

export function getPreviewReachableContentMinHeight(
  boundaryContentTop: number | null,
  boundaryHeight: number,
  viewportHeight: number,
  targetCenterY: number,
): number | undefined {
  if (
    boundaryContentTop === null
    || !Number.isFinite(boundaryContentTop)
    || viewportHeight <= 0
    || !Number.isFinite(viewportHeight)
    || !Number.isFinite(boundaryHeight)
    || !Number.isFinite(targetCenterY)
  ) {
    return undefined;
  }
  const boundaryCenter = boundaryContentTop + Math.max(0, boundaryHeight) / 2;
  return Math.max(0, Math.ceil(boundaryCenter + viewportHeight - targetCenterY + 1));
}
