import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseUserFromRequest } from "../../../../../lib/supabase-server";
import { traceDetailSchema } from "../../../../../lib/trace/traceSchemas";

const idSchema = z.object({ id: z.string().uuid() });
const projection = "id,owner_id,name,is_public,created_at,updated_at";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const rateKey = `trace:duplicate:${params.id}:${request.headers.get("x-forwarded-for") ?? "anonymous"}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Rate limit exceeded." }, { status: 429, headers: { "Retry-After": `${rate.retryAfter ?? 60}` } })
    );
  }

  const validatedParams = idSchema.safeParse(params);
  if (!validatedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid trace id." }, { status: 400 }));
  }

  const { user, supabase } = await getSupabaseUserFromRequest(request);

  if (!user) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  try {
    const traceResult = await supabase
      .from("traces")
      .select(projection)
      .eq("id", validatedParams.data.id)
      .maybeSingle();

    if (traceResult.error) {
      console.error("Unable to load trace for duplication", traceResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
    }

    if (!traceResult.data) {
      return withSecurityHeaders(NextResponse.json({ message: "Trace not found." }, { status: 404 }));
    }

    const [pointsResult, aidStationsResult] = await Promise.all([
      supabase.from("trace_points").select("*").eq("trace_id", traceResult.data.id).order("idx", { ascending: true }),
      supabase.from("aid_stations").select("*").eq("trace_id", traceResult.data.id).order("created_at", { ascending: true }),
    ]);

    if (pointsResult.error || aidStationsResult.error) {
      console.error("Unable to load trace details for duplication", pointsResult.error ?? aidStationsResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
    }

    const duplicateName = `${traceResult.data.name} (copy)`;
    const insertResult = await supabase
      .from("traces")
      .insert({
        name: duplicateName,
        is_public: false,
        owner_id: user.id,
      })
      .select(projection)
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      console.error("Unable to create duplicate trace", insertResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
    }

    const newTraceId = insertResult.data.id;

    if ((pointsResult.data?.length ?? 0) > 0) {
      const insertPoints = pointsResult.data!.map((point) => ({
        trace_id: newTraceId,
        idx: point.idx,
        lat: point.lat,
        lng: point.lng,
        elevation: point.elevation ?? null,
      }));
      const pointInsertResult = await supabase.from("trace_points").insert(insertPoints);
      if (pointInsertResult.error) {
        console.error("Unable to duplicate trace points", pointInsertResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
      }
    }

    if ((aidStationsResult.data?.length ?? 0) > 0) {
      const insertStations = aidStationsResult.data!.map((station) => ({
        trace_id: newTraceId,
        name: station.name,
        lat: station.lat,
        lng: station.lng,
        type: station.type ?? null,
        notes: station.notes ?? null,
      }));
      const stationInsertResult = await supabase.from("aid_stations").insert(insertStations);
      if (stationInsertResult.error) {
        console.error("Unable to duplicate aid stations", stationInsertResult.error);
        return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
      }
    }

    const parsed = traceDetailSchema.safeParse({
      trace: insertResult.data,
      points: pointsResult.data ?? [],
      aidStations: aidStationsResult.data ?? [],
    });

    if (!parsed.success) {
      console.error("Invalid duplicate trace response", parsed.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json(parsed.data, { status: 201 }));
  } catch (error) {
    console.error("Unexpected error while duplicating trace", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to duplicate trace." }, { status: 500 }));
  }
}
