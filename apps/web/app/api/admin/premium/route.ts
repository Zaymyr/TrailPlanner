import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
  isAdminUser,
} from "../../../../lib/supabase";

const premiumGrantRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  starts_at: z.string(),
  initial_duration_days: z.number(),
  reason: z.string(),
  ends_at: z.string().nullable().optional(),
});

const premiumGrantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  startsAt: z.string(),
  initialDurationDays: z.number(),
  remainingDurationDays: z.number(),
  reason: z.string(),
});

const premiumGrantEnvelopeSchema = z.object({
  premiumGrant: premiumGrantSchema.nullable(),
});

const premiumGrantsEnvelopeSchema = z.object({
  premiumGrants: z.array(premiumGrantSchema),
});

const grantPayloadSchema = z.object({
  userId: z.string().uuid(),
  startsAt: z.string().datetime(),
  initialDurationDays: z.number().int().positive(),
  reason: z.string().min(1),
});

const grantUpdateSchema = grantPayloadSchema.extend({
  id: z.string().uuid(),
});

const revokePayloadSchema = z.object({
  id: z.string().uuid(),
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
    userId: grant.user_id,
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

  return { supabaseService, supabaseUser };
};

export async function GET(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId") ?? searchParams.get("user_id");

  try {
    const now = new Date();

    if (userId) {
      const parsedUserId = z.string().uuid().safeParse(userId);

      if (!parsedUserId.success) {
        return withSecurityHeaders(NextResponse.json({ message: "Invalid user id." }, { status: 400 }));
      }

      const response = await fetch(
        `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?user_id=eq.${parsedUserId.data}&select=id,user_id,starts_at,initial_duration_days,reason,ends_at&order=starts_at.desc`,
        {
          headers: {
            apikey: auth.supabaseService.supabaseServiceRoleKey,
            Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          },
          cache: "no-store",
        }
      );

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        console.error("Unable to load premium grants", payload);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to load premium grants." }, { status: 502 }));
      }

      const parsed = z.array(premiumGrantRowSchema).safeParse(payload);

      if (!parsed.success) {
        return withSecurityHeaders(NextResponse.json({ message: "Unable to load premium grants." }, { status: 500 }));
      }

      const grant = parsed.data
        .map((row) => buildPremiumGrant(row, now))
        .find((row): row is NonNullable<typeof row> => Boolean(row?.isActive));

      if (!grant) {
        return withSecurityHeaders(NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: null })));
      }

      const { isActive, ...premiumGrantPayload } = grant;

      return withSecurityHeaders(
        NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: premiumGrantPayload }))
      );
    }

    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?select=id,user_id,starts_at,initial_duration_days,reason,ends_at&order=starts_at.desc`,
      {
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        },
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to load premium grants", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load premium grants." }, { status: 502 }));
    }

    const parsed = z.array(premiumGrantRowSchema).safeParse(payload);

    if (!parsed.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load premium grants." }, { status: 500 }));
    }

    const grantsByUserId = new Map<string, z.infer<typeof premiumGrantSchema>>();
    for (const grant of parsed.data) {
      if (grantsByUserId.has(grant.user_id)) continue;
      const mappedGrant = buildPremiumGrant(grant, now);
      if (mappedGrant?.isActive) {
        const { isActive, ...premiumGrantPayload } = mappedGrant;
        grantsByUserId.set(grant.user_id, premiumGrantPayload);
      }
    }

    return withSecurityHeaders(
      NextResponse.json(premiumGrantsEnvelopeSchema.parse({ premiumGrants: [...grantsByUserId.values()] }))
    );
  } catch (error) {
    console.error("Unexpected error while loading premium grants", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load premium grants." }, { status: 500 }));
  }
}

export async function POST(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const rateLimit = checkRateLimit(`admin-premium:${auth.supabaseUser?.id ?? "unknown"}`);
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ message: "Too many premium grant requests." }, { status: 429 });
    if (rateLimit.retryAfter) {
      response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfter / 1000).toString());
    }
    return withSecurityHeaders(response);
  }

  const parsedBody = grantPayloadSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid premium grant payload." }, { status: 400 }));
  }

  try {
    const response = await fetch(`${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants`, {
      method: "POST",
      headers: {
        apikey: auth.supabaseService.supabaseServiceRoleKey,
        Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: parsedBody.data.userId,
        starts_at: parsedBody.data.startsAt,
        initial_duration_days: parsedBody.data.initialDurationDays,
        reason: parsedBody.data.reason,
        created_by: auth.supabaseUser?.id ?? null,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to create premium grant", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create premium grant." }, { status: 502 }));
    }

    const parsedGrant = z.array(premiumGrantRowSchema).safeParse(payload);

    if (!parsedGrant.success || parsedGrant.data.length === 0) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create premium grant." }, { status: 500 }));
    }

    const mappedGrant = buildPremiumGrant(parsedGrant.data[0], new Date());

    if (!mappedGrant) {
      return withSecurityHeaders(NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: null })));
    }

    const { isActive, ...premiumGrantPayload } = mappedGrant;

    return withSecurityHeaders(
      NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: premiumGrantPayload }))
    );
  } catch (error) {
    console.error("Unexpected error while creating premium grant", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create premium grant." }, { status: 500 }));
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const rateLimit = checkRateLimit(`admin-premium:${auth.supabaseUser?.id ?? "unknown"}`);
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ message: "Too many premium grant requests." }, { status: 429 });
    if (rateLimit.retryAfter) {
      response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfter / 1000).toString());
    }
    return withSecurityHeaders(response);
  }

  const parsedBody = grantUpdateSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid premium grant payload." }, { status: 400 }));
  }

  try {
    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?id=eq.${parsedBody.data.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          user_id: parsedBody.data.userId,
          starts_at: parsedBody.data.startsAt,
          initial_duration_days: parsedBody.data.initialDurationDays,
          reason: parsedBody.data.reason,
        }),
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to update premium grant", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update premium grant." }, { status: 502 }));
    }

    const parsedGrant = z.array(premiumGrantRowSchema).safeParse(payload);

    if (!parsedGrant.success || parsedGrant.data.length === 0) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update premium grant." }, { status: 500 }));
    }

    const mappedGrant = buildPremiumGrant(parsedGrant.data[0], new Date());

    if (!mappedGrant) {
      return withSecurityHeaders(NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: null })));
    }

    const { isActive, ...premiumGrantPayload } = mappedGrant;

    return withSecurityHeaders(
      NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: premiumGrantPayload }))
    );
  } catch (error) {
    console.error("Unexpected error while updating premium grant", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update premium grant." }, { status: 500 }));
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await authorizeAdmin(request);
  if ("error" in auth) return auth.error;

  const rateLimit = checkRateLimit(`admin-premium:${auth.supabaseUser?.id ?? "unknown"}`);
  if (!rateLimit.allowed) {
    const response = NextResponse.json({ message: "Too many premium grant requests." }, { status: 429 });
    if (rateLimit.retryAfter) {
      response.headers.set("Retry-After", Math.ceil(rateLimit.retryAfter / 1000).toString());
    }
    return withSecurityHeaders(response);
  }

  const parsedBody = revokePayloadSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid premium grant payload." }, { status: 400 }));
  }

  try {
    const response = await fetch(
      `${auth.supabaseService.supabaseUrl}/rest/v1/premium_grants?id=eq.${parsedBody.data.id}`,
      {
        method: "PATCH",
        headers: {
          apikey: auth.supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${auth.supabaseService.supabaseServiceRoleKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          ends_at: new Date().toISOString(),
        }),
        cache: "no-store",
      }
    );

    const payload = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to revoke premium grant", payload);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to revoke premium grant." }, { status: 502 }));
    }

    const parsedGrant = z.array(premiumGrantRowSchema).safeParse(payload);

    if (!parsedGrant.success || parsedGrant.data.length === 0) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to revoke premium grant." }, { status: 500 }));
    }

    const mappedGrant = buildPremiumGrant(parsedGrant.data[0], new Date());

    if (!mappedGrant) {
      return withSecurityHeaders(NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: null })));
    }

    const { isActive, ...premiumGrantPayload } = mappedGrant;

    return withSecurityHeaders(
      NextResponse.json(premiumGrantEnvelopeSchema.parse({ premiumGrant: premiumGrantPayload }))
    );
  } catch (error) {
    console.error("Unexpected error while revoking premium grant", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to revoke premium grant." }, { status: 500 }));
  }
}
