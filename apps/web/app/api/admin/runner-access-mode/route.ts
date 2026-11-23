import { withAdminAudit, auditBody, pickAuditFields } from "../../../../lib/admin-audit-log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, getSupabaseServiceConfig, isAdminUser } from "../../../../lib/supabase";
import { getRunnerAdminMode, getRunnerSessionId } from "../../../../lib/runner-access";

export async function GET(request: Request) { return handle(request, false); }
async function putRoute(request: Request) { return handle(request, true); }
async function handle(request: Request, write: boolean) {
  const anon = getSupabaseAnonConfig();
  const service = getSupabaseServiceConfig();
  const token = extractBearerToken(request.headers.get("authorization"));
  if (!anon || !service || !token) return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  const user = await fetchSupabaseUser(token, anon);
  if (!user) return NextResponse.json({ message: "Invalid session." }, { status: 401 });
  const sid = getRunnerSessionId(token);
  if (!sid || !isAdminUser(user)) return NextResponse.json({ message: "Admin access required." }, { status: 403 });
  try {
    if (write) {
      const body = z.object({ mode: z.enum(["real", "free", "premium"]) }).safeParse(await request.json().catch(() => null));
      if (!body.success) return NextResponse.json({ message: "Invalid mode." }, { status: 400 });
      const response = await fetch(`${service.supabaseUrl}/rest/v1/runner_admin_access_modes?on_conflict=session_id`, {
        method: "POST", headers: { apikey: service.supabaseServiceRoleKey, Authorization: `Bearer ${service.supabaseServiceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ session_id: sid, user_id: user.id, mode: body.data.mode, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error("Simulation unavailable");
    }
    return NextResponse.json({ mode: await getRunnerAdminMode(user, token) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "Admin simulation unavailable." }, { status: 503 }); }
}

export const PUT = withAdminAudit(putRoute, {
  action: "simulation.runner-mode",
  targetType: "simulation",
  targetId: (c) => auditBody(c).mode as string | undefined,
  summary: (c) => `Mode de simulation des droits : ${({ real: "réel", free: "gratuit", premium: "Premium" } as Record<string, string>)[String(auditBody(c).mode)] ?? "?"}`,
  after: (c) => pickAuditFields(c.body, ["mode"]),
});
