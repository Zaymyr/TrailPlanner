"use client";

import * as React from "react";

import { Button } from "../../../../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../../../components/ui/dialog";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { cn } from "../../../../../components/utils";
import { isValidInstagramUrl, normalizeInstagramUrl } from "./validation";

export { hasSignificantDistanceMismatch, hasSuspiciousEqualElevation, isOutsideDateRange, isValidDraft, isValidInstagramUrl, normalizeInstagramUrl } from "./validation";

type Children = { children: React.ReactNode; className?: string };

export function EditorPanel({ title, status, actions, children, className }: Children & { title: string; status?: React.ReactNode; actions?: React.ReactNode }) {
  return <section className={cn("space-y-5 rounded-lg border border-border bg-card p-4 sm:p-6", className)}><header className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-foreground">{title}</h2>{status ? <div className="mt-1">{status}</div> : null}</div>{actions ? <div className="flex items-center gap-2">{actions}</div> : null}</header>{children}</section>;
}

export function FormSection({ title, description, help, children, className }: Children & { title: string; description?: string; help?: React.ReactNode }) {
  return <section className={cn("space-y-4 rounded-md bg-surface-muted/50 p-4", className)}><div className="space-y-1"><h3 className="text-base font-semibold text-foreground">{title}</h3>{description ? <p className="text-sm text-muted-foreground">{description}</p> : null}{help ? <div className="text-sm text-muted-foreground">{help}</div> : null}</div>{children}</section>;
}

export function FieldGroup({ legend, description, optional, children, className }: Children & { legend: string; description?: string; optional?: boolean }) {
  return <section className={cn("grid gap-3 border-t border-border py-5 first:border-t-0 first:pt-0 md:grid-cols-[minmax(9rem,12.5rem)_minmax(0,1fr)] md:gap-5", className)}><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-foreground">{legend}</h3>{optional ? <span className="text-[11px] font-medium text-muted-foreground">Optionnel</span> : null}</div>{description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}</div><div className="min-w-0 space-y-3">{children}</div></section>;
}

export function Field({ label, optional, required, help, error, warning, inherited, htmlFor, children, className }: Children & { label: string; optional?: boolean; required?: boolean; help?: React.ReactNode; error?: string; warning?: string; inherited?: boolean; htmlFor?: string }) {
  const messageId = htmlFor ? `${htmlFor}-message` : undefined;
  return <div className={cn("space-y-1.5", className)}><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Label htmlFor={htmlFor}>{label}</Label>{required ? <span className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-semibold text-brand">Requis</span> : null}{optional ? <span className="text-xs text-muted-foreground">Optionnel</span> : null}{inherited ? <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">Hérité</span> : null}</div>{children}{help ? <p className="text-xs text-muted-foreground">{help}</p> : null}{error ? <p id={messageId} className="text-xs font-medium text-red-700">{error}</p> : null}{warning ? <p className="text-xs font-medium text-amber-700">{warning}</p> : null}</div>;
}

export function SectionHeader({ title, description, status, icon }: { title: string; description?: string; status?: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="flex w-full flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-surface text-brand" aria-hidden="true">{icon ?? <span className="text-base font-bold">↗</span>}</span><div className="min-w-0"><h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>{description ? <p className="text-xs text-muted-foreground">{description}</p> : null}</div></div>{status}</div>;
}

type ValueInputProps = Omit<React.ComponentProps<typeof Input>, "onChange"> & { onValueChange: (value: string) => void; error?: boolean; unit?: string };
function BaseInput({ onValueChange, error, unit, className, ...props }: ValueInputProps) {
  return <div className="relative"><Input {...props} onChange={(event) => onValueChange(event.target.value)} aria-invalid={error || undefined} className={cn("h-11", unit && "pr-12", error && "border-red-500 bg-red-50 focus-visible:outline-red-600", className)} />{unit ? <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{unit}</span> : null}</div>;
}
export const TextInput = (props: ValueInputProps) => <BaseInput type="text" {...props} />;
export const NumberInput = (props: ValueInputProps) => <BaseInput type="number" inputMode="decimal" {...props} />;
export const DateInput = (props: ValueInputProps) => <BaseInput type="date" {...props} />;
export const TimeInput = (props: ValueInputProps) => <BaseInput type="time" {...props} />;

export function Textarea({ onValueChange, error, className, ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> & { onValueChange: (value: string) => void; error?: boolean }) {
  return <textarea {...props} onChange={(event) => onValueChange(event.target.value)} aria-invalid={error || undefined} className={cn("min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", error && "border-red-500 bg-red-50 focus-visible:outline-red-600", className)} />;
}

export function SelectField({ options, onValueChange, error, className, ...props }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & { options: ReadonlyArray<{ value: string; label: string }>; onValueChange: (value: string) => void; error?: boolean }) {
  return <select {...props} onChange={(event) => onValueChange(event.target.value)} aria-invalid={error || undefined} className={cn("h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", error && "border-red-500 bg-red-50", className)}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function UrlInput({ value, onValueChange, onValidationChange, className, ...props }: Omit<ValueInputProps, "onValueChange"> & { value: string; onValueChange: (value: string) => void; onValidationChange?: (valid: boolean) => void }) {
  const [invalid, setInvalid] = React.useState(false);
  return <BaseInput {...props} type="url" value={value} onValueChange={onValueChange} error={invalid} className={className} onBlur={() => { const valid = isValidInstagramUrl(value); setInvalid(!valid); onValidationChange?.(valid); if (valid) onValueChange(normalizeInstagramUrl(value)); }} />;
}

export function SwitchRow({ label, checked, onCheckedChange, description, disabled }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void; description?: string; disabled?: boolean }) {
  return <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 px-1 py-2 text-sm text-foreground last:border-b-0"><span><span className="font-medium">{label}</span>{description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}</span><button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onCheckedChange(!checked)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", checked ? "bg-brand" : "bg-muted", disabled && "cursor-not-allowed opacity-60")}><span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-5" : "left-0.5")} /></button></div>;
}

