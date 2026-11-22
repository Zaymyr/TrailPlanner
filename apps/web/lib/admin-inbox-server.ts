import { z } from "zod";

import {
  claimToItem,
  demoToItem,
  editionRequestToItem,
  failedFlyoverToItem,
  failedRenderToItem,
  feedbackToItem,
  isRecentRenderFailure,
  postToItem,
  publicationRequestToItem,
  raceDataGapToItem,
  raceRequestToItem,
  sortInboxItems,
  type InboxItem,
  type InboxResponse,
  type InboxSourceState,
} from "./admin-inbox";
import { createFlyoverOrderRepository } from "./flyover-orders";
import { buildRaceDataGaps, loadGapFormats } from "./race-data-gaps";
import {
  listCarouselRenderActivityRows,
  listReelRenderActivityRows,
  RENDER_ACTIVITY_WINDOW_MS,
  toCarouselRenderActivity,
  toReelRenderActivity,
  type RenderActivity,
} from "./render-activity";
import { createReelAutomationRepository } from "./reel-automation";
import { parisToday } from "./reel-planner";
import type { SupabaseServiceConfig } from "./supabase";

/**
 * Loaders of the « À traiter » queue (service role, read-only). Each source is read on its own: a
 * failing one is reported in `sources` and the others still load. The PostgREST filters below are
 * also the definition the badge counts use (`/api/admin/inbox-counts`).
 */

const LIST_LIMIT = 200;

/** Filters of the system items, shared with the counts. */
export const INBOX_FILTERS = {
  failedFlyovers: "flyover_video_orders?status=eq.failed",
  failedPosts: "social_posts?status=eq.failed",
  draftPosts: "social_posts?status=eq.draft",
} as const;

