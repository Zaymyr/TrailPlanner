import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../lib/http";

export async function GET(request: NextRequest) {
  const raceId = request.nextUrl.searchParams.get("raceId");
  if (!raceId || !z.string().uuid().safeParse(raceId).success) {
    return withSecurityHeaders(NextResponse.json({ message: "Invalid race id." }, { status: 400 }));
  }
  const publicUrl = new URL(`/courses/supporter-guide/${raceId}`, request.nextUrl.origin).toString();
  const svg = await QRCode.toString(publicUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 1024, color: { dark: "#173B2C", light: "#FFFFFF" } });
  const response = new NextResponse(svg, { headers: {
    "Content-Type": "image/svg+xml; charset=utf-8",
    "Content-Disposition": `attachment; filename="livret-supporter-${raceId}.svg"`,
    "Cache-Control": "private, max-age=300",
  } });
  return withSecurityHeaders(response);
}
