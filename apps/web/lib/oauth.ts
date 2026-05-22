import { getSupabaseUrl } from "./supabase";

export type OAuthProvider = "google" | "apple";

type BuildOAuthUrlOptions = {
  provider: OAuthProvider;
  redirectPath?: string;
};

export const buildSupabaseOAuthUrl = ({
  provider,
  redirectPath = "/auth/callback",
}: BuildOAuthUrlOptions): string => {
  const supabaseUrl = getSupabaseUrl();

  if (!supabaseUrl) {
    throw new Error("Supabase configuration is missing.");
  }

  if (typeof window === "undefined") {
    throw new Error("OAuth sign-in must run in the browser.");
  }

  const redirectUrl = new URL(redirectPath, window.location.origin);
  const authorizeUrl = new URL(`${supabaseUrl}/auth/v1/authorize`);

  authorizeUrl.searchParams.set("provider", provider);
  authorizeUrl.searchParams.set("redirect_to", redirectUrl.toString());

  return authorizeUrl.toString();
};

export const redirectToOAuth = (provider: OAuthProvider, redirectPath?: string) => {
  const authorizeUrl = buildSupabaseOAuthUrl({ provider, redirectPath });

  window.location.href = authorizeUrl;
};

export const redirectToGoogleOAuth = () => {
  redirectToOAuth("google");
};

export const redirectToAppleOAuth = () => {
  redirectToOAuth("apple");
};
