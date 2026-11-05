import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { SupabaseServiceConfig } from "./supabase";

/**
 * Background reel renders: a Google Cloud Run job opens the render page in headless Chrome, which
 * replays the exact admin composition and uploads the MP4 to Google Cloud Storage. Vercel reaches
 * Google through OIDC federation (no stored Google key); the render page authenticates with a
 * short-lived HMAC token bound to one job.
 */

export const VIDEO_RENDER_STATUSES = ["uploading", "queued", "running", "done", "failed"] as const;
export type VideoRenderStatus = (typeof VIDEO_RENDER_STATUSES)[number];

export const videoRenderJobRowSchema = z.object({
  id: z.string().uuid(),
  race_id: z.string().uuid(),
  race_title: z.string(),
  status: z.enum(VIDEO_RENDER_STATUSES),
  progress: z.number(),
  message: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  output_size_bytes: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});
export type VideoRenderJobRow = z.infer<typeof videoRenderJobRowSchema>;

export const VIDEO_RENDER_JOB_COLUMNS = "id,race_id,race_title,status,progress,message,width,height,output_size_bytes,created_at,updated_at,started_at,finished_at";

/**
 * Upper bound on a render, end to end, for the page token, the upload URL and the stale rule. The
 * Cloud Run GPU task itself stops at 1 h (.github/workflows/video-render-worker.yml): a GPU task
 * over 1 h is a Preview feature. The margin keeps these limits valid if that timeout grows.
 */
export const MAX_RENDER_HOURS = 8;

/** The page token covers the queue plus the longest render. */
export const RENDER_TOKEN_TTL_SECONDS = (MAX_RENDER_HOURS + 1) * 60 * 60;

/** The MP4 upload URL is signed when the render starts and used at its very end. */
export const RENDER_UPLOAD_URL_TTL_SECONDS = MAX_RENDER_HOURS * 60 * 60;

/** The page reports progress every 5 s: this long without news means the container is gone. */
export const RENDER_SILENCE_LIMIT_MS = 15 * 60 * 1_000;

/**
 * A render still marked active is lost when it has not reported for RENDER_SILENCE_LIMIT_MS, or
 * outlived the longest allowed render (queue included).
 */
export const isRenderJobStale = (row: Pick<VideoRenderJobRow, "status" | "created_at" | "updated_at">, nowMs: number) => {
  if (row.status !== "queued" && row.status !== "running" && row.status !== "uploading") return false;
  const silentFor = nowMs - Date.parse(row.updated_at);
  const age = nowMs - Date.parse(row.created_at);
  // A queued job has no report yet: only the overall limit applies until the page starts it.
  if (row.status !== "queued" && silentFor > RENDER_SILENCE_LIMIT_MS) return true;
  return age > RENDER_TOKEN_TTL_SECONDS * 1_000;
};

export type VideoRenderConfig = {
  projectId: string;
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
  region: string;
  bucket: string;
  jobName: string;
  tokenSecret: string;
};

export const getVideoRenderConfig = (): VideoRenderConfig | null => {
  const config = {
    projectId: process.env.GCP_PROJECT_ID?.trim() ?? "",
    projectNumber: process.env.GCP_PROJECT_NUMBER?.trim() ?? "",
    serviceAccountEmail: process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim() ?? "",
    poolId: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim() || "vercel",
    providerId: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim() || "vercel",
    region: process.env.GCP_REGION?.trim() || "europe-west1",
    bucket: process.env.VIDEO_RENDER_BUCKET?.trim() ?? "",
    jobName: process.env.VIDEO_RENDER_JOB_NAME?.trim() || "video-render",
    tokenSecret: process.env.VIDEO_RENDER_TOKEN_SECRET?.trim() ?? "",
  };
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) return null;
  if (config.tokenSecret.length < 32) return null;
  return config;
};

// ---------------------------------------------------------------------------------------------
// Per-job render token

const base64Url = (buffer: Buffer) => buffer.toString("base64url");

const signTokenPayload = (secret: string, jobId: string, expiresAt: number) =>
  base64Url(createHmac("sha256", secret).update(`video-render:${jobId}:${expiresAt}`).digest());

export const createRenderToken = (secret: string, jobId: string, nowMs = Date.now()) => {
  const expiresAt = Math.floor(nowMs / 1_000) + RENDER_TOKEN_TTL_SECONDS;
  return `${expiresAt}.${signTokenPayload(secret, jobId, expiresAt)}`;
};

