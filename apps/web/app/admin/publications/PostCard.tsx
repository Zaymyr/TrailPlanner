"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  buildFullCaption,
  formatParisDateTime,
  PUBLISH_REQUESTED_CONFIRMATION,
  utcToParisLocal,
  type PublicSocialPost,
  type SocialPostAction,
  type SocialPostStatus,
} from "../../../lib/social-posts";
import { CAROUSEL_MARK, CAROUSEL_SERIES_NAMES } from "./automation-labels";
import { CaptionForm, toCaptionFormValues, type CaptionPayload } from "./CaptionForm";
import { adminFetch, ConfirmationRequiredError, postAction, postDetailSchema, postResponseSchema } from "./publications-api";

const STATUS_LABELS: Record<SocialPostStatus, string> = {
  draft: "Brouillon",
  scheduled: "Programmée",
  publishing: "Publication en cours",
  published: "Publiée",
  failed: "Échec",
};

const STATUS_CLASSES: Record<SocialPostStatus, string> = {
  draft: "border-border text-muted-foreground",
  scheduled: "border-sky-300 text-sky-800 dark:border-sky-700 dark:text-sky-200",
  publishing: "border-amber-300 text-amber-800 dark:border-amber-700 dark:text-amber-200",
  published: "border-emerald-300 text-emerald-800 dark:border-emerald-700 dark:text-emerald-200",
  failed: "border-red-300 text-red-700 dark:border-red-700 dark:text-red-300",
};

/** The page advances a publishing post itself every 30 s (the server throttles Meta to 1/min). */
const ADVANCE_POLL_MS = 30_000;

const Badge = ({ className, children }: { className: string; children: ReactNode }) => (
  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
);

