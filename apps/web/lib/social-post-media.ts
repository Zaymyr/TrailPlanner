import { getCarouselRenderJob, listCarouselRenderJobs } from "./carousels/carousel-render";
import type { SocialPostRow } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";
import { getRenderJob } from "./video-render";

/**
 * The render behind a post, whatever its media: the reel's video_render_jobs row or the carousel's
 * carousel_render_jobs row. Both live in the same bucket with the same 30-day lifecycle, so the
 * publication rules (« Programmer », « Publier maintenant ») read `finished_at` the same way.
 */
export type PostMedia = { status: string; finished_at: string | null; title: string };

export const getPostMedia = async (supabase: SupabaseServiceConfig, post: Pick<SocialPostRow, "media_type" | "video_job_id" | "carousel_job_id">): Promise<PostMedia | null> => {
  if (post.media_type === "carousel") {
    const job = post.carousel_job_id ? await getCarouselRenderJob(supabase, post.carousel_job_id) : null;
    return job ? { status: job.status, finished_at: job.finished_at, title: job.title } : null;
  }
  const job = post.video_job_id ? await getRenderJob(supabase, post.video_job_id) : null;
  return job ? { status: job.status, finished_at: job.finished_at, title: job.race_title } : null;
};

/** Carousel renders of a list of posts, keyed by job id. */
export const listCarouselMedia = async (supabase: SupabaseServiceConfig, posts: Array<Pick<SocialPostRow, "carousel_job_id">>) => {
  const ids = Array.from(new Set(posts.flatMap((post) => (post.carousel_job_id ? [post.carousel_job_id] : []))));
  return listCarouselRenderJobs(supabase, ids);
};
