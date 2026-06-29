import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

const claimRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid(),
  organization_name: z.string(),
  role_title: z.string(),
  contact_email: z.string(),
  official_site_url: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]),
  reviewed_by: z.string().uuid().nullable().optional(),
  reviewed_at: z.string().nullable().optional(),
  reviewer_notes: z.string().nullable().optional(),
  race_events: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const membershipRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
  claim_id: z.string().uuid().nullable().optional(),
  role: z.string(),
  revoked_at: z.string().nullable().optional(),
  revoke_reason: z.string().nullable().optional(),
  race_events: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      location: z.string().nullable().optional(),
      race_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("approve"),
    claimId: z.string().uuid(),
    reviewerNotes: z.string().trim().optional().transform((value) => (value ? value : null)),
  }),
  z.object({
    action: z.literal("reject"),
    claimId: z.string().uuid(),
    reviewerNotes: z.string().trim().optional().transform((value) => (value ? value : null)),
  }),
  z.object({
    action: z.literal("revoke"),
    membershipId: z.string().uuid(),
    revokeReason: z.string().trim().optional().transform((value) => (value ? value : null)),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const [claimsResponse, membershipsResponse] = await Promise.all([
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?status=eq.pending&select=id,created_at,updated_at,user_id,event_id,organization_name,role_title,contact_email,official_site_url,message,status,reviewed_by,reviewed_at,reviewer_notes,race_events(id,name,location,race_date)&order=created_at.asc&limit=200`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?revoked_at=is.null&select=id,created_at,event_id,user_id,claim_id,role,revoked_at,revoke_reason,race_events(id,name,location,race_date)&order=created_at.desc&limit=200`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
  ]);

  if (!claimsResponse.ok || !membershipsResponse.ok) {
    console.error("Unable to load admin organizer claims", {
      claims: claimsResponse.ok ? null : await claimsResponse.text(),
      memberships: membershipsResponse.ok ? null : await membershipsResponse.text(),
    });
    return jsonError("Unable to load organizer claims.", 502);
  }

  const claims = z.array(claimRowSchema).parse(await claimsResponse.json());
  const memberships = z.array(membershipRowSchema).parse(await membershipsResponse.json());
  return withSecurityHeaders(NextResponse.json({ claims, memberships }));
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsedBody = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid organizer claim action.", 400);

  if (parsedBody.data.action === "revoke") {
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?id=eq.${parsedBody.data.membershipId}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          revoked_at: new Date().toISOString(),
          revoked_by: auth.user.id,
          revoke_reason: parsedBody.data.revokeReason,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to revoke organizer membership", await response.text());
      return jsonError("Unable to revoke organizer access.", 502);
    }

    const membership = z.array(membershipRowSchema.omit({ race_events: true }).passthrough()).parse(await response.json())[0] ?? null;
    return withSecurityHeaders(NextResponse.json({ membership }));
  }

  const claimResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?id=eq.${parsedBody.data.claimId}&select=id,user_id,event_id,status,role_title&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!claimResponse.ok) {
    console.error("Unable to load organizer claim for action", await claimResponse.text());
    return jsonError("Unable to load claim.", 502);
  }

  const claim = z
    .array(
      z.object({
        id: z.string().uuid(),
        user_id: z.string().uuid(),
        event_id: z.string().uuid(),
        status: z.enum(["pending", "approved", "rejected"]),
        role_title: z.string(),
      })
    )
    .parse(await claimResponse.json())[0] ?? null;

  if (!claim) return jsonError("Claim not found.", 404);

  if (parsedBody.data.action === "reject") {
    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?id=eq.${claim.id}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: "rejected",
          reviewed_by: auth.user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: parsedBody.data.reviewerNotes,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to reject organizer claim", await response.text());
      return jsonError("Unable to reject claim.", 502);
    }

    const updated = z.array(claimRowSchema.omit({ race_events: true }).passthrough()).parse(await response.json())[0] ?? null;
    return withSecurityHeaders(NextResponse.json({ claim: updated }));
  }

  const now = new Date().toISOString();
  const existingMembershipResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?event_id=eq.${claim.event_id}&user_id=eq.${claim.user_id}&select=id&limit=1`,
    {
      headers: serviceHeaders(auth.serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!existingMembershipResponse.ok) {
    console.error("Unable to inspect organizer membership before approval", await existingMembershipResponse.text());
    return jsonError("Unable to approve claim.", 502);
  }

  const existingMembership = z.array(z.object({ id: z.string().uuid() })).parse(await existingMembershipResponse.json())[0] ?? null;
  const membershipResponse = existingMembership
    ? await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?id=eq.${existingMembership.id}`, {
        method: "PATCH",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          claim_id: claim.id,
          role: "owner",
          created_by: auth.user.id,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        }),
        cache: "no-store",
      })
    : await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers`, {
        method: "POST",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          event_id: claim.event_id,
          user_id: claim.user_id,
          claim_id: claim.id,
          role: "owner",
          created_by: auth.user.id,
        }),
        cache: "no-store",
      });

  if (!membershipResponse.ok) {
    console.error("Unable to upsert organizer membership", await membershipResponse.text());
    return jsonError("Unable to approve claim.", 502);
  }

  const updateClaimResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_claims?id=eq.${claim.id}`,
    {
      method: "PATCH",
      headers: {
        ...serviceHeaders(auth.serviceConfig),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        status: "approved",
        reviewed_by: auth.user.id,
        reviewed_at: now,
        reviewer_notes: parsedBody.data.reviewerNotes,
      }),
      cache: "no-store",
    }
  );

  if (!updateClaimResponse.ok) {
    console.error("Unable to approve organizer claim", await updateClaimResponse.text());
    return jsonError("Organizer access was created, but the claim could not be marked approved.", 502);
  }

  const [membership] = z.array(membershipRowSchema.omit({ race_events: true }).passthrough()).parse(await membershipResponse.json());
  const [updatedClaim] = z.array(claimRowSchema.omit({ race_events: true }).passthrough()).parse(await updateClaimResponse.json());

  return withSecurityHeaders(NextResponse.json({ claim: updatedClaim, membership }));
}
