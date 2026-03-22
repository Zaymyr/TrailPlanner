import type { FormValues, SectionSegment } from "../types";

export const buildSectionKey = (sectionIndex: number) => `section-${sectionIndex}`;

export function getSectionSegments(
  values: Pick<FormValues, "sectionSegments">,
  sectionKey: string,
  totalSectionKm: number
): SectionSegment[] {
  const storedSegments = values.sectionSegments?.[sectionKey];

  if (storedSegments && storedSegments.length > 0) {
    return storedSegments;
  }

  return [{ segmentKm: totalSectionKm }];
}
