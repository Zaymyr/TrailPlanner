export const ANDROID_APP_STORE_URL = "https://play.google.com/store/apps/details?id=com.paceyourself.app";
export const IOS_APP_STORE_URL = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "";
export const APP_INSTALL_HELP_URL = "/links";

export type AppStoreTarget = {
  url: string;
  platform: "android" | "ios" | "fallback";
};

export function resolveAppStoreTarget(userAgent: string): AppStoreTarget {
  if (/Android/i.test(userAgent)) return { url: ANDROID_APP_STORE_URL, platform: "android" };
  if (/iPhone|iPad|iPod/i.test(userAgent) && IOS_APP_STORE_URL) {
    return { url: IOS_APP_STORE_URL, platform: "ios" };
  }
  return { url: APP_INSTALL_HELP_URL, platform: "fallback" };
}
