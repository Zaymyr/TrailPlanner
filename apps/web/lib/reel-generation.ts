import { z } from "zod";

import type { NarrationClip } from "../app/admin/video-generator/narration-player";
import {
  fetchNearestPeakName,
  fetchNearestPlaceName,
  resolveEndpointNames,
  type EndpointNames,
} from "../app/admin/video-generator/place-labels";
import {
  applyNarrationOverrides,
  assembleFullReelContent,
  buildInstagramCaptionRequest,
  buildNarrationScriptRequest,
  buildReelContentRequest,
  buildReelRenderSnapshot,
  buildReelSettings,
  freshClipsFor,
  getClimbTops,
  getEndpoints,
  getReelStoryInput,
  getReelVideoSize,
  hasGpxElevations,
  isReadyDetail,
  prepareReelStory,
  REEL_DEFAULT_VOICE_OPTIONS,
  type ReadyDetail,
} from "../app/admin/video-generator/reel-composition";
import type { StoryLandmarks } from "../app/admin/video-generator/route-story";
import { videoCompositionSettingsSchema, type VideoCompositionSettings } from "../app/admin/video-generator/video-composition";
import { pickPoolVoice } from "../app/admin/video-generator/voice-pool";
import { isInstagramPublishDryRun } from "./instagram/config";
import {
  createReelAutomationRepository,
  loadPlannerCatalog,
  loadRaceReels,
  ReelAutomationSkip,
  type ReelAutomationDeps,
  type ReelAutomationItem,
  type ReelAutomationSettings,
  type ReelRenderJobState,
  type ReelWork,
} from "./reel-automation";
import { buildNarrationOverrides, reelContentSchema, type ReelContent } from "./reel-content";
import { synthesizeNarration } from "./reel-voice";
import { writeInstagramCaption, writeNarrationScript, writeReelContent } from "./reel-writer";
import { createAutoDraftForRenderJob } from "./social-post-auto-draft";
import { createSocialPostRepository, scheduleSocialPostDraft } from "./social-posts";
import type { SupabaseServiceConfig } from "./supabase";
import { loadVideoGeneratorDetail } from "./video-generator-race";
import { readNarration, saveNarration } from "./video-narrations";
import {
  buildRenderUrl,
  createRenderToken,
  getGoogleAccessToken,
  getRenderInputObject,
  getRenderJob,
  getVideoRenderConfig,
  insertRenderJob,
  isRenderJobStale,
  runRenderJob,
  signStorageUrl,
  updateRenderJob,
  VIDEO_RENDER_JOB_COLUMNS,
  videoRenderJobRowSchema,
} from "./video-render";
import { listPoolVoices } from "./video-voices";

/**
 * Server side of an automatic reel, one step per cron tick: the same calls as the editor's
 * one-click reel (text, voice + saved narration, background render with an automatic draft), with
 * the composition built by reel-composition.ts instead of the browser.
 */

/** What the steps hand to each other, stored in `reel_automation_items.work`. */
export const reelWorkSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
  landmarks: z.record(z.string(), z.string()),
  placeNames: z.object({ start: z.string().nullable(), finish: z.string().nullable() }),
  overrides: z.record(z.string(), z.string()),
  content: reelContentSchema,
  warnings: z.array(z.string()).default([]),
  voice: z.object({ voiceId: z.string().nullable(), name: z.string().nullable() }).optional(),
});
export type ReelGenerationWork = z.infer<typeof reelWorkSchema>;

export const readWork = (work: ReelWork) => {
  const parsed = reelWorkSchema.safeParse(work);
  if (!parsed.success) throw new Error("Données de génération illisibles : relance depuis le texte.");
  return { ...parsed.data, settings: videoCompositionSettingsSchema.parse(parsed.data.settings) };
};

/** The race with its parsed GPX; a race that cannot be told without the editor is skipped. */
export const loadReadyDetail = async (supabase: SupabaseServiceConfig, raceId: string): Promise<ReadyDetail> => {
  const result = await loadVideoGeneratorDetail(supabase, raceId);
  if (!result.ok) {
    if (result.status === 404 || result.status === 422) throw new ReelAutomationSkip(`Course illisible : ${result.message}`);
    throw new Error(result.message);
  }
  if (!isReadyDetail(result.detail)) throw new ReelAutomationSkip("La course n’a plus de GPX.");
  // Without any GPX elevation the editor asks the 3D terrain, which the server cannot do.
  if (!hasGpxElevations(result.detail)) throw new ReelAutomationSkip("GPX sans altitudes : à faire à la main dans le générateur.");
  return result.detail;
};

