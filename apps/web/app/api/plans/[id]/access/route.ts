import { NextResponse } from "next/server";
import { z } from "zod";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAnonymousUser } from "../../../../../lib/supabase";
import { getRunnerPlanAccess, getRunnerAdminMode, getOwnedRunnerPlan } from "../../../../../lib/runner-access";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const config = getSupabaseAnonConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!config || !token) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ message: "Invalid plan." }, { status: 400 });
  const user = await fetchSupabaseUser(token, config);
  if (!user?.id || isAnonymousUser(user)) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  try {
    const plan = await getOwnedRunnerPlan(user.id, params.id);
    if (!plan) return NextResponse.json({ message: "Plan not found." }, { status: 404 });
    const adminMode = await getRunnerAdminMode(user, token);
    return NextResponse.json({ access: await getRunnerPlanAccess(user.id, params.id, { planKey: plan.planKey, adminMode }) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "Plan access unavailable." }, { status: 503 }); }
}
