"use client";

import React, { useState } from "react";

import { Button } from "../../../components/ui/button";
import { INSTAGRAM_CAPTION_MAX_CHARS, INSTAGRAM_MAX_HASHTAGS } from "../../../lib/video-narration";
import type { AsyncActionState } from "./StoryEditor";

type InstagramPanelProps = {
  caption: string;
  hashtags: string[];
  onCaptionChange: (caption: string) => void;
  onGenerate: () => void;
  onHashtagsChange: (hashtags: string[]) => void;
  state: AsyncActionState;
};

const parseHashtags = (value: string) =>
  value.split(/[\s,]+/).map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean);

/** Reel description and hashtags, written by Claude from the story, editable and copied in one click. */
export function InstagramPanel({ caption, hashtags, onCaptionChange, onGenerate, onHashtagsChange, state }: InstagramPanelProps) {
  const [copied, setCopied] = useState(false);
  const hashtagText = hashtags.map((tag) => `#${tag}`).join(" ");
  const fullText = [caption.trim(), hashtagText].filter(Boolean).join("\n\n");
  const tooLong = fullText.length > INSTAGRAM_CAPTION_MAX_CHARS;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-3 text-foreground">
      <Button type="button" className="h-9 w-full px-2 text-xs" disabled={state.status === "loading"} onClick={onGenerate}>
        {state.status === "loading" ? "Rédaction…" : caption ? "Réécrire la description" : "Générer la description et les hashtags"}
      </Button>
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
      <Button type="button" variant="outline" className="h-8 w-full px-2 text-xs" disabled={!fullText} onClick={() => void copy()}>
        {copied ? "Copié !" : "Copier description + hashtags"}
      </Button>
    </div>
  );
}
