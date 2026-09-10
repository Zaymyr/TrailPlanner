import { useId } from 'react';

import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { cn } from '../../../../components/utils';
import type { OrganizerModuleLevel, OrganizerModuleStatus } from '../completion';

export function ContextualHelp({ text, label = "Plus d’informations" }: { text: string; label?: string }) {
  const tooltipId = useId();

  return (
    <span className="group/help relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-[11px] font-bold text-muted-foreground transition hover:border-brand-border hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        ?
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-64 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover/help:block group-focus-within/help:block"
      >
        {text}
      </span>
    </span>
  );
}

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
  description,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  liveLabel?: string;
  draftLabel?: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      title={description}
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

export type RacebookVisibilityState = "hidden" | "private" | "public";

const RACEBOOK_VISIBILITY_OPTIONS: Array<{
  value: RacebookVisibilityState;
  label: string;
  description: string;
}> = [
  { value: "hidden", label: "Masqué", description: "Le format (course et RaceBook) est absent du catalogue mobile. Son contenu reste enregistré." },
  { value: "private", label: "Privé", description: "La course et son RaceBook sont visibles uniquement par les organisateurs actifs de l’événement." },
  { value: "public", label: "Public", description: "La course et son RaceBook sont visibles par tous. L’édition doit elle aussi être visible." },
];

export function RacebookVisibilityControl({
  value,
  disabled,
  publicDisabled,
  onChange,
  label,
}: {
  value: RacebookVisibilityState;
  disabled?: boolean;
  publicDisabled?: boolean;
  onChange: (value: RacebookVisibilityState) => void;
  label: string;
}) {
  const groupName = useId();

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">Visibilité de {label}</legend>
      <div className="inline-grid grid-cols-3 rounded-lg border border-border bg-muted/40 p-1" role="radiogroup">
        {RACEBOOK_VISIBILITY_OPTIONS.map((option) => {
          const checked = value === option.value;
          const optionDisabled = disabled || (option.value === "public" && publicDisabled);
          const tooltipId = `${groupName}-${option.value}-description`;
          return (
            <label
              key={option.value}
              className={cn(
                "group/visibility relative cursor-pointer rounded-md px-2.5 py-1.5 text-center text-xs font-semibold transition sm:px-3",
                checked
                  ? option.value === "public"
                    ? "bg-brand text-white shadow-sm"
                    : "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
                optionDisabled && "cursor-not-allowed opacity-50"
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={checked}
                disabled={optionDisabled}
                onChange={() => onChange(option.value)}
                className="sr-only"
                aria-describedby={tooltipId}
              />
              {option.label}
              <span
                id={tooltipId}
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md bg-slate-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover/visibility:block group-focus-within/visibility:block"
              >
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
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
  step,
  required,
  placeholder,
  invalid,
  disabled,
  id,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        {hint ? <ContextualHelp text={hint} /> : null}
      </div>
      <Input
        id={inputId}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={invalid ? "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500" : undefined}
      />
      {invalid ? <p id={errorId} className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  step = "0.1",
  invalid,
  readOnly,
  disabled,
  id,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: string;
  invalid?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  id?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        {hint ? <ContextualHelp text={hint} /> : null}
      </div>
      <Input
        id={inputId}
        type="number"
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        readOnly={readOnly}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className={cn(
          invalid && "border-amber-400 bg-amber-50/50 focus-visible:outline-amber-500",
          readOnly && "bg-muted/40 text-muted-foreground"
        )}
      />
      {invalid ? <p id={errorId} className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  invalid,
  disabled,
  id,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  hint?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        {hint ? <ContextualHelp text={hint} /> : null}
      </div>
      <textarea
        id={inputId}
        className={cn(
          "min-h-24 w-full rounded-md border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          invalid ? "border-amber-400 bg-amber-50/50 focus-visible:ring-amber-500" : "border-border"
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid ? <p id={errorId} className="text-xs font-medium text-amber-700">Champ manquant</p> : null}
    </div>
  );
}

export function ToggleChip({
  checked,
  label,
  onChange,
  disabled,
  description,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  description?: string;
}) {
  return (
    <label title={description} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
        disabled={disabled}
      />
      <span>{label}</span>
    </label>
  );
}
