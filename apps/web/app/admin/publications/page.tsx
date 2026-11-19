"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { formatParisDateTime } from "../../../lib/social-posts";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { CaptionForm, toCaptionFormValues, type CaptionPayload } from "./CaptionForm";
import { InstagramStatusCard } from "./InstagramStatusCard";
import { PostCard } from "./PostCard";
import { adminFetch, instagramStatusSchema, postResponseSchema, postsResponseSchema } from "./publications-api";

/** While a post is publishing, the list refreshes on this rhythm. */
const LIST_POLL_MS = 30_000;

const shellClass =
  "mx-auto flex max-w-5xl flex-col gap-6 rounded-lg border border-border bg-card/90 p-6 shadow-lg shadow-[rgba(45,80,22,0.08)] dark:border-slate-800 dark:bg-slate-950/70";

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

  if (sessionLoading) {
    return <div className={shellClass}><p className="text-sm text-muted-foreground">Vérification de la session…</p></div>;
  }
  if (!accessToken || !isAdmin) {
    return <div className={shellClass}><p className="text-sm text-amber-700 dark:text-amber-200">Accès réservé aux administrateurs.</p></div>;
  }

  const posts = postsQuery.data?.posts ?? [];
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
        <div className="flex items-center gap-2">
          <Link href={"/admin/video-generator" as Route}>
            <Button variant="outline">Générateur vidéo 3D</Button>
          </Link>
          <Link href={"/admin" as Route} className="text-brand underline-offset-4 hover:underline dark:text-emerald-200">
            Retour à l’admin
          </Link>
        </div>
      </div>

      <InstagramStatusCard
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        error={statusQuery.error instanceof Error ? statusQuery.error.message : null}
      />

      <Card>
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
                  {video.raceTitle} · {video.width}×{video.height} · rendu le {formatParisDateTime(video.finishedAt)}
                </option>
              ))}
            </select>
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
              onSubmit={(payload) => createDraft.mutate(payload)}
            />
          ) : null}
          {createMessage ? <p className="text-muted-foreground">{createMessage}</p> : null}
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Publications</h2>
        {postsQuery.isLoading && !postsQuery.data ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
        {postsQuery.error instanceof Error ? <p className="text-sm text-red-600 dark:text-red-300">{postsQuery.error.message}</p> : null}
        {postsQuery.data && posts.length === 0 ? <p className="text-sm text-muted-foreground">Aucune publication pour l’instant.</p> : null}
        {posts.map((post) => (
          <PostCard key={post.id} accessToken={accessToken} post={post} dryRunMode={dryRunMode} onChanged={onChanged} />
        ))}
      </section>
    </div>
  );
}

export default function PublicationsPage() {
  return <PublicationsContent />;
}
