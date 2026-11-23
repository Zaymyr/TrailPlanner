import type { SupabaseServiceConfig } from "./supabase";

/**
 * Read-only Data API helpers of the admin console loaders (service role, server only): JSON read,
 * RPC call and `settle`, which turns a failing source into `null` (logged) so the other sources of
 * a screen still load. Shared by the overview, inbox, system health, billing and runner profile loaders.
 * A failed read throws an `Error` carrying the HTTP `status` (e.g. 404 of a missing table).
 */

export const serviceRestHeaders = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  ...extra,
});

export type ServiceReadError = Error & { status?: number };

/** Raw response of a Data API read (`extraHeaders`, e.g. `Prefer: count=exact`); throws on a non-2xx status. */
export const getServiceResponse = async (supabase: SupabaseServiceConfig, path: string, extraHeaders: Record<string, string> = {}): Promise<Response> => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, { headers: serviceRestHeaders(supabase, extraHeaders), cache: "no-store" });
  if (!response.ok) {
    const error: ServiceReadError = new Error(`Read failed (${response.status}): ${path.split("?")[0]}`);
    error.status = response.status;
    throw error;
  }
  return response;
};

export const getServiceJson = async (supabase: SupabaseServiceConfig, path: string): Promise<unknown> =>
  (await getServiceResponse(supabase, path)).json();

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
