import { NextResponse } from "next/server";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseUserFromRequest } from "../../../../lib/supabase-server";
import { traceDetailSchema, traceSaveSchema } from "../../../../lib/trace/traceSchemas";

const projection = "id,owner_id,name,is_public,created_at,updated_at";

export async function POST(request: Request) {
  const rateKey = `trace:save:${request.headers.get("x-forwarded-for") ?? "anonymous"}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Rate limit exceeded." }, { status: 429, headers: { "Retry-After": `${rate.retryAfter ?? 60}` } })
    );
  }

  const { user, supabase, accessToken } = await getSupabaseUserFromRequest(request);

  if (!user || !accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const parsedBody = traceSaveSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid trace payload." }, { status: 400 }));
  }

  try {
    const payload = parsedBody.data;
    const sortedPoints = payload.points.slice().sort((a, b) => a.idx - b.idx);
    const traceFields = { name: payload.name, is_public: payload.isPublic };
    let traceId = payload.id ?? null;

    if (payload.id) {
      const existing = await supabase.from("traces").select("id").eq("id", payload.id).maybeSingle();
      if (existing.error) {
        console.error("Unable to verify trace ownership", existing.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to update trace." }, { status: 500 }));
      }
      if (!existing.data) {
        return withSecurityHeaders(NextResponse.json({ message: "Trace not found." }, { status: 404 }));
      }

      const updateResult = await supabase
        .from("traces")
        .update(traceFields)
        .eq("id", payload.id)
        .select(projection)
        .maybeSingle();

      if (updateResult.error || !updateResult.data) {
        console.error("Unable to update trace", updateResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to update trace." }, { status: 500 }));
      }

      traceId = updateResult.data.id;

      await supabase.from("trace_points").delete().eq("trace_id", traceId);
      await supabase.from("aid_stations").delete().eq("trace_id", traceId);
    } else {
      const insertResult = await supabase
        .from("traces")
        .insert({ ...traceFields, owner_id: user.id })
        .select(projection)
        .maybeSingle();

      if (insertResult.error || !insertResult.data) {
        console.error("Unable to create trace", insertResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to save trace." }, { status: 500 }));
      }

      traceId = insertResult.data.id;
    }

    const pointPayload = sortedPoints.map((point) => ({
      trace_id: traceId,
      idx: point.idx,
      lat: point.lat,
      lng: point.lng,
      elevation: point.elevation ?? null,
    }));

    if (pointPayload.length > 0) {
      const pointResult = await supabase.from("trace_points").insert(pointPayload);
      if (pointResult.error) {
        console.error("Unable to save trace points", pointResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to save trace points." }, { status: 500 }));
      }
    }

    const aidPayload = (payload.aidStations ?? []).map((station) => ({
      trace_id: traceId,
      name: station.name,
      lat: station.lat,
      lng: station.lng,
      type: station.type ?? null,
      notes: station.notes ?? null,
    }));

    if (aidPayload.length > 0) {
      const aidResult = await supabase.from("aid_stations").insert(aidPayload);
      if (aidResult.error) {
        console.error("Unable to save aid stations", aidResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to save aid stations." }, { status: 500 }));
      }
    }

    const detailResult = await supabase
      .from("traces")
      .select(projection)
      .eq("id", traceId)
      .maybeSingle();

    if (detailResult.error || !detailResult.data) {
      console.error("Unable to reload trace", detailResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    const [pointsResult, aidStationResult] = await Promise.all([
      supabase.from("trace_points").select("*").eq("trace_id", traceId).order("idx", { ascending: true }),
      supabase.from("aid_stations").select("*").eq("trace_id", traceId).order("created_at", { ascending: true }),
    ]);

    if (pointsResult.error || aidStationResult.error) {
      console.error("Unable to load trace details after save", pointsResult.error ?? aidStationResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    const parsed = traceDetailSchema.safeParse({
      trace: detailResult.data,
      points: pointsResult.data ?? [],
      aidStations: aidStationResult.data ?? [],
    });

    if (!parsed.success) {
      console.error("Invalid trace response after save", parsed.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json(parsed.data, { status: payload.id ? 200 : 201 }));
  } catch (error) {
    console.error("Unexpected error while saving trace", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to save trace." }, { status: 500 }));
  }
}
