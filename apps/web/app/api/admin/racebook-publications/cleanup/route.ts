import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { withSecurityHeaders } from "../../../../../lib/http";
import { jsonError, requireAdminAuth, serviceHeaders } from "../../../../../lib/organizer";

const cleanupRowSchema = z.object({
  id: z.string().uuid(),
  storage_bucket: z.string().min(1),
  storage_path: z.string().min(1),
  attempt_count: z.coerce.number().int().nonnegative(),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;
  const now = new Date();
  const queueResponse = await fetch(
    `${auth.serviceConfig.supabaseUrl}/rest/v1/racebook_publication_asset_cleanup_queue?status=in.(pending,failed)&available_at=lte.${encodeURIComponent(now.toISOString())}&select=id,storage_bucket,storage_path,attempt_count&order=available_at.asc,created_at.asc&limit=25`,
    { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
  );
  if (!queueResponse.ok) return jsonError("Impossible de charger la file de nettoyage RaceBook.", 502);
  const jobs = z.array(cleanupRowSchema).parse(await queueResponse.json());
  const deleted: string[] = [];
  const retained: string[] = [];
  const failed: string[] = [];

  for (const job of jobs) {
    const attempts = job.attempt_count + 1;
    const referencesResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/racebook_publication_assets?storage_bucket=eq.${encodeURIComponent(job.storage_bucket)}&storage_path=eq.${encodeURIComponent(job.storage_path)}&select=id&limit=1`,
      { headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
    );
    const isRetained = referencesResponse.ok && z.array(z.object({ id: z.string().uuid() })).parse(await referencesResponse.json()).length > 0;
    let storageError: string | null = null;
    if (!isRetained) {
      const storageResponse = await fetch(
        `${auth.serviceConfig.supabaseUrl}/storage/v1/object/${encodeURIComponent(job.storage_bucket)}/${job.storage_path.split("/").map(encodeURIComponent).join("/")}`,
        { method: "DELETE", headers: serviceHeaders(auth.serviceConfig, ""), cache: "no-store" },
      );
      if (!storageResponse.ok && storageResponse.status !== 404) storageError = await storageResponse.text();
    }

    const completed = isRetained || storageError === null;
    const retryAt = new Date(now.getTime() + Math.min(24 * 60, 2 ** Math.min(attempts, 10)) * 60_000).toISOString();
    const updateResponse = await fetch(
      `${auth.serviceConfig.supabaseUrl}/rest/v1/racebook_publication_asset_cleanup_queue?id=eq.${job.id}`,
      {
        method: "PATCH",
        headers: serviceHeaders(auth.serviceConfig),
        body: JSON.stringify({
          status: completed ? "deleted" : "failed",
          attempt_count: attempts,
          last_attempt_at: now.toISOString(),
          last_error: storageError,
          completed_at: completed ? now.toISOString() : null,
          available_at: completed ? now.toISOString() : retryAt,
        }),
        cache: "no-store",
      },
    );
    if (!updateResponse.ok) return jsonError("Impossible de mettre à jour la file de nettoyage RaceBook.", 502);
    if (isRetained) retained.push(job.id);
    else if (completed) deleted.push(job.id);
    else failed.push(job.id);
  }

  return withSecurityHeaders(NextResponse.json({ processed: jobs.length, deleted, retained, failed }));
}
