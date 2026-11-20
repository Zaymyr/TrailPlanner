import { z } from "zod";

import { publicationMarkSchema, publicSocialPostSchema, type SocialPostAction } from "../../../lib/social-posts";

/** Client contracts of the admin publications routes (every response is parsed). */

export const instagramStatusSchema = z.object({
  credentialsConfigured: z.boolean(),
  igUserId: z.string().nullable(),
  pageId: z.string().nullable(),
  graphVersion: z.string(),
  profile: z.object({
    username: z.string().nullable(),
    name: z.string().nullable(),
    profilePictureUrl: z.string().nullable(),
  }).nullable(),
  profileError: z.string().nullable(),
  quota: z.object({
    usage: z.number(),
    total: z.number(),
    durationSeconds: z.number().nullable(),
  }).nullable(),
  dryRun: z.boolean(),
});
export type InstagramStatus = z.infer<typeof instagramStatusSchema>;

export const publishableVideoSchema = z.object({
  id: z.string(),
  raceId: z.string(),
  raceTitle: z.string(),
  width: z.number(),
  height: z.number(),
  finishedAt: z.string().nullable(),
  latestPublishAt: z.string().nullable(),
  defaultCaption: z.string(),
  defaultHashtags: z.array(z.string()),
  defaultCoverText: z.string().nullable().default(null),
  hasContent: z.boolean().default(false),
  publication: publicationMarkSchema.nullable().default(null),
  racePublication: publicationMarkSchema.nullable().default(null),
});
export type PublishableVideo = z.infer<typeof publishableVideoSchema>;

export const postsResponseSchema = z.object({
  posts: z.array(publicSocialPostSchema),
  videos: z.array(publishableVideoSchema),
});

export const postResponseSchema = z.object({ post: publicSocialPostSchema });

export const postDetailSchema = z.object({
  post: publicSocialPostSchema,
  previewUrl: z.string().nullable(),
  /** Carousel: one signed URL per slide, in order. */
  previewImages: z.array(z.string()).default([]),
  previewMessage: z.string().nullable(),
});

/** The server refused an action that needs the admin's explicit confirmation first. */
export class ConfirmationRequiredError extends Error {}

const toError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null) as { message?: unknown; needsConfirmation?: unknown } | null;
  const message = typeof payload?.message === "string" ? payload.message : fallback;
  return payload?.needsConfirmation === true ? new ConfirmationRequiredError(message) : new Error(message);
};

export const adminFetch = async <T>(
  accessToken: string,
  url: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  init: { method?: string; body?: unknown } = {},
  fallback = "La requête a échoué.",
): Promise<T> => {
  const response = await fetch(url, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!response.ok) throw await toError(response, fallback);
  return schema.parse(await response.json());
};

export const postAction = (accessToken: string, postId: string, action: SocialPostAction) =>
  adminFetch(accessToken, `/api/admin/social-posts/${postId}`, postResponseSchema, { method: "POST", body: action }, "L’action a échoué.");

/** Automatic reels (`/api/admin/reel-automation`). */
export const reelAutomationItemSchema = z.object({
  id: z.string(),
  raceId: z.string(),
  raceName: z.string().nullable(),
  mode: z.enum(["full", "highlights"]),
  plannedPublishDate: z.string(),
  generateOn: z.string(),
  status: z.enum(["planned", "generating", "rendering", "drafted", "scheduled", "skipped", "failed"]),
  step: z.enum(["content", "voice", "render"]).nullable(),
  attempts: z.number(),
  error: z.string().nullable(),
  reason: z.enum(["too_late", "duplicate", "excluded", "ineligible"]).nullable(),
  renderJobId: z.string().nullable(),
  socialPostId: z.string().nullable(),
});
export type ReelAutomationItemView = z.infer<typeof reelAutomationItemSchema>;

export const reelAutomationResponseSchema = z.object({
  settings: z.object({
    generationEnabled: z.boolean(),
    autoPublishEnabled: z.boolean(),
    maxPerWeek: z.number(),
    maxPerDay: z.number(),
    leadDays: z.number(),
    publishTime: z.string(),
    updatedAt: z.string(),
    carousels: z.object({ plan: z.boolean(), brief: z.boolean(), week: z.boolean() }).optional(),
  }),
  items: z.array(reelAutomationItemSchema),
});
export type ReelAutomationView = z.infer<typeof reelAutomationResponseSchema>;

/** Automatic carousels (`/api/admin/carousel-automation`). */
export const CAROUSEL_SERIES_KEYS = ["plan", "brief", "week"] as const;
export type CarouselSeriesKey = (typeof CAROUSEL_SERIES_KEYS)[number];

export const carouselItemViewSchema = z.object({
  id: z.string(),
  series: z.enum(CAROUSEL_SERIES_KEYS),
  plannedPublishDate: z.string(),
  generateOn: z.string(),
  raceId: z.string().nullable(),
  raceName: z.string().nullable(),
  weekStart: z.string().nullable(),
  status: z.enum(["planned", "generating", "rendering", "drafted", "scheduled", "skipped", "failed"]),
  step: z.enum(["content", "render"]).nullable(),
  attempts: z.number(),
  error: z.string().nullable(),
  reason: z.enum(["too_late", "no_candidate", "occupied", "duplicate", "excluded", "ineligible"]).nullable(),
  carouselJobId: z.string().nullable(),
  socialPostId: z.string().nullable(),
});
export type CarouselItemView = z.infer<typeof carouselItemViewSchema>;

export const carouselAutomationResponseSchema = z.object({
  races: z.array(z.object({ id: z.string(), label: z.string(), date: z.string() })).default([]),
  weeks: z.array(z.string()).default([]),
  series: z.object({ plan: z.boolean(), brief: z.boolean(), week: z.boolean() }),
  items: z.array(carouselItemViewSchema),
});
export type CarouselAutomationView = z.infer<typeof carouselAutomationResponseSchema>;
