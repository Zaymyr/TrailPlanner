import { isInstagramPublishDryRun } from "../../../../lib/instagram/config";
import {
  buildDefaultCaption,
  canPublishNow,
  createSocialPostRepository,
  createSocialPostSchema,
  DEFAULT_HASHTAGS,
  getLatestPublishTime,
  getVideoAvailableUntil,
  listVideoJobsForPublishing,
  toPublicSocialPost,
  VIDEO_LIFETIME_MARGIN_HOURS,
  VIDEO_STORAGE_LIFETIME_DAYS,
} from "../../../../lib/social-posts";
import { getRenderJob, getRenderOutputObject } from "../../../../lib/video-render";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

/** Publications list, plus the finished renders a new draft can start from. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;

  try {
    const posts = await createSocialPostRepository(supabase).list(50);
    const jobIds = Array.from(new Set(posts.map((post) => post.video_job_id).filter((id): id is string => Boolean(id))));
    const [postJobs, recentJobs] = await Promise.all([
      listVideoJobsForPublishing(supabase, { ids: jobIds }),
      listVideoJobsForPublishing(supabase, {
        finishedSince: new Date(Date.now() - (VIDEO_STORAGE_LIFETIME_DAYS * 24 - VIDEO_LIFETIME_MARGIN_HOURS) * 60 * 60 * 1_000),
      }),
    ]);
    return renderJson({
      posts: posts.map((post) => {
        const job = post.video_job_id ? postJobs.get(post.video_job_id) : undefined;
        return toPublicSocialPost(post, {
          raceTitle: job?.race_title ?? null,
          videoAvailableUntil: job?.finished_at ? getVideoAvailableUntil(job.finished_at).toISOString() : null,
        });
      }),
      videos: Array.from(recentJobs.values()).map((job) => ({
        id: job.id,
        raceId: job.race_id,
        raceTitle: job.race_title,
        width: job.width,
        height: job.height,
        finishedAt: job.finished_at,
        latestPublishAt: job.finished_at ? getLatestPublishTime(job.finished_at).toISOString() : null,
        defaultCaption: buildDefaultCaption(job.race_title),
        defaultHashtags: DEFAULT_HASHTAGS,
      })),
    });
  } catch (error) {
    console.error("Social posts list failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les publications n’ont pas pu être chargées.", 502);
  }
}

/** New draft from a finished render. Nothing is published until an explicit action. */
export async function POST(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, userId } = gate.value;

  const parsed = createSocialPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError(parsed.error.issues[0]?.message ?? "Brouillon invalide.", 400);

  try {
    const job = await getRenderJob(supabase, parsed.data.videoJobId);
    if (!job || job.status !== "done" || !job.finished_at) return renderJsonError("Cette vidéo n’est pas terminée.", 409);
    if (!canPublishNow(job.finished_at)) return renderJsonError("Cette vidéo arrive en fin de conservation (30 jours) : relance un rendu.", 409);

    const post = await createSocialPostRepository(supabase).insert({
      race_id: job.race_id,
      video_job_id: job.id,
      platform: "instagram",
      status: "draft",
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags,
      cover_text: parsed.data.coverText || null,
      video_url: getRenderOutputObject(job.id),
      dry_run: isInstagramPublishDryRun(),
      created_by: userId,
    });
    return renderJson({
      post: toPublicSocialPost(post, {
        raceTitle: job.race_title,
        videoAvailableUntil: getVideoAvailableUntil(job.finished_at).toISOString(),
      }),
    }, 201);
  } catch (error) {
    console.error("Social post creation failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le brouillon n’a pas pu être créé.", 502);
  }
}
