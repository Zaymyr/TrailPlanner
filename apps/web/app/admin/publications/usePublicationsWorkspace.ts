"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { describePublicationMark } from "../../../lib/social-posts";
import { toPlannedCalendarEntries, toPlannedCarouselEntries } from "./automation-labels";
import type { CaptionPayload } from "./CaptionForm";
import { toCaptionFormValues } from "./CaptionForm";
import {
  adminFetch,
  carouselAutomationResponseSchema,
  instagramStatusSchema,
  postResponseSchema,
  postsResponseSchema,
  reelAutomationResponseSchema,
  renderActivityResponseSchema,
  type RenderActivityView,
} from "./publications-api";

/** While a post is publishing, the list refreshes on this rhythm. */
const LIST_POLL_MS = 30_000;
/** While a render runs, its stage refreshes on this rhythm; otherwise once a minute. */
const ACTIVE_RENDER_POLL_MS = 5_000;
const IDLE_RENDER_POLL_MS = 60_000;

/**
 * Data of the Publications screens (Calendrier, Publications, Rendus, Automatisations, Intégrations):
 * one set of react-query keys, so every console page reads and refreshes the same cache entries
 * (Instagram status, posts, render activity, reel and carousel automation). Extracted from the former
 * `/admin/publications` page without changing a request.
 */
export function usePublicationsWorkspace(accessToken: string) {
  const enabled = Boolean(accessToken);

  const statusQuery = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });

  const postsQuery = useQuery({
    queryKey: ["admin", "social-posts", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/social-posts", postsResponseSchema, {}, "Les publications n’ont pas pu être chargées."),
  });
  const refetchPosts = postsQuery.refetch;

  const hasPublishing = Boolean(postsQuery.data?.posts.some((post) => post.status === "publishing" || post.status === "scheduled"));
  useEffect(() => {
    if (!hasPublishing) return;
    const timer = window.setInterval(refetchPosts, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasPublishing, refetchPosts]);

  const activityQuery = useQuery({
    queryKey: ["admin", "render-activity", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/render-activity", renderActivityResponseSchema, {}, "Les rendus en cours n’ont pas pu être lus."),
  });
  const renders = useMemo(() => activityQuery.data?.jobs ?? [], [activityQuery.data?.jobs]);
  const hasActiveRender = renders.some((job) => job.status === "active");
  const pollActivity = activityQuery.refetch;
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(pollActivity, hasActiveRender ? ACTIVE_RENDER_POLL_MS : IDLE_RENDER_POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, hasActiveRender, pollActivity]);
  const renderById = useMemo(() => new Map<string, RenderActivityView>(renders.map((job) => [job.id, job])), [renders]);

  const automationQuery = useQuery({
    queryKey: ["admin", "reel-automation", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/reel-automation", reelAutomationResponseSchema, {}, "L’automatisation n’a pas pu être lue."),
  });
  const refetchAutomation = automationQuery.refetch;
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);
  const automationMutation = useMutation({
    mutationFn: (request: { url: string; method: string; body: unknown }) =>
      adminFetch(accessToken, request.url, reelAutomationResponseSchema.partial(), { method: request.method, body: request.body }, "L’automatisation n’a pas pu être modifiée."),
    onSuccess: () => {
      setAutomationMessage(null);
      refetchAutomation();
    },
    onError: (error) => setAutomationMessage(error instanceof Error ? error.message : "L’automatisation n’a pas pu être modifiée."),
  });

  const carouselQuery = useQuery({
    queryKey: ["admin", "carousel-automation", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken, "/api/admin/carousel-automation", carouselAutomationResponseSchema, {}, "Les carrousels n’ont pas pu être lus."),
  });
  const refetchCarousels = carouselQuery.refetch;
  const refetchActivity = activityQuery.refetch;
  const [carouselMessage, setCarouselMessage] = useState<string | null>(null);
  const carouselMutation = useMutation({
    mutationFn: (request: { url: string; method: string; body: unknown }) =>
      adminFetch(accessToken, request.url, z.object({ message: z.string().optional() }).passthrough(), { method: request.method, body: request.body }, "Les carrousels n’ont pas pu être modifiés."),
    onSuccess: (result) => {
      setCarouselMessage(typeof result.message === "string" ? result.message : null);
      refetchCarousels();
      // A launched render shows up at once in « Rendus en cours ».
      refetchActivity();
      // Turning a series on or off moves the reels off (or back onto) its weekday.
      refetchAutomation();
    },
    onError: (error) => setCarouselMessage(error instanceof Error ? error.message : "Les carrousels n’ont pas pu être modifiés."),
  });

  // When a render finishes, its draft (and the plan status) appear without a manual refresh.
  const activeIds = renders.filter((job) => job.status === "active").map((job) => job.id).join(",");
  const previousActive = useRef(activeIds);
  useEffect(() => {
    if (previousActive.current && previousActive.current !== activeIds) {
      refetchPosts();
      refetchAutomation();
      refetchCarousels();
    }
    previousActive.current = activeIds;
  }, [activeIds, refetchPosts, refetchAutomation, refetchCarousels]);

  const publishTime = automationQuery.data?.settings.publishTime ?? "18:00";
  const plannedEntries = useMemo(
    () => [
      ...(automationQuery.data ? toPlannedCalendarEntries(automationQuery.data.items, publishTime) : []),
      ...(carouselQuery.data ? toPlannedCarouselEntries(carouselQuery.data.items, publishTime) : []),
    ],
    [automationQuery.data, carouselQuery.data, publishTime],
  );

  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data?.posts]);
  const onChanged = useCallback(() => {
    refetchPosts();
  }, [refetchPosts]);

  return {
    accessToken,
    statusQuery,
    postsQuery,
    activityQuery,
    automationQuery,
    automationMutation,
    automationMessage,
    carouselQuery,
    carouselMutation,
    carouselMessage,
    posts,
    renders,
    renderById,
    plannedEntries,
    publishTime,
    onChanged,
    refetchPosts,
    dryRunMode: statusQuery.data?.dryRun ?? true,
    activityError: activityQuery.error instanceof Error ? activityQuery.error.message : null,
  };
}

