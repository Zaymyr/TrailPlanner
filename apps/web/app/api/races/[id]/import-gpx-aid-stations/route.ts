import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import {
  extractBearerToken,
  fetchSupabaseUser,
  getSupabaseAnonConfig,
  getSupabaseServiceConfig,
} from "../../../../../lib/supabase";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const paramsSchema = z.object({ id: z.string().uuid() });

const requestBodySchema = z.object({
  /** Raw GPX XML. If omitted, the stored GPX for the race is used. */
  gpx_content: z.string().min(1).optional(),
});

const existingStationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  order_index: z.number(),
});

const raceMetaSchema = z.object({
  id: z.string().uuid(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  gpx_storage_path: z.string().nullable().optional(),
  created_by: z.string().uuid().nullable().optional(),
});

/** Shape of each station entry returned by Claude */
const claudeStationSchema = z.object({
  action: z.enum(["insert", "update", "delete"]),
  id: z.string().uuid().nullable(),
  race_id: z.string(),
  name: z.string().min(1),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable(),
  order_index: z.number().int().nonnegative(),
});

const claudeResponseSchema = z.object({
  stations: z.array(claudeStationSchema),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const buildAuthHeaders = (key: string, token: string, contentType = "application/json") => ({
  apikey: key,
  Authorization: `Bearer ${token}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

/** Build the Claude system prompt for GPX aid-station extraction. */
const buildSystemPrompt = (
  raceId: string,
  distanceKm: number,
  elevationGainM: number,
  existingStationsJson: string,
  gpxContent: string
): string => `Tu es un assistant expert en trail running et en parsing de fichiers GPX.

## Contexte
On t'a fourni :
1. Le contenu XML brut d'un fichier GPX d'une course de trail
2. Les aid stations ACTUELLEMENT en base pour cette course (peut être vide si premier import)

Ton rôle est d'extraire les points de ravitaillement du GPX et de produire
un plan de merge avec les stations existantes.

## Données de la course
- Race ID : ${raceId}
- Distance totale : ${distanceKm} km
- Dénivelé positif : ${elevationGainM} m D+

## Stations actuellement en base
${existingStationsJson}
-- Format : [{ "id": "uuid", "name": "...", "km": 12.3, "order_index": 0 }]
-- Tableau vide [] si premier import

## Fichier GPX
${gpxContent}

## Instructions
1. Extrais tous les waypoints (<wpt>, <rtept>) susceptibles d'être des ravitaillements.
2. Calcule le km depuis le départ via la distance cumulée de la trace principale.
3. Pour chaque station extraite, cherche un match parmi les stations existantes :
   - Match si : même nom (insensible à la casse) OU km à moins de ±1.5km
   - Si match → action "update" avec l'id existant
   - Si pas de match → action "insert"
4. Pour les stations existantes sans match dans le GPX → action "delete"
   (l'app décidera de supprimer ou flaguer selon les plans liés)

## Format de réponse
Réponds UNIQUEMENT avec un JSON valide, sans markdown, sans explication :

{
  "stations": [
    {
      "action": "insert" | "update" | "delete",
      "id": "uuid existant ou null si insert",
      "race_id": "${raceId}",
      "name": "Nom du point",
      "km": 12.3,
      "water_available": true,
      "notes": null,
      "order_index": 0
    }
  ]
}

Règles :
- km arrondi à 1 décimale
- Ne pas inclure le départ (km 0)
- Inclure l'arrivée si explicite dans le GPX
- order_index croissant par km`;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: raceId } = await params;

  // --- Config ---
  const supabaseAnon = getSupabaseAnonConfig();
  const supabaseService = getSupabaseServiceConfig();

  if (!supabaseAnon || !supabaseService) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Server configuration error." }, { status: 500 })
    );
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    return withSecurityHeaders(
      NextResponse.json({ message: "AI service not configured." }, { status: 500 })
    );
  }

  // --- Validate params ---
  const parsedParams = paramsSchema.safeParse({ id: raceId });
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race ID." }, { status: 400 }));
  }

  // --- Auth ---
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  // --- Rate limit: 5 GPX imports per user per minute ---
  const rateLimit = checkRateLimit(`import-gpx-aid-stations:${user.id}`, 5, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        {
          status: 429,
          headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() },
        }
      )
    );
  }

  // --- Parse body ---
  const rawBody = await request.json().catch(() => null);
  const parsedBody = requestBodySchema.safeParse(rawBody ?? {});
  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  // --- Fetch race metadata + verify ownership ---
  const raceResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/races?id=eq.${raceId}&created_by=eq.${user.id}&select=id,distance_km,elevation_gain_m,gpx_storage_path,created_by&limit=1`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!raceResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to fetch race." }, { status: 502 }));
  }

  const raceRows = await raceResponse.json();
  if (!raceRows?.length) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Race not found or not authorized." }, { status: 404 })
    );
  }

  const raceMeta = raceMetaSchema.safeParse(raceRows[0]);
  if (!raceMeta.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Unexpected race data." }, { status: 502 }));
  }

  // --- Resolve GPX content ---
  let gpxContent = parsedBody.data.gpx_content ?? null;

  if (!gpxContent) {
    const storagePath = raceMeta.data.gpx_storage_path;
    if (!storagePath) {
      return withSecurityHeaders(
        NextResponse.json(
          { message: "No GPX file associated with this race. Upload one or provide gpx_content." },
          { status: 422 }
        )
      );
    }

    const gpxResponse = await fetch(
      `${supabaseService.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`,
      {
        headers: {
          apikey: supabaseService.supabaseServiceRoleKey,
          Authorization: `Bearer ${supabaseService.supabaseServiceRoleKey}`,
        },
      }
    );

    if (!gpxResponse.ok) {
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to fetch GPX file from storage." }, { status: 502 })
      );
    }

    gpxContent = await gpxResponse.text();
  }

  // --- Fetch existing aid stations ---
  const aidStationsResponse = await fetch(
    `${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=id,name,km,order_index&order=order_index.asc`,
    {
      headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!aidStationsResponse.ok) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to fetch existing aid stations." }, { status: 502 })
    );
  }

  const existingStationsRaw = await aidStationsResponse.json();
  const existingStations = z.array(existingStationSchema).catch([]).parse(existingStationsRaw);
  const existingStationsJson = JSON.stringify(existingStations);

  // --- Call Claude ---
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  let claudeText: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: buildSystemPrompt(
            raceId,
            raceMeta.data.distance_km,
            raceMeta.data.elevation_gain_m,
            existingStationsJson,
            gpxContent
          ),
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    claudeText = textBlock?.type === "text" ? textBlock.text.trim() : "";
  } catch (error) {
    console.error("Claude API error during GPX aid station import", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "AI service error. Please try again later." }, { status: 502 })
    );
  }

  // --- Parse Claude's JSON response ---
  let claudeParsed: z.infer<typeof claudeResponseSchema>;
  try {
    // Strip possible markdown code fences if Claude adds them despite instructions
    const jsonText = claudeText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    claudeParsed = claudeResponseSchema.parse(JSON.parse(jsonText));
  } catch (error) {
    console.error("Failed to parse Claude response", error, claudeText);
    return withSecurityHeaders(
      NextResponse.json({ message: "AI returned an unexpected format." }, { status: 502 })
    );
  }

  // --- Apply merge actions ---
  const results: { action: string; id: string; name: string; km: number }[] = [];
  const errors: string[] = [];

  for (const station of claudeParsed.stations) {
    try {
      if (station.action === "insert") {
        const newId = randomUUID();
        const insertRes = await fetch(
          `${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations`,
          {
            method: "POST",
            headers: {
              ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              id: newId,
              race_id: raceId,
              name: station.name,
              km: station.km,
              water_available: station.water_available,
              notes: station.notes ?? null,
              order_index: station.order_index,
            }),
            cache: "no-store",
          }
        );

        if (!insertRes.ok) {
          const errText = await insertRes.text();
          console.error("Failed to insert aid station", station.name, errText);
          errors.push(`insert:${station.name}`);
        } else {
          results.push({ action: "insert", id: newId, name: station.name, km: station.km });
        }
      } else if (station.action === "update" && station.id) {
        const updateRes = await fetch(
          `${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations?id=eq.${station.id}&race_id=eq.${raceId}`,
          {
            method: "PATCH",
            headers: {
              ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              name: station.name,
              km: station.km,
              water_available: station.water_available,
              notes: station.notes ?? null,
              order_index: station.order_index,
            }),
            cache: "no-store",
          }
        );

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          console.error("Failed to update aid station", station.id, errText);
          errors.push(`update:${station.id}`);
        } else {
          results.push({ action: "update", id: station.id, name: station.name, km: station.km });
        }
      } else if (station.action === "delete" && station.id) {
        // Check if any plan_aid_stations reference this station
        const planRefRes = await fetch(
          `${supabaseAnon.supabaseUrl}/rest/v1/plan_aid_stations?race_aid_station_id=eq.${station.id}&select=id&limit=1`,
          {
            headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
            cache: "no-store",
          }
        );

        const planRefs = planRefRes.ok ? await planRefRes.json().catch(() => []) : [];
        const hasPlans = Array.isArray(planRefs) && planRefs.length > 0;

        if (hasPlans) {
          // Flag for review instead of deleting
          const flagRes = await fetch(
            `${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations?id=eq.${station.id}&race_id=eq.${raceId}`,
            {
              method: "PATCH",
              headers: {
                ...buildAuthHeaders(supabaseAnon.supabaseAnonKey, token),
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ needs_review: true }),
              cache: "no-store",
            }
          );

          if (!flagRes.ok) {
            console.error("Failed to flag aid station for review", station.id);
            errors.push(`flag:${station.id}`);
          } else {
            results.push({ action: "flagged", id: station.id, name: station.name, km: station.km });
          }
        } else {
          const deleteRes = await fetch(
            `${supabaseAnon.supabaseUrl}/rest/v1/race_aid_stations?id=eq.${station.id}&race_id=eq.${raceId}`,
            {
              method: "DELETE",
              headers: buildAuthHeaders(supabaseAnon.supabaseAnonKey, token, undefined),
              cache: "no-store",
            }
          );

          if (!deleteRes.ok) {
            const errText = await deleteRes.text();
            console.error("Failed to delete aid station", station.id, errText);
            errors.push(`delete:${station.id}`);
          } else {
            results.push({ action: "delete", id: station.id, name: station.name, km: station.km });
          }
        }
      }
    } catch (err) {
      console.error("Unexpected error processing station action", station, err);
      errors.push(`error:${station.name}`);
    }
  }

  return withSecurityHeaders(
    NextResponse.json({
      applied: results,
      ...(errors.length > 0 ? { errors } : {}),
    })
  );
}
