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

    return withSecurityHeaders(NextResponse.json(mappedUsersSchema.parse({ users: mapped })));
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
