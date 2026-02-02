import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const supabaseAdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable().optional(),
  app_metadata: z
    .object({
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
});

const usersEnvelopeSchema = z.object({
  users: z.array(supabaseAdminUserSchema),
});

const mappedUsersSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string().optional(),
      createdAt: z.string(),
      lastSignInAt: z.string().optional(),
      role: z.string().optional(),
      roles: z.array(z.string()).optional(),
      premiumGrant: z
        .object({
          startsAt: z.string(),
          initialDurationDays: z.number(),
          remainingDurationDays: z.number(),
          reason: z.string(),
        })
        .nullable()
        .optional(),
    })
  ),
});

const userRoleSchema = z.enum(["user", "coach", "admin"]);

const updateUserRoleSchema = z.object({
  id: z.string().uuid(),
  roles: z.array(userRoleSchema).min(1),
});

const singleUserSchema = z.object({
  user: mappedUsersSchema.shape.users.element,
});

const mapUser = (user: z.infer<typeof supabaseAdminUserSchema>) => ({
  id: user.id,
  email: user.email,
  createdAt: user.created_at,
  lastSignInAt: user.last_sign_in_at ?? undefined,
  role: user.app_metadata?.role,
  roles:
    (Array.isArray(user.app_metadata?.roles) && user.app_metadata.roles.length > 0
      ? user.app_metadata.roles
      : undefined) ?? (user.app_metadata?.role ? [user.app_metadata.role] : undefined),
});

const premiumGrantRowSchema = z.object({
  user_id: z.string().uuid(),
  starts_at: z.string(),
  initial_duration_days: z.number(),
  reason: z.string(),
});

const buildPremiumGrant = (grant: z.infer<typeof premiumGrantRowSchema>, now: Date) => {
  const startsAt = new Date(grant.starts_at);

  if (Number.isNaN(startsAt.getTime()) || grant.initial_duration_days <= 0) {
    return null;
  }

  const endsAt = new Date(startsAt.getTime() + grant.initial_duration_days * 24 * 60 * 60 * 1000);
  const isActive = now >= startsAt && now <= endsAt;

  const remainingDurationDays = Math.max(
    0,
    Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    startsAt: grant.starts_at,
    initialDurationDays: grant.initial_duration_days,
    remainingDurationDays,
    reason: grant.reason,
    isActive,
  };
};

const authorizeAdmin = async (request: NextRequest) => {
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

  return { supabaseService };
};

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  try {
    const response = await fetch(`${auth.supabaseService.supabaseUrl}/auth/v1/admin/users?per_page=50`, {
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to load users", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load users." }, { status: 502 }));
    }

    const parsedEnvelope = usersEnvelopeSchema.safeParse(payload);
    const parsedList = z.array(supabaseAdminUserSchema).safeParse(payload);

    const users = (parsedEnvelope.success ? parsedEnvelope.data.users : parsedList.success ? parsedList.data : null);

    if (!users) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load users." }, { status: 500 }));
    }

    const mapped = users.map(mapUser);
    const userIds = mapped.map((user) => user.id);
    let grantsByUserId = new Map<string, z.infer<typeof mappedUsersSchema.shape.users.element.shape.premiumGrant>>();

    if (userIds.length > 0) {
      const grantsResponse = await fetch(
        `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?user_id=in.(${userIds.join(
          ","
        )})&select=user_id,starts_at,initial_duration_days,reason&order=starts_at.desc`,
        {
          headers: {
            apikey: auth.supabaseService.supabaseServiceRoleKey,
            Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        }
      );

      const grantsPayload = (await grantsResponse.json().catch(() => null)) as unknown;

      if (grantsResponse.ok) {
        const parsedGrants = z.array(premiumGrantRowSchema).safeParse(grantsPayload);

        if (parsedGrants.success) {
          const now = new Date();
          grantsByUserId = new Map();

          for (const grant of parsedGrants.data) {
            if (grantsByUserId.has(grant.user_id)) continue;
            const mappedGrant = buildPremiumGrant(grant, now);
            if (mappedGrant?.isActive) {
              const { isActive, ...payload } = mappedGrant;
              grantsByUserId.set(grant.user_id, payload);
            }
          }
        } else {
          console.warn("Unable to parse premium grants payload", parsedGrants.error.flatten().fieldErrors);
        }
      } else {
        console.error("Unable to load premium grants", grantsPayload);
      }
    }

    const mappedWithGrants = mapped.map((user) => ({
      ...user,
      premiumGrant: grantsByUserId.get(user.id) ?? null,
    }));

    return withSecurityHeaders(NextResponse.json(mappedUsersSchema.parse({ users: mappedWithGrants })));
  } catch (error) {
    console.error("Unexpected error while loading admin users", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load users." }, { status: 500 }));
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const parsedBody = updateUserRoleSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid user role payload." }, { status: 400 }));
  }

  const appMetadata = {
    role: parsedBody.data.roles[0] ?? null,
    roles: parsedBody.data.roles,
  };

  try {
    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/auth/v1/admin/users/${parsedBody.data.id}`,
      {
        method: "PUT",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ app_metadata: appMetadata }),
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to update user role", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update user role." }, { status: 502 }));
    }

    const parsedUser = supabaseAdminUserSchema.safeParse(payload);

    if (!parsedUser.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update user role." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json(singleUserSchema.parse({ user: mapUser(parsedUser.data) })));
  } catch (error) {
    console.error("Unexpected error while updating admin user role", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update user role." }, { status: 500 }));
  }
}
