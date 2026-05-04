/// <reference types="jsr:@supabase/functions-js/edge-runtime.d.ts" />

import {
  handleOptions,
  jsonResponse,
  sendScheduledPushReminders,
  verifyCronRequest,
} from "../_shared/push.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Method not allowed." }, { status: 405 });
  }

  if (!verifyCronRequest(request)) {
    return jsonResponse({ message: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await sendScheduledPushReminders();
    return jsonResponse({ ok: true, result });
  } catch (error) {
    console.error("Unable to process push reminder cron.", error);
    return jsonResponse({ message: "Unable to process push reminders." }, { status: 500 });
  }
});
