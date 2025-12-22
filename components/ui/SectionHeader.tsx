import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  descriptionAsTooltip?: boolean;
};

export function SectionHeader({ title, description, action, descriptionAsTooltip = false }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          {title}
          {description && descriptionAsTooltip ? (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[11px] font-semibold text-slate-200"
              title={description}
              aria-label={description}
            >
              ?
            </span>
          ) : null}
        </p>
        {description && !descriptionAsTooltip ? <p className="text-sm text-slate-400">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
