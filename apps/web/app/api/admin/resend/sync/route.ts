import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
  type SupabaseServiceConfig,
  type SupabaseUser,
} from "../../../../../lib/supabase";
import { getResendConfig, type ResendContactPayload, upsertResendContact } from "../../../../../lib/resend";

const syncRequestSchema = z.object({
  dryRun: z.boolean().optional().default(false),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(100),
  maxPages: z.coerce.number().int().min(1).max(500).optional(),
  includeAnonymous: z.boolean().optional().default(false),
  includeProperties: z.boolean().optional().default(true),
  defaultUnsubscribed: z.boolean().optional().default(true),
});

const supabaseAdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable().optional(),
  is_anonymous: z.boolean().optional(),
  app_metadata: z
    .object({
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
      provider: z.string().optional(),
    })
    .passthrough()
    .optional()
    .nullable(),
  user_metadata: z.record(z.unknown()).optional().nullable(),
});

const usersEnvelopeSchema = z.object({
  users: z.array(supabaseAdminUserSchema),
});

const userProfileRowSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable().optional(),
});

type SupabaseAdminUser = z.infer<typeof supabaseAdminUserSchema>;

const normalizeRoles = (user: SupabaseAdminUser): string[] => {
  const roles = Array.isArray(user.app_metadata?.roles)
    ? user.app_metadata.roles.filter((role): role is string => typeof role === "string" && role.trim().length > 0)
    : [];

  if (roles.length > 0) return roles;

  const role = user.app_metadata?.role;
  return typeof role === "string" && role.trim().length > 0 ? [role] : ["user"];
};

const getMetadataString = (metadata: Record<string, unknown> | null | undefined, keys: string[]): string | null => {
  if (!metadata) return null;

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
};

const splitName = (fullName: string | null): Pick<ResendContactPayload, "firstName" | "lastName"> => {
  if (!fullName) return {};

  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
};

const buildContact = (
  user: SupabaseAdminUser,
  fullName: string | null,
  options: Pick<z.infer<typeof syncRequestSchema>, "defaultUnsubscribed" | "includeProperties">
): ResendContactPayload | null => {
  if (!user.email) return null;

  const roles = normalizeRoles(user);
  const metadataName = getMetadataString(user.user_metadata, ["full_name", "name"]);
  const nameParts = splitName(fullName ?? metadataName);
  const properties = options.includeProperties
    ? {
        source: "supabase",
        supabase_user_id: user.id,
        supabase_created_at: user.created_at,
        ...(user.last_sign_in_at ? { supabase_last_sign_in_at: user.last_sign_in_at } : {}),
        app_roles: roles.join(","),
      }
    : undefined;

  return {
    email: user.email.toLowerCase(),
    ...nameParts,
    unsubscribed: options.defaultUnsubscribed,
    properties,
  };
};

type AdminAuthResult =
  | {
      error: NextResponse;
    }
  | {
      supabaseService: SupabaseServiceConfig;
      supabaseUser: SupabaseUser;
    };

const authorizeAdmin = async (request: NextRequest): Promise<AdminAuthResult> => {
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return {
      error: withSecurityHeaders(
        NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
      ),
    };
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  }

  const supabaseUser = await fetchSupabaseUser(token, supabaseAnon);

  if (!supabaseUser || !isAdminUser(supabaseUser)) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Admin access required." }, { status: 403 })) };
  }

  return { supabaseService, supabaseUser };
};

const fetchSupabaseUsersPage = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  page: number,
  perPage: number
): Promise<SupabaseAdminUser[]> => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    console.error("Unable to load Supabase users for Resend sync", payload);
    throw new Error("Unable to load Supabase users.");
  }

  const parsedEnvelope = usersEnvelopeSchema.safeParse(payload);
  const parsedList = z.array(supabaseAdminUserSchema).safeParse(payload);
  const users = parsedEnvelope.success ? parsedEnvelope.data.users : parsedList.success ? parsedList.data : null;

  if (!users) {
    console.error("Unable to parse Supabase users for Resend sync", payload);
    throw new Error("Unable to parse Supabase users.");
  }

  return users;
};

