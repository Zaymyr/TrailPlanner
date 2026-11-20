"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { TabsList } from "../../../components/ui/tabs";
import { describePublicationMark, formatParisDateTime, type PublicSocialPost } from "../../../lib/social-posts";
import { AdminWorkspaceNav } from "../components/AdminWorkspaceNav";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { ReelAutomationSettings, ReelPlanList } from "./AutomationCard";
import { toPlannedCalendarEntries, toPlannedCarouselEntries } from "./automation-labels";
import { CaptionForm, toCaptionFormValues, type CaptionPayload } from "./CaptionForm";
import { CarouselGenerateNow, CarouselPlanList, CarouselSeriesSettings } from "./CarouselAutomationSection";
import { InstagramStatusCard } from "./InstagramStatusCard";
import { PostCard } from "./PostCard";
import { PublicationCalendar } from "./PublicationCalendar";
import { buildAttentionList, PUBLICATION_TABS, readDismissedAlerts, readTabFromLocation, tabForPost, writeDismissedAlerts, type AttentionEntry, type PublicationTab } from "./publication-tabs";
import {
  adminFetch,
  carouselAutomationResponseSchema,
  instagramStatusSchema,
  postResponseSchema,
  postsResponseSchema,
  raceDataGapsResponseSchema,
  reelAutomationResponseSchema,
  renderActivityResponseSchema,
  type RenderActivityView,
} from "./publications-api";
import { isReelReachable, RaceDataGapsCard } from "./RaceDataGapsCard";
import { RenderActivityCard } from "./RenderActivityCard";

/** While a post is publishing, the list refreshes on this rhythm. */
const LIST_POLL_MS = 30_000;
/** While a render runs, its stage refreshes on this rhythm; otherwise once a minute. */
const ACTIVE_RENDER_POLL_MS = 5_000;
const IDLE_RENDER_POLL_MS = 60_000;

type PublishedFilter = "all" | "reel" | "carousel";

const shellClass =
  "mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70";

const ATTENTION_TONE: Record<AttentionEntry["tone"], string> = {
  active: "bg-sky-500",
  error: "bg-red-500",
  todo: "bg-amber-500",
  scheduled: "bg-brand",
};

function PostList({ posts, accessToken, dryRunMode, highlightedPostId, onChanged, emptyText }: {
  posts: PublicSocialPost[];
  accessToken: string;
  dryRunMode: boolean;
  highlightedPostId: string | null;
  onChanged: () => void;
  emptyText: string;
}) {
  if (posts.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <div key={post.id} id={`post-${post.id}`} className={highlightedPostId === post.id ? "rounded-lg ring-2 ring-brand" : undefined}>
          <PostCard accessToken={accessToken} post={post} dryRunMode={dryRunMode} onChanged={onChanged} />
        </div>
      ))}
    </div>
  );
}

