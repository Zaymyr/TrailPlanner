"use client";

import type { CoachComment } from "../../lib/coach-comments";
import type { CoachCommentsTranslations } from "../../locales/types";

type CoachCommentsBlockProps = {
  comments: CoachComment[];
  copy: CoachCommentsTranslations;
};

const formatDate = (value: string) => new Date(value).toLocaleDateString();

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
