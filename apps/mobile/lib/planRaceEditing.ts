export type EditableAidStationFields = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  solidRefill: boolean;
  assistanceAllowed: boolean;
  pauseMinutes: number;
};

export function resolveAidStationEdit(
  current: EditableAidStationFields,
  proposed: EditableAidStationFields,
  isLinkedRace: boolean,
): EditableAidStationFields {
  if (!isLinkedRace) return proposed;
  return {
    ...current,
    pauseMinutes: proposed.pauseMinutes,
  };
}
