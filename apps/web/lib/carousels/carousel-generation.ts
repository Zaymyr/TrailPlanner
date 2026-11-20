import "server-only";

import { z } from "zod";

import { isInstagramPublishDryRun } from "../instagram/config";
import { createReelAutomationRepository, type ReelAutomationSettings } from "../reel-automation";
import { addDays } from "../reel-planner";
import { createSocialPostRepository, scheduleSocialPostDraft } from "../social-posts";
import type { SupabaseServiceConfig } from "../supabase";
import { getVideoRenderConfig } from "../video-render";
import {
  CarouselAutomationSkip,
  createCarouselItemRepository,
  type CarouselAutomationDeps,
  type CarouselItem,
} from "./carousel-automation";
import { buildRaceCarousel, buildWeekCarousel, CarouselSkip, loadCarouselCatalog, type BuiltCarousel } from "./carousel-data";
import { CAROUSEL_HORIZON_DAYS } from "./carousel-planner";
import {
  createAutoDraftForCarouselJob,
  getCarouselRenderJob,
  isCarouselRenderStale,
  launchCarouselRender,
  listCarouselRenderJobs,
  type CarouselContent,
} from "./carousel-render";
import { parseCarouselSnapshot, type CarouselSeries } from "./carousel-snapshot";
import { writeCarouselCaption } from "./carousel-writer";

/**
 * Server side of the carousels: build (data + snapshot + caption) and render, for the automatic
 * slots and for « Générer maintenant ».
 */

const workSchema = z.object({
  series: z.enum(["plan", "brief", "week"]),
  raceId: z.string().nullable(),
  title: z.string(),
  snapshot: z.record(z.string(), z.unknown()),
  content: z.object({ caption: z.string(), hashtags: z.array(z.string()), warnings: z.array(z.string()) }),
});

/** Data, snapshot and caption of one carousel. A missing figure skips it (CarouselSkip), never invents. */
export const buildCarousel = async (
  supabase: SupabaseServiceConfig,
  target: { series: "plan" | "brief"; raceId: string } | { series: "week"; weekStart: string },
): Promise<{ built: BuiltCarousel; content: CarouselContent }> => {
  const built = target.series === "week"
    ? await buildWeekCarousel(supabase, target.weekStart)
    : await buildRaceCarousel(supabase, target.series, target.raceId);
  const caption = await writeCarouselCaption({ series: built.series, facts: built.facts, allowed: built.allowed, snapshot: built.snapshot });
  if (!caption.ok) throw new Error(caption.message);
  return { built, content: caption.content };
};

/** « Générer maintenant »: build, then launch the render with an automatic draft. */
export const generateCarouselNow = async ({ supabase, request, userId, target }: {
  supabase: SupabaseServiceConfig;
  request: Request;
  userId: string;
  target: { series: "plan" | "brief"; raceId: string } | { series: "week"; weekStart: string };
}) => {
  const config = getVideoRenderConfig();
  if (!config) throw new Error("Rendu en arrière-plan non configuré (variables Google Cloud absentes).");
  const { built, content } = await buildCarousel(supabase, target);
  return launchCarouselRender({
    supabase, config, request,
    series: built.series,
    raceId: built.raceId,
    title: built.title,
    snapshot: built.snapshot,
    content,
    createdBy: userId,
    autoDraft: true,
  });
};

const headers = (supabase: SupabaseServiceConfig) => ({ apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}` });

export const createCarouselAutomationDeps = (supabase: SupabaseServiceConfig, request: Request): CarouselAutomationDeps => {
  const posts = createSocialPostRepository(supabase);
  const items = createCarouselItemRepository(supabase);
  return {
    now: () => new Date(),
    items,
    getSettings: () => createReelAutomationRepository(supabase).getSettings(),
    loadCatalog: (today, mondays, carouselPostIds) => loadCarouselCatalog(supabase, today, CAROUSEL_HORIZON_DAYS, mondays, carouselPostIds),
    hasDuplicate: async (item: CarouselItem) => {
      if (!item.race_id) return false;
      const all = await items.list();
      const sameEdition = all.some((other) => other.id !== item.id && other.series === item.series && other.edition_key === item.edition_key
        && ["generating", "rendering", "drafted", "scheduled"].includes(other.status));
      if (sameEdition) return true;
      const since = addDays(item.planned_publish_date, -180);
      const response = await fetch(
        `${supabase.supabaseUrl}/rest/v1/social_posts?race_id=eq.${item.race_id}&media_type=eq.carousel&carousel_series=eq.${item.series}&status=neq.failed&created_at=gte.${since}${item.social_post_id ? `&id=neq.${item.social_post_id}` : ""}&select=id&limit=1`,
        { headers: headers(supabase), cache: "no-store" },
      );
      if (!response.ok) throw new Error(`Unable to read the carousels of a race (${response.status}).`);
      return ((await response.json()) as unknown[]).length > 0;
    },
    steps: {
      content: async (item) => {
        const target = item.series === "week"
          ? (item.week_start ? { series: "week" as const, weekStart: item.week_start } : null)
          : (item.race_id ? { series: item.series, raceId: item.race_id } : null);
        if (!target) throw new CarouselAutomationSkip("Créneau sans course ni semaine.");
        try {
          const { built, content } = await buildCarousel(supabase, target);
          return { series: built.series, raceId: built.raceId, title: built.title, snapshot: built.snapshot, content };
        } catch (error) {
          if (error instanceof CarouselSkip) throw new CarouselAutomationSkip(error.message);
          throw error;
        }
      },
      render: async (_item, rawWork, settings: ReelAutomationSettings) => {
        const config = getVideoRenderConfig();
        if (!config) throw new Error("Rendu en arrière-plan non configuré (variables Google Cloud absentes).");
        const work = workSchema.parse(rawWork);
        const job = await launchCarouselRender({
          supabase, config, request,
          series: work.series as CarouselSeries,
          raceId: work.raceId,
          title: work.title,
          snapshot: parseCarouselSnapshot(work.snapshot),
          content: work.content,
          createdBy: settings.updated_by,
          autoDraft: true,
        });
        return job.id;
      },
    },
    getJobs: async (ids) => {
      const jobs = await listCarouselRenderJobs(supabase, ids);
      return new Map(Array.from(jobs.values()).map((job) => [job.id, { id: job.id, status: job.status, message: job.message, created_at: job.created_at }]));
    },
    isJobStale: (job, nowMs) => isCarouselRenderStale({ status: job.status as "queued", created_at: job.created_at }, nowMs),
    ensureAutoDraft: async (jobId) => {
      const existing = await posts.findCarouselAutoDraft(jobId);
      if (existing) return { id: existing.id };
      const job = await getCarouselRenderJob(supabase, jobId);
      if (!job) return null;
      const created = await createAutoDraftForCarouselJob(supabase, job, posts);
      return created ? { id: created.post.id } : null;
    },
    schedulePost: async (postId, local) => {
      const post = await posts.get(postId);
      if (!post) return { ok: false, message: "Brouillon introuvable." };
      const job = post.carousel_job_id ? await getCarouselRenderJob(supabase, post.carousel_job_id) : null;
      const result = await scheduleSocialPostDraft({ posts, post, finishedAt: job?.status === "done" ? job.finished_at : null, local, dryRun: isInstagramPublishDryRun() });
      return result.ok ? { ok: true } : { ok: false, message: result.message ?? "Le brouillon a changé entre-temps." };
    },
  };
};
