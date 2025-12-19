import { cookies } from "next/headers";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth-cookies";
import { extractBearerToken, getSupabaseAnonConfig } from "./supabase";

type ServerClientResult = {
  supabase: SupabaseClient;
  accessToken: string | null;
};

export const createSupabaseServerClient = (request: Request): ServerClientResult => {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    throw new Error("Supabase configuration is missing.");
  }

  const cookieStore = cookies();

  const accessToken =
    extractBearerToken(request.headers.get("authorization")) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  const supabase = createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  if (accessToken && refreshToken) {
    void supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  return { supabase, accessToken };
};

export const getSupabaseUserFromRequest = async (
  request: Request
): Promise<{ supabase: SupabaseClient; user: User | null; accessToken: string | null }> => {
  const { supabase, accessToken } = createSupabaseServerClient(request);
  const { data, error } = await supabase.auth.getUser(accessToken ?? undefined);

  if (error) {
    console.error("Unable to fetch Supabase user", error);
    return { supabase, user: null, accessToken };
  }

  return { supabase, user: data.user ?? null, accessToken };
};
