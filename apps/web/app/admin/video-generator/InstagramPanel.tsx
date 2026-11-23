"use client";

import type { Route } from "next";
import Link from "next/link";
import React, { useState } from "react";

import { Button } from "../../../components/ui/button";
import { renderPostHref } from "../../../lib/admin-renders";
import { REEL_COVER_TEXT_MAX_WORDS } from "../../../lib/reel-content";
import { INSTAGRAM_CAPTION_MAX_CHARS, INSTAGRAM_MAX_HASHTAGS } from "../../../lib/video-narration";
import { buildStudioDraftRequest, type StudioDraftSource } from "./studio-draft";
import type { AsyncActionState } from "./StoryEditor";

type InstagramPanelProps = {
  caption: string;
  hashtags: string[];
  onCaptionChange: (caption: string) => void;
  /** Writes the caption on its own (full reels). Omitted for highlights reels: it comes with the script. */
  onGenerate?: () => void;
  onHashtagsChange: (hashtags: string[]) => void;
  state: AsyncActionState;
  /** Cover text of a highlights reel (≤ 6 words, stored with the post); undefined hides the field. */
  coverText?: string;
  onCoverTextChange?: (coverText: string) => void;
  /** Limits and figures to check in the text written by the AI. */
  warnings?: string[];
  /** Finished render of the race the draft is made from; without one the draft button is replaced by a hint. */
  draftSource?: StudioDraftSource | null;
  accessToken?: string;
  /** After a draft is created: the render list reloads to show its link. */
  onDraftCreated?: () => void;
};

const parseHashtags = (value: string) =>
  value.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);

