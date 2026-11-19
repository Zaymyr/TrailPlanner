import { z } from "zod";

import type { SupabaseServiceConfig } from "../supabase";
import { decryptSocialToken, encryptSocialToken } from "./crypto";
import { InstagramGraphError, refreshLongLivedToken, type LongLivedToken } from "./graph";

/** Connected Instagram account rows (service role only). The token column is never returned to a client. */

export const SOCIAL_ACCOUNT_STATUSES = ["connected", "needs_reconnect"] as const;

export const socialAccountRowSchema = z.object({
  id: z.string().uuid(),
  platform: z.literal("instagram"),
  ig_user_id: z.string(),
  username: z.string().nullable(),
  access_token_encrypted: z.string(),
  token_expires_at: z.string(),
  token_refreshed_at: z.string(),
  status: z.enum(SOCIAL_ACCOUNT_STATUSES),
  status_message: z.string().nullable(),
  updated_at: z.string(),
});
export type SocialAccountRow = z.infer<typeof socialAccountRowSchema>;

const COLUMNS = "id,platform,ig_user_id,username,access_token_encrypted,token_expires_at,token_refreshed_at,status,status_message,updated_at";

/** Refresh once the token is this old (it lives 60 days; the daily job retries for 10 days). */
export const TOKEN_REFRESH_AFTER_DAYS = 50;
/** Meta refuses to refresh a token younger than 24 h. */
export const TOKEN_MIN_AGE_FOR_REFRESH_MS = 24 * 60 * 60 * 1_000;

const DAY_MS = 24 * 60 * 60 * 1_000;

const headers = (supabase: SupabaseServiceConfig, extra: Record<string, string> = {}) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
  ...extra,
});

/** The most recently updated Instagram account (one account is connected at a time). */
export const getInstagramAccount = async (supabase: SupabaseServiceConfig, fetcher: typeof fetch = fetch) => {
  const response = await fetcher(
    `${supabase.supabaseUrl}/rest/v1/social_accounts?platform=eq.instagram&select=${COLUMNS}&order=updated_at.desc&limit=1`,
    { headers: headers(supabase), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to read social account (${response.status}).`);
  return z.array(socialAccountRowSchema).parse(await response.json())[0] ?? null;
};

export const upsertInstagramAccount = async (
  supabase: SupabaseServiceConfig,
  key: Buffer,
  { igUserId, username, token, connectedBy, now = new Date() }: { igUserId: string; username: string | null; token: LongLivedToken; connectedBy: string; now?: Date },
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/social_accounts?on_conflict=platform,ig_user_id&select=${COLUMNS}`, {
    method: "POST",
    headers: headers(supabase, { Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      platform: "instagram",
      ig_user_id: igUserId,
      username,
      access_token_encrypted: encryptSocialToken(key, token.accessToken),
      token_expires_at: new Date(now.getTime() + token.expiresInSeconds * 1_000).toISOString(),
      token_refreshed_at: now.toISOString(),
      status: "connected",
      status_message: null,
      connected_by: connectedBy,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to save social account (${response.status}).`);
  return z.array(socialAccountRowSchema).parse(await response.json())[0];
};

export const updateInstagramAccount = async (
  supabase: SupabaseServiceConfig,
  id: string,
  patch: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
) => {
  const response = await fetcher(`${supabase.supabaseUrl}/rest/v1/social_accounts?id=eq.${id}`, {
    method: "PATCH",
    headers: headers(supabase, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to update social account (${response.status}).`);
};

export const markAccountNeedsReconnect = (supabase: SupabaseServiceConfig, id: string, message: string, fetcher: typeof fetch = fetch) =>
  updateInstagramAccount(supabase, id, { status: "needs_reconnect", status_message: message.slice(0, 500) }, fetcher);

/** Public view of the account for the admin card: never the token. */
export const toPublicAccount = (account: SocialAccountRow | null) => account && ({
  id: account.id,
  igUserId: account.ig_user_id,
  username: account.username,
  status: account.status,
  statusMessage: account.status_message,
  tokenExpiresAt: account.token_expires_at,
  tokenRefreshedAt: account.token_refreshed_at,
});

export const isTokenRefreshDue = (account: Pick<SocialAccountRow, "token_refreshed_at" | "token_expires_at">, nowMs: number) => {
  const refreshedAt = Date.parse(account.token_refreshed_at);
  const expiresAt = Date.parse(account.token_expires_at);
  if (nowMs - refreshedAt < TOKEN_MIN_AGE_FOR_REFRESH_MS) return false;
  return nowMs - refreshedAt >= TOKEN_REFRESH_AFTER_DAYS * DAY_MS || expiresAt - nowMs <= 10 * DAY_MS;
};

export type TokenRefreshResult =
  | { status: "no_account" | "not_due" | "needs_reconnect" }
  | { status: "refreshed"; expiresAt: string }
  | { status: "failed"; message: string };

/** Daily job: refresh the long-lived token when due; an expired or revoked token asks for a reconnect. */
export const refreshInstagramTokenIfDue = async ({
  supabase,
  key,
  now = new Date(),
  fetcher = fetch,
  force = false,
}: { supabase: SupabaseServiceConfig; key: Buffer; now?: Date; fetcher?: typeof fetch; force?: boolean }): Promise<TokenRefreshResult> => {
  const account = await getInstagramAccount(supabase, fetcher);
  if (!account) return { status: "no_account" };
  if (account.status === "needs_reconnect") return { status: "needs_reconnect" };
  const nowMs = now.getTime();
  if (Date.parse(account.token_expires_at) <= nowMs) {
    await markAccountNeedsReconnect(supabase, account.id, "Le jeton Instagram a expiré : reconnecte le compte.", fetcher);
    return { status: "needs_reconnect" };
  }
  if (!force && !isTokenRefreshDue(account, nowMs)) return { status: "not_due" };

  try {
    const token = await refreshLongLivedToken(decryptSocialToken(key, account.access_token_encrypted), fetcher);
    const expiresAt = new Date(nowMs + token.expiresInSeconds * 1_000).toISOString();
    await updateInstagramAccount(supabase, account.id, {
      access_token_encrypted: encryptSocialToken(key, token.accessToken),
      token_expires_at: expiresAt,
      token_refreshed_at: now.toISOString(),
      status: "connected",
      status_message: null,
    }, fetcher);
    return { status: "refreshed", expiresAt };
  } catch (error) {
    if (error instanceof InstagramGraphError && error.kind === "auth") {
      await markAccountNeedsReconnect(supabase, account.id, `Jeton refusé par Instagram : ${error.message}`, fetcher);
      return { status: "needs_reconnect" };
    }
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await updateInstagramAccount(supabase, account.id, { status_message: `Renouvellement du jeton échoué : ${message}`.slice(0, 500) }, fetcher);
    return { status: "failed", message };
  }
};
