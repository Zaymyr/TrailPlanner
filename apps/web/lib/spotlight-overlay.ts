export const SPOTLIGHT_OVERLAY_EVENT = "trailplanner:spotlight-overlay" as const;
export const SPOTLIGHT_OVERLAY_ATTRIBUTE = "data-spotlight-overlay" as const;

type SpotlightRect = { x: number; y: number; width: number; height: number };

const PAD = 12;
const GAP = 18;
const MAX_SPOTLIGHT_HEIGHT = 360;
const VIEWPORT_EDGE = 8;

export const isSpotlightOverlayOpen = () =>
  typeof document !== "undefined"
  && document.documentElement.getAttribute(SPOTLIGHT_OVERLAY_ATTRIBUTE) === "open";

export const clampSpotlightRect = ({ rect, viewportWidth, viewportHeight, dialogHeight }: {
  rect: SpotlightRect;
  viewportWidth: number;
  viewportHeight: number;
  dialogHeight: number;
}): SpotlightRect => {
  const targetBottom = rect.y + rect.height;
  const topRegionEnd = Math.max(PAD, viewportHeight - VIEWPORT_EDGE - dialogHeight - PAD - GAP);
  const bottomRegionStart = Math.min(
    viewportHeight - PAD,
    VIEWPORT_EDGE + dialogHeight + PAD + GAP,
  );

  const candidateForRegion = (start: number, end: number) => {
    const intersectionStart = Math.max(rect.y, start);
    const intersectionEnd = Math.min(targetBottom, end);
    const intersectionHeight = Math.max(0, intersectionEnd - intersectionStart);
    const regionHeight = Math.max(0, end - start);
    const height = Math.min(
      intersectionHeight || rect.height,
      MAX_SPOTLIGHT_HEIGHT,
      regionHeight,
    );
    const y = intersectionHeight > 0
      ? intersectionStart
      : Math.max(start, Math.min(rect.y, end - height));
    return { y, height, visibleTargetHeight: intersectionHeight };
  };

  const topCandidate = candidateForRegion(PAD, topRegionEnd);
  const bottomCandidate = candidateForRegion(bottomRegionStart, viewportHeight - PAD);
  const targetCenter = rect.y + rect.height / 2;
  const candidate = topCandidate.visibleTargetHeight > bottomCandidate.visibleTargetHeight
    || (topCandidate.visibleTargetHeight === bottomCandidate.visibleTargetHeight
      && targetCenter <= viewportHeight / 2)
    ? topCandidate
    : bottomCandidate;
  const width = Math.min(rect.width, Math.max(0, viewportWidth - PAD * 2));
  return {
    x: Math.max(PAD, Math.min(rect.x, viewportWidth - PAD - width)),
    y: candidate.y,
    width,
    height: candidate.height,
  };
};

export const getOnboardingModalTop = ({ spotlight, viewportHeight, dialogHeight }: {
  spotlight: SpotlightRect;
  viewportHeight: number;
  dialogHeight: number;
}) => {
  const below = spotlight.y + spotlight.height + PAD + GAP;
  if (below + dialogHeight <= viewportHeight - VIEWPORT_EDGE) return below;
  return Math.max(VIEWPORT_EDGE, spotlight.y - PAD - dialogHeight - GAP);
};
