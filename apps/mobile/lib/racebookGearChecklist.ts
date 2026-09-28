import { supabase } from './supabase';

export {
  countMissingRequiredRacebookGearItems,
  getRacebookGearItemKey,
  type RacebookGearGroupKey,
} from './racebookGearItemKey';

export async function loadRacebookGearChecks(raceId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return new Set<string>();

  const { data, error } = await supabase
    .from('racebook_gear_checks')
    .select('item_key')
    .eq('user_id', userId)
    .eq('race_id', raceId);

  if (error) throw error;
  return new Set<string>((data ?? []).map((row: { item_key: string }) => row.item_key));
}

export async function saveRacebookGearCheck(raceId: string, itemKey: string, checked: boolean) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('Missing authenticated session');

  if (checked) {
    const { error } = await supabase
      .from('racebook_gear_checks')
      .upsert(
        { user_id: userId, race_id: raceId, item_key: itemKey },
        { onConflict: 'user_id,race_id,item_key', ignoreDuplicates: true },
      );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('racebook_gear_checks')
    .delete()
    .eq('user_id', userId)
    .eq('race_id', raceId)
    .eq('item_key', itemKey);
  if (error) throw error;
}
