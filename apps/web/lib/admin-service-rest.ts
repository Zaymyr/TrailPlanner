import type { SupabaseServiceConfig } from "./supabase";

/**
 * Read-only Data API helpers of the admin console loaders (service role, server only): JSON read,
 * RPC call and `settle`, which turns a failing source into `null` (logged) so the other sources of
 * a screen still load. Shared by `admin-system-health-server.ts` and `admin-billing-server.ts`.
 */

export const serviceRestHeaders = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  ...extra,
});

export const getServiceJson = async (supabase: SupabaseServiceConfig, path: string): Promise<unknown> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, { headers: serviceRestHeaders(supabase), cache: "no-store" });
  if (!response.ok) throw new Error(`Read failed (${response.status}): ${path.split("?")[0]}`);
  return response.json();
};

export const callServiceRpc = async (supabase: SupabaseServiceConfig, name: string, body: Record<string, unknown> = {}): Promise<unknown> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceRestHeaders(supabase, { "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`RPC ${name} failed (${response.status}).`);
  return response.json();
};

export const settleSource = async <T>(promise: Promise<T>, label = "Admin source"): Promise<T | null> => {
  try {
    return await promise;
  } catch (error) {
    console.error(`${label} failed`, error instanceof Error ? error.message : error);
    return null;
  }
};
