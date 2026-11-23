import { withAdminAudit, auditBody, auditResponse, pickAuditFields } from "../../../../../lib/admin-audit-log";
import { z } from "zod";

import { postLinkSchema } from "../../../../../lib/admin-renders";
import { getServiceJson, settleSource } from "../../../../../lib/admin-service-rest";
import { reelContentSchema } from "../../../../../lib/reel-content";
import {
  getGoogleAccessToken,
  getReelFileName,
  getRenderInputObject,
  getRenderOutputObject,
  insertRenderJob,
  isRenderJobStale,
  listRenderJobs,
  signStorageUrl,
  updateRenderJob,
} from "../../../../../lib/video-render";
import { authorizeRenderAdmin, describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

const createSchema = z.object({
  raceId: z.string().uuid(),
  raceTitle: z.string().trim().min(1).max(200),
  width: z.number().int().min(160).max(4096),
  height: z.number().int().min(160).max(4096),
  // Highlights reel text, snapshotted with the video so Publications can pre-fill its drafts.
  content: reelContentSchema.nullable().optional(),
  // One-click reel: create the Instagram draft when the render finishes (needs content).
  autoDraft: z.boolean().optional(),
});

export async function GET(request: Request) {
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, config } = gate.value;

  try {
    const rows = await listRenderJobs(supabase, 8);
    const now = Date.now();
    // The Instagram draft of each render (studio link « Brouillon »); a failed lookup only hides the links.
    const posts = rows.length
      ? await settleSource(
        getServiceJson(supabase, `social_posts?video_job_id=in.(${rows.map((row) => row.id).join(",")})&select=id,video_job_id,carousel_job_id,status,media_type,created_at&order=created_at.desc`)
          .then((json) => z.array(postLinkSchema).parse(json)),
        "Render draft links",
      )
      : null;
    const jobs = await Promise.all(rows.map(async (row) => {
      let current = row;
      if (isRenderJobStale(row, now)) {
        current = await updateRenderJob(supabase, row.id, {
          status: "failed",
          message: "Le rendu n’a plus donné de nouvelles : relance-le.",
          finished_at: new Date().toISOString(),
        }, ["uploading", "queued", "running"]) ?? row;
      }
      const downloadUrl = current.status === "done"
        ? await signStorageUrl({
          config,
          accessToken: await getGoogleAccessToken(config, request),
          method: "GET",
          objectName: getRenderOutputObject(current.id),
          expiresSeconds: 60 * 60,
          responseDisposition: `attachment; filename="${getReelFileName(current.race_title)}"`,
        })
        : null;
      const post = posts?.find((candidate) => candidate.video_job_id === current.id) ?? null;
      return {
        id: current.id,
        raceId: current.race_id,
        post: post ? { id: post.id, status: post.status } : null,
        raceTitle: current.race_title,
        status: current.status,
        progress: current.progress,
        message: current.message,
        width: current.width,
        height: current.height,
        sizeBytes: current.output_size_bytes,
        createdAt: current.created_at,
        startedAt: current.started_at,
        finishedAt: current.finished_at,
        downloadUrl,
      };
    }));
    return renderJson({ jobs });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible de lister les rendus."), 502);
  }
}

async function postRoute(request: Request) {
  const gate = await authorizeRenderAdmin(request);
  if (!gate.ok) return gate.response;
  const { userId, supabase, config } = gate.value;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError("Requête de rendu invalide.", 400);

  try {
    const job = await insertRenderJob(supabase, {
      race_id: parsed.data.raceId,
      race_title: parsed.data.raceTitle,
      width: parsed.data.width,
      height: parsed.data.height,
      status: "uploading",
      created_by: userId,
      ...(parsed.data.content ? { content: parsed.data.content } : {}),
      // Without reel text there is nothing to pre-fill: the flag would never fire.
      ...(parsed.data.autoDraft && parsed.data.content ? { auto_draft: true } : {}),
    });
    const inputUploadUrl = await signStorageUrl({
      config,
      accessToken: await getGoogleAccessToken(config, request),
      method: "PUT",
      objectName: getRenderInputObject(job.id),
      expiresSeconds: 15 * 60,
    });
    return renderJson({ job: { id: job.id }, inputUploadUrl }, 201);
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Le rendu n’a pas pu être créé."), 502);
  }
}

export const POST = withAdminAudit(postRoute, {
  action: "render.create",
  targetType: "render",
  targetId: (c) => (auditResponse(c).job as { id?: string } | null)?.id,
  summary: (c) => `Rendu lancé pour ${typeof auditBody(c).raceTitle === "string" ? `« ${auditBody(c).raceTitle} »` : "une course"}`,
  after: (c) => pickAuditFields(c.body, ["raceId", "raceTitle", "width", "height", "autoDraft"]),
});
