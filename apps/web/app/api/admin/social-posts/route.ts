import { withAdminAudit, auditResponse, pickAuditFields } from "../../../../lib/admin-audit-log";
import { buildDraftPrefill, parseReelContent } from "../../../../lib/reel-content";
import {
  canPublishNow,
  createSocialPostRepository,
  createSocialPostSchema,
  getLatestPublishTime,
  getVideoAvailableUntil,
  listVideoJobsForPublishing,
  readPublicationMarks,
  toPublicSocialPost,
  VIDEO_LIFETIME_MARGIN_HOURS,
  VIDEO_STORAGE_LIFETIME_DAYS,
} from "../../../../lib/social-posts";
import { buildSocialPostDraftRow } from "../../../../lib/social-post-auto-draft";
import { listCarouselMedia } from "../../../../lib/social-post-media";
import { getRenderJob } from "../../../../lib/video-render";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

/** Publications list, plus the finished renders a new draft can start from. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase } = gate.value;

  try {
    const [posts, marks] = await Promise.all([createSocialPostRepository(supabase).list(200), readPublicationMarks(supabase)]);
    const jobIds = Array.from(new Set(posts.map((post) => post.video_job_id).filter((id): id is string => Boolean(id))));
    const [postJobs, carouselJobs, recentJobs] = await Promise.all([
      listVideoJobsForPublishing(supabase, { ids: jobIds }),
      listCarouselMedia(supabase, posts),
      listVideoJobsForPublishing(supabase, {
        finishedSince: new Date(Date.now() - (VIDEO_STORAGE_LIFETIME_DAYS * 24 - VIDEO_LIFETIME_MARGIN_HOURS) * 60 * 60 * 1_000),
      }),
    ]);
    return renderJson({
      posts: posts.map((post) => {
        if (post.media_type === "carousel") {
          const carousel = post.carousel_job_id ? carouselJobs.get(post.carousel_job_id) : undefined;
          return toPublicSocialPost(post, {
            raceTitle: carousel?.title ?? null,
            videoAvailableUntil: carousel?.finished_at ? getVideoAvailableUntil(carousel.finished_at).toISOString() : null,
          });
        }
        const job = post.video_job_id ? postJobs.get(post.video_job_id) : undefined;
        return toPublicSocialPost(post, {
          raceTitle: job?.race_title ?? null,
          videoAvailableUntil: job?.finished_at ? getVideoAvailableUntil(job.finished_at).toISOString() : null,
        });
      }),
      videos: Array.from(recentJobs.values()).map((job) => {
        // A video with reel content starts its draft from it; older ones from the plain template.
        const prefill = buildDraftPrefill(job.race_title, parseReelContent(job.content));
        return {
          id: job.id,
          raceId: job.race_id,
          raceTitle: job.race_title,
          width: job.width,
          height: job.height,
          finishedAt: job.finished_at,
          latestPublishAt: job.finished_at ? getLatestPublishTime(job.finished_at).toISOString() : null,
          defaultCaption: prefill.caption,
          defaultHashtags: prefill.hashtags,
          defaultCoverText: prefill.coverText,
          hasContent: parseReelContent(job.content) !== null,
          // Already published, scheduled or drafted: the page warns before a second post of the same reel.
          publication: marks.byVideo[job.id] ?? null,
          racePublication: job.race_id ? marks.byRace[job.race_id] ?? null : null,
        };
      }),
    });
  } catch (error) {
    console.error("Social posts list failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les publications n’ont pas pu être chargées.", 502);
  }
}

/** New draft from a finished render. Nothing is published until an explicit action. */
async function postRoute(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  const { supabase, userId } = gate.value;

  const parsed = createSocialPostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return renderJsonError(parsed.error.issues[0]?.message ?? "Brouillon invalide.", 400);

  try {
    const job = await getRenderJob(supabase, parsed.data.videoJobId);
    if (!job || job.status !== "done" || !job.finished_at) return renderJsonError("Cette vidéo n’est pas terminée.", 409);
    if (!canPublishNow(job.finished_at)) return renderJsonError("Cette vidéo arrive en fin de conservation (30 jours) : relance un rendu.", 409);

    // The reel text of the video is copied as is (full JSON), whatever the admin edited above.
    const post = await createSocialPostRepository(supabase).insert(buildSocialPostDraftRow({
      job,
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags,
      coverText: parsed.data.coverText ?? null,
      createdBy: userId,
    }));
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

export const POST = withAdminAudit(postRoute, {
  action: "content.post-create",
  targetType: "post",
  targetId: (c) => (auditResponse(c).post as { id?: string } | null)?.id,
  summary: "Brouillon Instagram créé à partir d’un rendu",
  after: (c) => pickAuditFields(c.body, ["videoJobId"]),
});