const get = async (supabase: SupabaseServiceConfig, path: string) => {
  const response = await fetch(`${supabase.supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: supabase.supabaseServiceRoleKey, Authorization: `Bearer ${supabase.supabaseServiceRoleKey}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = new Error(`Read failed (${response.status}).`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<unknown>;
};

const eventRef = z.object({ name: z.string() }).nullable().optional();

const feedbackRows = z.array(z.object({
  id: z.coerce.number(),
  created_at: z.string(),
  kind: z.enum(["bug", "feedback"]),
  subject: z.string(),
  source: z.string().nullable(),
  screen: z.string().nullable(),
}));
const raceRequestRows = z.array(z.object({ id: z.coerce.number(), created_at: z.string(), race_name: z.string(), location: z.string().nullable(), requested_date: z.string().nullable() }));
const demoRows = z.array(z.object({ id: z.string(), created_at: z.string(), email: z.string(), race_url: z.string() }));
const claimRows = z.array(z.object({ id: z.string(), created_at: z.string(), organization_name: z.string(), contact_email: z.string(), race_events: eventRef }));
const publicationRows = z.array(z.object({ id: z.string(), created_at: z.string(), race_events: eventRef, requested_race: eventRef }));
const editionRows = z.array(z.object({ id: z.string(), created_at: z.string(), source_year: z.number(), requested_start_date: z.string(), race_events: eventRef }));
const postRows = z.array(z.object({
  id: z.string(),
  status: z.enum(["failed", "draft"]),
  media_type: z.enum(["reel", "carousel"]).default("reel"),
  carousel_series: z.enum(["plan", "brief", "week"]).nullable().default(null),
  error: z.string().nullable(),
  auto_generated: z.boolean().default(false),
  dry_run: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  races: eventRef,
}));

const pending = (table: string, select: string) => `${table}?status=eq.pending&select=${select}&order=created_at.asc&limit=${LIST_LIMIT}`;

/** Reel and carousel renders that failed in the last 24 h (same list as the Rendus page). */
export const loadRecentRenderFailures = async (supabase: SupabaseServiceConfig, nowMs: number): Promise<RenderActivity[]> => {
  const [reels, carousels] = await Promise.all([listReelRenderActivityRows(supabase), listCarouselRenderActivityRows(supabase)]);
  return [...reels.map(toReelRenderActivity), ...carousels.map(toCarouselRenderActivity)]
    .filter((render) => isRecentRenderFailure(render, nowMs, RENDER_ACTIVITY_WINDOW_MS));
};

type Source = { key: string; label: string; load: () => Promise<InboxItem[]> };

export const loadAdminInbox = async (supabase: SupabaseServiceConfig, now = new Date()): Promise<InboxResponse> => {
  const nowMs = now.getTime();
  const today = parisToday(now);
  const sources: Source[] = [
    {
      key: "feedback",
      label: "Bugs et feedback",
      load: async () => feedbackRows.parse(await get(supabase, pending("app_feedback", "id,created_at,kind,subject,source,screen"))).map(feedbackToItem),
    },
    {
      key: "race_requests",
      label: "Demandes de course",
      load: async () => raceRequestRows.parse(await get(supabase, pending("race_requests", "id,created_at,race_name,location,requested_date"))).map(raceRequestToItem),
    },
    {
      key: "demos",
      label: "Démos organisateurs",
      load: async () => {
        try {
          return demoRows.parse(await get(supabase, pending("organizer_demo_requests", "id,created_at,email,race_url"))).map(demoToItem);
        } catch (error) {
          // Same as the counts: no demo request until the table is deployed.
          if ((error as { status?: number }).status === 404) return [];
          throw error;
        }
      },
    },
    {
      key: "claims",
      label: "Demandes d’accès",
      load: async () => claimRows.parse(await get(supabase, pending("race_event_claims", "id,created_at,organization_name,contact_email,race_events(name)"))).map(claimToItem),
    },
    {
      key: "publication_requests",
      label: "Demandes de publication",
      load: async () => publicationRows.parse(await get(supabase, pending("race_event_publication_requests", "id,created_at,race_events(name),requested_race:races(name)"))).map(publicationRequestToItem),
    },
    {
      key: "edition_requests",
      label: "Nouvelles éditions",
      load: async () => editionRows.parse(await get(supabase, pending("race_event_edition_requests", "id,created_at,source_year,requested_start_date,race_events(name)"))).map(editionRequestToItem),
    },
    {
      key: "flyovers",
      label: "Vidéos de survol",
      load: async () => (await createFlyoverOrderRepository(supabase).listByStatus(["failed"], LIST_LIMIT)).map(failedFlyoverToItem),
    },
    {
      key: "posts",
      label: "Publications Instagram",
      load: async () => postRows.parse(await get(
        supabase,
        `social_posts?status=in.(failed,draft)&select=id,status,media_type,carousel_series,error,auto_generated,dry_run,created_at,updated_at,races(name)&order=created_at.asc&limit=${LIST_LIMIT}`,
      )).map(postToItem),
    },
    {
      key: "renders",
      label: "Rendus",
      load: async () => (await loadRecentRenderFailures(supabase, nowMs)).map(failedRenderToItem),
    },
    {
      key: "race_data",
      label: "Données de course",
      load: async () => {
        const [formats, settings] = await Promise.all([loadGapFormats(supabase), createReelAutomationRepository(supabase).getSettings()]);
        return buildRaceDataGaps(formats, today, settings.lead_days).flatMap((gap) => raceDataGapToItem(gap) ?? []);
      },
    },
  ];

  const results = await Promise.allSettled(sources.map((source) => source.load()));
  const states: InboxSourceState[] = [];
  const items: InboxItem[] = [];
  results.forEach((result, index) => {
    const source = sources[index];
    if (result.status === "fulfilled") {
      items.push(...result.value);
      states.push({ key: source.key, label: source.label, ok: true, message: null });
    } else {
      console.error(`Admin inbox source ${source.key} failed`, result.reason instanceof Error ? result.reason.message : result.reason);
      states.push({ key: source.key, label: source.label, ok: false, message: `${source.label} : lecture impossible.` });
    }
  });
  return { generatedAt: now.toISOString(), today, items: sortInboxItems(items), sources: states };
};
