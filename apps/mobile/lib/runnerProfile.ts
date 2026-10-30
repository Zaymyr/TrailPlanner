export type RunnerProfileDraft = { firstName: string; pace: string; water: string; carbs: string; birthDate: string; height: string; weight: string; utmb: string };

export function parseRunnerProfile(draft: RunnerProfileDraft) {
  const number = (value: string) => value.trim() === '' ? NaN : Number(value.replace(',', '.'));
  const pace = /^\d{1,2}:\d{2}$/.test(draft.pace) ? (() => {
    const [minutes, seconds] = draft.pace.split(':').map(Number);
    return seconds < 60 ? minutes + seconds / 60 : NaN;
  })() : number(draft.pace);
  const water = number(draft.water); const carbs = number(draft.carbs);
  if (!draft.firstName.trim() || draft.firstName.trim().length > 150 || !Number.isFinite(pace) || pace <= 0 || pace > 60 || !Number.isFinite(water) || water < 0 || water > 20 || !Number.isFinite(carbs) || carbs < 0 || carbs > 200) return null;
  const optional = (value: string, min: number, max: number, integer = false) => {
    if (!value.trim()) return null;
    const result = number(value);
    return Number.isFinite(result) && result >= min && result <= max && (!integer || Number.isInteger(result)) ? result : NaN;
  };
  const height = optional(draft.height, 100, 250, true); const weight = optional(draft.weight, 20, 250); const utmb = optional(draft.utmb, 0, 2000);
  if ([height, weight, utmb].some((value) => value !== null && !Number.isFinite(value))) return null;
  const birth = draft.birthDate.trim();
  if (birth && (!/^\d{4}-\d{2}-\d{2}$/.test(birth) || !Number.isFinite(Date.parse(birth)) || new Date(birth).toISOString().slice(0, 10) !== birth || Date.parse(birth) > Date.now())) return null;
  return { full_name: draft.firstName.trim(), comfortable_flat_pace_min_per_km: pace, water_bag_liters: water, default_carbs_g_per_hour: carbs,
    birth_date: birth || null, height_cm: height, weight_kg: weight, utmb_index: utmb };
}
