import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { buildSlug, jsonError, requireAdminAuth, serviceHeaders } from "../../../../lib/organizer";

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

const editionRequestRowSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
  user_id: z.string().uuid(),
  event_id: z.string().uuid(),
  source_year: z.number().int(),
  requested_start_date: z.string(),
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

const editionRequestActionRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  source_year: z.number().int(),
  requested_start_date: z.string(),
  status: z.enum(["pending", "approved", "rejected"]),
});

const sourceRaceSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid().nullable().optional(),
  edition_group_id: z.string().uuid().nullable().optional(),
  series_name: z.string().nullable().optional(),
  name: z.string(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  location_text: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_path: z.string().nullable().optional(),
  gpx_hash: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
  gpx_sha256: z.string().nullable().optional(),
  min_alt_m: z.number().nullable().optional(),
  max_alt_m: z.number().nullable().optional(),
  start_lat: z.number().nullable().optional(),
  start_lng: z.number().nullable().optional(),
  bounds_min_lat: z.number().nullable().optional(),
  bounds_min_lng: z.number().nullable().optional(),
  bounds_max_lat: z.number().nullable().optional(),
  bounds_max_lng: z.number().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
});

const cloneAidStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  solid_available: z.boolean().nullable().optional(),
  assistance_allowed: z.boolean().nullable().optional(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
  organizer_details: z.unknown().nullable().optional(),
});

const cloneAidStationProductSchema = z.object({
  product_id: z.string().uuid(),
  race_aid_station_id: z.string().uuid(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

const userProfileRowSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().nullable().optional(),
});

const adminUserRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable().optional(),
});

const adminUsersResponseSchema = z.object({
  users: z.array(adminUserRowSchema),
});

const raceEventOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
});

const existingMembershipSchema = z.object({
  id: z.string().uuid(),
  role: z.string(),
  revoked_at: z.string().nullable().optional(),
});

const AUTH_USERS_PER_PAGE = 1000;
const MAX_AUTH_USER_PAGES = 100;

async function findAuthUserByEmail(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  requestedEmail: string
) {
  const normalizedEmail = requestedEmail.trim().toLowerCase();

  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const response = await fetch(
      `${serviceConfig.supabaseUrl}/auth/v1/admin/users?page=${page}&per_page=${AUTH_USERS_PER_PAGE}`,
      {
        headers: serviceHeaders(serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Unable to search Supabase Auth users: ${await response.text()}`);
    }

    const users = adminUsersResponseSchema.parse(await response.json()).users;
    const match = users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail);
    if (match) return { id: match.id, email: match.email!.trim() };
    if (users.length < AUTH_USERS_PER_PAGE) return null;
  }

  throw new Error("Supabase Auth user search exceeded the supported pagination limit.");
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string | null | undefined) => {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatIsoDate = (value: Date) => value.toISOString().slice(0, 10);

const addUtcDays = (value: string, days: number) => {
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return formatIsoDate(new Date(parsed.getTime() + days * DAY_IN_MS));
};

const deleteClonedRaces = async (supabaseUrl: string, serviceRoleKey: string, raceIds: string[]) => {
  await Promise.all(
    raceIds.map((raceId) =>
      fetch(`${supabaseUrl}/rest/v1/races?id=eq.${raceId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      }).catch(() => null)
    )
  );
};

