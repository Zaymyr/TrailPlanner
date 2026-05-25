/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import {
  authenticateRequestUser,
  handleOptions,
  jsonResponse,
  upsertPushDevice,
} from "../_shared/push.ts";

type RegisterPayload = {
  expoPushToken: string;
  platform: "ios" | "android";
  locale?: string;
  appVersion?: string | null;
  notificationsEnabled?: boolean;
};

function parseRegisterPayload(value: unknown): RegisterPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const expoPushToken = typeof payload.expoPushToken === "string" ? payload.expoPushToken.trim() : "";
  const platform = payload.platform;
  const locale = typeof payload.locale === "string" ? payload.locale.trim() : "en";
  const appVersion =
    typeof payload.appVersion === "string"
      ? payload.appVersion.trim().slice(0, 32)
      : payload.appVersion == null
        ? null
        : null;
  const notificationsEnabled =
    typeof payload.notificationsEnabled === "boolean" ? payload.notificationsEnabled : true;

  if (!expoPushToken || (platform !== "ios" && platform !== "android")) {
    return null;
  }

  return {
    expoPushToken,
    platform,
    locale,
    appVersion,
    notificationsEnabled,
  };
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Method not allowed." }, { status: 405 });
  }

  const user = await authenticateRequestUser(request);
  if (!user?.userId) {
    return jsonResponse({ message: "Invalid session." }, { status: 401 });
  }

  const parsedBody = parseRegisterPayload(await request.json().catch(() => null));
  if (!parsedBody) {
    return jsonResponse({ message: "Invalid payload." }, { status: 400 });
  }

  try {
    const device = await upsertPushDevice({
      userId: user.userId,
      expoPushToken: parsedBody.expoPushToken,
      platform: parsedBody.platform,
      locale: parsedBody.locale ?? "en",
      appVersion: parsedBody.appVersion ?? null,
      notificationsEnabled: parsedBody.notificationsEnabled ?? true,
    });

    return jsonResponse({ device });
  } catch (error) {
    console.error("Unable to register push device.", error);
    return jsonResponse({ message: "Unable to register push device." }, { status: 500 });
  }
});
