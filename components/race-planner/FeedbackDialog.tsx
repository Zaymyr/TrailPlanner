"use client";

import type React from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import type { RacePlannerTranslations } from "../../locales/types";

type FeedbackDialogProps = {
  copy: RacePlannerTranslations["sections"]["summary"]["feedback"];
  open: boolean;
  subject: string;
  detail: string;
  status: "idle" | "submitting" | "success" | "error";
  error: string | null;
  onSubjectChange: (value: string) => void;
  onDetailChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function FeedbackDialog({
  copy,
  open,
  subject,
  detail,
  status,
  error,
  onSubjectChange,
  onDetailChange,
  onClose,
  onSubmit,
}: FeedbackDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
        <Button
          type="button"
          variant="ghost"
          className="absolute right-2 top-2 h-8 w-8 p-0 text-lg text-slate-200"
          aria-label={copy.open}
          onClick={onClose}
        >
          ×
        </Button>
        <div className="mb-4 pr-8">
          <p className="text-lg font-semibold text-slate-50">{copy.title}</p>
        </div>

        <form id="feedback-form" className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="feedback-subject">{copy.subject}</Label>
            <Input
              id="feedback-subject"
              value={subject}
              onChange={(event) => onSubjectChange(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="feedback-detail">{copy.detail}</Label>
            <textarea
              id="feedback-detail"
              value={detail}
              onChange={(event) => onDetailChange(event.target.value)}
              required
              className="min-h-[120px] w-full rounded-md border border-slate-800 bg-slate-900/80 p-3 text-sm text-slate-50 shadow-sm transition placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {status === "success" && !error ? <p className="text-sm text-emerald-400">{copy.success}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" className="w-full sm:w-auto" disabled={status === "submitting"}>
              {copy.submit}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
