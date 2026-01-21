import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import {
  coachCommentCreateSchema,
  coachCommentDeleteSchema,
  coachCommentResponseSchema,
  coachCommentUpdateSchema,
  coachCommentsResponseSchema,
} from "../../../../lib/coach-comments";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const coachCommentsQuerySchema = z.object({
  planId: z.string().uuid(),
});

const coachCommentRowSchema = z.array(
  z.object({
    id: z.string(),
    coach_id: z.string(),
    coachee_id: z.string(),
    plan_id: z.string(),
    section_id: z.string().nullable(),
    aid_station_id: z.string().nullable(),
    body: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  })
);

const buildAuthHeaders = (supabaseKey: string, accessToken: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${accessToken}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const ensureCoachCoacheePlanAccess = async (
  supabaseUrl: string,
  supabaseAnonKey: string,
  token: string,
  coachId: string,
  coacheeId: string,
  planId: string
): Promise<boolean> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/race_plans?select=id&limit=1&id=eq.${encodeURIComponent(
      planId
    )}&user_id=eq.${encodeURIComponent(coacheeId)}&coach_id=eq.${encodeURIComponent(coachId)}`,
    {
      headers: buildAuthHeaders(supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to verify coach plan access", await response.text());
    return false;
  }

  const rows = z.array(z.object({ id: z.string() })).parse(await response.json());
  return rows.length > 0;
};

const mapCommentRow = (row: z.infer<typeof coachCommentRowSchema>[number]) => ({
  id: row.id,
  coachId: row.coach_id,
  coacheeId: row.coachee_id,
  planId: row.plan_id,
  sectionId: row.section_id,
  aidStationId: row.aid_station_id,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function GET(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-comments:${user.id}`, 60, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = coachCommentsQuerySchema.safeParse({
      planId: searchParams.get("planId") ?? "",
    });

    if (!parsedQuery.success) {
      return withSecurityHeaders(NextResponse.json({ message: "Invalid coach comments request." }, { status: 400 }));
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_comments?select=id,coach_id,coachee_id,plan_id,section_id,aid_station_id,body,created_at,updated_at&plan_id=eq.${encodeURIComponent(
        parsedQuery.data.planId
      )}&order=updated_at.desc`,
      {
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to fetch coach comments", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch comments." }, { status: 502 }));
    }

    const rows = coachCommentRowSchema.parse(await response.json());
    const comments = rows.map(mapCommentRow);

    return withSecurityHeaders(NextResponse.json(coachCommentsResponseSchema.parse({ comments })));
  } catch (error) {
    console.error("Unable to fetch coach comments", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch comments." }, { status: 500 }));
  }
}

export async function POST(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-comments-create:${user.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachCommentCreateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid comment payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheePlanAccess(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId,
      parsedBody.data.planId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(`${supabaseConfig.supabaseUrl}/rest/v1/coach_comments`, {
      method: "POST",
      headers: {
        ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        coach_id: user.id,
        coachee_id: parsedBody.data.coacheeId,
        plan_id: parsedBody.data.planId,
        section_id: parsedBody.data.sectionId ?? null,
        aid_station_id: parsedBody.data.aidStationId ?? null,
        body: parsedBody.data.body,
      }),
    });

    const result = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to create coach comment", result);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create comment." }, { status: 502 }));
    }

    const rows = coachCommentRowSchema.parse(result);
    if (!rows[0]) {
      return withSecurityHeaders(NextResponse.json({ message: "Unable to create comment." }, { status: 502 }));
    }
    const comment = mapCommentRow(rows[0]);

    return withSecurityHeaders(NextResponse.json(coachCommentResponseSchema.parse({ comment })));
  } catch (error) {
    console.error("Unable to create coach comment", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to create comment." }, { status: 500 }));
  }
}

export async function PUT(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-comments-update:${user.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachCommentUpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid comment payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheePlanAccess(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId,
      parsedBody.data.planId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_comments?id=eq.${encodeURIComponent(parsedBody.data.id)}`,
      {
        method: "PATCH",
        headers: {
          ...buildAuthHeaders(supabaseConfig.supabaseAnonKey, token),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          section_id: parsedBody.data.sectionId ?? null,
          aid_station_id: parsedBody.data.aidStationId ?? null,
          body: parsedBody.data.body,
        }),
      }
    );

    const result = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      console.error("Unable to update coach comment", result);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to update comment." }, { status: 502 }));
    }

    const rows = coachCommentRowSchema.parse(result);

    if (!rows[0]) {
      return withSecurityHeaders(NextResponse.json({ message: "Comment not found." }, { status: 404 }));
    }

    const comment = mapCommentRow(rows[0]);

    return withSecurityHeaders(NextResponse.json(coachCommentResponseSchema.parse({ comment })));
  } catch (error) {
    console.error("Unable to update coach comment", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to update comment." }, { status: 500 }));
  }
}

export async function DELETE(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const rateLimit = checkRateLimit(`coach-comments-delete:${user.id}`, 30, 60_000);

  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfter ?? 0) / 1000)) } }
      )
    );
  }

  const parsedBody = coachCommentDeleteSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid comment payload." }, { status: 400 }));
  }

  try {
    const canAccess = await ensureCoachCoacheePlanAccess(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseAnonKey,
      token,
      user.id,
      parsedBody.data.coacheeId,
      parsedBody.data.planId
    );

    if (!canAccess) {
      return withSecurityHeaders(NextResponse.json({ message: "Not authorized." }, { status: 403 }));
    }

    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/coach_comments?id=eq.${encodeURIComponent(parsedBody.data.id)}`,
      {
        method: "DELETE",
        headers: buildAuthHeaders(supabaseConfig.supabaseAnonKey, token, undefined),
      }
    );

    if (!response.ok) {
      console.error("Unable to delete coach comment", await response.text());
      return withSecurityHeaders(NextResponse.json({ message: "Unable to delete comment." }, { status: 502 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Unable to delete coach comment", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete comment." }, { status: 500 }));
  }
}
