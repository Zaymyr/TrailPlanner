export type ProfileTabKey = 'personal' | 'performance' | 'settings';

export type CarbEstimatorLevel = 'beginner' | 'moderate' | 'gels' | 'high';
export type HydrationEstimatorLevel = 'low' | 'normal' | 'thirsty' | 'very_thirsty';
export type SodiumEstimatorLevel = 'low' | 'normal' | 'salty' | 'very_salty';

export type EstimatedHourlyTargets = {
  carbsGPerHour: number;
  waterMlPerHour: number;
  sodiumMgPerHour: number;
};

export type ChangelogEntry = {
  id: number;
  published_at: string;
  version: string;
  title: string;
  detail: string;
};
