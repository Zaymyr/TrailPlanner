import { NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAnonConfig } from "../../../../lib/supabase";
import { ensureTrialStatus } from "../../../../lib/trial-server";

const passwordRequirement = "Password must be at least 8 characters and include a letter and a number";

const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, passwordRequirement).regex(/[A-Za-zÀ-ÖØ-öø-ÿ]/, passwordRequirement).regex(/\d/, passwordRequirement),
  fullName: z.string().trim().min(2).max(120).optional(),
});

export async function POST(request: Request) {
  const parsedBody = signUpSchema.safeParse(await request.json().catch(() => null));

  if (!parsedBody.success) {
    const passwordError = parsedBody.error.flatten().fieldErrors.password?.[0];
    return NextResponse.json({ message: passwordError ?? "Invalid sign up request." }, { status: 400 });
  }

  const supabaseConfig = getSupabaseAnonConfig();

  if (!supabaseConfig) {
    return NextResponse.json({ message: "Supabase configuration is missing." }, { status: 500 });
  }

  try {
    const { email, password, fullName } = parsedBody.data;

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
        // When email confirmation is required, Supabase returns the user object
        // at the top level (not nested under .user), so we fall back to `result`
        user: result.user ?? result,
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
