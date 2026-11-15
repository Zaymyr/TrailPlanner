/**
 * Sub-tabs of the runner RaceBook › Course section.
 *
 * Supporter points ("Où encourager") are deliberately absent: they live only
 * in the Livret accompagnateur (Supporter Guide) to keep the runner book
 * focused on running. The runner Course tab links to that guide instead.
 */
export type RacebookCourseTabKey = 'route' | 'start-waves' | 'aid-stations' | 'relay' | 'awards';

export function resolveRacebookCourseTabKeys(input: {
  aidStations: boolean;
  relay: boolean;
  startWaves: boolean;
  awards: boolean;
}): RacebookCourseTabKey[] {
  const keys: RacebookCourseTabKey[] = ['route'];
  if (input.startWaves) keys.push('start-waves');
  if (input.aidStations) keys.push('aid-stations');
  if (input.relay) keys.push('relay');
  if (input.awards) keys.push('awards');
  return keys;
}