/**
 * Mapbox Tilequery with the public token. A URL-restricted token is refused from a server: the
 * reel then has no summit or place names, and the refusal is logged once per lookup batch.
 */
const createTilequeryFetcher = () => {
  let refused: number | null = null;
  const fetcher: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok && refused === null) refused = response.status;
    return response;
  };
  return { fetcher, refused: () => refused };
};

export const lookupPlaceData = async (detail: ReadyDetail, token: string | null | undefined): Promise<{ landmarks: StoryLandmarks; placeNames: EndpointNames }> => {
  const input = getReelStoryInput(detail);
  const path = prepareReelStory(input, buildReelSettings("full"), {}).path;
  const { start, finish } = getEndpoints(path);
  if (!token) {
    console.warn("Reel automation: NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN missing, no summit or place names.");
    return { landmarks: {}, placeNames: await resolveEndpointNames(start, finish, input.race.startPlace, async () => null) };
  }
  const tilequery = createTilequeryFetcher();
  const entries = await Promise.all(getClimbTops(path).map(async (top) => {
    const name = await fetchNearestPeakName(top.lon, top.lat, token, undefined, tilequery.fetcher).catch(() => null);
    return name ? [top.slopeId, name] as const : null;
  }));
  const placeNames = await resolveEndpointNames(start, finish, input.race.startPlace, (lon, lat) => fetchNearestPlaceName(lon, lat, token, undefined, tilequery.fetcher));
  if (tilequery.refused() !== null) {
    console.warn(`Reel automation: Mapbox Tilequery refused (${tilequery.refused()}), the token may be URL-restricted; names skipped.`);
  }
  return { landmarks: Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry))), placeNames };
};

const requireEnv = (name: string, message: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(message);
  return value;
};

/**
 * The reel text of a ready course with these settings (their `storyMode` decides: one call in
 * Temps forts; script then caption in Parcours complet). Shared by the automatic reels and the
 * organizer flyover orders (lib/flyover-generation.ts), which have no catalog race.
 */
export const writeReelWork = async (detail: ReadyDetail, settings: VideoCompositionSettings): Promise<ReelGenerationWork> => {
  requireEnv("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY absent : la rédaction par IA n’est pas configurée.");
  const { landmarks, placeNames } = await lookupPlaceData(detail, process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim());
  const story = prepareReelStory(getReelStoryInput(detail), settings, landmarks);
  if (story.beats.length === 0) throw new ReelAutomationSkip("Le parcours est trop court pour un récit.");

  let content: ReelContent;
  let overrides: Record<string, string>;
  let warnings: string[] = [];
  if (settings.storyMode === "highlights") {
    const result = await writeReelContent(buildReelContentRequest(story));
    if (!result.ok) throw new Error(result.message);
    content = result.value.content;
    overrides = buildNarrationOverrides(content);
    warnings = result.value.warnings.map((warning) => warning.message);
  } else {
    const script = await writeNarrationScript(buildNarrationScriptRequest(story, settings));
    if (!script.ok) throw new Error(script.message);
    overrides = Object.fromEntries(script.value.beats.map((beat) => [beat.id, beat.narration]));
    const written = applyNarrationOverrides(story.beats, overrides);
    const caption = await writeInstagramCaption(buildInstagramCaptionRequest(story, written));
    if (!caption.ok) throw new Error(caption.message);
    content = assembleFullReelContent({ beats: written, caption: caption.value.caption, hashtags: caption.value.hashtags, coverText: story.race.shortName });
  }
  return { settings, landmarks, placeNames, overrides, content, warnings };
};

/** Step 1: the reel text. */
export const runContentStep = async (supabase: SupabaseServiceConfig, item: ReelAutomationItem): Promise<ReelGenerationWork> => {
  requireEnv("ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY absent : la rédaction par IA n’est pas configurée.");
  const detail = await loadReadyDetail(supabase, item.race_id);
  return writeReelWork(detail, buildReelSettings(item.mode));
};

/**
 * The narration of a written reel with one voice (ElevenLabs, reel defaults): the beats as told
 * and their clips keyed by beat id.
 */
