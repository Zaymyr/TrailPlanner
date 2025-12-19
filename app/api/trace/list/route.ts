import { NextResponse } from "next/server";

import { checkRateLimit, withSecurityHeaders } from "../../../../lib/http";
import { getSupabaseUserFromRequest } from "../../../../lib/supabase-server";
import { traceListResponseSchema, traceSearchFiltersSchema } from "../../../../lib/trace/traceSchemas";

const projection = "id,owner_id,name,is_public,created_at,updated_at";

export async function GET(request: Request) {
  const rateKey = `trace:list:${request.headers.get("x-forwarded-for") ?? "anonymous"}`;
  const rate = checkRateLimit(rateKey);
  if (!rate.allowed) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Rate limit exceeded." }, { status: 429, headers: { "Retry-After": `${rate.retryAfter ?? 60}` } })
    );
  }

  const { user, supabase } = await getSupabaseUserFromRequest(request);

  if (!user) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  const searchParams = new URL(request.url).searchParams;
  const parsedFilters = traceSearchFiltersSchema.safeParse({ search: searchParams.get("search") ?? undefined });

  if (!parsedFilters.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid filters." }, { status: 400 }));
  }

  try {
    const nameFilter = parsedFilters.data.search ? `%${parsedFilters.data.search}%` : null;

    const myQuery = supabase.from("traces").select(projection).eq("owner_id", user.id).order("updated_at", { ascending: false });
    if (nameFilter) {
      myQuery.ilike("name", nameFilter);
    }

    const publicQuery = supabase.from("traces").select(projection).eq("is_public", true).order("updated_at", { ascending: false });
    if (nameFilter) {
      publicQuery.ilike("name", nameFilter);
    }

    const [myResult, publicResult] = await Promise.all([myQuery, publicQuery]);

    if (myResult.error || publicResult.error) {
      console.error("Unable to fetch traces", myResult.error ?? publicResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load traces." }, { status: 500 }));
    }

    const parsed = traceListResponseSchema.safeParse({
      myTraces: myResult.data ?? [],
      publicTraces: publicResult.data ?? [],
    });

    if (!parsed.success) {
      console.error("Invalid trace list response", parsed.error.flatten().fieldErrors);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to load traces." }, { status: 500 }));
    }

    return withSecurityHeaders(NextResponse.json(parsed.data));
  } catch (error) {
    console.error("Unexpected error while loading traces", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load traces." }, { status: 500 }));
  }
}
