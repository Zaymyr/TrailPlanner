import { NextResponse } from "next/server";
import { z } from "zod";

import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig } from "../../../lib/supabase";

const feedbackSchema = z.object({
  kind: z.enum(["bug", "feedback"]).optional().default("feedback"),
  screen: z
    .string()
    .trim()
    .max(120, "Screen is too long")
    .optional()
    .transform((value) => value?.trim() || null),
  subject: z.string().trim().min(1, "Subject is required"),
  detail: z.string().trim().min(1, "Detail is required"),
});

const getSupabaseConfig = () => {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error("Missing Supabase environment variables", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
    });
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ""),
    supabaseServiceRoleKey,
  };
};

export async function POST(request: Request) {
  const parsedBody = feedbackSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid feedback payload." }, { status: 400 });
  }

  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  const { supabaseUrl, supabaseServiceRoleKey } = supabaseConfig;
  const supabaseAnonConfig = getSupabaseAnonConfig();
  const accessToken = extractBearerToken(request.headers.get("authorization"));
  let userId: string | null = null;

  if (accessToken && supabaseAnonConfig) {
    const supabaseUser = await fetchSupabaseUser(accessToken, supabaseAnonConfig);
    userId = supabaseUser?.id ?? null;
  }

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/app_feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        kind: parsedBody.data.kind,
        source: "web",
        screen: parsedBody.data.screen,
        subject: parsedBody.data.kind === "bug" ? `[bug] ${parsedBody.data.subject}` : parsedBody.data.subject,
        detail: parsedBody.data.detail,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to log feedback in Supabase:", errorText);
      return NextResponse.json({ message: "Unable to record feedback." }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Unexpected Supabase error while logging feedback", error);
    return NextResponse.json({ message: "Unable to record feedback." }, { status: 500 });
  }
}
