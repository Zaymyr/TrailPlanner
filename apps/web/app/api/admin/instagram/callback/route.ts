import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "../../../../../lib/auth-cookies";
import { withSecurityHeaders } from "../../../../../lib/http";
import { upsertInstagramAccount } from "../../../../../lib/instagram/accounts";
import { getInstagramAppConfig, INSTAGRAM_OAUTH_COOKIE } from "../../../../../lib/instagram/config";
import { getSocialTokenKey, verifyOAuthState } from "../../../../../lib/instagram/crypto";
import {
  exchangeCodeForShortLivedToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  InstagramGraphError,
} from "../../../../../lib/instagram/graph";
import { fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig, isAdminUser } from "../../../../../lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Instagram redirects the admin's browser here (INSTAGRAM_REDIRECT_URI). The admin session comes
 * from the auth cookie; the state must match the signed nonce. The code becomes a short-lived then
 * a long-lived token server side; only its encrypted form is stored.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => {
    const response = withSecurityHeaders(NextResponse.redirect(new URL(`/admin/publications?instagram=${result}`, url.origin)));
    response.cookies.set({ name: INSTAGRAM_OAUTH_COOKIE, value: "", path: "/api/admin/instagram", maxAge: 0 });
    return response;
  };

  const anon = getSupabaseAnonConfig();
  const supabase = getSupabaseServiceConfig();
  const app = getInstagramAppConfig();
  const key = getSocialTokenKey();
  if (!anon || !supabase || !app || !key) return back("not_configured");

  const jar = cookies();
  const accessToken = jar.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const user = accessToken ? await fetchSupabaseUser(accessToken, anon) : null;
  if (!user?.id || !isAdminUser(user)) return back("forbidden");

  if (!verifyOAuthState(key, {
    state: url.searchParams.get("state"),
    cookieNonce: jar.get(INSTAGRAM_OAUTH_COOKIE)?.value ?? null,
    userId: user.id,
  })) {
    return back("invalid_state");
  }

  const code = url.searchParams.get("code");
  if (!code) return back(url.searchParams.get("error") === "access_denied" ? "denied" : "error");

  try {
    const shortLived = await exchangeCodeForShortLivedToken(app, code);
    const longLived = await exchangeForLongLivedToken(app, shortLived.accessToken);
    // The publishing id must come from /me: no fallback to the code-exchange user_id.
    const profile = await fetchInstagramProfile(longLived.accessToken);
    if (!profile.igUserId) return back("error");
    await upsertInstagramAccount(supabase, key, {
      igUserId: profile.igUserId,
      username: profile.username,
      token: longLived,
      connectedBy: user.id,
    });
    return back("connected");
  } catch (error) {
    // Never log the Graph payloads: they carry tokens. The sanitized message is enough.
    console.error("Instagram connection failed", error instanceof InstagramGraphError ? `${error.kind} ${error.details.code ?? ""} ${error.message}` : "unexpected error");
    return back("error");
  }
}
