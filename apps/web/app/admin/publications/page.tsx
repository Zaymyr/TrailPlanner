"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { describePublicationMark, formatParisDateTime, type PublicSocialPost } from "../../../lib/social-posts";
import { AdminWorkspaceNav } from "../components/AdminWorkspaceNav";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { CaptionForm, toCaptionFormValues, type CaptionPayload } from "./CaptionForm";
import { InstagramStatusCard } from "./InstagramStatusCard";
import { PostCard } from "./PostCard";
import { PublicationCalendar } from "./PublicationCalendar";
import { AutomationCard } from "./AutomationCard";
import { toPlannedCalendarEntries } from "./automation-labels";
import { adminFetch, instagramStatusSchema, postResponseSchema, postsResponseSchema, reelAutomationResponseSchema } from "./publications-api";

/** While a post is publishing, the list refreshes on this rhythm. */
const LIST_POLL_MS = 30_000;

type ListFilter = "todo" | "published" | "all";

const FILTERS: Array<{ key: ListFilter; label: string; matches: (post: PublicSocialPost) => boolean }> = [
  { key: "todo", label: "À traiter", matches: (post) => post.status !== "published" },
  { key: "published", label: "Publiées", matches: (post) => post.status === "published" },
  { key: "all", label: "Toutes", matches: () => true },
];

const shellClass =
  "mx-auto flex max-w-6xl flex-col gap-6 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70";

