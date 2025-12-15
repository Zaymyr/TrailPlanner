import { NextResponse } from "next/server";
import { z } from "zod";

const feedbackSchema = z.object({
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
        subject: parsedBody.data.subject,
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