export const BooleanField = SwitchRow;

export function ChoiceField<T extends string>({ label, value, options, onValueChange, disabled }: { label: string; value: T; options: ReadonlyArray<{ value: T; label: string }>; onValueChange: (value: T) => void; disabled?: boolean }) {
  const id = React.useId();
  return <fieldset disabled={disabled}><legend className="sr-only">{label}</legend><div className="inline-flex rounded-md border border-border bg-surface-muted p-0.5" role="radiogroup" aria-label={label}>{options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={value === option.value} onClick={() => onValueChange(option.value)} className={cn("min-h-10 rounded px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring", value === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>{option.label}</button>)}</div><input type="hidden" name={id} value={value} /></fieldset>;
}

export function FileField({ label, accept, value, onChange, onRemove, maxSizeLabel, className }: { label: string; accept?: string; value?: { name: string; previewUrl?: string; meta?: string } | null; onChange: (file: File) => void; onRemove?: () => void; maxSizeLabel?: string; className?: string }) {
  const id = React.useId();
  return <div className={cn("space-y-2", className)}><Label htmlFor={id}>{label}</Label>{value ? <div className="flex min-h-20 items-center gap-3 rounded-md border border-border bg-card p-2">{value.previewUrl ? <img src={value.previewUrl} alt="Aperçu du fichier" className="h-20 w-20 rounded object-cover" /> : <span className="grid h-16 w-16 shrink-0 place-items-center rounded bg-muted font-mono text-xs text-muted-foreground">FICHIER</span>}<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{value.name}</span>{value.meta || maxSizeLabel ? <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{value.meta ?? maxSizeLabel}</span> : null}</span><label className="cursor-pointer text-sm font-medium text-brand"><input id={id} type="file" accept={accept} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onChange(file); event.currentTarget.value = ""; }} />Remplacer</label>{onRemove ? <Button type="button" variant="ghost" onClick={onRemove} className="min-h-10 text-red-700">Supprimer</Button> : null}</div> : <label htmlFor={id} className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-card p-3 text-center text-sm text-muted-foreground"><input id={id} type="file" accept={accept} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onChange(file); event.currentTarget.value = ""; }} />Dépose un fichier ou choisis-le{maxSizeLabel ? <span className="mt-1 font-mono text-xs">{maxSizeLabel}</span> : null}</label>}</div>;
}

export function MultiFileField({ label, accept, value, onChange, onRemove, maxSizeLabel, className }: { label: string; accept?: string; value: readonly File[]; onChange: (files: File[]) => void; onRemove?: (file: File) => void; maxSizeLabel?: string; className?: string }) {
  const id = React.useId();
  return <div className={cn("space-y-2", className)}><Label htmlFor={id}>{label}</Label><label htmlFor={id} className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground"><input id={id} type="file" accept={accept} multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onChange(files); }} />Dépose des fichiers ou choisis-les{maxSizeLabel ? <span className="mt-1 text-xs">{maxSizeLabel}</span> : null}</label>{value.length ? <ul className="space-y-1 rounded-md border border-border bg-card p-3 text-sm">{value.map((file) => <li key={`${file.name}-${file.size}`} className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate">{file.name}</span>{onRemove ? <Button type="button" variant="ghost" onClick={() => onRemove(file)} className="min-h-8 text-red-700">Supprimer</Button> : null}</li>)}</ul> : null}</div>;
}

