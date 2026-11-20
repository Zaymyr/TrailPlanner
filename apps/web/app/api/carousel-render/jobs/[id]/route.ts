import { z } from "zod";

import {
  createAutoDraftForCarouselJob,
  getCarouselRenderJob,
  updateCarouselRenderJob,
} from "../../../../../lib/carousels/carousel-render";
import { getCarouselSlideObject } from "../../../../../lib/carousels/carousel-snapshot";
import { getSupabaseServiceConfig } from "../../../../../lib/supabase";
import {
  getGoogleAccessToken,
  getRenderTokenFromRequest,
  getStorageObjectSize,
  getVideoRenderConfig,
  signStorageUrl,
  verifyRenderToken,
} from "../../../../../lib/video-render";
import { describeRenderError, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

const paramsSchema = z.object({ id: z.string().uuid() });

const reportSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("failed"), message: z.string().trim().min(1).max(500) }),
  z.object({ status: z.literal("done") }),
]);

/** Upload URLs are used within seconds; 1 h covers a slow container start. */
const SLIDE_UPLOAD_URL_TTL_SECONDS = 60 * 60;

/** The carousel render page: a carousel-scoped token for this very job, and the job itself. */
const authorize = async (request: Request, context: { params: { id?: string } }) => {
  const params = paramsSchema.safeParse(context.params);
  if (!params.success) return { ok: false as const, response: renderJsonError("Invalid render job id.", 400) };
  const supabase = getSupabaseServiceConfig();
  const config = getVideoRenderConfig();
  if (!supabase || !config) return { ok: false as const, response: renderJsonError("Rendu en arrière-plan non configuré.", 503) };
  if (!verifyRenderToken(config.tokenSecret, params.data.id, getRenderTokenFromRequest(request), Date.now(), "carousel-render")) {
    return { ok: false as const, response: renderJsonError("Invalid render token.", 401) };
  }
  const job = await getCarouselRenderJob(supabase, params.data.id);
  if (!job) return { ok: false as const, response: renderJsonError("Render job not found.", 404) };
  return { ok: true as const, supabase, config, job };
};

/** Marks the job running and returns its snapshot plus one signed upload URL per slide. */
export async function GET(request: Request, context: { params: { id?: string } }) {
  const gate = await authorize(request, context);
  if (!gate.ok) return gate.response;
  const { supabase, config, job } = gate;
  if (job.status !== "queued" && job.status !== "running") return renderJsonError("Ce rendu n’est plus en attente.", 409);
  try {
    const accessToken = await getGoogleAccessToken(config, request);
    const uploadUrls = await Promise.all(Array.from({ length: job.slide_count }, (_, index) => signStorageUrl({
      config,
      accessToken,
      method: "PUT",
      objectName: getCarouselSlideObject(job.id, index + 1),
      expiresSeconds: SLIDE_UPLOAD_URL_TTL_SECONDS,
    })));
    await updateCarouselRenderJob(supabase, job.id, { status: "running", started_at: new Date().toISOString() }, ["queued"]);
    return renderJson({ snapshot: job.snapshot, uploadUrls });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible de préparer le rendu."), 502);
  }
}

/** Failure, or completion checked against the uploaded JPEGs; a done job with auto_draft gets its draft. */
export async function POST(request: Request, context: { params: { id?: string } }) {
  const gate = await authorize(request, context);
  if (!gate.ok) return gate.response;
  const { supabase, config, job } = gate;
  const report = reportSchema.safeParse(await request.json().catch(() => null));
  if (!report.success) return renderJsonError("Rapport de rendu invalide.", 400);
  const active = ["queued", "running"] as const;
  try {
    if (report.data.status === "failed") {
      await updateCarouselRenderJob(supabase, job.id, { status: "failed", message: report.data.message, finished_at: new Date().toISOString() }, active);
      return renderJson({ ok: true });
    }
    const accessToken = await getGoogleAccessToken(config, request);
    const paths = Array.from({ length: job.slide_count }, (_, index) => getCarouselSlideObject(job.id, index + 1));
    const sizes = await Promise.all(paths.map((path) => getStorageObjectSize(config, accessToken, path)));
    if (sizes.some((size) => !size)) return renderJsonError("Toutes les images n’ont pas été reçues.", 409);
    const finished = await updateCarouselRenderJob(supabase, job.id, {
      status: "done",
      image_paths: paths,
      message: null,
      finished_at: new Date().toISOString(),
    }, active);
    // A retried callback (already done) repairs a draft that failed the first time.
    const doneJob = finished ?? (job.status === "done" ? job : null);
    if (doneJob?.auto_draft) {
      try {
        await createAutoDraftForCarouselJob(supabase, doneJob);
      } catch (error) {
        console.error("Automatic carousel draft failed", error instanceof Error ? error.message : "unknown error");
      }
    }
    return renderJson({ ok: true });
  } catch (error) {
    return renderJsonError(describeRenderError(error, "Impossible d’enregistrer la fin du rendu."), 502);
  }
}