export function PostCard({
  accessToken,
  post,
  dryRunMode,
  onChanged,
}: {
  accessToken: string;
  post: PublicSocialPost;
  dryRunMode: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [scheduleLocal, setScheduleLocal] = useState(() => utcToParisLocal(new Date(Date.now() + 60 * 60 * 1_000)));
  const [preview, setPreview] = useState<{ url: string | null; images: string[]; message: string | null } | null>(null);
  const isCarousel = post.mediaType === "carousel";
  const [message, setMessage] = useState<string | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const action = useMutation({
    mutationFn: (body: SocialPostAction) => postAction(accessToken, post.id, body),
    onSuccess: () => {
      setMessage(null);
      onChanged();
    },
    onError: (error, body) => {
      // After a live publish request, starting over needs an explicit confirmation.
      if (error instanceof ConfirmationRequiredError && body.action === "retry" && !body.confirmRestart) {
        if (window.confirm(error.message)) action.mutate({ action: "retry", confirmRestart: true });
        return;
      }
      setMessage(error instanceof Error ? error.message : "L’action a échoué.");
    },
  });

  const save = useMutation({
    mutationFn: (payload: CaptionPayload & { confirmRestart?: boolean }) =>
      adminFetch(accessToken, `/api/admin/social-posts/${post.id}`, postResponseSchema, { method: "PATCH", body: payload }, "Enregistrement impossible."),
    onSuccess: () => {
      setEditing(false);
      setMessage(null);
      onChanged();
    },
    onError: (error, payload) => {
      if (error instanceof ConfirmationRequiredError && !payload.confirmRestart) {
        if (window.confirm(error.message)) save.mutate({ ...payload, confirmRestart: true });
        return;
      }
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible.");
    },
  });

  const remove = useMutation({
    mutationFn: () => adminFetch(accessToken, `/api/admin/social-posts/${post.id}`, z.object({ deleted: z.boolean() }), { method: "DELETE" }, "Suppression impossible."),
    onSuccess: () => onChanged(),
    onError: (error) => setMessage(error instanceof Error ? error.message : "Suppression impossible."),
  });

  const loadPreview = useMutation({
    mutationFn: () => adminFetch(accessToken, `/api/admin/social-posts/${post.id}`, postDetailSchema, {}, "Aperçu indisponible."),
    onSuccess: (detail) => setPreview({ url: detail.previewUrl, images: detail.previewImages, message: detail.previewMessage }),
    onError: (error) => setPreview({ url: null, images: [], message: error instanceof Error ? error.message : "Aperçu indisponible." }),
  });

  // A carousel draft shows its slides at once, in order, for the review.
  const autoPreviewRef = useRef(false);
  const loadPreviewMutate = loadPreview.mutate;
  useEffect(() => {
    if (!isCarousel || post.status !== "draft" || autoPreviewRef.current || !post.carouselJobId) return;
    autoPreviewRef.current = true;
    loadPreviewMutate();
  }, [isCarousel, loadPreviewMutate, post.carouselJobId, post.status]);

  // A live publication in progress: advance it from the page as well as from the cron.
  useEffect(() => {
    if (post.status !== "publishing") return;
    const timer = window.setInterval(() => {
      void postAction(accessToken, post.id, { action: "advance" }).then(() => onChangedRef.current()).catch(() => undefined);
    }, ADVANCE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [accessToken, post.id, post.status]);

  const initialValues = useMemo(
    () => toCaptionFormValues(post.caption, post.hashtags, post.coverText),
    [post.caption, post.hashtags, post.coverText],
  );

  const busy = action.isPending || save.isPending || remove.isPending;
  const canEdit = post.status === "draft" || post.status === "failed";
  // Published posts can leave the list too; scheduled or in-flight ones must be stopped first.
  const canDelete = canEdit || post.status === "published";
  const deleteLabel = post.status === "published" ? "Retirer de la liste" : "Supprimer";
  const deleteConfirmation = post.status !== "published"
    ? "Supprimer cette publication ?"
    : post.dryRun
      ? "Retirer cette publication simulée de la liste ? La vidéo ne sera plus marquée comme publiée."
      : "Retirer cette publication de la liste ? Elle reste en ligne sur Instagram (l’API ne permet pas de la supprimer : fais-le depuis l’app Instagram si besoin), et la vidéo ne sera plus marquée comme publiée.";
  const modeLabel = dryRunMode ? "en simulation" : "sur Instagram";

  const publishNow = () => {
    if (window.confirm(`Publier ${isCarousel ? "ce carrousel" : "ce reel"} maintenant ${modeLabel} ?`)) action.mutate({ action: "publish_now" });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-foreground">
            {isCarousel ? `${CAROUSEL_MARK} ` : ""}{post.raceTitle ?? (isCarousel ? "Images supprimées" : "Vidéo supprimée")}
          </span>
          {isCarousel ? (
            <Badge className="border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-100">
              Carrousel{post.carouselSeries ? ` · ${CAROUSEL_SERIES_NAMES[post.carouselSeries]}` : ""} · {post.slideCount} images
            </Badge>
          ) : null}
          <Badge className={STATUS_CLASSES[post.status]}>{STATUS_LABELS[post.status]}</Badge>
          {post.autoGenerated ? (
            <Badge className="border-brand/40 bg-brand/10 text-brand">Généré automatiquement</Badge>
          ) : null}
          {post.dryRun && post.status !== "draft" ? (
            <Badge className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">Simulation</Badge>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Créée le {formatParisDateTime(post.createdAt)}
          {post.status === "scheduled" ? ` · programmée le ${formatParisDateTime(post.scheduledAt)} (heure de Paris)` : ""}
          {post.publishedAt ? ` · publiée le ${formatParisDateTime(post.publishedAt)}` : ""}
          {post.videoAvailableUntil ? ` · ${isCarousel ? "images conservées" : "vidéo conservée"} jusqu’au ${formatParisDateTime(post.videoAvailableUntil)}` : ""}
        </p>

        {post.error ? (
          <p className={post.status === "failed" ? "text-red-600 dark:text-red-300" : "text-amber-700 dark:text-amber-200"}>{post.error}</p>
        ) : null}
        {post.status === "publishing" ? (
          <p className="text-muted-foreground">Instagram traite la vidéo. Le statut se met à jour automatiquement (quelques minutes au plus).</p>
        ) : null}
        {post.igPermalink ? (
          <a href={post.igPermalink} target="_blank" rel="noreferrer" className="text-brand underline-offset-4 hover:underline dark:text-emerald-200">
            Voir la publication sur Instagram
          </a>
        ) : post.status === "published" && post.dryRun ? (
          <p className="text-muted-foreground">Publication simulée : rien n’a été envoyé à Instagram (identifiant {post.igMediaId}).</p>
        ) : null}

        {editing ? (
          <CaptionForm
            idPrefix={`post-${post.id}`}
            initialValues={initialValues}
            submitLabel="Enregistrer"
            isSubmitting={save.isPending}
            onSubmit={(payload) => save.mutate(payload)}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-sans text-sm">
            {buildFullCaption(post.caption, post.hashtags) || "Description vide."}
          </pre>
        )}

        {preview && preview.images.length ? (
          <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Images du carrousel, dans l’ordre">
            {preview.images.map((url, index) => (
              <li key={url} className="flex shrink-0 flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed Cloud Storage URL */}
                <img src={url} alt={`Image ${index + 1} sur ${preview.images.length}`} className="h-[300px] w-[240px] rounded-md border border-border object-cover" />
                <span className="text-xs text-muted-foreground">{index + 1} / {preview.images.length}</span>
              </li>
            ))}
          </ol>
        ) : preview ? (
          preview.url ? (
            <video src={preview.url} controls playsInline className="max-h-[480px] w-full max-w-[270px] rounded-md bg-black" />
          ) : (
            <p className="text-muted-foreground">{preview.message}</p>
          )
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          {(post.videoJobId || post.carouselJobId) && !preview ? (
            <Button type="button" variant="ghost" disabled={loadPreview.isPending} onClick={() => loadPreview.mutate()}>
              {loadPreview.isPending ? "Chargement…" : isCarousel ? "Voir les images" : "Voir la vidéo"}
            </Button>
          ) : null}
          {canEdit && !editing ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setEditing(true)}>Modifier</Button>
          ) : null}
          {post.status === "draft" || post.status === "scheduled" ? (
            <Button type="button" disabled={busy || editing} onClick={publishNow}>Publier maintenant</Button>
          ) : null}
          {post.status === "failed" ? (
            <Button type="button" disabled={busy || editing} onClick={() => action.mutate({ action: "retry" })}>Réessayer</Button>
          ) : null}
          {post.status === "failed" && post.publishRequested ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy || editing}
              onClick={() => {
                if (window.confirm(PUBLISH_REQUESTED_CONFIRMATION)) action.mutate({ action: "retry", confirmRestart: true });
              }}
            >
              Recommencer avec un nouveau conteneur
            </Button>
          ) : null}
          {post.status === "scheduled" ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => action.mutate({ action: "unschedule" })}>
              Annuler la programmation
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (window.confirm(deleteConfirmation)) remove.mutate();
              }}
            >
              {deleteLabel}
            </Button>
          ) : null}
        </div>

        {post.status === "draft" && !editing ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`schedule-${post.id}`}>Date et heure (heure de Paris)</Label>
              <Input
                id={`schedule-${post.id}`}
                type="datetime-local"
                value={scheduleLocal}
                onChange={(event) => setScheduleLocal(event.target.value)}
                className="w-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy || !scheduleLocal}
              onClick={() => action.mutate({ action: "schedule", scheduledAtLocal: scheduleLocal.slice(0, 16) })}
            >
              Programmer
            </Button>
          </div>
        ) : null}

        {message ? <p className="text-red-600 dark:text-red-300">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
