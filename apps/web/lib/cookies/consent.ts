const COOKIE_CONSENT_KEY = "cookie_consent" as const;
export const COOKIE_CONSENT_EVENT = "cookie-consent" as const;

export type CookieConsentValue = "accepted" | "refused";

const isBrowser = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export const getCookieConsent = (): CookieConsentValue | null => {
  if (!isBrowser()) {
    return null;
  }

  const storedValue = window.localStorage.getItem(COOKIE_CONSENT_KEY);

  return storedValue === "accepted" || storedValue === "refused" ? storedValue : null;
};

export const setCookieConsent = (value: CookieConsentValue) => {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
};

export const hasCookieConsent = (): boolean => getCookieConsent() === "accepted";

export const canLoadAnalytics = (): boolean => hasCookieConsent();
