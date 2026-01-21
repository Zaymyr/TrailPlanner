"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "../../../../../components/ui/button";
import { Label } from "../../../../../components/ui/label";
import type { CoachPlan } from "../../../../../lib/coach-plans";
import type { CoachComment } from "../../../../../lib/coach-comments";
import { useCoachComments } from "../../../../hooks/useCoachComments";
import { useI18n } from "../../../../i18n-provider";

const commentFormSchema = z.object({
  context: z.string().min(1),
  body: z.string().trim().min(1),
});

type CommentFormValues = z.infer<typeof commentFormSchema>;

type CoachCommentsSectionProps = {
  accessToken: string;
  coacheeId: string;
  plan: CoachPlan;
};

type ContextOption = { value: string; label: string };

const extractAidStations = (plan: CoachPlan) => {
  const plannerValues = plan.plannerValues as { aidStations?: Array<{ name?: string | null }> } | null;
  return Array.isArray(plannerValues?.aidStations) ? plannerValues.aidStations : [];
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

const buildContextOptions = (base: ContextOption[], plan: CoachPlan, label: string) => {
  const aidStations = extractAidStations(plan);
  const aidLabels = aidStations.map((station, index) => {
    const name = typeof station?.name === "string" ? station.name : "";
    return {
      value: `aid-${index}`,
      label: name
        ? `${label.replace("{index}", String(index + 1))} · ${name}`
        : label.replace("{index}", String(index + 1)),
    };
  });

  return [...base, ...aidLabels];
};

const formatContextKey = (comment: CoachComment) => comment.aidStationId ?? comment.sectionId ?? "plan";

const CoachCommentItem = ({
  comment,
  contextLabel,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
  copy,
}: {
  comment: CoachComment;
  contextLabel: string;
  onUpdate: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
  copy: ReturnType<typeof useI18n>["t"]["coachComments"];
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const form = useForm<{ body: string }>({
    resolver: zodResolver(z.object({ body: z.string().trim().min(1) })),
    defaultValues: { body: comment.body },
  });

  useEffect(() => {
    form.reset({ body: comment.body });
  }, [comment.body, form]);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{contextLabel}</p>
          <p className="text-xs text-slate-500">
            {copy.viewer.updatedLabel.replace("{date}", formatDate(comment.updatedAt))}
          </p>
        </div>
        {!isEditing ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            {copy.actions.edit}
          </Button>
        ) : null}
      </div>

      {!isEditing ? (
        <p className="text-sm text-slate-700">{comment.body}</p>
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

export const CoachCommentsSection = ({ accessToken, coacheeId, plan }: CoachCommentsSectionProps) => {
  const { t } = useI18n();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const {
    data: comments,
    isLoading,
    error,
    createComment,
    updateComment,
    deleteComment,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
  } = useCoachComments({
    accessToken,
    planId: plan.id,
  });

  const contextOptions = useMemo(() => {
    const baseOptions: ContextOption[] = [
      { value: "plan", label: t.coachComments.contextOptions.plan },
      { value: "start", label: t.coachComments.contextOptions.start },
      { value: "finish", label: t.coachComments.contextOptions.finish },
    ];
    return buildContextOptions(baseOptions, plan, t.coachComments.contextOptions.aidStation);
  }, [
    plan,
    t.coachComments.contextOptions.aidStation,
    t.coachComments.contextOptions.finish,
    t.coachComments.contextOptions.plan,
    t.coachComments.contextOptions.start,
  ]);

  const contextLabelMap = useMemo(() => {
    return Object.fromEntries(contextOptions.map((option) => [option.value, option.label]));
  }, [contextOptions]);

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      context: "plan",
      body: "",
    },
  });

  const handleCreate = async (values: CommentFormValues) => {
    setStatusMessage(null);
    const aidStationId = values.context.startsWith("aid-") ? values.context : null;
    const sectionId = aidStationId ? null : values.context;

    try {
      await createComment({
        coacheeId,
        planId: plan.id,
        sectionId,
        aidStationId,
        body: values.body,
      });
      form.reset({ context: values.context, body: "" });
      setStatusMessage(t.coachComments.messages.created);
    } catch {
      setStatusMessage(null);
    }
  };

  const handleUpdate = async (comment: CoachComment, body: string) => {
    setStatusMessage(null);
    try {
      await updateComment({
        id: comment.id,
        coacheeId,
        planId: plan.id,
        sectionId: comment.sectionId,
        aidStationId: comment.aidStationId,
        body,
      });
      setStatusMessage(t.coachComments.messages.updated);
    } catch {
      setStatusMessage(null);
    }
  };

  const handleDelete = async (comment: CoachComment) => {
    setStatusMessage(null);
    try {
      await deleteComment({
        id: comment.id,
        coacheeId,
        planId: plan.id,
      });
      setStatusMessage(t.coachComments.messages.deleted);
    } catch {
      setStatusMessage(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">{t.coachComments.title}</h3>
        <p className="text-sm text-slate-500">{t.coachComments.description}</p>
      </div>

      <form className="space-y-3" onSubmit={form.handleSubmit(handleCreate)}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`comment-context-${plan.id}`}>{t.coachComments.fields.contextLabel}</Label>
            <select
              id={`comment-context-${plan.id}`}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              {...form.register("context")}
            >
              {contextOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`comment-body-${plan.id}`}>{t.coachComments.fields.bodyLabel}</Label>
            <textarea
              id={`comment-body-${plan.id}`}
              className="min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              placeholder={t.coachComments.fields.bodyPlaceholder}
              {...form.register("body")}
            />
          </div>
        </div>
        <Button type="submit" disabled={isCreating}>
          {isCreating ? t.coachComments.actions.creating : t.coachComments.actions.create}
        </Button>
      </form>

      {isLoading ? <p className="text-sm text-slate-500">{t.coachComments.loading}</p> : null}
      {error ? <p className="text-sm text-red-600">{t.coachComments.loadError}</p> : null}
      {statusMessage ? <p className="text-sm text-emerald-600">{statusMessage}</p> : null}
      {createError ? <p className="text-sm text-red-600">{t.coachComments.errors.create}</p> : null}
      {updateError ? <p className="text-sm text-red-600">{t.coachComments.errors.update}</p> : null}
      {deleteError ? <p className="text-sm text-red-600">{t.coachComments.errors.delete}</p> : null}

      {!isLoading && !error && (comments?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-500">{t.coachComments.empty}</p>
      ) : null}

      <div className="space-y-3">
        {(comments ?? []).map((comment) => {
          const contextKey = formatContextKey(comment);
          const contextLabel = contextLabelMap[contextKey] ?? t.coachComments.contextOptions.plan;

          return (
            <CoachCommentItem
              key={comment.id}
              comment={comment}
              contextLabel={contextLabel}
              onUpdate={(body) => handleUpdate(comment, body)}
              onDelete={() => handleDelete(comment)}
              isUpdating={isUpdating}
              isDeleting={isDeleting}
              copy={t.coachComments}
            />
          );
        })}
      </div>
    </div>
  );
};
