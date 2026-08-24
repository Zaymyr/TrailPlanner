import { NextResponse } from "next/server";

import { withSecurityHeaders } from "../../../../lib/http";
import { cleanupExpiredOrganizerImportSessions } from "../../../../lib/organizer-import-sessions";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return withSecurityHeaders(NextResponse.json({ message: "Unauthorized." }, { status: 401 }));
  }

  try {
    const result = await cleanupExpiredOrganizerImportSessions();
    return withSecurityHeaders(NextResponse.json({ ok: true, result }));
  } catch (error) {
    console.error("Unable to clean expired organizer import sessions.", error);
    return withSecurityHeaders(
      NextResponse.json({ message: "Unable to clean organizer import sessions." }, { status: 500 })
    );
  }
}

export const POST = GET;
