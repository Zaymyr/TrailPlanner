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
    startSupplies?: Array<{ productId: string; quantity: number }>;
    aidStations?: Array<{
      id?: string;
      name?: string;
      distanceKm?: number;
      supplies?: Array<{ productId: string; quantity: number }>;
    }>;
  };
  elevation_profile?: unknown;
  departureAt?: string | null;
  departureSource?: 'runner' | 'organizer' | null;
  races?: {
    name: string;
    race_date?: string | null;
    organizer_details?: unknown;
    race_events?: {
      id: string;
      name: string;
    } | null;
  } | null;
};

export type RaceSection = {
  sectionKey: string;
  raceId: string | null;
  eventName: string;
  isOwned: boolean;
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
