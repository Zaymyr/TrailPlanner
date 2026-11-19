import { z } from "zod";

import { publicSocialPostSchema, type SocialPostAction } from "../../../lib/social-posts";

/** Client contracts of the admin publications routes (every response is parsed). */

export const instagramStatusSchema = z.object({
  account: z.object({
    id: z.string(),
    igUserId: z.string(),
    username: z.string().nullable(),
    status: z.enum(["connected", "needs_reconnect"]),
    statusMessage: z.string().nullable(),
    tokenExpiresAt: z.string(),
    tokenRefreshedAt: z.string(),
  }).nullable(),
  dryRun: z.boolean(),
  appConfigured: z.boolean(),
  encryptionConfigured: z.boolean(),
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
