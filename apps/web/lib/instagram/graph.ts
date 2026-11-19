import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  INSTAGRAM_GRAPH_HOST,
  INSTAGRAM_OAUTH_AUTHORIZE_URL,
  INSTAGRAM_OAUTH_TOKEN_URL,
  INSTAGRAM_SCOPES,
  getInstagramGraphVersion,
  type InstagramAppConfig,
} from "./config";

/**
 * Thin Instagram Graph client. Tokens travel as `access_token` parameters (query for GET, form body
 * for POST) and are never logged; errors keep only Meta's code, subcode and a truncated message.
 */

export const CONTAINER_STATUS_CODES = ["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"] as const;
export type ContainerStatusCode = (typeof CONTAINER_STATUS_CODES)[number];

/** auth: token expired/revoked or permission missing (reconnect); rate_limit: retry later;
 *  not_ready: media still processing; transient: network/5xx; permanent: request refused. */
export type GraphErrorKind = "auth" | "rate_limit" | "not_ready" | "transient" | "permanent";

export class InstagramGraphError extends Error {
  constructor(
    message: string,
    readonly kind: GraphErrorKind,
    readonly details: { httpStatus?: number; code?: number; subcode?: number } = {},
  ) {
    super(message);
    this.name = "InstagramGraphError";
  }
}

const graphErrorBodySchema = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.coerce.number().optional(),
    error_subcode: z.coerce.number().optional(),
    error_user_msg: z.string().optional(),
  }).passthrough(),
}).passthrough();

// OAuth endpoints answer { error_type, code, error_message } instead of the Graph error object.
const oauthErrorBodySchema = z.object({
  error_type: z.string().optional(),
  code: z.coerce.number().optional(),
  error_message: z.string().optional(),
}).passthrough();

const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002]);
const PUBLISH_LIMIT_SUBCODE = 2207042;
const AUTH_CODES = new Set([102, 190, 10]);

export const classifyGraphError = (httpStatus: number, code?: number, subcode?: number): GraphErrorKind => {
  if (subcode === PUBLISH_LIMIT_SUBCODE || (code !== undefined && RATE_LIMIT_CODES.has(code)) || httpStatus === 429) return "rate_limit";
  if ((code !== undefined && (AUTH_CODES.has(code) || (code >= 200 && code < 300))) || httpStatus === 401) return "auth";
  if (code === 9007) return "not_ready";
  if (code === 1 || code === 2 || httpStatus >= 500) return "transient";
  return "permanent";
};

const sanitize = (message: string | undefined) =>
  (message ?? "").replace(/access_token=[^&\s]+/gi, "access_token=***").replace(/\s+/g, " ").trim().slice(0, 300);

const toGraphError = async (response: Response) => {
  const body = await response.json().catch(() => null);
  const graph = graphErrorBodySchema.safeParse(body);
  if (graph.success) {
    const { code, error_subcode: subcode, message, error_user_msg: userMessage } = graph.data.error;
    const kind = classifyGraphError(response.status, code, subcode);
    return new InstagramGraphError(
      sanitize(userMessage || message) || `Erreur Instagram ${response.status}`,
      kind,
      { httpStatus: response.status, code, subcode },
    );
  }
  const oauth = oauthErrorBodySchema.safeParse(body);
  const code = oauth.success ? oauth.data.code : undefined;
  const message = oauth.success ? oauth.data.error_message : undefined;
  return new InstagramGraphError(
    sanitize(message) || `Erreur Instagram ${response.status}`,
    classifyGraphError(response.status, code === response.status ? undefined : code),
    { httpStatus: response.status, code },
  );
};

const call = async <T>(fetcher: typeof fetch, url: string, init: RequestInit, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> => {
  let response: Response;
  try {
    response = await fetcher(url, { ...init, cache: "no-store" });
  } catch {
    throw new InstagramGraphError("Instagram injoignable.", "transient");
  }
  if (!response.ok) throw await toGraphError(response);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new InstagramGraphError("Réponse Instagram inattendue.", "transient", { httpStatus: response.status });
  return parsed.data;
};

const form = (values: Record<string, string | undefined>) => {
  const body = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) body.set(key, value);
  });
  return body;
};

// ---------------------------------------------------------------------------------------------
// Publishing client

export type ReelContainerInput = {
  igUserId: string;
  accessToken: string;
  videoUrl: string;
  caption: string;
  coverUrl?: string | null;
  shareToFeed?: boolean;
};

export type RecentMedia = { id: string; permalink: string | null; timestampMs: number | null; mediaProductType: string | null };

export type PublishingLimit = { usage: number; total: number; durationSeconds: number | null };

