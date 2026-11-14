import { formatCoteUnit } from '../../../lib/trailSignature';

export type MilestoneLabelParts = {
  /** Figure painted on the milestone ("<30", "30–60", "60+"). */
  value: string;
  /** Unit in spaced capitals under the figure ("KM", "D+ M"), or null. */
  unit: string | null;
};

/** Units longer than this are words, not units ("4 ravitos"). */
const MAX_UNIT_LENGTH = 6;

/**
 * Splits a filter label into the figure and the unit engraved on a kilometre
 * milestone: "30–60 km" -> 30–60 / KM, "< 30 km" -> <30 / KM, "60+ km" ->
 * 60+ / KM, "1000 D+ m" -> 1000 / D+ M. Labels without a figure (or with a
 * long trailing word) are returned whole with no unit.
 */
export function splitMilestoneLabel(label: string, unit?: string | null): MilestoneLabelParts {
  const text = label.trim();
  if (unit != null && unit !== '') {
    return { value: compactFigure(text), unit: formatCoteUnit(unit) };
  }
  const match = /^(.*\d\+?)\s*([^\d\s+][^\d]*)$/u.exec(text);
  if (!match) return { value: text, unit: null };
  const parsedUnit = match[2].trim();
  if (!parsedUnit || parsedUnit.length > MAX_UNIT_LENGTH) return { value: text, unit: null };
  return { value: compactFigure(match[1]), unit: formatCoteUnit(parsedUnit) };
}

/** Comparison signs hug their figure on a narrow milestone ("< 30" -> "<30"). */
function compactFigure(value: string): string {
  return value.trim().replace(/([<>≤≥])\s+/gu, '$1');
}
