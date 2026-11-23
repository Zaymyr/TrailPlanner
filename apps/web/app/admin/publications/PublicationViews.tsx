"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { describePublicationMark, formatParisDateTime, type PublicSocialPost } from "../../../lib/social-posts";
import { ReelAutomationSettings, ReelPlanList } from "./AutomationCard";
import { CaptionForm } from "./CaptionForm";
import { CarouselGenerateNow, CarouselPlanList, CarouselSeriesSettings } from "./CarouselAutomationSection";
import { InstagramStatusCard } from "./InstagramStatusCard";
import { PostCard } from "./PostCard";
import { adminFetch, flyoverOrdersResponseSchema } from "./publications-api";
import { toPlannedFlyoverEntries } from "./automation-labels";
import { PublicationCalendar } from "./PublicationCalendar";
import { buildAttentionList, publicationTargetHref, readDismissedAlerts, tabForPost, writeDismissedAlerts, type AttentionEntry } from "./publication-tabs";
import { RenderActivityCard } from "./RenderActivityCard";
import { useNewReelDraft, type PublicationsWorkspace } from "./usePublicationsWorkspace";

/**
 * Sections of the former `/admin/publications` page, mounted by the console pages (Calendrier,
 * Publications, Automatisations, Intégrations); the render lists are summaries linking to the render queue. Same markup and actions as before; only the
 * cross-tab « Voir » became a link to the console page.
 */

const ATTENTION_TONE: Record<AttentionEntry["tone"], string> = {
  active: "bg-sky-500",
  error: "bg-red-500",
  todo: "bg-amber-500",
  scheduled: "bg-brand",
};

type Highlight = { postId: string | null; itemId: string | null };

function PostList({ posts, workspace, highlightedPostId, emptyText }: { posts: PublicSocialPost[]; workspace: PublicationsWorkspace; highlightedPostId: string | null; emptyText: string }) {
  if (posts.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="flex flex-col gap-3">
      {posts.map((post) => (
        <div key={post.id} id={`post-${post.id}`} className={highlightedPostId === post.id ? "rounded-lg ring-2 ring-brand" : undefined}>
          <PostCard accessToken={workspace.accessToken} post={post} dryRunMode={workspace.dryRunMode} onChanged={workspace.onChanged} />
        </div>
      ))}
    </div>
  );
}

/** Alerts not dismissed in this browser (« Masquer »), for the agenda and its count. */
export function useAttentionAlerts(workspace: PublicationsWorkspace) {
  const { posts, renders } = workspace;
  const allAlerts = useMemo(() => buildAttentionList({ posts, renders, nowMs: Date.now() }), [posts, renders]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setDismissed(readDismissedAlerts());
  }, []);
  return {
    allAlerts,
    dismissed,
    pendingCount: allAlerts.filter((entry) => entry.tone !== "scheduled" && !dismissed.has(entry.dismissKey)).length,
    dismiss: (entry: AttentionEntry) => setDismissed((current) => writeDismissedAlerts(new Set([...current, entry.dismissKey]), allAlerts)),
    restore: (entry: AttentionEntry) => setDismissed((current) => writeDismissedAlerts(new Set([...current].filter((key) => key !== entry.dismissKey)), allAlerts)),
  };
}