export const verifyRenderToken = (secret: string, jobId: string, token: string | null, nowMs = Date.now()) => {
  if (!token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || !signature || expiresAt * 1_000 < nowMs) return false;
  const expected = Buffer.from(signTokenPayload(secret, jobId, expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

export const getRenderTokenFromRequest = (request: Request) => {
  const header = request.headers.get("authorization");
  return header?.startsWith("Render ") ? header.slice("Render ".length).trim() : null;
};

// ---------------------------------------------------------------------------------------------
// Google credentials through Vercel OIDC federation

type CachedToken = { accessToken: string; expiresAtMs: number };
let cachedGoogleToken: CachedToken | null = null;

const getVercelOidcToken = (request: Request) =>
  request.headers.get("x-vercel-oidc-token")?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim() || null;

export class VideoRenderSetupError extends Error {}

/** Exchanges the Vercel OIDC token for an access token of the Google service account. */
export const getGoogleAccessToken = async (config: VideoRenderConfig, request: Request, fetcher: typeof fetch = fetch) => {
  if (cachedGoogleToken && cachedGoogleToken.expiresAtMs - 60_000 > Date.now()) return cachedGoogleToken.accessToken;
  const subjectToken = getVercelOidcToken(request);
  if (!subjectToken) throw new VideoRenderSetupError("Jeton OIDC Vercel absent : active « Secure backend access with OIDC federation » dans Vercel.");

  const stsResponse = await fetcher("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectToken,
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
    }),
    cache: "no-store",
  });
  if (!stsResponse.ok) {
    throw new VideoRenderSetupError(`Google a refusé le jeton Vercel (${stsResponse.status}) : ${(await stsResponse.text()).slice(0, 300)}`);
  }
  const { access_token: federatedToken } = z.object({ access_token: z.string() }).parse(await stsResponse.json());

  const impersonation = await fetcher(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.serviceAccountEmail)}:generateAccessToken`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${federatedToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: ["https://www.googleapis.com/auth/cloud-platform"], lifetime: "3600s" }),
      cache: "no-store",
    },
  );
  if (!impersonation.ok) {
    throw new VideoRenderSetupError(`Accès au compte de service refusé (${impersonation.status}) : ${(await impersonation.text()).slice(0, 300)}`);
  }
  const { accessToken, expireTime } = z.object({ accessToken: z.string(), expireTime: z.string() }).parse(await impersonation.json());
  cachedGoogleToken = { accessToken, expiresAtMs: Date.parse(expireTime) || Date.now() + 3_000_000 };
  return accessToken;
};

/** Test hook: forget the cached Google token. */
export const resetGoogleTokenCache = () => {
  cachedGoogleToken = null;
};

// ---------------------------------------------------------------------------------------------
// Cloud Storage V4 signed URLs (signed by the service account through IAM signBlob)

export const getRenderInputObject = (jobId: string) => `jobs/${jobId}/input.json`;
export const getRenderOutputObject = (jobId: string) => `jobs/${jobId}/reel.mp4`;

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);

const formatGoogleDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export const signStorageUrl = async ({
  config,
  accessToken,
  method,
  objectName,
  expiresSeconds,
  responseDisposition,
  now = new Date(),
  fetcher = fetch,
}: {
  config: VideoRenderConfig;
  accessToken: string;
  method: "GET" | "PUT";
  objectName: string;
  expiresSeconds: number;
  responseDisposition?: string;
  now?: Date;
  fetcher?: typeof fetch;
}) => {
  const datetime = formatGoogleDate(now);
  const scope = `${datetime.slice(0, 8)}/auto/storage/goog4_request`;
  const path = `/${config.bucket}/${objectName.split("/").map(encodeRfc3986).join("/")}`;
  const query: Record<string, string> = {
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": `${config.serviceAccountEmail}/${scope}`,
    "X-Goog-Date": datetime,
    "X-Goog-Expires": String(expiresSeconds),
    "X-Goog-SignedHeaders": "host",
  };
  if (responseDisposition) query["response-content-disposition"] = responseDisposition;
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
    .join("&");
  const canonicalRequest = [method, path, canonicalQuery, "host:storage.googleapis.com", "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["GOOG4-RSA-SHA256", datetime, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");

  const response = await fetcher(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(config.serviceAccountEmail)}:signBlob`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ payload: Buffer.from(stringToSign).toString("base64") }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new VideoRenderSetupError(`Signature d'URL refusée (${response.status}) : ${(await response.text()).slice(0, 300)}`);
  }
  const { signedBlob } = z.object({ signedBlob: z.string() }).parse(await response.json());
  const signature = Buffer.from(signedBlob, "base64").toString("hex");
  return `https://storage.googleapis.com${path}?${canonicalQuery}&X-Goog-Signature=${signature}`;
};