const fetchProfileNames = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  userIds: string[]
): Promise<Map<string, string>> => {
  if (userIds.length === 0) return new Map();

  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?user_id=in.(${userIds.join(",")})&select=user_id,full_name`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    }
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    console.warn("Unable to load user profile names for Resend sync", payload);
    return new Map();
  }

  const parsed = z.array(userProfileRowSchema).safeParse(payload);

  if (!parsed.success) {
    console.warn("Unable to parse user profile names for Resend sync", parsed.error.flatten().fieldErrors);
    return new Map();
  }

  return new Map(
    parsed.data
      .filter((row) => typeof row.full_name === "string" && row.full_name.trim().length > 0)
      .map((row) => [row.user_id, row.full_name?.trim() ?? ""])
  );
};

const isAnonymousSupabaseUser = (user: SupabaseAdminUser): boolean =>
  user.is_anonymous === true || user.app_metadata?.provider === "anonymous";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const resendConfig = getResendConfig();
  if (!resendConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Resend configuration is missing." }, { status: 500 }));
  }

  const parsedBody = syncRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid Resend sync payload." }, { status: 400 }));
  }

  const rateLimit = await checkRateLimitAsync(`admin-resend-sync:${auth.supabaseUser.id}`, 4, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many Resend sync requests.", retryAfter: rateLimit.retryAfter },
        { status: 429 }
      )
    );
  }

  const { dryRun, pageSize, maxPages, includeAnonymous, includeProperties, defaultUnsubscribed } = parsedBody.data;
  const { supabaseUrl, supabaseServiceRoleKey } = auth.supabaseService;
  const failures: { userId: string; email: string | null; statusCode?: number; message: string }[] = [];
  let pagesProcessed = 0;
  let usersRead = 0;
  let skippedNoEmail = 0;
  let skippedAnonymous = 0;
  let contactsPrepared = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;
  let hasMoreFailures = false;

  try {
    for (let page = 1; ; page += 1) {
      if (maxPages && page > maxPages) break;

      const users = await fetchSupabaseUsersPage(supabaseUrl, supabaseServiceRoleKey, page, pageSize);
      pagesProcessed += 1;
      usersRead += users.length;

      const profileNames = await fetchProfileNames(
        supabaseUrl,
        supabaseServiceRoleKey,
        users.map((user) => user.id)
      );

      for (const user of users) {
        if (!user.email) {
          skippedNoEmail += 1;
          continue;
        }

        if (!includeAnonymous && isAnonymousSupabaseUser(user)) {
          skippedAnonymous += 1;
          continue;
        }

        const contact = buildContact(user, profileNames.get(user.id) ?? null, {
          defaultUnsubscribed,
          includeProperties,
        });

        if (!contact) {
          skippedNoEmail += 1;
          continue;
        }

        contactsPrepared += 1;

        if (dryRun) continue;

        const result = await upsertResendContact(resendConfig, contact);

        if (result.status === "created") {
          created += 1;
          continue;
        }

        if (result.status === "updated") {
          updated += 1;
          continue;
        }

        if (result.status === "failed") {
          failed += 1;
          if (failures.length < 25) {
            failures.push({
              userId: user.id,
              email: contact.email,
              statusCode: result.statusCode,
              message: result.message,
            });
          } else {
            hasMoreFailures = true;
          }
        }
      }

      if (users.length < pageSize) break;
    }

    return withSecurityHeaders(
      NextResponse.json({
        summary: {
          dryRun,
          defaultUnsubscribed,
          includeProperties,
          pagesProcessed,
          usersRead,
          contactsPrepared,
          contactsWouldSync: dryRun ? contactsPrepared : 0,
          contactsSynced: dryRun ? 0 : created + updated,
          created,
          updated,
          skipped: skippedNoEmail + skippedAnonymous,
          skippedNoEmail,
          skippedAnonymous,
          failed,
        },
        failures,
        hasMoreFailures,
      })
    );
  } catch (error) {
    console.error("Unexpected Resend sync failure", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to sync Resend contacts." }, { status: 500 }));
  }
}
