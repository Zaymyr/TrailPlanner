export type PlanRow = {
  id: string;
  created_at: string;
  name: string;
  updated_at: string;
  race_id: string | null;
  planner_values: {
    raceDistanceKm?: number;
    elevationGain?: number;
    paceMinutes?: number;
    paceSeconds?: number;
    speedKph?: number;
    paceType?: 'pace' | 'speed';
  };
  races?: { name: string } | null;
};

export type RaceSection = {
  raceId: string | null;
  raceName: string;
  isOwned: boolean;
  isAdmin: boolean;
  data: PlanRow[];
};

export type PickerRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  thumbnail_url?: string | null;
};

export type PickerEventGroup = {
  id: string;
  name: string;
  location: string | null;
  race_date: string | null;
  thumbnail_url?: string | null;
  races: PickerRace[];
};