export const synthesizeReelClips = async ({ detail, work, voiceId, apiKey }: {
  detail: ReadyDetail;
  work: ReturnType<typeof readWork>;
  voiceId: string | null;
  apiKey: string;
}) => {
  const story = prepareReelStory(getReelStoryInput(detail), work.settings, work.landmarks);
  const written = applyNarrationOverrides(story.beats, work.overrides);
  const items = written.filter((beat) => beat.narration.trim()).map((beat) => ({ id: beat.id, text: beat.narration.trim() }));
  if (!items.length) throw new Error("Aucun texte à dire : relance depuis le texte.");
  const result = await synthesizeNarration({ voiceId, items, ...REEL_DEFAULT_VOICE_OPTIONS }, apiKey);
  if (!result.ok) throw new Error(result.message);
  const textById = new Map(written.map((beat) => [beat.id, beat.narration]));
  const clips: Record<string, NarrationClip> = Object.fromEntries(result.clips.map((clip) => [clip.id, {
    beatId: clip.id,
    text: textById.get(clip.id) ?? clip.text,
    audioBase64: clip.audioBase64,
    durationMs: clip.durationMs,
    ...(clip.characterEndMs ? { characterEndMs: clip.characterEndMs } : {}),
    ...(clip.characterStartMs ? { characterStartMs: clip.characterStartMs } : {}),
  }]));
  return { written, clips };
};

/** Step 2: a random active pool voice (not the previous one of this race), then the narration saved with its clips. */
export const runVoiceStep = async (
  supabase: SupabaseServiceConfig,
  item: ReelAutomationItem,
  rawWork: ReelWork,
  userId: string | null,
): Promise<ReelGenerationWork> => {
  const apiKey = requireEnv("ELEVENLABS_API_KEY", "ELEVENLABS_API_KEY absent : la voix off n’est pas configurée.");
  const work = readWork(rawWork);
  const detail = await loadReadyDetail(supabase, item.race_id);

  const [pool, previous] = await Promise.all([
    listPoolVoices(supabase),
    readNarration(supabase, item.race_id, item.mode).catch(() => null),
  ]);
  const picked = pickPoolVoice(pool.filter((voice) => voice.active), previous?.voice.voiceId ?? null);
  const voice = { voiceId: picked?.voiceId ?? null, name: picked?.name ?? null };
  const { written, clips } = await synthesizeReelClips({ detail, work, voiceId: voice.voiceId, apiKey });

  const highlights = item.mode === "highlights";
  await saveNarration(supabase, item.race_id, userId, {
    settings: work.settings,
    // Each mode saves only its own texts, like the editor.
    narrationOverrides: Object.fromEntries(Object.entries(work.overrides).filter(([beatId]) => beatId.startsWith("hl-") === highlights)),
    voice: { voiceId: voice.voiceId, voiceName: voice.name, ...REEL_DEFAULT_VOICE_OPTIONS },
    clips: freshClipsFor(written, clips),
    ...(highlights ? { content: work.content } : {}),
  }, item.mode);
  return { ...work, voice };
};

/**
 * The composition replayed by the render page, the render job, the snapshot upload and the Cloud
 * Run start, as `launchBackgroundRender` does. `job` carries the row's own fields (race or
 * flyover order, title, content, automatic draft, author). A failed launch marks the job failed.
 */
export const launchReelRender = async ({ supabase, request, detail, work, clips, job: jobFields }: {
  supabase: SupabaseServiceConfig;
  request: Request;
  detail: ReadyDetail;
  work: ReturnType<typeof readWork>;
  clips: NarrationClip[];
  job: { race_id?: string | null; flyover_order_id?: string | null; race_title: string; created_by: string | null; content: ReelContent | null; auto_draft: boolean };
}): Promise<string> => {
  const config = getVideoRenderConfig();
  if (!config) throw new Error("Rendu en arrière-plan non configuré (variables Google Cloud absentes).");
  const snapshot = buildReelRenderSnapshot({
    detail,
    settings: work.settings,
    narrationOverrides: work.overrides,
    landmarks: work.landmarks,
    placeNames: work.placeNames,
    voiceClips: clips,
  });
  const size = getReelVideoSize(work.settings);
  const job = await insertRenderJob(supabase, {
    ...jobFields,
    race_title: jobFields.race_title.slice(0, 200),
    width: size.width,
    height: size.height,
    status: "uploading",
  });
  try {
    const accessToken = await getGoogleAccessToken(config, request);
    const uploadUrl = await signStorageUrl({ config, accessToken, method: "PUT", objectName: getRenderInputObject(job.id), expiresSeconds: 15 * 60 });
    const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot), cache: "no-store" });
    if (!uploaded.ok) throw new Error(`L’envoi de la composition a échoué (${uploaded.status}).`);
    const execution = await runRenderJob(config, accessToken, buildRenderUrl(new URL(request.url).origin, job, createRenderToken(config.tokenSecret, job.id)));
    await updateRenderJob(supabase, job.id, { status: "queued", cloud_run_execution: execution }, ["uploading"]);
    return job.id;
  } catch (error) {
    // A failed launch never leaves an active job behind (it would count as a reel of the race).
    const message = (error instanceof Error ? error.message : "Le rendu n’a pas pu démarrer.").slice(0, 500);
    await updateRenderJob(supabase, job.id, { status: "failed", message, finished_at: new Date().toISOString() }, ["uploading"]).catch(() => null);
    throw error;
  }
};