export function InheritedSection({ inherited, onCustomize, onRestore, children }: Children & { inherited: boolean; onCustomize: () => void; onRestore: () => void }) {
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm"><span>{inherited ? "Hérité de l’événement" : "Informations propres au format"}</span><Button type="button" variant="outline" onClick={inherited ? onCustomize : onRestore}>{inherited ? "Personnaliser pour ce format" : "Revenir à l’héritage"}</Button></div><div aria-readonly={inherited || undefined} className={cn(inherited && "opacity-75")}>{children}</div></section>;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Supprimer", onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; confirmLabel?: string; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent role="alertdialog" aria-modal="true"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="button" onClick={() => { onConfirm(); onOpenChange(false); }} className="bg-red-700 hover:bg-red-800">{confirmLabel}</Button></DialogFooter></DialogContent></Dialog>;
}

export function SaveStatus({ state, savedAt, onRetry }: { state: "idle" | "saving" | "saved" | "error"; savedAt?: string; onRetry?: () => void }) {
  const text = state === "saving" ? "Enregistrement…" : state === "error" ? "Erreur d’enregistrement" : state === "saved" ? `Enregistré${savedAt ? ` à ${savedAt}` : ""}` : "";
  if (!text) return null;
  return <div className="inline-flex shrink-0 items-center gap-2 text-xs" role="status" aria-live="polite"><span className={state === "error" ? "font-medium text-red-700" : "text-muted-foreground"}>{text}</span>{state === "error" && onRetry ? <Button type="button" variant="outline" className="!min-h-8 !px-2 text-xs" onClick={onRetry}>Réessayer</Button> : null}</div>;
}

export function RepeatableList<T>({ items, createDraft, validateDraft, onCreate, renderDraft, renderItem, getItemKey, onRemove, addLabel, variant = "row" }: { items: readonly T[]; createDraft: () => T; validateDraft: (draft: T) => boolean; onCreate: (draft: T) => void | Promise<void>; renderDraft?: (draft: T, setDraft: React.Dispatch<React.SetStateAction<T | null>>) => React.ReactNode; renderItem: (item: T, index: number) => React.ReactNode; getItemKey?: (item: T, index: number) => string; onRemove?: (item: T) => void | Promise<void>; addLabel: string; variant?: "row" | "card" }) {
  const [draft, setDraft] = React.useState<T | null>(null);
  const [pendingRemoval, setPendingRemoval] = React.useState<T | null>(null);
  const draftRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (draft) draftRef.current?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(); }, [draft]);
  React.useEffect(() => {
    if (!pendingRemoval || !onRemove) return;
    const timeout = window.setTimeout(() => { void onRemove(pendingRemoval); setPendingRemoval(null); }, 6000);
    return () => window.clearTimeout(timeout);
  }, [onRemove, pendingRemoval]);
  const visibleItems = pendingRemoval ? items.filter((item, index) => getItemKey ? getItemKey(item, index) !== getItemKey(pendingRemoval, -1) : item !== pendingRemoval) : items;
  return <div className="space-y-3"><div className={cn("space-y-2", variant === "card" && "grid gap-3 sm:grid-cols-2")}>{visibleItems.map((item, index) => <div key={getItemKey?.(item, index) ?? index} className="relative">{renderItem(item, index)}{onRemove ? <Button type="button" variant="ghost" aria-label="Supprimer l’élément" onClick={() => setPendingRemoval(item)} className="absolute right-1 top-1 min-h-6 min-w-6 px-1 text-red-700">⋯</Button> : null}</div>)}</div>{pendingRemoval ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">Supprimé <Button type="button" variant="ghost" onClick={() => setPendingRemoval(null)}>Annuler</Button></div> : null}{draft ? <div ref={draftRef} className="rounded-md border border-dashed border-brand-border bg-brand-surface p-3"><p className="mb-2 text-sm font-medium">Brouillon à compléter</p>{renderDraft ? <div className="mb-3">{renderDraft(draft, setDraft)}</div> : null}<div className="flex gap-2"><Button type="button" onClick={async () => { if (!validateDraft(draft)) return; await onCreate(draft); setDraft(null); }}>Enregistrer</Button><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Annuler</Button></div></div> : <Button type="button" variant="outline" onClick={() => setDraft(createDraft())}>+ {addLabel}</Button>}</div>;
}
