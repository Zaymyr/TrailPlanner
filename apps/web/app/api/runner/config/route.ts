import { NextResponse } from "next/server";
import { getRunnerMonetizationEnabled } from "../../../../lib/runner-access";
export async function GET() {
  try { return NextResponse.json({ enabled: await getRunnerMonetizationEnabled() }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ message: "Access configuration unavailable." }, { status: 503 }); }
}