export type InstagramGraphClient = {
  createReelContainer: (input: ReelContainerInput) => Promise<string>;
  getContainerStatus: (containerId: string, accessToken: string) => Promise<{ statusCode: ContainerStatusCode; status: string | null }>;
  publishContainer: (igUserId: string, containerId: string, accessToken: string) => Promise<string>;
  getPermalink: (mediaId: string, accessToken: string) => Promise<string | null>;
  getPublishingLimit: (igUserId: string, accessToken: string) => Promise<PublishingLimit | null>;
  /** Latest media of the account, to recover a media id whose publish response was lost. */
  listRecentMedia: (igUserId: string, accessToken: string) => Promise<RecentMedia[]>;
};

const idSchema = z.object({ id: z.coerce.string().min(1) }).passthrough();
const containerStatusSchema = z.object({
  status_code: z.enum(CONTAINER_STATUS_CODES),
  status: z.string().optional(),
}).passthrough();
const permalinkSchema = z.object({ permalink: z.string().url().optional() }).passthrough();
const recentMediaSchema = z.object({
  data: z.array(z.object({
    id: z.coerce.string().min(1),
    permalink: z.string().url().optional(),
    timestamp: z.string().optional(),
    media_product_type: z.string().optional(),
  }).passthrough()),
}).passthrough();

/** Instagram timestamps look like "2026-11-19T10:00:00+0000". */
export const parseInstagramTimestamp = (value: string | undefined) => {
  if (!value) return null;
  const parsed = Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isFinite(parsed) ? parsed : null;
};

const publishingLimitSchema = z.object({
  data: z.array(z.object({
    quota_usage: z.coerce.number(),
    config: z.object({ quota_total: z.coerce.number(), quota_duration: z.coerce.number().optional() }).passthrough().optional(),
  }).passthrough()),
}).passthrough();

/** Default quota budget when Meta does not say (docs mention 50, sometimes 100, posts per 24 h). */
export const INSTAGRAM_DAILY_PUBLISH_BUDGET = 50;