function PublicationsContent() {
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const accessToken = session?.accessToken ?? null;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");
  const enabled = Boolean(accessToken && isAdmin);

  const [tab, setTabState] = useState<PublicationTab>("agenda");
  useEffect(() => {
    setTabState(readTabFromLocation(window.location.search));
  }, []);
  const setTab = useCallback((next: PublicationTab) => {
    setTabState(next);
    const url = new URL(window.location.href);
    url.searchParams.set("onglet", next);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const statusQuery = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });

  const postsQuery = useQuery({
    queryKey: ["admin", "social-posts", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/social-posts", postsResponseSchema, {}, "Les publications n’ont pas pu être chargées."),
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
    queryFn: () => adminFetch(accessToken as string, "/api/admin/render-activity", renderActivityResponseSchema, {}, "Les rendus en cours n’ont pas pu être lus."),
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

  const [selectedVideoId, setSelectedVideoId] = useState("");
  const videos = useMemo(() => postsQuery.data?.videos ?? [], [postsQuery.data?.videos]);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;
  const draftInitialValues = useMemo(
    () => toCaptionFormValues(selectedVideo?.defaultCaption ?? "", selectedVideo?.defaultHashtags ?? [], selectedVideo?.defaultCoverText ?? null),
    [selectedVideo],
  );
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>("all");
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const duplicateWarning = selectedVideo?.publication
    ? `Cette vidéo est déjà ${describePublicationMark(selectedVideo.publication)}.`
    : selectedVideo?.racePublication && selectedVideo.racePublication.state === "published"
      ? `Cette course a déjà une vidéo ${describePublicationMark(selectedVideo.racePublication)}.`
      : null;

  const createDraft = useMutation({
    mutationFn: (payload: CaptionPayload) =>
      adminFetch(accessToken as string, "/api/admin/social-posts", postResponseSchema, {
        method: "POST",
        body: { videoJobId: selectedVideoId, ...payload },
      }, "Le brouillon n’a pas pu être créé."),
    onSuccess: () => {
      setSelectedVideoId("");
      setCreateMessage("Brouillon créé : il est dans « Reels à publier » ci-dessous. Rien n’est publié tant que tu ne cliques pas sur « Publier maintenant » ou « Programmer ».");
      refetchPosts();
    },
    onError: (error) => setCreateMessage(error instanceof Error ? error.message : "Le brouillon n’a pas pu être créé."),
  });

  const onChanged = useCallback(() => {
    refetchPosts();
  }, [refetchPosts]);

  // Read once per visit of the tab: the catalog changes slowly.
  const gapsQuery = useQuery({
    queryKey: ["admin", "race-data-gaps", accessToken],
    enabled: enabled && tab === "gpx",
    staleTime: 5 * 60_000,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/race-data-gaps", raceDataGapsResponseSchema, {}, "La liste des données manquantes n’a pas pu être lue."),
  });

  const automationQuery = useQuery({
    queryKey: ["admin", "reel-automation", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/reel-automation", reelAutomationResponseSchema, {}, "L’automatisation n’a pas pu être lue."),
  });
  const refetchAutomation = automationQuery.refetch;
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);
  const automationMutation = useMutation({
    mutationFn: (request: { url: string; method: string; body: unknown }) =>
      adminFetch(accessToken as string, request.url, reelAutomationResponseSchema.partial(), { method: request.method, body: request.body }, "L’automatisation n’a pas pu être modifiée."),
    onSuccess: () => {
      setAutomationMessage(null);
      refetchAutomation();
    },
    onError: (error) => setAutomationMessage(error instanceof Error ? error.message : "L’automatisation n’a pas pu être modifiée."),
  });
  const carouselQuery = useQuery({
    queryKey: ["admin", "carousel-automation", accessToken],
    enabled,
    queryFn: () => adminFetch(accessToken as string, "/api/admin/carousel-automation", carouselAutomationResponseSchema, {}, "Les carrousels n’ont pas pu être lus."),
  });
  const refetchCarousels = carouselQuery.refetch;
  const refetchActivity = activityQuery.refetch;
  const [carouselMessage, setCarouselMessage] = useState<string | null>(null);
  const carouselMutation = useMutation({
    mutationFn: (request: { url: string; method: string; body: unknown }) =>
      adminFetch(accessToken as string, request.url, z.object({ message: z.string().optional() }).passthrough(), { method: request.method, body: request.body }, "Les carrousels n’ont pas pu être modifiés."),
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
  const plannedEntries = useMemo(() => [
    ...(automationQuery.data ? toPlannedCalendarEntries(automationQuery.data.items, publishTime) : []),
    ...(carouselQuery.data ? toPlannedCarouselEntries(carouselQuery.data.items, publishTime) : []),
  ], [automationQuery.data, carouselQuery.data, publishTime]);

  const posts = useMemo(() => postsQuery.data?.posts ?? [], [postsQuery.data?.posts]);
  const allAlerts = useMemo(() => buildAttentionList({ posts, renders, nowMs: Date.now() }), [posts, renders]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [showDismissed, setShowDismissed] = useState(false);
  useEffect(() => {
    setDismissed(readDismissedAlerts());
  }, []);
  const attention = useMemo(() => allAlerts.filter((entry) => showDismissed || !dismissed.has(entry.dismissKey)), [allAlerts, dismissed, showDismissed]);
  const hiddenCount = allAlerts.filter((entry) => dismissed.has(entry.dismissKey)).length;
  const dismissAlert = (entry: AttentionEntry) => setDismissed((current) => writeDismissedAlerts(new Set([...current, entry.dismissKey]), allAlerts));
  const restoreAlert = (entry: AttentionEntry) => setDismissed((current) => writeDismissedAlerts(new Set([...current].filter((key) => key !== entry.dismissKey)), allAlerts));

  if (sessionLoading) {
    return <div className={shellClass}><p className="text-sm text-muted-foreground">Vérification de la session…</p></div>;
  }
  if (!accessToken || !isAdmin) {
    return <div className={shellClass}><p className="text-sm text-amber-700 dark:text-amber-200">Accès réservé aux administrateurs.</p></div>;
  }

  const dryRunMode = statusQuery.data?.dryRun ?? true;
  const nowMs = Date.now();
  const reelsToPublish = posts.filter((post) => post.mediaType !== "carousel" && post.status !== "published");
  const carouselsToPublish = posts.filter((post) => post.mediaType === "carousel" && post.status !== "published");
  const published = posts.filter((post) => post.status === "published");
  const publishedVisible = published.filter((post) => publishedFilter === "all" || (publishedFilter === "carousel" ? post.mediaType === "carousel" : post.mediaType !== "carousel"));
  const reelRenders = renders.filter((job) => job.kind === "reel");
  const carouselRenders = renders.filter((job) => job.kind === "carousel");
  const activityError = activityQuery.error instanceof Error ? activityQuery.error.message : null;
  const countLabel = (label: string, count: number) => (count ? `${label} · ${count}` : label);

  const goTo = (target: { tab: PublicationTab; postId?: string; itemId?: string }) => {
    setTab(target.tab);
    setHighlightedPostId(target.postId ?? null);
    setHighlightedItemId(target.itemId ?? null);
    const anchor = target.postId ? `post-${target.postId}` : target.itemId ? `automation-${target.itemId}` : null;
    if (anchor) window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  };

  const tabs = PUBLICATION_TABS.map((item) => ({
    id: item.id,
    label: item.id === "agenda" ? countLabel(item.label, allAlerts.filter((entry) => entry.tone !== "scheduled" && !dismissed.has(entry.dismissKey)).length)
      : item.id === "reels" ? countLabel(item.label, reelsToPublish.length)
        : item.id === "carousels" ? countLabel(item.label, carouselsToPublish.length)
          : item.id === "gpx" ? countLabel(item.label, (gapsQuery.data?.gaps ?? []).filter(isReelReachable).length)
          : item.id === "published" ? countLabel(item.label, published.length)
            : item.label,
  }));

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">Publications</h1>
            {statusQuery.data ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dryRunMode ? "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"}`}>
                {dryRunMode ? "Simulation : rien n’atteint Instagram" : "En direct sur Instagram"}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground dark:text-slate-300">Reels et carrousels Instagram : préparer, contrôler, publier.</p>
        </div>
        <AdminWorkspaceNav current="publish" />
      </div>

      <div className="-mx-1 overflow-x-auto px-1">
        <div className="min-w-max">
          <TabsList tabs={tabs} activeTab={tab} onTabChange={(id) => setTab(id as PublicationTab)} />
        </div>
      </div>

      {tab === "agenda" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">À surveiller</CardTitle>
              <CardDescription>
                Rendus en cours, échecs, brouillons à relire et prochaines publications. « Masquer » cache une alerte traitée ; elle revient si son état change.
                {hiddenCount ? (
                  <button type="button" className="ml-1 text-brand underline-offset-4 hover:underline" onClick={() => setShowDismissed((value) => !value)}>
                    {showDismissed ? "Cacher les alertes masquées" : `Voir les ${hiddenCount} masquée${hiddenCount > 1 ? "s" : ""}`}
                  </button>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              {attention.length === 0 ? <p className="text-muted-foreground">Rien à signaler.</p> : (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {attention.map((entry) => (
                    <li key={entry.key} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <span aria-hidden="true" className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${ATTENTION_TONE[entry.tone]} ${entry.tone === "active" ? "animate-pulse" : ""}`} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{entry.title}</p>
                          <p className="text-xs text-muted-foreground">{entry.detail}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => goTo(entry.target)}>Voir</Button>
                        {dismissed.has(entry.dismissKey) ? (
                          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => restoreAlert(entry)}>Réafficher</Button>
                        ) : entry.tone === "active" ? null : (
                          <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => dismissAlert(entry)}>Masquer</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <PublicationCalendar
            posts={posts}
            planned={plannedEntries}
            onSelectPlanned={(itemId) => {
              const isCarousel = carouselQuery.data?.items.some((item) => item.id === itemId);
              goTo({ tab: isCarousel ? "carousels" : "reels", itemId });
            }}
            onSelect={(postId) => {
              const post = posts.find((item) => item.id === postId);
              if (post) goTo({ tab: tabForPost(post), postId });
            }}
          />
        </div>
      ) : null}

      {tab === "reels" ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Nouveau brouillon</CardTitle>
                <CardDescription>Choisis un rendu terminé (conservé 30 jours), puis rédige la description.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="publication-video">Vidéo</Label>
                  <select
                    id="publication-video"
                    className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                    value={selectedVideoId}
                    onChange={(event) => {
                      setSelectedVideoId(event.target.value);
                      setCreateMessage(null);
                    }}
                  >
                    <option value="">{videos.length ? "Choisir un rendu…" : "Aucun rendu terminé récent"}</option>
                    {videos.map((video) => (
                      <option key={video.id} value={video.id}>
                        {video.publication ? "✓ " : ""}{video.raceTitle} · rendu le {formatParisDateTime(video.finishedAt)}
                        {video.publication ? ` · ${describePublicationMark(video.publication)}` : ""}
                      </option>
                    ))}
                  </select>
                  {duplicateWarning ? (
                    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      {duplicateWarning} Vérifie avant d’en créer un autre : Instagram n’aime pas les doublons.
                    </p>
                  ) : null}
                  {selectedVideo?.latestPublishAt ? (
                    <p className="text-xs text-muted-foreground">À publier avant le {formatParisDateTime(selectedVideo.latestPublishAt)} (heure de Paris).</p>
                  ) : null}
                </div>
                {selectedVideo ? (
                  <CaptionForm
                    idPrefix="new-publication"
                    initialValues={draftInitialValues}
                    submitLabel="Créer le brouillon"
                    isSubmitting={createDraft.isPending}
                    onSubmit={(payload) => {
                      if (duplicateWarning && !window.confirm(`${duplicateWarning} Créer quand même un nouveau brouillon ?`)) return;
                      createDraft.mutate(payload);
                    }}
                  />
                ) : null}
                {createMessage ? <p className="text-muted-foreground">{createMessage}</p> : null}
              </CardContent>
            </Card>
            <RenderActivityCard jobs={reelRenders} title="Rendus vidéo" emptyText="Aucun rendu de reel ces dernières 24 h." error={activityError} nowMs={nowMs} />
          </div>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">Reels à publier</h2>
            {postsQuery.isLoading && !postsQuery.data ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
            {postsQuery.error instanceof Error ? <p className="text-sm text-red-600 dark:text-red-300">{postsQuery.error.message}</p> : null}
            {postsQuery.data ? (
              <PostList posts={reelsToPublish} accessToken={accessToken} dryRunMode={dryRunMode} highlightedPostId={highlightedPostId} onChanged={onChanged} emptyText="Aucun reel en attente : brouillons, programmés et échecs apparaissent ici." />
            ) : null}
          </section>
          <ReelPlanList
            data={automationQuery.data}
            busy={automationMutation.isPending}
            highlightedItemId={highlightedItemId}
            renders={renderById}
            onItemAction={(itemId, action) => automationMutation.mutate({ url: `/api/admin/reel-automation/items/${itemId}`, method: "PATCH", body: { action } })}
            onRefresh={() => automationMutation.mutate({ url: "/api/admin/reel-automation", method: "POST", body: { action: "refresh" } })}
          />
          {automationMessage ? <p className="text-sm text-red-600 dark:text-red-300">{automationMessage}</p> : null}
        </div>
      ) : null}

      {tab === "carousels" ? (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <CarouselGenerateNow
              data={carouselQuery.data}
              busy={carouselMutation.isPending}
              message={carouselMessage ?? (carouselQuery.error instanceof Error ? carouselQuery.error.message : null)}
              onGenerate={(request) => carouselMutation.mutate({ url: "/api/admin/carousel-automation", method: "POST", body: { action: "generate", ...request } })}
            />
            <RenderActivityCard jobs={carouselRenders} title="Rendus des images" emptyText="Aucun rendu de carrousel ces dernières 24 h." error={activityError} nowMs={nowMs} />
          </div>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">Carrousels à publier</h2>
            {postsQuery.data ? (
              <PostList posts={carouselsToPublish} accessToken={accessToken} dryRunMode={dryRunMode} highlightedPostId={highlightedPostId} onChanged={onChanged} emptyText="Aucun carrousel en attente." />
            ) : null}
          </section>
          <CarouselPlanList
            data={carouselQuery.data}
            publishTime={publishTime}
            busy={carouselMutation.isPending}
            highlightedItemId={highlightedItemId}
            renders={renderById}
            onItemAction={(itemId, action) => carouselMutation.mutate({ url: `/api/admin/carousel-automation/items/${itemId}`, method: "PATCH", body: { action } })}
            onRefresh={() => carouselMutation.mutate({ url: "/api/admin/carousel-automation", method: "POST", body: { action: "refresh" } })}
          />
        </div>
      ) : null}

      {tab === "gpx" ? (
        <RaceDataGapsCard
          gaps={gapsQuery.data?.gaps ?? []}
          leadDays={gapsQuery.data?.leadDays ?? null}
          isLoading={gapsQuery.isLoading}
          error={gapsQuery.error instanceof Error ? gapsQuery.error.message : null}
        />
      ) : null}

      {tab === "published" ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Publiées</h2>
            <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Filtrer les publications">
              {([["all", "Toutes"], ["reel", "Reels"], ["carousel", "Carrousels"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={publishedFilter === key}
                  onClick={() => setPublishedFilter(key)}
                  className={`rounded-full px-3 py-1 text-sm ${publishedFilter === key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {postsQuery.data ? (
            <PostList posts={publishedVisible} accessToken={accessToken} dryRunMode={dryRunMode} highlightedPostId={highlightedPostId} onChanged={onChanged} emptyText="Rien de publié dans ce filtre." />
          ) : null}
        </section>
      ) : null}

      {tab === "settings" ? (
        <div className="flex flex-col gap-4">
          <InstagramStatusCard
            status={statusQuery.data}
            isLoading={statusQuery.isLoading}
            error={statusQuery.error instanceof Error ? statusQuery.error.message : null}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <ReelAutomationSettings
              data={automationQuery.data}
              isLoading={automationQuery.isLoading}
              error={automationMessage ?? (automationQuery.error instanceof Error ? automationQuery.error.message : null)}
              busy={automationMutation.isPending}
              onSettings={(patch) => automationMutation.mutate({ url: "/api/admin/reel-automation", method: "PATCH", body: patch })}
            />
            <CarouselSeriesSettings
              data={carouselQuery.data}
              publishTime={publishTime}
              busy={carouselMutation.isPending}
              message={carouselMessage}
              onSeries={(patch) => carouselMutation.mutate({ url: "/api/admin/carousel-automation", method: "PATCH", body: patch })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PublicationsPage() {
  return <PublicationsContent />;
}