/** Calendrier: « À surveiller » next to the publication calendar. */
export function PublicationsAgenda({ workspace }: { workspace: PublicationsWorkspace }) {
  const router = useRouter();
  const alerts = useAttentionAlerts(workspace);
  const [showDismissed, setShowDismissed] = useState(false);
  const attention = alerts.allAlerts.filter((entry) => showDismissed || !alerts.dismissed.has(entry.dismissKey));
  const hiddenCount = alerts.allAlerts.filter((entry) => alerts.dismissed.has(entry.dismissKey)).length;
  const goTo = (target: AttentionEntry["target"] & { itemId?: string }) => router.push(publicationTargetHref(target) as Route);
  const { posts } = workspace;
  // The same cache entry as the « Vidéos de survol » page: paid collaborations waiting for their slot.
  const flyoverQuery = useQuery({
    queryKey: ["admin", "flyover-orders", workspace.accessToken],
    enabled: Boolean(workspace.accessToken),
    queryFn: () => adminFetch(workspace.accessToken, "/api/admin/flyover-orders", flyoverOrdersResponseSchema, {}, "Les commandes de survol n’ont pas pu être chargées."),
  });
  const planned = useMemo(
    () => [...workspace.plannedEntries, ...toPlannedFlyoverEntries(flyoverQuery.data?.orders ?? [], posts)],
    [workspace.plannedEntries, flyoverQuery.data, posts],
  );

  return (
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
          {attention.length === 0 ? (
            <p className="text-muted-foreground">Rien à signaler.</p>
          ) : (
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
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => goTo(entry.target)}>
                      Voir
                    </Button>
                    {alerts.dismissed.has(entry.dismissKey) ? (
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => alerts.restore(entry)}>
                        Réafficher
                      </Button>
                    ) : entry.tone === "active" ? null : (
                      <Button type="button" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground" onClick={() => alerts.dismiss(entry)}>
                        Masquer
                      </Button>
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
        planned={planned}
        onSelectPlanned={(entry) => {
          if (entry.kind === "flyover") goTo({ tab: "flyovers", orderId: entry.id });
          else goTo({ tab: entry.kind === "carousel" ? "carousels" : "reels", itemId: entry.id });
        }}
        onSelect={(postId) => {
          const post = posts.find((item) => item.id === postId);
          if (post) goTo({ tab: tabForPost(post), postId });
        }}
      />
    </div>
  );
}

/** Reels: new draft from a finished render, render activity, reels to publish, automatic plan. */
export function ReelsPanel({ workspace, highlight }: { workspace: PublicationsWorkspace; highlight: Highlight }) {
  const draft = useNewReelDraft(workspace);
  const { postsQuery, automationQuery, automationMutation, automationMessage, renders, renderById, posts } = workspace;
  const reelsToPublish = posts.filter((post) => post.mediaType !== "carousel" && post.status !== "published");
  const reelRenders = renders.filter((job) => job.kind === "reel");

  return (
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
                value={draft.selectedVideoId}
                onChange={(event) => {
                  draft.setSelectedVideoId(event.target.value);
                  draft.setCreateMessage(null);
                }}
              >
                <option value="">{draft.videos.length ? "Choisir un rendu…" : "Aucun rendu terminé récent"}</option>
                {draft.videos.map((video) => (
                  <option key={video.id} value={video.id}>
                    {video.publication ? "✓ " : ""}
                    {video.raceTitle} · rendu le {formatParisDateTime(video.finishedAt)}
                    {video.publication ? ` · ${describePublicationMark(video.publication)}` : ""}
                  </option>
                ))}
              </select>
              {draft.duplicateWarning ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  {draft.duplicateWarning} Vérifie avant d’en créer un autre : Instagram n’aime pas les doublons.
                </p>
              ) : null}
              {draft.selectedVideo?.latestPublishAt ? (
                <p className="text-xs text-muted-foreground">À publier avant le {formatParisDateTime(draft.selectedVideo.latestPublishAt)} (heure de Paris).</p>
              ) : null}
            </div>
            {draft.selectedVideo ? (
              <CaptionForm
                idPrefix="new-publication"
                initialValues={draft.draftInitialValues}
                submitLabel="Créer le brouillon"
                isSubmitting={draft.createDraft.isPending}
                onSubmit={(payload) => {
                  if (draft.duplicateWarning && !window.confirm(`${draft.duplicateWarning} Créer quand même un nouveau brouillon ?`)) return;
                  draft.createDraft.mutate(payload);
                }}
              />
            ) : null}
            {draft.createMessage ? <p className="text-muted-foreground">{draft.createMessage}</p> : null}
          </CardContent>
        </Card>
        <RenderActivityCard jobs={reelRenders} title="Rendus vidéo" emptyText="Aucun rendu de reel ces dernières 24 h." error={workspace.activityError} nowMs={Date.now()} queueHref="/admin/content/renders?type=manuel,auto,survol" />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Reels à publier</h2>
        {postsQuery.isLoading && !postsQuery.data ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {postsQuery.error instanceof Error ? <p className="text-sm text-red-600 dark:text-red-300">{postsQuery.error.message}</p> : null}
        {postsQuery.data ? (
          <PostList posts={reelsToPublish} workspace={workspace} highlightedPostId={highlight.postId} emptyText="Aucun reel en attente : brouillons, programmés et échecs apparaissent ici." />
        ) : null}
      </section>
      <ReelPlanList
        data={automationQuery.data}
        busy={automationMutation.isPending}
        highlightedItemId={highlight.itemId}
        renders={renderById}
        onItemAction={(itemId, action) => automationMutation.mutate({ url: `/api/admin/reel-automation/items/${itemId}`, method: "PATCH", body: { action } })}
        onRefresh={() => automationMutation.mutate({ url: "/api/admin/reel-automation", method: "POST", body: { action: "refresh" } })}
      />
      {automationMessage ? <p className="text-sm text-red-600 dark:text-red-300">{automationMessage}</p> : null}
    </div>
  );
}

/**
 * Explains the two ways to make a carousel, shown on both tabs: the automatic series (written, rendered on
 * Google Cloud and dropped as a draft on the calendar) and the manual carousel (4 PNG exported from one of
 * your plans, published by hand). Each side links to the other tab.
 */
export function CarouselKindsNote({ current }: { current: "automatic" | "manual" }) {
  const linkClass = "font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return (
    <section aria-label="Carrousel automatique ou manuel" className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
      <div className="space-y-1">
        <h2 className="font-semibold text-foreground">Carrousel automatique{current === "automatic" ? " (cet onglet)" : ""}</h2>
        <p className="text-muted-foreground">
          Les séries « Le plan chiffré », « Le brief » et « La semaine qui vient » sont écrites par l’IA, rendues en images sur Google Cloud et déposées en brouillon Instagram selon le calendrier. Tu relis, puis tu publies ou tu programmes.
        </p>
        {current === "manual" ? <Link href="/admin/content/posts?onglet=carousels" className={linkClass}>Ouvrir les carrousels automatiques →</Link> : null}
      </div>
      <div className="space-y-1">
        <h2 className="font-semibold text-foreground">Carrousel manuel{current === "manual" ? " (cet onglet)" : ""}</h2>
        <p className="text-muted-foreground">
          À partir d’un de tes plans enregistrés, tu génères 4 slides et tu les exportes en PNG dans ton navigateur. Rien n’est rendu sur Google Cloud, rien n’est créé dans Publications : tu publies les images toi-même.
        </p>
        {current === "automatic" ? <Link href="/admin/content/posts?onglet=templates" className={linkClass}>Ouvrir le carrousel manuel →</Link> : null}
      </div>
    </section>
  );
}

/** Carrousels: generate now, image renders, carousels to publish, automatic plan. */
export function CarouselsPanel({ workspace, highlight }: { workspace: PublicationsWorkspace; highlight: Highlight }) {
  const { postsQuery, carouselQuery, carouselMutation, carouselMessage, renders, renderById, posts, publishTime } = workspace;
  const carouselsToPublish = posts.filter((post) => post.mediaType === "carousel" && post.status !== "published");
  const carouselRenders = renders.filter((job) => job.kind === "carousel");
  return (
    <div className="flex flex-col gap-6">
      <CarouselKindsNote current="automatic" />
      <div className="grid gap-4 lg:grid-cols-2">
        <CarouselGenerateNow
          data={carouselQuery.data}
          busy={carouselMutation.isPending}
          message={carouselMessage ?? (carouselQuery.error instanceof Error ? carouselQuery.error.message : null)}
          onGenerate={(request) => carouselMutation.mutate({ url: "/api/admin/carousel-automation", method: "POST", body: { action: "generate", ...request } })}
        />
        <RenderActivityCard jobs={carouselRenders} title="Rendus des images" emptyText="Aucun rendu de carrousel ces dernières 24 h." error={workspace.activityError} nowMs={Date.now()} queueHref="/admin/content/renders?type=carrousel" />
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Carrousels à publier</h2>
        {postsQuery.data ? <PostList posts={carouselsToPublish} workspace={workspace} highlightedPostId={highlight.postId} emptyText="Aucun carrousel en attente." /> : null}
      </section>
      <CarouselPlanList
        data={carouselQuery.data}
        publishTime={publishTime}
        busy={carouselMutation.isPending}
        highlightedItemId={highlight.itemId}
        renders={renderById}
        onItemAction={(itemId, action) => carouselMutation.mutate({ url: `/api/admin/carousel-automation/items/${itemId}`, method: "PATCH", body: { action } })}
        onRefresh={() => carouselMutation.mutate({ url: "/api/admin/carousel-automation", method: "POST", body: { action: "refresh" } })}
      />
    </div>
  );
}

type PublishedFilter = "all" | "reel" | "carousel";

/** Publiées: history with the reel / carousel filter. */
export function PublishedPanel({ workspace, highlight }: { workspace: PublicationsWorkspace; highlight: Highlight }) {
  const [publishedFilter, setPublishedFilter] = useState<PublishedFilter>("all");
  const published = workspace.posts.filter((post) => post.status === "published");
  const publishedVisible = published.filter((post) => publishedFilter === "all" || (publishedFilter === "carousel" ? post.mediaType === "carousel" : post.mediaType !== "carousel"));
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">Publiées</h2>
        <div className="inline-flex rounded-full border border-border bg-card p-1" role="group" aria-label="Filtrer les publications">
          {(
            [
              ["all", "Toutes"],
              ["reel", "Reels"],
              ["carousel", "Carrousels"],
            ] as const
          ).map(([key, label]) => (
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
      {workspace.postsQuery.data ? <PostList posts={publishedVisible} workspace={workspace} highlightedPostId={highlight.postId} emptyText="Rien de publié dans ce filtre." /> : null}
    </section>
  );
}

/** Counts shown in the Publications tab labels (to publish, published). */
export const publicationCounts = (posts: PublicSocialPost[]) => ({
  reels: posts.filter((post) => post.mediaType !== "carousel" && post.status !== "published").length,
  carousels: posts.filter((post) => post.mediaType === "carousel" && post.status !== "published").length,
  published: posts.filter((post) => post.status === "published").length,
});

/** Automatisations: reel and carousel switches (former « Paramètres » tab, without the account card). */
export function PublicationAutomationSettings({ workspace }: { workspace: PublicationsWorkspace }) {
  const { automationQuery, automationMutation, automationMessage, carouselQuery, carouselMutation, carouselMessage, publishTime } = workspace;
  return (
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
  );
}

/** Intégrations: the Instagram account card of the former « Paramètres » tab. */
export function InstagramIntegration({ workspace }: { workspace: Pick<PublicationsWorkspace, "statusQuery"> }) {
  const { statusQuery } = workspace;
  return <InstagramStatusCard status={statusQuery.data} isLoading={statusQuery.isLoading} error={statusQuery.error instanceof Error ? statusQuery.error.message : null} />;
}
