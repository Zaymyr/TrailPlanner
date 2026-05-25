import { NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";
import { upsertPushDevice } from "../../../../lib/push";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../../lib/supabase";

const registerPushDeviceSchema = z.object({
  expoPushToken: z.string().trim().min(1, "Expo push token is required."),
  platform: z.enum(["ios", "android"]),
  locale: z.string().trim().min(2).max(8).default("en"),
  appVersion: z.string().trim().max(32).nullish(),
  notificationsEnabled: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return withSecurityHeaders(
      NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 })
    );
  }

  const accessToken = extractBearerToken(request.headers.get("authorization"));

  if (!accessToken) {
    return withSecurityHeaders(NextResponse.json({ message: "Missing access token." }, { status: 401 }));
  }

  const user = await fetchSupabaseUser(accessToken, supabaseConfig);

  if (!user?.id) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid session." }, { status: 401 }));
  }

  const parsedBody = registerPushDeviceSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid payload." }, { status: 400 }));
  }

  try {
    const device = await upsertPushDevice({
      userId: user.id,
      expoPushToken: parsedBody.data.expoPushToken,
      platform: parsedBody.data.platform,
      locale: parsedBody.data.locale,
      appVersion: parsedBody.data.appVersion ?? null,
      notificationsEnabled: parsedBody.data.notificationsEnabled,
    });

    return withSecurityHeaders(NextResponse.json({ device }));
  } catch (error) {
    console.error("Unable to register push device.", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to register push device." }, { status: 500 }));
  }
}
