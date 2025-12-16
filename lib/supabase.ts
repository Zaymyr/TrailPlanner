import { z } from "zod";

type SupabaseAnonConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const supabaseEnvSchema = z.object({
  supabaseUrl: z.string().trim().url(),
  supabaseAnonKey: z.string().trim().min(1),
});

const supabaseUrlSchema = z.object({
  supabaseUrl: z.string().trim().url(),
});

export const getSupabaseUrl = (): string | null => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  const parsed = supabaseUrlSchema.safeParse({ supabaseUrl });

  if (!parsed.success) {
    console.error("Missing Supabase URL", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data.supabaseUrl;
};

export const getSupabaseAnonConfig = (): SupabaseAnonConfig | null => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const parsed = supabaseEnvSchema.safeParse({ supabaseUrl, supabaseAnonKey });

  if (!parsed.success) {
    console.error("Missing Supabase anon configuration", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data;
};

export const extractBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
};

export type SupabaseUser = {
  id: string;
  email?: string;
};

export const fetchSupabaseUser = async (
  accessToken: string,
  config: SupabaseAnonConfig
): Promise<SupabaseUser | null> => {
  try {
    const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: config.supabaseAnonKey,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Unable to fetch Supabase user", await response.text());
      return null;
    }

    const data = (await response.json()) as { id?: string; email?: string };
    if (!data?.id) {
      return null;
    }

    return { id: data.id, email: data.email };
  } catch (error) {
    console.error("Unexpected error while verifying Supabase token", error);
    return null;
  }
};
