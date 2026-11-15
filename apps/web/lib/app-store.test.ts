import { describe, expect, it } from "vitest";

import {
  ANDROID_APP_STORE_URL,
  APP_INSTALL_HELP_URL,
  IOS_APP_STORE_URL,
  resolveAppStoreTarget,
} from "./app-store";

describe("resolveAppStoreTarget", () => {
  it("selects the Android store", () => {
    expect(resolveAppStoreTarget("Mozilla/5.0 (Linux; Android 15)")).toEqual({
      url: ANDROID_APP_STORE_URL,
      platform: "android",
    });
  });

  it("selects the configured iOS store or the neutral links fallback", () => {
    expect(resolveAppStoreTarget("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toEqual({
      url: IOS_APP_STORE_URL || APP_INSTALL_HELP_URL,
      platform: IOS_APP_STORE_URL ? "ios" : "fallback",
    });
  });

  it("falls back to the store links page for unknown clients", () => {
    expect(resolveAppStoreTarget("Mozilla/5.0 (X11; Linux x86_64)")).toEqual({
      url: APP_INSTALL_HELP_URL,
      platform: "fallback",
    });
  });
});
