"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import type { CoachComment } from "../../lib/coach-comments";
import type { CoachCommentsTranslations } from "../../locales/types";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

type CoachCommentsBlockProps = {
  comments: CoachComment[];
  copy: CoachCommentsTranslations;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();
const commentFormSchema = z.object({
  context: z.string().min(1),
  body: z.string().trim().min(1),
});

const buildContextValue = (targetType: CoachComment["targetType"], targetId: string) => `${targetType}:${targetId}`;

const isCoachCommentTargetType = (value: string): value is CoachComment["targetType"] =>
  value === "plan" || value === "section" || value === "aid-station";

const parseContextValue = (
  value: string
): { targetType: CoachComment["targetType"]; targetId: string } | null => {
  const [targetType, ...rest] = value.split(":");
  const targetId = rest.join(":");
  if (!targetType || !targetId) return null;
  if (!isCoachCommentTargetType(targetType)) return null;
  return { targetType, targetId };
};

export type CoachCommentContextOption = {
  targetType: CoachComment["targetType"];
  targetId: string;
  label: string;
};

type CommentFormValues = z.infer<typeof commentFormSchema>;

export const CoachCommentsBlock = ({ comments, copy }: CoachCommentsBlockProps) => {
  if (!comments.length) return null;

  return (
    <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
        {copy.viewer.title}
      </p>
      <div className="mt-2 space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-1">
            <p className="text-sm text-emerald-900 dark:text-emerald-50">{comment.body}</p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-200/80">
              {copy.viewer.updatedLabel.replace("{date}", formatDate(comment.updatedAt))}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

type CoachCommentItemProps = {
  comment: CoachComment;
  contextLabel: string;
  onUpdate: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
  copy: CoachCommentsTranslations;
};

const CoachCommentItem = ({
  comment,
  contextLabel,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
  copy,
}: CoachCommentItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm<{ body: string }>({
    resolver: zodResolver(z.object({ body: z.string().trim().min(1) })),
    defaultValues: { body: comment.body },
  });

  useEffect(() => {
    form.reset({ body: comment.body });
  }, [comment.body, form]);

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{contextLabel}</p>
          <p className="text-xs text-muted-foreground">
            {copy.viewer.updatedLabel.replace("{date}", formatDate(comment.updatedAt))}
          </p>
        </div>
        {!isEditing ? (
          <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setIsEditing(true)}>
            {copy.actions.edit}
          </Button>
        ) : null}
      </div>

      {!isEditing ? (
        <p className="text-sm text-foreground">{comment.body}</p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit(async (values) => {
            await onUpdate(values.body);
            setIsEditing(false);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor={`comment-body-${comment.id}`}>{copy.fields.bodyLabel}</Label>
            <textarea
              id={`comment-body-${comment.id}`}
              className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              {...form.register("body")}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? copy.actions.saving : copy.actions.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={async () => {
                await onDelete();
                setIsEditing(false);
              }}
            >
              {isDeleting ? copy.actions.deleting : copy.actions.delete}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
              {copy.actions.cancel}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

type CommentsPanelProps = {
  comments: CoachComment[];
  copy: CoachCommentsTranslations;
  contextOptions: CoachCommentContextOption[];
  onCreate: (payload: { targetType: CoachComment["targetType"]; targetId: string; body: string }) => Promise<void>;
  onUpdate: (payload: { id: string; targetType: CoachComment["targetType"]; targetId: string; body: string }) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  createError?: Error | null;
  updateError?: Error | null;
  deleteError?: Error | null;
};

export const CommentsPanel = ({
  comments,
  copy,
  contextOptions,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  isUpdating,
  isDeleting,
  createError,
  updateError,
  deleteError,
}: CommentsPanelProps) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const contextValues = useMemo(
    () => contextOptions.map((option) => buildContextValue(option.targetType, option.targetId)),
    [contextOptions]
  );
  const defaultContext = contextValues[0] ?? buildContextValue("plan", "plan");
  const contextLabelMap = useMemo(
    () =>
      Object.fromEntries(
        contextOptions.map((option) => [buildContextValue(option.targetType, option.targetId), option.label])
      ),
    [contextOptions]
  );
  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      context: defaultContext,
      body: "",
    },
  });

  useEffect(() => {
    const current = form.getValues("context");
    if (!contextValues.includes(current)) {
      form.setValue("context", defaultContext);
    }
  }, [contextValues, defaultContext, form]);

  const handleCreate = async (values: CommentFormValues) => {
    setStatusMessage(null);
    const parsedContext = parseContextValue(values.context);
    if (!parsedContext) return;
    try {
      await onCreate({
        targetType: parsedContext.targetType,
        targetId: parsedContext.targetId,
        body: values.body,
      });
      form.reset({ context: values.context, body: "" });
      setStatusMessage(copy.messages.created);
    } catch {
      setStatusMessage(null);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{copy.title}</h3>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>

      <form className="space-y-3" onSubmit={form.handleSubmit(handleCreate)}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="comment-context-panel">{copy.fields.contextLabel}</Label>
            <select
              id="comment-context-panel"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              {...form.register("context")}
            >
              {contextOptions.map((option) => {
                const value = buildContextValue(option.targetType, option.targetId);
                return (
                  <option key={value} value={value}>
                    {option.label}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="comment-body-panel">{copy.fields.bodyLabel}</Label>
            <textarea
              id="comment-body-panel"
              className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              placeholder={copy.fields.bodyPlaceholder}
              {...form.register("body")}
            />
          </div>
        </div>
        <Button type="submit" disabled={isCreating}>
          {isCreating ? copy.actions.creating : copy.actions.create}
        </Button>
      </form>

      {statusMessage ? <p className="text-xs text-emerald-600">{statusMessage}</p> : null}
      {createError ? <p className="text-xs text-red-600">{copy.errors.create}</p> : null}
      {updateError ? <p className="text-xs text-red-600">{copy.errors.update}</p> : null}
      {deleteError ? <p className="text-xs text-red-600">{copy.errors.delete}</p> : null}

      {comments.length === 0 ? <p className="text-xs text-muted-foreground">{copy.empty}</p> : null}

      <div className="space-y-3">
        {comments.map((comment) => {
          const contextValue = buildContextValue(comment.targetType, comment.targetId);
          const contextLabel = contextLabelMap[contextValue] ?? copy.contextOptions.plan;
          return (
            <CoachCommentItem
              key={comment.id}
              comment={comment}
              contextLabel={contextLabel}
              onUpdate={(body) =>
                onUpdate({
                  id: comment.id,
                  targetType: comment.targetType,
                  targetId: comment.targetId,
                  body,
                })
              }
              onDelete={() => onDelete(comment.id)}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
              copy={copy}
            />
          );
        })}
      </div>
    </div>
  );
};
