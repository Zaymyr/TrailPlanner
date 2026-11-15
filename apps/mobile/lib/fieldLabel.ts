/**
 * Splits an i18n label carrying its unit in trailing parentheses
 * ("Distance (km) *", "Pause (min)") so the unit can be typeset as the
 * Field cote. Labels without a unit come back unchanged.
 */
export function splitLabelUnit(label: string): { label: string; unit?: string } {
  const match = /^(.*?)\s*\(([^()]{1,12})\)\s*(\*?)\s*$/.exec(label);
  if (!match) return { label };
  const base = `${match[1].trim()}${match[3] ? ' *' : ''}`;
  return base ? { label: base, unit: match[2].trim() } : { label };
}
