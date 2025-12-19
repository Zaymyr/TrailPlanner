import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseUserFromRequest } from "../../../../../lib/supabase-server";

const idSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const rateKey = `trace:delete:${params.id}:${request.headers.get("x-forwarded-for") ?? "anonymous"}`;
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
    const deleteResult = await supabase
      .from("traces")
      .delete()
      .eq("id", validatedParams.data.id)
      .select("id")
      .maybeSingle();

    if (deleteResult.error) {
      console.error("Unable to delete trace", deleteResult.error);
      return withSecurityHeaders(NextResponse.json({ message: "Unable to delete trace." }, { status: 500 }));
    }

    if (!deleteResult.data) {
      return withSecurityHeaders(NextResponse.json({ message: "Trace not found." }, { status: 404 }));
    }

    return withSecurityHeaders(NextResponse.json({ success: true }, { status: 200 }));
  } catch (error) {
    console.error("Unexpected error while deleting trace", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to delete trace." }, { status: 500 }));
  }
}
