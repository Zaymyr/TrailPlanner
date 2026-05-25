import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { sendScheduledPushReminders } from "../../../../lib/push";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  try {
    const result = await sendScheduledPushReminders();
    return withSecurityHeaders(NextResponse.json({ ok: true, result }));
  } catch (error) {
    console.error("Unable to process push reminder cron.", error);
    return withSecurityHeaders(NextResponse.json({ message: "Unable to process push reminders." }, { status: 500 }));
  }
}
