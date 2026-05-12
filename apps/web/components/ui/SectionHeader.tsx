import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  descriptionAsTooltip?: boolean;
  headingLevel?: "h2" | "h3";
};

export function SectionHeader({
  title,
  description,
  action,
  descriptionAsTooltip = false,
  headingLevel = "h2",
}: SectionHeaderProps) {
  const titleContent = (
    <>
      {title}
      {description && descriptionAsTooltip ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground"
          title={description}
          aria-label={description}
        >
          ?
        </span>
      ) : null}
    </>
  );

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        {headingLevel === "h3" ? (
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">{titleContent}</h3>
        ) : (
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">{titleContent}</h2>
        )}
        {description && !descriptionAsTooltip ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
