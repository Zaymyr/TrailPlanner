/**
 * Printed organizer brochure demo.
 *
 * The QR code encodes `demoQrUrl()`, the real Trail TST Supporter Guide URL
 * tagged `?src=plaquette`. `/courses/*` is declared for iOS universal links and
 * Android App Links, so an app build that ships those declarations opens the
 * guide directly. Otherwise the browser reaches the web guide page, which sends
 * the tagged visit to `/demo`:
 * - Android: a Chrome intent URL opens the app through its `paceyourself://`
 *   scheme, which every published build supports, with `/organisateurs` as the
 *   browser fallback when the app is missing;
 * - iOS and desktop: `/organisateurs`. A custom-scheme attempt would show a
 *   Safari invalid-address alert to every prospect without the app.
 */

/** Trail TST demo event, format « Ultra des Cimes ». */
export const DEMO_SUPPORTER_GUIDE_RACE_ID = "73afcbc4-dcaa-4753-9996-e2180fa9ec4c";
export const DEMO_QR_SOURCE = "plaquette";
export const DEMO_REDIRECT_PATH = "/demo";

const ANDROID_PACKAGE = "com.paceyourself.app";
const APP_SCHEME = "paceyourself";
const FALLBACK_PATH = "/organisateurs";
const FALLBACK_UTM: Record<string, string> = { utm_source: DEMO_QR_SOURCE, utm_medium: "qr", utm_campaign: "demo" };

/** The intent fallback must be absolute; the request origin is the server bind address behind some hosts. */
export function demoPublicOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://pace-yourself.com";
}

/** URL encoded in the brochure QR code. */
export function demoQrUrl(origin: string): string {
  const url = new URL(`/courses/supporter-guide/${DEMO_SUPPORTER_GUIDE_RACE_ID}`, origin);
  url.searchParams.set("src", DEMO_QR_SOURCE);
  return url.toString();
}

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