export type PublicationsWorkspace = ReturnType<typeof usePublicationsWorkspace>;

/** « Nouveau brouillon » of the Reels tab: the chosen finished render and its draft mutation. */
export function useNewReelDraft(workspace: PublicationsWorkspace) {
  const { accessToken, postsQuery, refetchPosts } = workspace;
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const videos = useMemo(() => postsQuery.data?.videos ?? [], [postsQuery.data?.videos]);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;
  const draftInitialValues = useMemo(
    () => toCaptionFormValues(selectedVideo?.defaultCaption ?? "", selectedVideo?.defaultHashtags ?? [], selectedVideo?.defaultCoverText ?? null),
    [selectedVideo],
  );
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const duplicateWarning = selectedVideo?.publication
    ? `Cette vidéo est déjà ${describePublicationMark(selectedVideo.publication)}.`
    : selectedVideo?.racePublication && selectedVideo.racePublication.state === "published"
      ? `Cette course a déjà une vidéo ${describePublicationMark(selectedVideo.racePublication)}.`
      : null;

  const createDraft = useMutation({
    mutationFn: (payload: CaptionPayload) =>
      adminFetch(accessToken, "/api/admin/social-posts", postResponseSchema, { method: "POST", body: { videoJobId: selectedVideoId, ...payload } }, "Le brouillon n’a pas pu être créé."),
    onSuccess: () => {
      setSelectedVideoId("");
      setCreateMessage("Brouillon créé : il est dans « Reels à publier » ci-dessous. Rien n’est publié tant que tu ne cliques pas sur « Publier maintenant » ou « Programmer ».");
      refetchPosts();
    },
    onError: (error) => setCreateMessage(error instanceof Error ? error.message : "Le brouillon n’a pas pu être créé."),
  });

  return { videos, selectedVideoId, setSelectedVideoId, selectedVideo, draftInitialValues, createMessage, setCreateMessage, duplicateWarning, createDraft };
}
