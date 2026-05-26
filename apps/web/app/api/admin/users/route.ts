import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../../../../lib/auth-cookies";
import { withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const supabaseAdminUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
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
  users: z.array(z.unknown()),
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
          id: z.string(),
          startsAt: z.string(),
          initialDurationDays: z.number(),
          remainingDurationDays: z.number(),
          reason: z.string(),
        })
        .nullable()
        .optional(),
      trial: z
        .object({
          endsAt: z.string(),
          remainingDays: z.number(),
        })
        .nullable()
        .optional(),
      subscription: z
        .object({
          status: z.string(),
          currentPeriodEnd: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      insights: z
        .object({
          signInCount: z.number().int().nonnegative().nullable(),
          activityWindowDays: z.number().int().nonnegative().nullable(),
          planCount: z.number().int().nonnegative(),
          latestPlanName: z.string().nullable(),
          favoriteProducts: z.array(z.string()),
          onboardingCompleted: z.boolean(),
        })
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

const userIdUuidSchema = z.string().uuid();

const mapUser = (user: z.infer<typeof supabaseAdminUserSchema>) => ({
  id: user.id,
  email: user.email ?? undefined,
  createdAt: user.created_at ?? new Date(0).toISOString(),
  lastSignInAt: user.last_sign_in_at ?? undefined,
  role: user.app_metadata?.role,
  roles:
    (Array.isArray(user.app_metadata?.roles) && user.app_metadata.roles.length > 0
      ? user.app_metadata.roles
      : undefined) ?? (user.app_metadata?.role ? [user.app_metadata.role] : undefined),
});

const premiumGrantRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  starts_at: z.string(),
  initial_duration_days: z.number(),
  reason: z.string(),
  ends_at: z.string().nullable().optional(),
});

const buildPremiumGrant = (grant: z.infer<typeof premiumGrantRowSchema>, now: Date) => {
  const startsAt = new Date(grant.starts_at);

  if (Number.isNaN(startsAt.getTime()) || grant.initial_duration_days <= 0) {
    return null;
  }

  const defaultEndsAt = new Date(startsAt.getTime() + grant.initial_duration_days * 24 * 60 * 60 * 1000);
  const explicitEndsAt = grant.ends_at ? new Date(grant.ends_at) : null;
  const endsAt =
    explicitEndsAt && Number.isFinite(explicitEndsAt.getTime()) ? explicitEndsAt : defaultEndsAt;
  const isActive = now >= startsAt && now < endsAt;

  const remainingDurationDays = Math.max(
    0,
    Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  );

  return {
    id: grant.id,
    startsAt: grant.starts_at,
    initialDurationDays: grant.initial_duration_days,
    remainingDurationDays,
    reason: grant.reason,
    isActive,
  };
};

const trialRowSchema = z.object({
  user_id: z.string().uuid(),
  trial_ends_at: z.string().nullable().optional(),
});

const subscriptionRowSchema = z.object({
  user_id: z.string().uuid(),
  status: z.string().nullable().optional(),
  current_period_end: z.string().nullable().optional(),
});

const coachProfileRowSchema = z.object({
  user_id: z.string().uuid(),
  subscription_status: z.string().nullable().optional(),
});

const racePlanRowSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
});

