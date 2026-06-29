import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseAnonConfig } from "../../../../../lib/supabase";

const updateRowSchema = z.object({
  id: z.string().uuid(),
  event_id: z.string().uuid(),
  message: z.string(),
  created_at: z.string(),
});

const eventRowSchema = z.object({
  id: z.string().uuid(),
});

const uuidParamSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, context: { params: { id?: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 }));
  }

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid event id." }, { status: 400 }));
  }

  const eventResponse = await fetch(
    `${supabaseConfig.supabaseUrl}/rest/v1/race_events?id=eq.${parsedParams.data.id}&is_live=eq.true&select=id&limit=1`,
    {
      headers: {
        apikey: supabaseConfig.supabaseAnonKey,
      },
      cache: "no-store",
    }
  );

  if (!eventResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to verify race event." }, { status: 502 }));
  }

  const event = z.array(eventRowSchema).parse(await eventResponse.json())[0] ?? null;
  if (!event) {
    return withSecurityHeaders(NextResponse.json({ message: "Race event not found." }, { status: 404 }));
  }

  const updatesResponse = await fetch(
    `${supabaseConfig.supabaseUrl}/rest/v1/race_event_updates?event_id=eq.${parsedParams.data.id}&select=id,event_id,message,created_at&order=created_at.desc&limit=20`,
    {
      headers: {
        apikey: supabaseConfig.supabaseAnonKey,
      },
      cache: "no-store",
    }
  );

  if (!updatesResponse.ok) {
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load race event updates." }, { status: 502 }));
  }

  const updates = z.array(updateRowSchema).parse(await updatesResponse.json());
  return withSecurityHeaders(NextResponse.json({ updates }));
}