/** Reel description and hashtags, written by Claude from the story, editable and copied in one click. */
export function InstagramPanel({ caption, coverText, hashtags, onCaptionChange, onCoverTextChange, onGenerate, onHashtagsChange, state, warnings = [], draftSource = null, accessToken = "", onDraftCreated }: InstagramPanelProps) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState<{ status: "idle" | "loading" | "done" | "error"; message: string | null; postId: string | null }>({ status: "idle", message: null, postId: null });
  const hashtagText = hashtags.map((tag) => `#${tag}`).join(" ");
  const fullText = [caption.trim(), hashtagText].filter(Boolean).join("\n\n");
  const tooLong = fullText.length > INSTAGRAM_CAPTION_MAX_CHARS;
  const coverWords = (coverText ?? "").split(/\s+/).filter(Boolean).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  // Same request as « Nouveau brouillon » of Publications: one path from the text to a draft.
  const createDraft = async () => {
    if (!draftSource) return;
    if (draftSource.post && !window.confirm("Ce rendu a déjà un brouillon ou une publication. Créer quand même un nouveau brouillon ?")) return;
    const request = buildStudioDraftRequest({ jobId: draftSource.jobId, caption, hashtags, coverText });
    if (!request.ok) {
      setDraft({ status: "error", message: request.message, postId: null });
      return;
    }
    setDraft({ status: "loading", message: null, postId: null });
    try {
      const response = await fetch("/api/admin/social-posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string; post?: { id?: string } } | null;
      if (!response.ok || !payload?.post?.id) throw new Error(payload?.message ?? "Le brouillon n’a pas pu être créé.");
      setDraft({ status: "done", message: "Brouillon créé : rien n’est publié tant que tu ne cliques pas sur « Publier maintenant » ou « Programmer » dans Publications.", postId: payload.post.id });
      onDraftCreated?.();
    } catch (error) {
      setDraft({ status: "error", message: error instanceof Error ? error.message : "Le brouillon n’a pas pu être créé.", postId: null });
    }
  };

  return (
    <div className="space-y-3 text-foreground">
      {onGenerate ? (
        <Button type="button" className="h-9 w-full px-2 text-xs" disabled={state.status === "loading"} onClick={onGenerate}>
          {state.status === "loading" ? "Rédaction…" : caption ? "Réécrire la description" : "Générer la description et les hashtags"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">La description, les hashtags et le texte de couverture sont rédigés avec le script (« Rédiger avec l’IA »).</p>
      )}
      {warnings.length ? (
        <ul aria-label="Points à vérifier dans la description" className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      {state.message ? <p className={`text-xs ${state.status === "error" ? "text-red-700" : "text-muted-foreground"}`}>{state.message}</p> : null}

      <label className="block space-y-1 text-xs">
        <span className="flex justify-between font-medium">
          Description
          <span className={`tabular-nums ${tooLong ? "text-red-700" : "text-muted-foreground"}`}>{fullText.length} / {INSTAGRAM_CAPTION_MAX_CHARS}</span>
        </span>
        <textarea
          aria-label="Description Instagram"
          className="w-full resize-y rounded border border-input bg-card px-2 py-1 text-xs leading-snug"
          rows={8}
          placeholder="La description du reel apparaîtra ici."
          value={caption}
          onChange={(event) => onCaptionChange(event.target.value)}
        />
      </label>
      <label className="block space-y-1 text-xs">
        <span className="flex justify-between font-medium">
          Hashtags
          <span className={`tabular-nums ${hashtags.length > INSTAGRAM_MAX_HASHTAGS ? "text-red-700" : "text-muted-foreground"}`}>{hashtags.length} / {INSTAGRAM_MAX_HASHTAGS}</span>
        </span>
        <textarea
          aria-label="Hashtags Instagram"
          className="w-full resize-y rounded border border-input bg-card px-2 py-1 font-mono text-xs leading-snug"
          rows={3}
          placeholder="#trail #trailrunning"
          value={hashtagText}
          onChange={(event) => onHashtagsChange(parseHashtags(event.target.value))}
        />
      </label>
      {coverText !== undefined && onCoverTextChange ? (
        <label className="block space-y-1 text-xs">
          <span className="flex justify-between font-medium">
            Texte de couverture
            <span className={`tabular-nums ${coverWords > REEL_COVER_TEXT_MAX_WORDS ? "text-red-700" : "text-muted-foreground"}`}>{coverWords} / {REEL_COVER_TEXT_MAX_WORDS} mots</span>
          </span>
          <input
            aria-label="Texte de couverture"
            className="w-full rounded border border-input bg-card px-2 py-1 text-xs"
            value={coverText}
            onChange={(event) => onCoverTextChange(event.target.value)}
          />
        </label>
      ) : null}
      <Button type="button" variant="outline" className="h-8 w-full px-2 text-xs" disabled={!fullText} onClick={() => void copy()}>
        {copied ? "Copié !" : "Copier description + hashtags"}
      </Button>
      <div className="space-y-1.5 border-t border-border pt-3">
        {draftSource ? (
          <>
            <Button type="button" className="h-8 w-full px-2 text-xs" disabled={!fullText || draft.status === "loading" || !accessToken} onClick={() => void createDraft()}>
              {draft.status === "loading" ? "Création du brouillon…" : "Créer un brouillon avec ce texte"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Utilise le dernier rendu terminé de cette course{draftSource.post ? (
                <>
                  {" "}— il a déjà{" "}
                  <Link href={renderPostHref({ ...draftSource.post, media_type: "reel" }) as Route} className="font-semibold text-brand underline underline-offset-2">
                    {draftSource.post.status === "draft" ? "un brouillon" : "une publication"}
                  </Link>
                </>
              ) : null}.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Le bouton « Créer un brouillon » apparaît dès qu’un rendu terminé de cette course existe (« Générer en arrière-plan » ci-dessus).</p>
        )}
        {draft.message ? (
          <p role={draft.status === "error" ? "alert" : "status"} className={`text-xs ${draft.status === "error" ? "text-red-700" : "text-muted-foreground"}`}>
            {draft.message}{" "}
            {draft.postId ? <Link href={renderPostHref({ id: draft.postId, status: "draft", media_type: "reel" }) as Route} className="font-semibold text-brand underline underline-offset-2">Voir le brouillon →</Link> : null}
          </p>
        ) : null}
      </div>
    </div>
  );
}
