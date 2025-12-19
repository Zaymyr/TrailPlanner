import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";

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

  const supabase = createServerClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const accessToken =
    extractBearerToken(request.headers.get("authorization")) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (accessToken) {
    void supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
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

  return { supabase, user: data.user ?? null, accessToken: data.session?.access_token ?? accessToken };
};
