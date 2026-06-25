import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { cn } from '../../../../components/utils';
import type { OrganizerModuleLevel, OrganizerModuleStatus } from '../completion';

export function OrganizerToast({ toast }: { toast: { id: number; type: "success" | "error"; message: string } | null }) {
  if (!toast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div
        key={toast.id}
        className={cn(
          "max-w-md rounded-full border px-4 py-2 text-sm font-semibold shadow-lg",
          toast.type === "success" && "border-emerald-300 bg-emerald-50 text-emerald-800",
          toast.type === "error" && "border-red-300 bg-red-50 text-red-800"
        )}
      >
        {toast.message}
      </div>
    </div>
  );
}

export function LiveToggle({
  checked,
  disabled,
  onChange,
  liveLabel = "Publié",
  draftLabel = "Brouillon",
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  liveLabel?: string;
  draftLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-semibold text-foreground transition hover:border-brand-border disabled:cursor-not-allowed disabled:opacity-60"
      aria-pressed={checked}
    >
      <span className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-brand" : "bg-muted")}>
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition",
            checked ? "left-4" : "left-0.5"
          )}
        />
      </span>
      {checked ? liveLabel : draftLabel}
    </button>
  );
}

export function StatusBadge({ status }: { status: OrganizerModuleStatus }) {
  const labels: Record<OrganizerModuleStatus, string> = {
    empty: "Vide",
    incomplete: "Incomplet",
    complete: "Complet",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-semibold",
        status === "complete" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        status === "incomplete" && "border-amber-300 bg-amber-50 text-amber-700",
        status === "empty" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {labels[status]}
    </span>
  );
}

export function LevelBadge({ level }: { level: OrganizerModuleLevel }) {
  const labels: Record<OrganizerModuleLevel, string> = {
    required: "Obligatoire",
    recommended: "Recommandé",
    optional: "Optionnel",
  };
  return <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">{labels[level]}</span>;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className={invalid ? "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500" : undefined}
      />
      {invalid ? <p className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = "0.1",
  invalid,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={invalid ? "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500" : undefined}
      />
      {invalid ? <p className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <textarea
        className={cn(
          "min-h-24 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          invalid ? "border-amber-400 bg-amber-50/50 focus-visible:ring-amber-500" : "border-border"
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? <p className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function ToggleChip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}