const userFavoriteProductRowSchema = z.object({
  user_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

const productNameRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const userProfileInsightRowSchema = z.object({
  user_id: z.string().uuid(),
  sign_in_count: z.number().int().nonnegative().nullable().optional(),
  first_sign_in_at: z.string().nullable().optional(),
  last_sign_in_at: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  water_bag_liters: z.number().nullable().optional(),
  utmb_index: z.number().nullable().optional(),
  comfortable_flat_pace_min_per_km: z.number().nullable().optional(),
});

const buildTrial = (trial: z.infer<typeof trialRowSchema>, now: Date) => {
  if (!trial.trial_ends_at) return null;
  const endsAt = new Date(trial.trial_ends_at);
  if (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) return null;
  const remainingDays = Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  return { endsAt: trial.trial_ends_at, remainingDays };
};

const isSubscriptionStatusActive = (status?: string | null, currentPeriodEnd?: string | null) => {
  const normalizedStatus = status?.toLowerCase() ?? null;
  if (normalizedStatus !== "active" && normalizedStatus !== "trialing") return false;
  if (!currentPeriodEnd) return true;
  const endDate = new Date(currentPeriodEnd);
  return Number.isFinite(endDate.getTime()) ? endDate.getTime() > Date.now() : false;
};

const isSubscriptionActive = (subscription: z.infer<typeof subscriptionRowSchema> | null) => {
  return isSubscriptionStatusActive(subscription?.status, subscription?.current_period_end);
};

type RefreshTokenPayload = {
  access_token: string;
  refresh_token?: string;
};

const readResponsePayload = async (response: Response): Promise<unknown> => {
  const text = await response.text().catch(() => "");

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const summarizePayload = (payload: unknown): string | null => {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (payload && typeof payload === "object") {
    const entries = payload as Record<string, unknown>;
    const parts = [
      typeof entries.message === "string" ? entries.message : null,
      typeof entries.error === "string" ? entries.error : null,
      typeof entries.error_description === "string" ? entries.error_description : null,
      typeof entries.details === "string" ? entries.details : null,
      typeof entries.hint === "string" ? `Hint: ${entries.hint}` : null,
      typeof entries.code === "string" ? `Code: ${entries.code}` : null,
    ].filter((value): value is string => Boolean(value && value.trim().length > 0));

    if (parts.length > 0) {
      return parts.join(" ");
    }

    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }

  if (payload === null || payload === undefined) {
    return null;
  }

  return String(payload);
};

const summarizeZodError = (error: z.ZodError): string =>
  error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.length > 0 ? issue.path.join(".") : "response"}: ${issue.message}`)
    .join("; ");

const buildErrorResponse = (status: number, message: string, options?: { details?: string; source?: string }) =>
  withSecurityHeaders(
    NextResponse.json(
      {
        message,
        details: options?.details,
        source: options?.source,
      },
      { status }
    )
  );

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

  const cookieStore = cookies();
  let accessToken =
    extractBearerToken(request.headers.get("authorization")) ?? cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  let refreshToken =
    extractBearerToken(request.headers.get("x-refresh-token")) ?? cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (!accessToken) {
    return { error: withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 })) };
  }

  let supabaseUser = await fetchSupabaseUser(accessToken, supabaseAnon);

  if (!supabaseUser && refreshToken) {
    const refreshResponse = await fetch(`${supabaseAnon.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnon.supabaseAnonKey,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });

    const refreshData = (await refreshResponse.json().catch(() => null)) as RefreshTokenPayload | null;

    if (refreshResponse.ok && refreshData?.access_token) {
      accessToken = refreshData.access_token;
      refreshToken = refreshData.refresh_token ?? refreshToken;
      supabaseUser = await fetchSupabaseUser(accessToken, supabaseAnon);
    }
  }

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

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      console.error("Unable to load users", payload);
      return buildErrorResponse(502, "Failed to load admin users from Supabase Auth.", {
        source: "supabase-auth-admin-users",
        details: summarizePayload(payload) ?? `HTTP ${response.status}`,
      });
    }

    const parsedEnvelope = usersEnvelopeSchema.safeParse(payload);
    const parsedList = z.array(z.unknown()).safeParse(payload);

    const rawUsers = (parsedEnvelope.success ? parsedEnvelope.data.users : parsedList.success ? parsedList.data : null);

    if (!rawUsers) {
      return buildErrorResponse(500, "Unexpected Supabase Auth response while loading admin users.", {
        source: "supabase-auth-admin-users",
        details: "Expected an array or an object with a users array.",
      });
    }

    const mapped = rawUsers
      .map((entry) => supabaseAdminUserSchema.safeParse(entry))
      .filter((entry): entry is { success: true; data: z.infer<typeof supabaseAdminUserSchema> } => entry.success)
      .map((entry) => mapUser(entry.data));
    const userIds = mapped.map((user) => user.id);
    const relationalUserIds = userIds.filter((userId) => userIdUuidSchema.safeParse(userId).success);
    let grantsByUserId = new Map<string, z.infer<typeof mappedUsersSchema.shape.users.element.shape.premiumGrant>>();
    let trialsByUserId = new Map<string, z.infer<typeof mappedUsersSchema.shape.users.element.shape.trial>>();
    let subscriptionsByUserId = new Map<
      string,
      z.infer<typeof mappedUsersSchema.shape.users.element.shape.subscription>
    >();
    let planRows: z.infer<typeof racePlanRowSchema>[] = [];
    let favoritesByUserId = new Map<string, string[]>();
    let profilesByUserId = new Map<string, z.infer<typeof userProfileInsightRowSchema>>();

    if (relationalUserIds.length > 0) {
      const [grantsResponse, trialsResponse, subscriptionsResponse, coachProfilesResponse, plansResponse, favoritesResponse, productsResponse, profilesResponse] = await Promise.all([
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=id,user_id,starts_at,initial_duration_days,reason,ends_at&order=starts_at.desc`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/user_profiles?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,trial_ends_at`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/subscriptions?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,status,current_period_end`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/coach_profiles?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,subscription_status`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/race_plans?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,name,created_at&order=created_at.desc`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/user_favorite_products?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,product_id`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
        fetch(`${auth.supabaseService.supabaseUrl}/rest/v1/products?select=id,name`, {
          headers: {
            apikey: auth.supabaseService.supabaseServiceRoleKey,
            Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        }),
        fetch(
          `${auth.supabaseService.supabaseUrl}/rest/v1/user_profiles?user_id=in.(${relationalUserIds.join(
            ","
          )})&select=user_id,sign_in_count,first_sign_in_at,last_sign_in_at,age,water_bag_liters,utmb_index,comfortable_flat_pace_min_per_km`,
          {
            headers: {
              apikey: auth.supabaseService.supabaseServiceRoleKey,
              Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
            },
            cache: "no-store",
          }
        ),
      ]);

      const [grantsPayload, trialsPayload, subscriptionsPayload, coachProfilesPayload, plansPayload, favoritesPayload, productsPayload, profilesPayload] = await Promise.all([
        grantsResponse.json().catch(() => null),
        trialsResponse.json().catch(() => null),
        subscriptionsResponse.json().catch(() => null),
        coachProfilesResponse.json().catch(() => null),
        plansResponse.json().catch(() => null),
        favoritesResponse.json().catch(() => null),
        productsResponse.json().catch(() => null),
        profilesResponse.json().catch(() => null),
      ]);

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

      if (trialsResponse.ok) {
        const parsedTrials = z.array(trialRowSchema).safeParse(trialsPayload);

        if (parsedTrials.success) {
          const now = new Date();
          trialsByUserId = new Map();

          for (const trial of parsedTrials.data) {
            if (trialsByUserId.has(trial.user_id)) continue;
            const mappedTrial = buildTrial(trial, now);
            if (mappedTrial) {
              trialsByUserId.set(trial.user_id, mappedTrial);
            }
          }
        } else {
          console.warn("Unable to parse trial payload", parsedTrials.error.flatten().fieldErrors);
        }
      } else {
        console.error("Unable to load trial payload", trialsPayload);
      }

      if (subscriptionsResponse.ok) {
        const parsedSubscriptions = z.array(subscriptionRowSchema).safeParse(subscriptionsPayload);

        if (parsedSubscriptions.success) {
          subscriptionsByUserId = new Map();

          for (const subscription of parsedSubscriptions.data) {
            if (subscriptionsByUserId.has(subscription.user_id)) continue;
            if (!isSubscriptionActive(subscription)) continue;
            subscriptionsByUserId.set(subscription.user_id, {
              status: subscription.status ?? "active",
              currentPeriodEnd: subscription.current_period_end ?? null,
            });
          }
        } else {
          console.warn("Unable to parse subscription payload", parsedSubscriptions.error.flatten().fieldErrors);
        }
      } else {
        console.error("Unable to load subscription payload", subscriptionsPayload);
      }

      if (coachProfilesResponse.ok) {
        const parsedCoachProfiles = z.array(coachProfileRowSchema).safeParse(coachProfilesPayload);

        if (parsedCoachProfiles.success) {
          for (const coachProfile of parsedCoachProfiles.data) {
            if (subscriptionsByUserId.has(coachProfile.user_id)) continue;
            if (!isSubscriptionStatusActive(coachProfile.subscription_status)) continue;
            subscriptionsByUserId.set(coachProfile.user_id, {
              status: coachProfile.subscription_status ?? "active",
              currentPeriodEnd: null,
            });
          }
        } else {
          console.warn("Unable to parse coach profile payload", parsedCoachProfiles.error.flatten().fieldErrors);
        }
      } else {
        console.error("Unable to load coach profile payload", coachProfilesPayload);
      }

      if (plansResponse.ok) {
        const parsedPlans = z.array(racePlanRowSchema).safeParse(plansPayload);
        if (parsedPlans.success) planRows = parsedPlans.data;
      }

      if (favoritesResponse.ok && productsResponse.ok) {
        const parsedFavorites = z.array(userFavoriteProductRowSchema).safeParse(favoritesPayload);
        const parsedProducts = z.array(productNameRowSchema).safeParse(productsPayload);
        if (parsedFavorites.success && parsedProducts.success) {
          const productNames = new Map(parsedProducts.data.map((product) => [product.id, product.name]));
          for (const favorite of parsedFavorites.data) {
            const label = productNames.get(favorite.product_id);
            if (!label) continue;
            const current = favoritesByUserId.get(favorite.user_id) ?? [];
            if (current.length < 5) current.push(label);
            favoritesByUserId.set(favorite.user_id, current);
          }
        }
      }

      if (profilesResponse.ok) {
        const parsedProfiles = z.array(userProfileInsightRowSchema).safeParse(profilesPayload);
        if (parsedProfiles.success) {
          profilesByUserId = new Map(parsedProfiles.data.map((profile) => [profile.user_id, profile]));
        }
      }
    }

    const plansByUserId = new Map<string, z.infer<typeof racePlanRowSchema>[]>();
    for (const plan of planRows) {
      const current = plansByUserId.get(plan.user_id) ?? [];
      current.push(plan);
      plansByUserId.set(plan.user_id, current);
    }

    const mappedWithGrants = mapped.map((user) => {
      const userPlans = plansByUserId.get(user.id) ?? [];
      const profile = profilesByUserId.get(user.id);
      const onboardingCompleted = Boolean(
        profile &&
          (profile.age !== null ||
            profile.water_bag_liters !== null ||
            profile.utmb_index !== null ||
            profile.comfortable_flat_pace_min_per_km !== null)
      );
      const createdAt = profile?.first_sign_in_at ? new Date(profile.first_sign_in_at) : new Date(user.createdAt);
      const lastSignInAt = profile?.last_sign_in_at
        ? new Date(profile.last_sign_in_at)
        : user.lastSignInAt
          ? new Date(user.lastSignInAt)
          : null;
      const activityWindowDays =
        lastSignInAt && Number.isFinite(lastSignInAt.getTime()) && Number.isFinite(createdAt.getTime())
          ? Math.max(0, Math.ceil((lastSignInAt.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)))
          : null;

      return {
        ...user,
        premiumGrant: grantsByUserId.get(user.id) ?? null,
        trial: trialsByUserId.get(user.id) ?? null,
        subscription: subscriptionsByUserId.get(user.id) ?? null,
        insights: {
          signInCount: profile?.sign_in_count ?? null,
          activityWindowDays,
          planCount: userPlans.length,
          latestPlanName: userPlans[0]?.name ?? null,
          favoriteProducts: favoritesByUserId.get(user.id) ?? [],
          onboardingCompleted,
        },
      };
    });

    const parsedMappedUsers = mappedUsersSchema.safeParse({ users: mappedWithGrants });

    if (!parsedMappedUsers.success) {
      return buildErrorResponse(500, "Admin users response validation failed.", {
        source: "admin-users-response-parse",
        details: summarizeZodError(parsedMappedUsers.error),
      });
    }

    return withSecurityHeaders(NextResponse.json(parsedMappedUsers.data));
  } catch (error) {
    console.error("Unexpected error while loading admin users", error);
    return buildErrorResponse(500, "Unexpected error while loading admin users.", {
      source: "admin-users-route",
      details: error instanceof Error ? error.message : undefined,
    });
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