/** Size of a stored object, or null when it does not exist. */
export const getStorageObjectSize = async (config: VideoRenderConfig, accessToken: string, objectName: string, fetcher: typeof fetch = fetch) => {
  const response = await fetcher(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(config.bucket)}/o/${encodeURIComponent(objectName)}?fields=size`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new VideoRenderSetupError(`Lecture du stockage impossible (${response.status}).`);
  const { size } = z.object({ size: z.coerce.number() }).parse(await response.json());
  return size;
};

// ---------------------------------------------------------------------------------------------
// Cloud Run job

/** Starts one execution of the render job; the render page URL (with its token) is its only input. */
export const runRenderJob = async (config: VideoRenderConfig, accessToken: string, renderUrl: string, fetcher: typeof fetch = fetch) => {
  const response = await fetcher(
    `https://run.googleapis.com/v2/projects/${config.projectId}/locations/${config.region}/jobs/${config.jobName}:run`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ overrides: { containerOverrides: [{ env: [{ name: "RENDER_URL", value: renderUrl }] }] } }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new VideoRenderSetupError(`Cloud Run n'a pas lancé le rendu (${response.status}) : ${(await response.text()).slice(0, 300)}`);
  }
  const operation = z.object({ name: z.string().optional(), metadata: z.object({ name: z.string().optional() }).passthrough().optional() })
    .passthrough()
    .parse(await response.json());
  return operation.metadata?.name ?? operation.name ?? null;
};

// ---------------------------------------------------------------------------------------------
// Job rows (service role)

const serviceHeaders = (supabase: SupabaseServiceConfig) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
  "Content-Type": "application/json",
});

export const insertRenderJob = async (supabase: SupabaseServiceConfig, row: Record<string, unknown>) => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?select=${VIDEO_RENDER_JOB_COLUMNS}`, {
    method: "POST",
    headers: { ...serviceHeaders(supabase), Prefer: "return=representation" },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to create render job: ${await response.text()}`);
  return z.array(videoRenderJobRowSchema).parse(await response.json())[0];
};

export const getRenderJob = async (supabase: SupabaseServiceConfig, jobId: string) => {
  const response = await fetch(
    `${supabase.supabaseUrl}/rest/v1/video_render_jobs?id=eq.${jobId}&select=${VIDEO_RENDER_JOB_COLUMNS}&limit=1`,
    { headers: serviceHeaders(supabase), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to read render job: ${await response.text()}`);
  return z.array(videoRenderJobRowSchema).parse(await response.json())[0] ?? null;
};

export const listRenderJobs = async (supabase: SupabaseServiceConfig, limit = 10) => {
  const response = await fetch(
    `${supabase.supabaseUrl}/rest/v1/video_render_jobs?select=${VIDEO_RENDER_JOB_COLUMNS}&order=created_at.desc&limit=${limit}`,
    { headers: serviceHeaders(supabase), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Unable to list render jobs: ${await response.text()}`);
  return z.array(videoRenderJobRowSchema).parse(await response.json());
};

/** Updates a job; `onlyFrom` guards the transition (e.g. a finished job is never reopened). */
export const updateRenderJob = async (
  supabase: SupabaseServiceConfig,
  jobId: string,
  patch: Record<string, unknown>,
  onlyFrom?: readonly VideoRenderStatus[],
) => {
  const filter = onlyFrom ? `&status=in.(${onlyFrom.join(",")})` : "";
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?id=eq.${jobId}${filter}&select=${VIDEO_RENDER_JOB_COLUMNS}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(supabase), Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to update render job: ${await response.text()}`);
  return z.array(videoRenderJobRowSchema).parse(await response.json())[0] ?? null;
};

/** Filename-safe slug of the race title, like the in-browser export. */
export const getReelFileName = (title: string) =>
  `${title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "parcours"}-reel.mp4`;
