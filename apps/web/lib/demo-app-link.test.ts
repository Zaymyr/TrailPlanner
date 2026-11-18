import { describe, expect, it } from "vitest";

import { DEMO_SUPPORTER_GUIDE_RACE_ID, demoFallbackUrl, demoQrUrl, resolveDemoRedirect } from "./demo-app-link";

const ORIGIN = "https://pace-yourself.com";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

describe("demo app link", () => {
  it("encodes the real Supporter Guide URL so app builds with universal links open it directly", () => {
    expect(demoQrUrl(ORIGIN)).toBe(`https://pace-yourself.com/courses/supporter-guide/${DEMO_SUPPORTER_GUIDE_RACE_ID}?src=plaquette`);
  });

  it("tags the organizer landing fallback with the brochure campaign", () => {
    expect(demoFallbackUrl(ORIGIN)).toBe("https://pace-yourself.com/organisateurs?utm_source=plaquette&utm_medium=qr&utm_campaign=demo");
  });

  it("opens the Supporter Guide in the Android app with a browser fallback", () => {
    const target = resolveDemoRedirect(ANDROID, ORIGIN);
    expect(target).toBe(
      `intent://courses/supporter-guide/${DEMO_SUPPORTER_GUIDE_RACE_ID}#Intent;scheme=paceyourself;package=com.paceyourself.app;S.browser_fallback_url=${encodeURIComponent(demoFallbackUrl(ORIGIN))};end`,
    );
  });

  it("sends iOS and desktop visitors to the organizer landing", () => {
    expect(resolveDemoRedirect(IPHONE, ORIGIN)).toBe(demoFallbackUrl(ORIGIN));
    expect(resolveDemoRedirect(DESKTOP, ORIGIN)).toBe(demoFallbackUrl(ORIGIN));
    expect(resolveDemoRedirect("", ORIGIN)).toBe(demoFallbackUrl(ORIGIN));
  });
});
