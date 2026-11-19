"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  CAPTION_MAX_CHARS,
  CAPTION_MAX_HASHTAGS,
  checkCaption,
  COVER_TEXT_MAX_CHARS,
  parseHashtagInput,
} from "../../../lib/social-posts";

export const captionFormSchema = z.object({
  caption: z.string().max(CAPTION_MAX_CHARS, `${CAPTION_MAX_CHARS} caractères au plus.`),
  hashtagsText: z.string().max(2_000),
  coverText: z.string().max(COVER_TEXT_MAX_CHARS, `${COVER_TEXT_MAX_CHARS} caractères au plus.`),
}).superRefine((value, context) => {
  checkCaption(value.caption, parseHashtagInput(value.hashtagsText)).problems.forEach((message) => {
    context.addIssue({ code: z.ZodIssueCode.custom, message, path: ["caption"] });
  });
});

export type CaptionFormValues = z.infer<typeof captionFormSchema>;

export type CaptionPayload = { caption: string; hashtags: string[]; coverText: string | null };

export const toCaptionPayload = (values: CaptionFormValues): CaptionPayload => ({
  caption: values.caption.trim(),
  hashtags: parseHashtagInput(values.hashtagsText),
  coverText: values.coverText.trim() || null,
});

export const toCaptionFormValues = (caption: string, hashtags: string[], coverText: string | null): CaptionFormValues => ({
  caption,
  hashtagsText: hashtags.map((tag) => `#${tag}`).join(" "),
  coverText: coverText ?? "",
});

const textareaClass =
  "w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

export function CaptionForm({
  idPrefix,
  initialValues,
  submitLabel,
  isSubmitting,
  disabled = false,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initialValues: CaptionFormValues;
  submitLabel: string;
  isSubmitting: boolean;
  disabled?: boolean;
  onSubmit: (payload: CaptionPayload) => void;
  onCancel?: () => void;
}) {
  const form = useForm<CaptionFormValues>({ resolver: zodResolver(captionFormSchema), defaultValues: initialValues });
  const { reset } = form;
  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const caption = form.watch("caption");
  const hashtagsText = form.watch("hashtagsText");
  const check = checkCaption(caption ?? "", parseHashtagInput(hashtagsText ?? ""));
  const captionError = form.formState.errors.caption?.message;

  return (
    <form className="flex flex-col gap-3" onSubmit={form.handleSubmit((values) => onSubmit(toCaptionPayload(values)))}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-caption`}>Description</Label>
        <textarea id={`${idPrefix}-caption`} rows={8} className={textareaClass} disabled={disabled} {...form.register("caption")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-hashtags`}>Hashtags</Label>
        <textarea id={`${idPrefix}-hashtags`} rows={2} className={textareaClass} disabled={disabled} placeholder="#trail #trailrunning" {...form.register("hashtagsText")} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-cover`}>Texte de couverture (optionnel)</Label>
        <Input id={`${idPrefix}-cover`} disabled={disabled} {...form.register("coverText")} />
        {form.formState.errors.coverText ? <p className="text-xs text-red-600 dark:text-red-300">{form.formState.errors.coverText.message}</p> : null}
      </div>
      <p className={`text-xs ${check.problems.length ? "text-red-600 dark:text-red-300" : "text-muted-foreground"}`}>
        {check.length} / {CAPTION_MAX_CHARS} caractères · {check.hashtagCount} / {CAPTION_MAX_HASHTAGS} hashtags · {check.mentionCount} / 20 mentions
      </p>
      {captionError ? <p className="text-xs text-red-600 dark:text-red-300">{captionError}</p> : null}
      {disabled ? null : (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Enregistrement…" : submitLabel}</Button>
          {onCancel ? <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button> : null}
        </div>
      )}
    </form>
  );
}