async function cloneEditionFromRequest(
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  requestRow: z.infer<typeof editionRequestActionRowSchema>
) {
  const sourceYearStart = `${requestRow.source_year}-01-01`;
  const sourceYearEnd = `${requestRow.source_year + 1}-01-01`;
  const requestedYear = requestRow.requested_start_date.slice(0, 4);
  const requestedYearEnd = `${Number(requestedYear) + 1}-01-01`;

  const [sourceRacesResponse, existingTargetYearResponse] = await Promise.all([
    fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${requestRow.event_id}&race_date=gte.${sourceYearStart}&race_date=lt.${sourceYearEnd}&select=id,event_id,edition_group_id,series_name,name,distance_km,elevation_gain_m,elevation_loss_m,location_text,race_date,thumbnail_url,gpx_path,gpx_hash,gpx_storage_path,gpx_sha256,min_alt_m,max_alt_m,start_lat,start_lng,bounds_min_lat,bounds_min_lng,bounds_max_lat,bounds_max_lng,organizer_details&order=race_date.asc`,
      {
        headers: serviceHeaders(serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${serviceConfig.supabaseUrl}/rest/v1/races?event_id=eq.${requestRow.event_id}&race_date=gte.${requestedYear}-01-01&race_date=lt.${requestedYearEnd}&select=id&limit=1`,
      {
        headers: serviceHeaders(serviceConfig, ""),
        cache: "no-store",
      }
    ),
  ]);

  if (!sourceRacesResponse.ok) {
    throw new Error(`Unable to load source edition races: ${await sourceRacesResponse.text()}`);
  }
  if (!existingTargetYearResponse.ok) {
    throw new Error(`Unable to inspect requested edition year: ${await existingTargetYearResponse.text()}`);
  }

  const existingTargetYearRace = z.array(z.object({ id: z.string().uuid() })).parse(await existingTargetYearResponse.json())[0] ?? null;
  if (existingTargetYearRace) {
    throw new Error("The requested edition year already has at least one format.");
  }

  const sourceRaces = z.array(sourceRaceSchema).parse(await sourceRacesResponse.json());
  if (sourceRaces.length === 0) {
    throw new Error("No source formats were found for the requested source year.");
  }

  const earliestSourceDate =
    sourceRaces
      .map((race) => parseIsoDate(race.race_date))
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

  const requestedStartDate = parseIsoDate(requestRow.requested_start_date);
  const dayShift =
    earliestSourceDate && requestedStartDate
      ? Math.round((requestedStartDate.getTime() - earliestSourceDate.getTime()) / DAY_IN_MS)
      : 0;

  const createdRaceIds: string[] = [];
  const clonedStoragePaths: string[] = [];

  try {
    for (const sourceRace of sourceRaces) {
      const nextRaceId = randomUUID();
      const nextRaceDate = sourceRace.race_date ? addUtcDays(sourceRace.race_date, dayShift) : requestRow.requested_start_date;

      const insertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races`, {
        method: "POST",
        headers: {
          ...serviceHeaders(serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          id: nextRaceId,
          event_id: requestRow.event_id,
          edition_group_id: sourceRace.edition_group_id ?? sourceRace.id,
          series_name: sourceRace.series_name?.trim() || sourceRace.name,
          slug: buildSlug(sourceRace.name),
          name: sourceRace.name,
          distance_km: sourceRace.distance_km,
          elevation_gain_m: sourceRace.elevation_gain_m,
          elevation_loss_m: sourceRace.elevation_loss_m ?? 0,
          location_text: sourceRace.location_text ?? null,
          race_date: nextRaceDate,
          thumbnail_url: sourceRace.thumbnail_url ?? null,
          organizer_details: sourceRace.organizer_details ?? null,
          gpx_path: `organizer/${requestRow.event_id}/${nextRaceId}.gpx`,
          gpx_hash: `manual:${nextRaceId}`,
          gpx_storage_path: null,
          gpx_sha256: null,
          is_live: true,
          is_public: true,
          created_by: null,
          min_alt_m: sourceRace.min_alt_m ?? null,
          max_alt_m: sourceRace.max_alt_m ?? null,
          start_lat: sourceRace.start_lat ?? null,
          start_lng: sourceRace.start_lng ?? null,
          bounds_min_lat: sourceRace.bounds_min_lat ?? null,
          bounds_min_lng: sourceRace.bounds_min_lng ?? null,
          bounds_max_lat: sourceRace.bounds_max_lat ?? null,
          bounds_max_lng: sourceRace.bounds_max_lng ?? null,
        }),
        cache: "no-store",
      });

      if (!insertResponse.ok) {
        throw new Error(`Unable to create cloned race: ${await insertResponse.text()}`);
      }

      createdRaceIds.push(nextRaceId);

      if (sourceRace.gpx_storage_path) {
        const sourceGpxResponse = await fetch(
          `${serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${sourceRace.gpx_storage_path}`,
          {
            headers: serviceHeaders(serviceConfig, ""),
            cache: "no-store",
          }
        );

        if (!sourceGpxResponse.ok) {
          throw new Error(`Unable to read source GPX: ${await sourceGpxResponse.text()}`);
        }

        const sourceGpxBuffer = await sourceGpxResponse.arrayBuffer();
        const nextStoragePath = `organizer/${requestRow.event_id}/${nextRaceId}/${Date.now()}.gpx`;
        const uploadResponse = await fetch(
          `${serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${nextStoragePath}`,
          {
            method: "POST",
            headers: {
              ...serviceHeaders(serviceConfig, sourceGpxResponse.headers.get("content-type") || "application/gpx+xml"),
              "x-upsert": "true",
            },
            body: sourceGpxBuffer,
          }
        );

        if (!uploadResponse.ok) {
          throw new Error(`Unable to clone source GPX: ${await uploadResponse.text()}`);
        }

        clonedStoragePaths.push(nextStoragePath);

        const gpxPatchResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${nextRaceId}`, {
          method: "PATCH",
          headers: serviceHeaders(serviceConfig),
          body: JSON.stringify({
            gpx_path: nextStoragePath,
            gpx_hash: sourceRace.gpx_sha256 ?? sourceRace.gpx_hash ?? `clone:${nextRaceId}`,
            gpx_storage_path: nextStoragePath,
            gpx_sha256: sourceRace.gpx_sha256 ?? null,
          }),
          cache: "no-store",
        });

        if (!gpxPatchResponse.ok) {
          throw new Error(`Unable to persist cloned GPX: ${await gpxPatchResponse.text()}`);
        }
      }

      const sourceStationsResponse = await fetch(
        `${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${sourceRace.id}&select=id,name,km,water_available,solid_available,assistance_allowed,notes,order_index,organizer_details&order=order_index.asc`,
        {
          headers: serviceHeaders(serviceConfig, ""),
          cache: "no-store",
        }
      );

      if (!sourceStationsResponse.ok) {
        throw new Error(`Unable to load source aid stations: ${await sourceStationsResponse.text()}`);
      }

      const sourceStations = z.array(cloneAidStationSchema).parse(await sourceStationsResponse.json());
      const stationIdMap = new Map<string, string>();

      if (sourceStations.length > 0) {
        const stationInsertPayload = sourceStations.map((station) => {
          const nextStationId = randomUUID();
          stationIdMap.set(station.id, nextStationId);
          return {
            id: nextStationId,
            race_id: nextRaceId,
            name: station.name,
            km: station.km,
            water_available: station.water_available,
            solid_available: station.solid_available ?? true,
            assistance_allowed: station.assistance_allowed ?? true,
            notes: station.notes ?? null,
            order_index: station.order_index,
            organizer_details: station.organizer_details ?? null,
          };
        });

        const stationInsertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
          method: "POST",
          headers: serviceHeaders(serviceConfig),
          body: JSON.stringify(stationInsertPayload),
          cache: "no-store",
        });

        if (!stationInsertResponse.ok) {
          throw new Error(`Unable to clone aid stations: ${await stationInsertResponse.text()}`);
        }

        const sourceProductsResponse = await fetch(
          `${serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products?select=product_id,race_aid_station_id,notes,order_index,race_aid_stations!inner(race_id)&race_aid_stations.race_id=eq.${sourceRace.id}&order=order_index.asc`,
          {
            headers: serviceHeaders(serviceConfig, ""),
            cache: "no-store",
          }
        );

        if (!sourceProductsResponse.ok) {
          throw new Error(`Unable to load source station products: ${await sourceProductsResponse.text()}`);
        }

        const sourceProducts = z.array(cloneAidStationProductSchema.passthrough()).parse(await sourceProductsResponse.json());
        const productInsertPayload = sourceProducts
          .map((product) => {
            const nextStationId = stationIdMap.get(product.race_aid_station_id);
            if (!nextStationId) return null;
            return {
              race_aid_station_id: nextStationId,
              product_id: product.product_id,
              notes: product.notes ?? null,
              order_index: product.order_index,
            };
          })
          .filter((product): product is NonNullable<typeof product> => product !== null);

        if (productInsertPayload.length > 0) {
          const productInsertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_aid_station_products`, {
            method: "POST",
            headers: serviceHeaders(serviceConfig),
            body: JSON.stringify(productInsertPayload),
            cache: "no-store",
          });

          if (!productInsertResponse.ok) {
            throw new Error(`Unable to clone station products: ${await productInsertResponse.text()}`);
          }
        }
      }
    }
  } catch (error) {
    await Promise.all(
      clonedStoragePaths.map((storagePath) =>
        fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
          method: "DELETE",
          headers: serviceHeaders(serviceConfig, ""),
          cache: "no-store",
        }).catch(() => null)
      )
    );
    await deleteClonedRaces(serviceConfig.supabaseUrl, serviceConfig.supabaseServiceRoleKey, createdRaceIds);
    throw error;
  }
}

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
  z.object({
    action: z.literal("assign"),
    eventId: z.string().uuid(),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    createAccount: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal("approveEditionRequest"),
    editionRequestId: z.string().uuid(),
    reviewerNotes: z.string().trim().optional().transform((value) => (value ? value : null)),
  }),
  z.object({
    action: z.literal("rejectEditionRequest"),
    editionRequestId: z.string().uuid(),
    reviewerNotes: z.string().trim().optional().transform((value) => (value ? value : null)),
  }),
]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const [claimsResponse, membershipsResponse, editionRequestsResponse, eventsResponse] = await Promise.all([
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
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?status=eq.pending&select=id,created_at,updated_at,user_id,event_id,source_year,requested_start_date,status,reviewed_by,reviewed_at,reviewer_notes,race_events(id,name,location,race_date)&order=created_at.asc&limit=200`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    ),
    fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?select=id,name,location,race_date&order=name.asc&limit=1000`,
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
      editionRequests: editionRequestsResponse.ok ? null : await editionRequestsResponse.text(),
    });
    return jsonError("Unable to load organizer claims.", 502);
  }

  const claims = z.array(claimRowSchema).parse(await claimsResponse.json());
  const memberships = z.array(membershipRowSchema).parse(await membershipsResponse.json());
  let editionRequests: Array<z.infer<typeof editionRequestRowSchema>> = [];
  let events: Array<z.infer<typeof raceEventOptionSchema>> = [];

  if (editionRequestsResponse.ok) {
    editionRequests = z.array(editionRequestRowSchema).parse(await editionRequestsResponse.json());
  } else {
    console.warn("Unable to load admin edition requests. Continuing without them.", await editionRequestsResponse.text());
  }

  if (eventsResponse.ok) {
    events = z.array(raceEventOptionSchema).parse(await eventsResponse.json());
  } else {
    console.warn("Unable to load race events for organizer assignment. Continuing without them.", await eventsResponse.text());
  }

  const userIds = Array.from(new Set([...claims, ...memberships, ...editionRequests].map((row) => row.user_id)));

  let userProfilesById = new Map<string, string>();
  let userEmailsById = new Map<string, string>();

  if (userIds.length > 0) {
    const [profilesResponse, adminUsersResponse] = await Promise.all([
      fetch(
        `${auth.serviceConfig.supabaseUrl}/rest/v1/user_profiles?user_id=in.(${userIds.join(",")})&select=user_id,full_name`,
        {
          headers: serviceHeaders(auth.serviceConfig, ""),
          cache: "no-store",
        }
      ),
      fetch(`${auth.serviceConfig.supabaseUrl}/auth/v1/admin/users?per_page=200`, {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }),
    ]);

    if (!profilesResponse.ok) {
      console.warn("Unable to enrich admin organizer claims with profile names", await profilesResponse.text());
    } else {
      userProfilesById = new Map(
        z
          .array(userProfileRowSchema)
          .parse(await profilesResponse.json())
          .filter((profile) => typeof profile.full_name === "string" && profile.full_name.trim().length > 0)
          .map((profile) => [profile.user_id, profile.full_name!.trim()])
      );
    }

    if (!adminUsersResponse.ok) {
      console.warn("Unable to enrich admin organizer claims with auth emails", await adminUsersResponse.text());
    } else {
      userEmailsById = new Map(
        adminUsersResponseSchema
          .parse(await adminUsersResponse.json())
          .users.filter((user) => {
            if (!userIds.includes(user.id)) return false;
            const email = user.email?.trim() ?? "";
            return email.includes("@");
          })
          .map((user) => [user.id, user.email!.trim()])
      );
    }
  }

  const withUserIdentity = <T extends { user_id: string; contact_email?: string }>(row: T) => {
    const fullName = userProfilesById.get(row.user_id) ?? null;
    const email = userEmailsById.get(row.user_id) ?? row.contact_email ?? null;
    const label = fullName ?? email ?? row.user_id;
    return {
      ...row,
      user: {
        id: row.user_id,
        full_name: fullName,
        email,
        label,
      },
    };
  };

  return withSecurityHeaders(
    NextResponse.json({
      claims: claims.map(withUserIdentity),
      memberships: memberships.map(withUserIdentity),
      editionRequests: editionRequests.map(withUserIdentity),
      events,
    })
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsedBody = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return jsonError("Invalid organizer claim action.", 400);

  if (parsedBody.data.action === "assign") {
    let authUser: Awaited<ReturnType<typeof findAuthUserByEmail>>;
    let event: z.infer<typeof raceEventOptionSchema> | null = null;

    try {
      const [matchedUser, eventResponse] = await Promise.all([
        findAuthUserByEmail(auth.serviceConfig, parsedBody.data.email),
        fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedBody.data.eventId}&select=id,name,location,race_date&limit=1`,
          {
            headers: serviceHeaders(auth.serviceConfig, ""),
            cache: "no-store",
          }
        ),
      ]);

      if (!eventResponse.ok) {
        console.error("Unable to load race event before organizer assignment", await eventResponse.text());
        return jsonError("Unable to load the race event.", 502);
      }

      authUser = matchedUser;
      event = z.array(raceEventOptionSchema).parse(await eventResponse.json())[0] ?? null;
    } catch (error) {
      console.error("Unable to resolve organizer assignment", error);
      return jsonError("Unable to find the Supabase account.", 502);
    }

    if (!event) return jsonError("Race event not found.", 404);
    if (!authUser && !parsedBody.data.createAccount) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            code: "auth_account_not_found",
            message: "Aucun compte Supabase ne correspond à cette adresse e-mail.",
            email: parsedBody.data.email,
          },
          { status: 404 }
        )
      );
    }

    let accountCreated = false;
    if (!authUser) {
      const inviteResponse = await fetch(`${auth.serviceConfig.supabaseUrl}/auth/v1/invite`, {
        method: "POST",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({ email: parsedBody.data.email }),
        cache: "no-store",
      });

      if (!inviteResponse.ok) {
        console.error("Unable to invite organizer account", await inviteResponse.text());
        return jsonError("Impossible de créer et d’inviter le compte Supabase.", 502);
      }

      const invitedUser = adminUserRowSchema.parse(await inviteResponse.json());
      authUser = { id: invitedUser.id, email: invitedUser.email?.trim() || parsedBody.data.email };
      accountCreated = true;
    }

    const existingResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?event_id=eq.${event.id}&user_id=eq.${authUser.id}&select=id,role,revoked_at&order=created_at.desc`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!existingResponse.ok) {
      console.error("Unable to inspect organizer membership before assignment", await existingResponse.text());
      return jsonError("Unable to assign organizer access.", 502);
    }

    const existingMemberships = z.array(existingMembershipSchema).parse(await existingResponse.json());
    const activeMembership = existingMemberships.find((membership) => !membership.revoked_at);
    if (activeMembership) {
      return jsonError("This account already has active organizer access to this race event.", 409);
    }

    const revokedMembership = existingMemberships[0] ?? null;
    const membershipResponse = revokedMembership
      ? await fetch(
          `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers?id=eq.${revokedMembership.id}`,
          {
            method: "PATCH",
            headers: {
              ...serviceHeaders(auth.serviceConfig),
              Prefer: "return=representation",
            },
            body: JSON.stringify({
              role: revokedMembership.role === "owner" ? "owner" : "organizer",
              created_by: auth.user.id,
              revoked_at: null,
              revoked_by: null,
              revoke_reason: null,
            }),
            cache: "no-store",
          }
        )
      : await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_organizers`, {
          method: "POST",
          headers: {
            ...serviceHeaders(auth.serviceConfig),
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            event_id: event.id,
            user_id: authUser.id,
            role: "organizer",
            created_by: auth.user.id,
          }),
          cache: "no-store",
        });

    if (!membershipResponse.ok) {
      console.error("Unable to create organizer assignment", await membershipResponse.text());
      return jsonError("Unable to assign organizer access.", 502);
    }

    const membership = z
      .array(membershipRowSchema.omit({ race_events: true }).passthrough())
      .parse(await membershipResponse.json())[0] ?? null;

    return withSecurityHeaders(NextResponse.json({ membership, user: authUser, event, accountCreated }));
  }

  if (parsedBody.data.action === "approveEditionRequest" || parsedBody.data.action === "rejectEditionRequest") {
    const nextStatus = parsedBody.data.action === "approveEditionRequest" ? "approved" : "rejected";
    const editionRequestResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?id=eq.${parsedBody.data.editionRequestId}&select=id,event_id,source_year,requested_start_date,status&limit=1`,
      {
        headers: serviceHeaders(auth.serviceConfig, ""),
        cache: "no-store",
      }
    );

    if (!editionRequestResponse.ok) {
      console.error("Unable to load edition request for action", await editionRequestResponse.text());
      return jsonError("Unable to load edition request.", 502);
    }

    const editionRequest = z
      .array(editionRequestActionRowSchema)
      .parse(await editionRequestResponse.json())[0] ?? null;

    if (!editionRequest) return jsonError("Edition request not found.", 404);
    if (editionRequest.status !== "pending") {
      return jsonError("Edition request is no longer pending.", 409);
    }

    if (parsedBody.data.action === "approveEditionRequest") {
      try {
        await cloneEditionFromRequest(auth.serviceConfig, editionRequest);
      } catch (error) {
        console.error("Unable to clone approved edition request", error);
        return jsonError("Unable to create the approved edition.", 502);
      }
    }

    const response = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/race_event_edition_requests?id=eq.${editionRequest.id}`,
      {
        method: "PATCH",
        headers: {
          ...serviceHeaders(auth.serviceConfig),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          status: nextStatus,
          reviewed_by: auth.user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: parsedBody.data.reviewerNotes,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to update edition request", await response.text());
      return jsonError("Unable to update edition request.", 502);
    }

    const updated = z.array(editionRequestRowSchema.omit({ race_events: true }).passthrough()).parse(await response.json())[0] ?? null;
    return withSecurityHeaders(NextResponse.json({ editionRequest: updated }));
  }

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
