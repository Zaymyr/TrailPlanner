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

export type SupabaseMetadata = {
  role?: string;
  roles?: string[];
} & Record<string, unknown>;

export type SupabaseUser = {
  id: string;
  email?: string;
  role?: string;
  roles?: string[];
  appMetadata?: SupabaseMetadata;
  userMetadata?: Record<string, unknown>;
};

export type SupabaseServiceConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

const supabaseServiceSchema = z.object({
  supabaseUrl: z.string().trim().url(),
  supabaseServiceRoleKey: z.string().trim().min(1),
});

export const getSupabaseServiceConfig = (): SupabaseServiceConfig | null => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  const parsed = supabaseServiceSchema.safeParse({ supabaseUrl, supabaseServiceRoleKey });

  if (!parsed.success) {
    console.error("Missing Supabase service role configuration", parsed.error.flatten().fieldErrors);
    return null;
  }

  return parsed.data;
};

const supabaseUserSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  app_metadata: z
    .object({
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
  user_metadata: z.record(z.unknown()).optional(),
});

const normalizeRoles = (roles: unknown): string[] | undefined => {
  if (!Array.isArray(roles)) return undefined;
  const normalized = roles.filter((value): value is string => typeof value === "string");
  return normalized.length > 0 ? normalized : undefined;
};

export const isAdminUser = (user: SupabaseUser | null): boolean => {
  if (!user) return false;
  const roleFromApp = typeof user.appMetadata?.role === "string" ? user.appMetadata.role : undefined;
  const normalizedRoles = normalizeRoles(user.roles ?? user.appMetadata?.roles);
  const effectiveRole = user.role ?? roleFromApp ?? normalizedRoles?.[0];
  return effectiveRole === "admin" || Boolean(normalizedRoles?.includes("admin"));
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

    const parsed = supabaseUserSchema.safeParse(await response.json());

    if (!parsed.success) {
      console.error("Unable to parse Supabase user", parsed.error.flatten().fieldErrors);
      return null;
    }

    const roles = normalizeRoles(parsed.data.app_metadata?.roles);
    const role =
      parsed.data.app_metadata?.role ??
      roles?.[0] ??
      (typeof parsed.data.user_metadata?.role === "string" ? parsed.data.user_metadata.role : undefined);

    return {
      id: parsed.data.id,
      email: parsed.data.email,
      role,
      roles,
      appMetadata: parsed.data.app_metadata,
      userMetadata: parsed.data.user_metadata,
    };
  } catch (error) {
    console.error("Unexpected error while verifying Supabase token", error);
    return null;
  }
};
