export type PlanPreviewStation = { id?: string | null };
export type PreviewLimitReason = 'scroll' | 'press';

export type PlanPreviewBoundary = {
  visibleStationIndexes: number[];
  boundaryStationIndex: number | null;
  hasHiddenCourse: boolean;
};

export type PreviewLimitTriggerInput = {
  boundaryTop: number | null;
  hasDeliberateScroll: boolean;
  hasReported: boolean;
  scrollY: number;
  viewportHeight: number;
  threshold?: number;
};

export function shouldTriggerPreviewLimit({
  boundaryTop,
  hasDeliberateScroll,
  hasReported,
  scrollY,
  viewportHeight,
  threshold = 12,
}: PreviewLimitTriggerInput): boolean {
  return boundaryTop !== null
    && hasDeliberateScroll
    && !hasReported
    && scrollY + viewportHeight >= boundaryTop + threshold;
}

export function getPreviewBoundaryTop(activeViewTop: number, boundaryLocalTop: number): number {
  return activeViewTop + boundaryLocalTop;
}

export function resolvePlanPreviewBoundary(
  stations: readonly PlanPreviewStation[],
  departId: string,
  arriveeId: string,
  visibleIntermediateCount = 2,
): PlanPreviewBoundary {
  const intermediateIndexes = stations
    .map((station, index) => ({ station, index }))
    .filter(({ station }) => station.id !== departId && station.id !== arriveeId)
    .map(({ index }) => index);
  const boundaryStationIndex = intermediateIndexes[visibleIntermediateCount] ?? null;

  if (boundaryStationIndex === null) {
    return {
      visibleStationIndexes: stations.map((_, index) => index),
      boundaryStationIndex: null,
      hasHiddenCourse: false,
    };
  }

  return {
    visibleStationIndexes: stations
      .map((_, index) => index)
      .filter((index) => index < boundaryStationIndex),
    boundaryStationIndex,
    hasHiddenCourse: true,
  };
}