export const createInstagramGraphClient = ({
  fetcher = fetch,
  version = getInstagramGraphVersion(),
}: { fetcher?: typeof fetch; version?: string | null } = {}): InstagramGraphClient => {
  const base = version ? `${INSTAGRAM_GRAPH_HOST}/${version}` : INSTAGRAM_GRAPH_HOST;
  const get = <T>(path: string, params: Record<string, string>, schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
    call(fetcher, `${base}/${path}?${new URLSearchParams(params).toString()}`, { method: "GET" }, schema);
  const post = <T>(path: string, params: Record<string, string | undefined>, schema: z.ZodType<T, z.ZodTypeDef, unknown>) =>
    call(fetcher, `${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form(params),
    }, schema);

  return {
    createReelContainer: async ({ igUserId, accessToken, videoUrl, caption, coverUrl, shareToFeed = true }) => {
      const result = await post(`${encodeURIComponent(igUserId)}/media`, {
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        cover_url: coverUrl ?? undefined,
        share_to_feed: shareToFeed ? "true" : "false",
        access_token: accessToken,
      }, idSchema);
      return result.id;
    },
    getContainerStatus: async (containerId, accessToken) => {
      const result = await get(encodeURIComponent(containerId), { fields: "status_code,status", access_token: accessToken }, containerStatusSchema);
      return { statusCode: result.status_code, status: result.status ? sanitize(result.status) : null };
    },
    publishContainer: async (igUserId, containerId, accessToken) => {
      const result = await post(`${encodeURIComponent(igUserId)}/media_publish`, { creation_id: containerId, access_token: accessToken }, idSchema);
      return result.id;
    },
    getPermalink: async (mediaId, accessToken) => {
      const result = await get(encodeURIComponent(mediaId), { fields: "permalink", access_token: accessToken }, permalinkSchema);
      return result.permalink ?? null;
    },
    getPublishingLimit: async (igUserId, accessToken) => {
      const result = await get(`${encodeURIComponent(igUserId)}/content_publishing_limit`, {
        fields: "config,quota_usage",
        access_token: accessToken,
      }, publishingLimitSchema);
      const entry = result.data[0];
      if (!entry) return null;
      return {
        usage: entry.quota_usage,
        total: entry.config?.quota_total ?? INSTAGRAM_DAILY_PUBLISH_BUDGET,
        durationSeconds: entry.config?.quota_duration ?? null,
      };
    },
    listRecentMedia: async (igUserId, accessToken) => {
      const result = await get(`${encodeURIComponent(igUserId)}/media`, {
        fields: "id,permalink,timestamp,media_product_type",
        limit: "10",
        access_token: accessToken,
      }, recentMediaSchema);
      return result.data.map((item) => ({
        id: item.id,
        permalink: item.permalink ?? null,
        timestampMs: parseInstagramTimestamp(item.timestamp),
        mediaProductType: item.media_product_type ?? null,
      }));
    },
  };
};

/**
 * Simulated Graph: same contract, zero network call. Used when dry run is on or Meta credentials
 * are absent. Ids are prefixed "dry-run-" so they can never be mistaken for real Instagram ids.
 */
export const createDryRunGraphClient = (): InstagramGraphClient => ({
  createReelContainer: async () => `dry-run-container-${randomUUID()}`,
  getContainerStatus: async () => ({ statusCode: "FINISHED", status: "Simulation" }),
  publishContainer: async () => `dry-run-media-${randomUUID()}`,
  getPermalink: async () => null,
  getPublishingLimit: async () => ({ usage: 0, total: INSTAGRAM_DAILY_PUBLISH_BUDGET, durationSeconds: 86_400 }),
  listRecentMedia: async () => [],
});

export const isDryRunId = (id: string | null | undefined) => Boolean(id?.startsWith("dry-run-"));

// ---------------------------------------------------------------------------------------------
// OAuth (Instagram Login)

export const buildInstagramAuthorizeUrl = (app: InstagramAppConfig, state: string) => {
  const url = new URL(INSTAGRAM_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", app.appId);
  url.searchParams.set("redirect_uri", app.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
};

const shortLivedEntrySchema = z.object({
  access_token: z.string().min(1),
  user_id: z.coerce.string().min(1),
  permissions: z.union([z.array(z.string()), z.string()]).optional(),
}).passthrough();
// The documented sample wraps the entry in a data array; older responses are flat.
const shortLivedSchema = z.union([
  z.object({ data: z.array(shortLivedEntrySchema).min(1) }).transform((value) => value.data[0]),
  shortLivedEntrySchema,
]);

const longLivedSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string().optional(),
  expires_in: z.coerce.number().positive(),
}).passthrough();

const profileSchema = z.object({
  id: z.coerce.string().optional(),
  user_id: z.coerce.string().optional(),
  username: z.string().optional(),
}).passthrough();

export type LongLivedToken = { accessToken: string; expiresInSeconds: number };

/** Meta appends "#_" to the code in the redirect. */
export const cleanAuthorizationCode = (code: string) => code.replace(/#_$/, "").trim();

export const exchangeCodeForShortLivedToken = async (app: InstagramAppConfig, code: string, fetcher: typeof fetch = fetch) => {
  const result = await call(fetcher, INSTAGRAM_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form({
      client_id: app.appId,
      client_secret: app.appSecret,
      grant_type: "authorization_code",
      redirect_uri: app.redirectUri,
      code: cleanAuthorizationCode(code),
    }),
  }, shortLivedSchema);
  const permissions = Array.isArray(result.permissions) ? result.permissions : (result.permissions ?? "").split(",").filter(Boolean);
  return { accessToken: result.access_token, userId: result.user_id, permissions };
};

export const exchangeForLongLivedToken = async (app: InstagramAppConfig, shortLivedToken: string, fetcher: typeof fetch = fetch): Promise<LongLivedToken> => {
  const params = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: app.appSecret, access_token: shortLivedToken });
  const result = await call(fetcher, `${INSTAGRAM_GRAPH_HOST}/access_token?${params.toString()}`, { method: "GET" }, longLivedSchema);
  return { accessToken: result.access_token, expiresInSeconds: result.expires_in };
};

/** The token must be at least 24 h old and unexpired; Meta answers a new 60-day token. */
export const refreshLongLivedToken = async (accessToken: string, fetcher: typeof fetch = fetch): Promise<LongLivedToken> => {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const result = await call(fetcher, `${INSTAGRAM_GRAPH_HOST}/refresh_access_token?${params.toString()}`, { method: "GET" }, longLivedSchema);
  return { accessToken: result.access_token, expiresInSeconds: result.expires_in };
};

export const fetchInstagramProfile = async (accessToken: string, fetcher: typeof fetch = fetch, version = getInstagramGraphVersion()) => {
  const base = version ? `${INSTAGRAM_GRAPH_HOST}/${version}` : INSTAGRAM_GRAPH_HOST;
  const params = new URLSearchParams({ fields: "user_id,username", access_token: accessToken });
  const result = await call(fetcher, `${base}/me?${params.toString()}`, { method: "GET" }, profileSchema);
  return { igUserId: result.user_id ?? result.id ?? null, username: result.username ?? null };
};
