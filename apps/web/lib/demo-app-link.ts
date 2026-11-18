import { PUBLIC_IOS_APP_STORE_URL } from "./app-store";

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
 *
 * The printed business card QR code encodes `cardQrUrl()`, the same guide URL
 * tagged `?src=carte`. Its browser path goes to `/carte-visite`, which sends the
 * prospect to the app instead of the organizer pitch:
 * - Android: the same intent URL, with the Google Play listing as fallback;
 * - iOS: the App Store listing (iOS cannot tell whether the app is installed
 *   without a custom-scheme attempt, see above);
 * - desktop: `/links`, which lists both stores.
 */

/** Trail TST demo event, format « Ultra des Cimes ». */
export const DEMO_SUPPORTER_GUIDE_RACE_ID = "73afcbc4-dcaa-4753-9996-e2180fa9ec4c";
export const DEMO_QR_SOURCE = "plaquette";
export const DEMO_REDIRECT_PATH = "/demo";

/** Printed business card. */
export const CARD_QR_SOURCE = "carte";
export const CARD_REDIRECT_PATH = "/carte-visite";

const ANDROID_PACKAGE = "com.paceyourself.app";
const APP_SCHEME = "paceyourself";
const FALLBACK_PATH = "/organisateurs";
const FALLBACK_UTM: Record<string, string> = { utm_source: DEMO_QR_SOURCE, utm_medium: "qr", utm_campaign: "demo" };
const CARD_UTM: Record<string, string> = { utm_source: CARD_QR_SOURCE, utm_medium: "qr", utm_campaign: "carte-visite" };
const CARD_DESKTOP_PATH = "/links";

/** The intent fallback must be absolute; the request origin is the server bind address behind some hosts. */
export function demoPublicOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://pace-yourself.com";
}

function demoGuideUrl(origin: string, source: string): string {
  const url = new URL(`/courses/supporter-guide/${DEMO_SUPPORTER_GUIDE_RACE_ID}`, origin);
  url.searchParams.set("src", source);
  return url.toString();
}

/** URL encoded in the brochure QR code. */
export function demoQrUrl(origin: string): string {
  return demoGuideUrl(origin, DEMO_QR_SOURCE);
}

/** URL encoded in the business card QR code. Printed: never change it. */
export function cardQrUrl(origin: string): string {
  return demoGuideUrl(origin, CARD_QR_SOURCE);
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

/** Google Play listing with an install referrer, so card installs show up in Play Console acquisition. */
export function cardPlayStoreUrl(): string {
  const referrer = new URLSearchParams(CARD_UTM).toString();
  return `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}&referrer=${encodeURIComponent(referrer)}`;
}

export function cardDesktopUrl(origin: string): string {
  const url = new URL(CARD_DESKTOP_PATH, origin);
  for (const [key, value] of Object.entries(CARD_UTM)) url.searchParams.set(key, value);
  return url.toString();
}

export function resolveCardRedirect(userAgent: string, origin: string): string {
  if (/Android/i.test(userAgent)) return demoAndroidIntentUrl(cardPlayStoreUrl());
  if (/iPhone|iPad|iPod/i.test(userAgent)) return PUBLIC_IOS_APP_STORE_URL;
  return cardDesktopUrl(origin);
}
