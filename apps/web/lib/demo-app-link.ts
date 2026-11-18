/**
 * Printed-brochure demo link (`/demo`).
 *
 * Android phones with the app open the Trail TST Supporter Guide in the app
 * through a Chrome intent URL, which does not depend on verified App Links.
 * Without the app, the intent's browser fallback opens the organizer landing.
 * iOS and desktop go straight to the organizer landing: universal links are not
 * verified yet, and a custom-scheme attempt would show a Safari error alert to
 * every prospect who does not have the app.
 */

/** Trail TST demo event, format « Ultra des Cimes ». */
export const DEMO_SUPPORTER_GUIDE_RACE_ID = "73afcbc4-dcaa-4753-9996-e2180fa9ec4c";

const ANDROID_PACKAGE = "com.paceyourself.app";
const APP_SCHEME = "paceyourself";
const FALLBACK_PATH = "/organisateurs";
const FALLBACK_UTM: Record<string, string> = { utm_source: "plaquette", utm_medium: "qr", utm_campaign: "demo" };

export function demoFallbackUrl(origin: string): string {
  const url = new URL(FALLBACK_PATH, origin);
  for (const [key, value] of Object.entries(FALLBACK_UTM)) url.searchParams.set(key, value);
  return url.toString();
}

export function demoAndroidIntentUrl(fallbackUrl: string): string {
  return `intent://courses/supporter-guide/${DEMO_SUPPORTER_GUIDE_RACE_ID}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`;
}

export function resolveDemoRedirect(userAgent: string, origin: string): string {
  const fallback = demoFallbackUrl(origin);
  return /Android/i.test(userAgent) ? demoAndroidIntentUrl(fallback) : fallback;
}