function PublicationsContent() {
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const accessToken = session?.accessToken ?? null;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin");

  const statusQuery = useQuery({
    queryKey: ["admin", "instagram-status", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: () => adminFetch(accessToken as string, "/api/admin/instagram", instagramStatusSchema, {}, "Le compte Instagram n’a pas pu être lu."),
  });

  const postsQuery = useQuery({
    queryKey: ["admin", "social-posts", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: () => adminFetch(accessToken as string, "/api/admin/social-posts", postsResponseSchema, {}, "Les publications n’ont pas pu être chargées."),
  });
  const refetchPosts = postsQuery.refetch;

  const hasPublishing = Boolean(postsQuery.data?.posts.some((post) => post.status === "publishing" || post.status === "scheduled"));
  useEffect(() => {
    if (!hasPublishing) return;
    const timer = window.setInterval(refetchPosts, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [hasPublishing, refetchPosts]);

  const [selectedVideoId, setSelectedVideoId] = useState("");
  const videos = useMemo(() => postsQuery.data?.videos ?? [], [postsQuery.data?.videos]);
  const selectedVideo = videos.find((video) => video.id === selectedVideoId) ?? null;
  const draftInitialValues = useMemo(
    () => toCaptionFormValues(selectedVideo?.defaultCaption ?? "", selectedVideo?.defaultHashtags ?? [], selectedVideo?.defaultCoverText ?? null),
    [selectedVideo],
  );
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<ListFilter>("todo");
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
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
      setCreateMessage("Brouillon créé. Rien n’est publié tant que tu ne cliques pas sur « Publier maintenant » ou « Programmer ».");
      refetchPosts();
    },
    onError: (error) => setCreateMessage(error instanceof Error ? error.message : "Le brouillon n’a pas pu être créé."),
  });

  const onChanged = useCallback(() => {
    refetchPosts();
  }, [refetchPosts]);

  const automationQuery = useQuery({
    queryKey: ["admin", "reel-automation", accessToken],
    enabled: Boolean(accessToken && isAdmin),
    queryFn: () => adminFetch(accessToken as string, "/api/admin/reel-automation", reelAutomationResponseSchema, {}, "L’automatisation n’a pas pu être lue."),
  });
  const refetchAutomation = automationQuery.refetch;
  const [automationMessage, setAutomationMessage] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const automationMutation = useMutation({
    mutationFn: (request: { url: string; method: string; body: unknown }) =>
      adminFetch(accessToken as string, request.url, reelAutomationResponseSchema.partial(), { method: request.method, body: request.body }, "L’automatisation n’a pas pu être modifiée."),
    onSuccess: () => {
      setAutomationMessage(null);
      refetchAutomation();
    },
    onError: (error) => setAutomationMessage(error instanceof Error ? error.message : "L’automatisation n’a pas pu être modifiée."),
  });
  const plannedEntries = useMemo(
    () => (automationQuery.data ? toPlannedCalendarEntries(automationQuery.data.items, automationQuery.data.settings.publishTime) : []),
    [automationQuery.data],
  );

  if (sessionLoading) {
    return <div className={shellClass}><p className="text-sm text-muted-foreground">Vérification de la session…</p></div>;
  }
  if (!accessToken || !isAdmin) {
    return <div className={shellClass}><p className="text-sm text-amber-700 dark:text-amber-200">Accès réservé aux administrateurs.</p></div>;
  }

  const posts = postsQuery.data?.posts ?? [];
  const visiblePosts = posts.filter(FILTERS.find((item) => item.key === filter)?.matches ?? (() => true));
  const dryRunMode = statusQuery.data?.dryRun ?? true;

  return (
    <div className={shellClass}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground dark:text-slate-50">Publications</h1>
          <p className="text-sm text-muted-foreground dark:text-slate-300">
            Reels Instagram à partir des rendus 3D terminés. Chaque publication part sur une action explicite.
          </p>
        </div>
        <AdminWorkspaceNav current="publish" />
      </div>

      <InstagramStatusCard
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error instanceof Error ? statusQuery.error.message : null}
      />

      <div className="grid gap-4 lg:grid-cols-2">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Nouveau brouillon</CardTitle>
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

      <PublicationCalendar
        posts={posts}
        planned={plannedEntries}
        onSelectPlanned={(itemId) => {
          setHighlightedItemId(itemId);
          window.setTimeout(() => document.getElementById(`automation-${itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}
        onSelect={(postId) => {
          setFilter("all");
          setHighlightedPostId(postId);
          window.setTimeout(() => document.getElementById(`post-${postId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        }}
      />
      </div>

      <AutomationCard
        data={automationQuery.data}
        isLoading={automationQuery.isLoading}
        error={automationMessage ?? (automationQuery.error instanceof Error ? automationQuery.error.message : null)}
        busy={automationMutation.isPending}
        highlightedItemId={highlightedItemId}
        onSettings={(patch) => automationMutation.mutate({ url: "/api/admin/reel-automation", method: "PATCH", body: patch })}
        onItemAction={(itemId, action) => automationMutation.mutate({ url: `/api/admin/reel-automation/items/${itemId}`, method: "PATCH", body: { action } })}
        onRefresh={() => automationMutation.mutate({ url: "/api/admin/reel-automation", method: "POST", body: { action: "refresh" } })}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Publications</h2>
          <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Filtrer les publications">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`rounded-full px-3 py-1 text-sm ${filter === item.key ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                {item.label} ({posts.filter(item.matches).length})
              </button>
            ))}
          </div>
        </div>
        {postsQuery.isLoading && !postsQuery.data ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {postsQuery.error instanceof Error ? <p className="text-sm text-red-600 dark:text-red-300">{postsQuery.error.message}</p> : null}
        {postsQuery.data && visiblePosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{posts.length === 0 ? "Aucune publication pour l’instant." : "Rien dans ce filtre."}</p>
        ) : null}
        {visiblePosts.map((post) => (
          <div key={post.id} id={`post-${post.id}`} className={highlightedPostId === post.id ? "rounded-lg ring-2 ring-brand" : undefined}>
            <PostCard accessToken={accessToken} post={post} dryRunMode={dryRunMode} onChanged={onChanged} />
          </div>
        ))}
      </section>
    </div>
  );
}

export default function PublicationsPage() {
  return <PublicationsContent />;
}
