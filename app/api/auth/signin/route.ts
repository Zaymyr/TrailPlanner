import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAnonConfig } from "../../../../lib/supabase";

const signInSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(request: Request) {
  const parsedBody = signInSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid sign in request." }, { status: 400 });
  }

  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  try {
    const response = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify(parsedBody.data),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result) {
      const message = typeof result?.msg === "string" ? result.msg : "Unable to sign in.";
      return NextResponse.json({ message }, { status: response.status || 400 });
    }

    return NextResponse.json(
      {
        user: result.user,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected Supabase error during sign in", error);
    return NextResponse.json({ message: "Unable to sign in." }, { status: 500 });
  }
}
