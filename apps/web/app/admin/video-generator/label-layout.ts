import { isSamePlace } from "./place-labels";

/**
 * Which map labels (start/finish names, aid bubbles) are shown in a frame. Pure geometry: the map
 * client measures the screen boxes (projection of the anchor plus the element size) and applies the
 * verdicts; the decision only depends on those boxes, so the preview and the export agree.
 *
 * Rules: a label that is not entirely inside the frame is hidden (never half cut); when two boxes
 * overlap the one of lower priority is hidden: the aid bubble currently shown, then the start /
 * finish label, then any other label.
 */

export type LabelKind = "aid" | "endpoint" | "other";

/** Higher wins. */
export const LABEL_PRIORITY: Record<LabelKind, number> = { aid: 3, endpoint: 2, other: 1 };

export type LabelBox = { left: number; top: number; right: number; bottom: number };

export type LabelCandidate = {
  id: string;
  kind: LabelKind;
  /** Screen box in frame pixels, or null when the anchor cannot be projected (behind the camera). */
  box: LabelBox | null;
  /** False for a label that is faded out (an aid bubble outside its window): it takes no room. */
  active: boolean;
};

/** Gap kept between two labels, in pixels, so they never touch. */
export const LABEL_GAP_PX = 6;

export const boxesOverlap = (left: LabelBox, right: LabelBox, gap = 0) =>
  left.left < right.right + gap && right.left < left.right + gap && left.top < right.bottom + gap && right.top < left.bottom + gap;

export const isBoxInsideFrame = (box: LabelBox, frame: { width: number; height: number }) =>
  box.left >= 0 && box.top >= 0 && box.right <= frame.width && box.bottom <= frame.height;

/**
 * Box of a label card pinned above an anchor: centred on it horizontally, its bottom at the anchor
 * plus the marker offset (negative = above), `extraBottom` for a tail that hangs under the card.
 */
export const getPinnedLabelBox = (
  anchor: { x: number; y: number },
  size: { width: number; height: number },
  offsetY: number,
  extraBottom = 0,
): LabelBox => {
  const bottom = anchor.y + offsetY;
  return { left: anchor.x - size.width / 2, right: anchor.x + size.width / 2, top: bottom - size.height, bottom: bottom + extraBottom };
};

/**
 * Visibility of every label: `true` when it may be shown. Inactive labels are not shown and take no
 * room. Labels are placed by priority (ties keep their order in the list); a label is hidden when
 * its box is not fully inside the frame or overlaps one already placed.
 */
export const resolveLabelVisibility = (
  candidates: LabelCandidate[],
  frame: { width: number; height: number },
  gap = LABEL_GAP_PX,
): Map<string, boolean> => {
  const verdicts = new Map<string, boolean>();
  const placed: LabelBox[] = [];
  candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => LABEL_PRIORITY[right.candidate.kind] - LABEL_PRIORITY[left.candidate.kind] || left.index - right.index)
    .forEach(({ candidate }) => {
      const { box } = candidate;
      const visible = candidate.active && box !== null && isBoxInsideFrame(box, frame) && !placed.some((other) => boxesOverlap(box, other, gap));
      verdicts.set(candidate.id, visible);
      if (visible && box) placed.push(box);
    });
  return verdicts;
};

export type EndpointLabelSpec = {
  id: "start" | "finish" | "start-finish";
  kind: string;
  name: string;
  /** True when the label is anchored at the finish point, false at the start point. */
  atFinish: boolean;
};

/**
 * Start and finish labels to draw. A loop (start and finish less than 1,500 m apart, the same rule
 * as the endpoint names) gets ONE label « Départ / Arrivée » with the start name.
 */
export const getEndpointLabelSpecs = (
  names: { start: string | null; finish: string | null },
  start: { lat: number; lon: number },
  finish: { lat: number; lon: number },
): EndpointLabelSpec[] => {
  if (isSamePlace(start, finish)) {
    const name = names.start ?? names.finish;
    return name ? [{ id: "start-finish", kind: "Départ / Arrivée", name, atFinish: false }] : [];
  }
  const specs: EndpointLabelSpec[] = [];
  if (names.start) specs.push({ id: "start", kind: "Départ", name: names.start, atFinish: false });
  if (names.finish) specs.push({ id: "finish", kind: "Arrivée", name: names.finish, atFinish: true });
  return specs;
};
