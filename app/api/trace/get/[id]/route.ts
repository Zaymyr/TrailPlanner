import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseUserFromRequest } from "../../../../../lib/supabase-server";
import { traceDetailSchema } from "../../../../../lib/trace/traceSchemas";

const idSchema = z.object({ id: z.string().uuid() });
const projection = "id,owner_id,name,is_public,created_at,updated_at";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const rateKey = `trace:get:${params.id}:${request.headers.get("x-forwarded-for") ?? "anonymous"}`;
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
      console.error("Unable to load trace", traceResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    if (!traceResult.data) {
      return withSecurityHeaders(NextResponse.json({ message: "Trace not found." }, { status: 404 }));
    }

    const [pointsResult, aidStationResult] = await Promise.all([
      supabase.from("trace_points").select("*").eq("trace_id", traceResult.data.id).order("idx", { ascending: true }),
      supabase.from("aid_stations").select("*").eq("trace_id", traceResult.data.id).order("created_at", { ascending: true }),
    ]);

    if (pointsResult.error || aidStationResult.error) {
      console.error("Unable to load trace details", pointsResult.error ?? aidStationResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    const parsed = traceDetailSchema.safeParse({
      trace: traceResult.data,
      points: pointsResult.data ?? [],
      aidStations: aidStationResult.data ?? [],
    });

    if (!parsed.success) {
      console.error("Invalid trace detail response", parsed.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json(parsed.data));
  } catch (error) {
    console.error("Unexpected error while fetching trace", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load trace." }, { status: 500 }));
  }
}
