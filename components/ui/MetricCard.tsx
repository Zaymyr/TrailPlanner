import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  tone?: "default" | "warning";
  className?: string;
};

export function MetricCard({ label, value, helper, icon, tone = "default", className }: MetricCardProps) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-500/70 bg-amber-500/5 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]"
      : "border-border bg-card/60";

  return (
    <div className={`rounded-lg border p-4 ${toneClasses} ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="flex items-baseline gap-2">
            {icon}
            <p className="text-3xl font-semibold leading-tight text-foreground">{value}</p>
          </div>
        </div>
      </div>
      {helper ? <p className="mt-2 text-sm text-muted-foreground">{helper}</p> : null}
    </div>
  );
}