/** Step 3: the render of the saved narration, with its automatic draft. */
export const runRenderStep = async (
  supabase: SupabaseServiceConfig,
  request: Request,
  item: ReelAutomationItem,
  rawWork: ReelWork,
  userId: string | null,
): Promise<string> => {
  if (!getVideoRenderConfig()) throw new Error("Rendu en arrière-plan non configuré (variables Google Cloud absentes).");
  const work = readWork(rawWork);
  const detail = await loadReadyDetail(supabase, item.race_id);
  const story = prepareReelStory(getReelStoryInput(detail), work.settings, work.landmarks);
  const written = applyNarrationOverrides(story.beats, work.overrides);
  const narration = await readNarration(supabase, item.race_id, item.mode);
  const clips = freshClipsFor(written, Object.fromEntries((narration?.clips ?? []).map((clip) => [clip.beatId, clip])));
  if (!clips.length) throw new Error("La voix off enregistrée ne correspond plus au texte : relance la voix.");
  return launchReelRender({
    supabase,
    request,
    detail,
    work,
    clips,
    job: { race_id: item.race_id, race_title: story.race.title, created_by: userId, content: work.content, auto_draft: true },
  });
};

const renderJobStateSchema = videoRenderJobRowSchema.pick({ id: true, status: true, message: true, created_at: true, updated_at: true, finished_at: true });

const serviceHeaders = (supabase: SupabaseServiceConfig) => ({
  apikey: supabase.supabaseServiceRoleKey,
  Authorization: `Bearer ${supabase.supabaseServiceRoleKey}`,
});

/** The executor's dependencies on the real services, for the cron route. */
export const createReelAutomationDeps = (supabase: SupabaseServiceConfig, request: Request): ReelAutomationDeps => {
  const posts = createSocialPostRepository(supabase);
  const userOf = (settings: ReelAutomationSettings) => settings.updated_by;
  return {
    now: () => new Date(),
    repository: createReelAutomationRepository(supabase),
    loadCatalog: () => loadPlannerCatalog(supabase),
    loadRaceReels: (item) => loadRaceReels(supabase, item.race_id, { renderJobId: item.render_job_id, socialPostId: item.social_post_id }),
    steps: {
      content: (item) => runContentStep(supabase, item),
      voice: (item, work, settings) => runVoiceStep(supabase, item, work, userOf(settings)),
      render: (item, work, settings) => runRenderStep(supabase, request, item, work, userOf(settings)),
    },
    getRenderJobs: async (ids) => {
      if (!ids.length) return new Map();
      const response = await fetch(`${supabase.supabaseUrl}/rest/v1/video_render_jobs?id=in.(${ids.join(",")})&select=${VIDEO_RENDER_JOB_COLUMNS}`, {
        headers: serviceHeaders(supabase),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Unable to read render jobs (${response.status}).`);
      const rows = z.array(renderJobStateSchema).parse(await response.json());
      return new Map(rows.map((row) => [row.id, row as ReelRenderJobState]));
    },
    isRenderJobStale: (job, nowMs) => isRenderJobStale(job as Parameters<typeof isRenderJobStale>[0], nowMs),
    ensureAutoDraft: async (renderJobId) => {
      const existing = await posts.findAutoDraft(renderJobId);
      if (existing) return { id: existing.id };
      // The completion route creates it; this repairs a draft that failed there.
      const job = await getRenderJob(supabase, renderJobId);
      if (!job || job.status !== "done") return null;
      const created = await createAutoDraftForRenderJob(supabase, job, posts);
      return created ? { id: created.post.id } : null;
    },
    schedulePost: async (postId, local) => {
      const post = await posts.get(postId);
      if (!post) return { ok: false, message: "Brouillon introuvable." };
      const job = post.video_job_id ? await getRenderJob(supabase, post.video_job_id) : null;
      const result = await scheduleSocialPostDraft({
        posts,
        post,
        finishedAt: job?.status === "done" ? job.finished_at : null,
        local,
        dryRun: isInstagramPublishDryRun(),
      });
      return result.ok ? { ok: true } : { ok: false, message: result.message ?? "Le brouillon a changé entre-temps." };
    },
  };
};
