import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAnonConfig } from "../../../../lib/supabase";
import { ensureTrialStatus } from "../../../../lib/trial-server";

const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(2).max(120).optional(),
  anonToken: z.string().optional(),
});

export async function POST(request: Request) {
  const parsedBody = signUpSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json({ message: "Invalid sign up request." }, { status: 400 });
  }

  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  try {
    const { email, password, fullName, anonToken } = parsedBody.data;

    // Link anonymous user to permanent account instead of creating a new one
    if (anonToken) {
      const linkResponse = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseConfig.supabaseAnonKey,
          Authorization: `Bearer ${anonToken}`,
        },
        body: JSON.stringify({
          email,
          password,
          ...(fullName ? { data: { full_name: fullName } } : {}),
        }),
        cache: "no-store",
      });

      if (!linkResponse.ok) {
        const linkResult = await linkResponse.json().catch(() => null);
        const message = typeof linkResult?.msg === "string" ? linkResult.msg : "Unable to link account.";
        return NextResponse.json({ message }, { status: linkResponse.status || 400 });
      }

      return NextResponse.json({ requiresEmailConfirmation: true }, { status: 200 });
    }

    const response = await fetch(`${supabaseConfig.supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseConfig.supabaseAnonKey,
      },
      body: JSON.stringify({
        email,
        password,
        data: fullName ? { full_name: fullName } : undefined,
      }),
      cache: "no-store",
    });

    const result = await response.json().catch(() => null);

    const accessToken = result?.access_token ?? result?.session?.access_token;
    const refreshToken = result?.refresh_token ?? result?.session?.refresh_token;
    const requiresEmailConfirmation = response.ok && !accessToken;

    if (!response.ok || !result) {
      const message = typeof result?.msg === "string" ? result.msg : "Unable to create account.";
      return NextResponse.json({ message }, { status: response.status || 400 });
    }

    // Activate trial for users who get an immediate session (no email confirmation)
    if (accessToken && result.user?.id) {
      try {
        await ensureTrialStatus({
          supabaseUrl: supabaseConfig.supabaseUrl,
          supabaseKey: supabaseConfig.supabaseAnonKey,
          token: accessToken,
          userId: result.user.id,
        });
      } catch {
        // Non-fatal — trial can be activated on first login
      }
    }

    return NextResponse.json(
      {
        user: result.user,
        access_token: accessToken,
        refresh_token: refreshToken,
        requiresEmailConfirmation,
      },
      { status: response.status || (requiresEmailConfirmation ? 202 : 201) }
    );
  } catch (error) {
    console.error("Unexpected Supabase error during sign up", error);
    return NextResponse.json({ message: "Unable to create account." }, { status: 500 });
  }
}
