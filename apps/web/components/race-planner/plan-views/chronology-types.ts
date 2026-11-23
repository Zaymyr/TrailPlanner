/**
 * Local copy of the chronology data shape. Identical to the types exported by `lib/plan-chronology.ts`
 * (written on another branch); reconcile at integration by re-exporting from there.
 */
export type ChronologyEvent = {
  minute: number;
  label: string;
  detail: string;
  kind: "carbs" | "water" | "sodium" | "mixed";
};

export type ChronologySection = {
  key: string;
  fromName: string;
  toName: string;
  startMinute: number;
  durationMin: number;
  distanceKm: number;
  dPlus: number;
  dMinus: number;
  events: ChronologyEvent[];
};
