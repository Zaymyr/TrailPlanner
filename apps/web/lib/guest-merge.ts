import type { SupabaseClient } from "@supabase/supabase-js";

export const guestOwnedReferences = [
  ["race_plans", "user_id"],
  ["nutrition_plans", "user_id"],
  ["races", "created_by"],
  ["products", "created_by"],
  ["race_requests", "user_id"],
  ["user_notifications", "user_id"],
  ["traces", "owner_id"],
] as const;

export async function moveGuestOwnedReferences(
  adminClient: SupabaseClient,
  sourceUserId: string,
  targetUserId: string
) {
  for (const [table, column] of guestOwnedReferences) {
    const { error } = await adminClient.from(table).update({ [column]: targetUserId }).eq(column, sourceUserId);
    if (error) throw error;
  }
}
