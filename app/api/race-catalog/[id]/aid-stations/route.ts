import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { getSupabaseAnonConfig } from "../../../../../lib/supabase";

const paramsSchema = z.object({ id: z.string().uuid() });

const aidStationRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  km: z.number(),
  water_available: z.boolean(),
  notes: z.string().nullable().optional(),
  order_index: z.number(),
});

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid request." }, { status: 400 }));
  }

  try {
    const response = await fetch(
      `${supabaseConfig.supabaseUrl}/rest/v1/race_catalog_aid_stations?race_id=eq.${parsedParams.data.id}&select=id,name,km,water_available,notes,order_index&order=order_index.asc`,
      {
        headers: {
          apikey: supabaseConfig.supabaseAnonKey,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Unable to load race catalog aid stations", await response.text());
      return withSecurityHeaders(
        NextResponse.json({ message: "Unable to load aid stations." }, { status: 502 })
      );
    }

    const rows = z.array(aidStationRowSchema).parse(await response.json());

    return withSecurityHeaders(NextResponse.json({ aidStations: rows }));
  } catch (error) {
    console.error("Unexpected error while loading race catalog aid stations", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to load aid stations." }, { status: 500 }));
  }
}
