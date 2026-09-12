import {
  DEFAULT_RACEBOOK_ACCENT_COLOR,
  DEFAULT_RACEBOOK_PRIMARY_COLOR,
  RACEBOOK_EDITION_LOGO_ENABLED,
  isHexColor,
  resolveRacebookTheme,
} from "@pace-yourself/design-system";
import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { ContextualHelp } from "./controls";
import type { OrganizerBranding, OrganizerBrandingState } from "./types";

const emptyState = (): OrganizerBrandingState => ({
  draft: { logoUrl: null, primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR, accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR },
  published: { logoUrl: null, primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR, accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR },
  publishedAt: null,
  hasUnpublishedChanges: false,
});

export function BrandingEditor({
  editionId,
  eventName,
  authHeaders,
  onSummaryChange,
  onDraftChange,
  onDraftStatusChange,
  onToast,
  hideInlinePreview = false,
}: {
  editionId: string;
  eventName: string;
  authHeaders: Record<string, string>;
  onSummaryChange: (summary: { configured: boolean; unpublished: boolean }) => void;
  onDraftChange?: (draft: OrganizerBranding) => void;
  onDraftStatusChange?: (status: { dirty: boolean }) => void;
  onToast: (type: "success" | "error", message: string) => void;
  hideInlinePreview?: boolean;
}) {
  const [serverState, setServerState] = useState<OrganizerBrandingState>(emptyState);
  const [draft, setDraft] = useState<OrganizerBranding>(emptyState().draft);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "logo" | "publish" | "reset" | null>(null);
  const formId = useId();
  const onDraftChangeRef = useRef(onDraftChange);
  onDraftChangeRef.current = onDraftChange;

  const updateState = useCallback((next: OrganizerBrandingState) => {
    setServerState(next);
    setDraft(next.draft);
    onDraftChangeRef.current?.(next.draft);
    onSummaryChange({ configured: Boolean(next.publishedAt), unpublished: next.hasUnpublishedChanges });
  }, [onSummaryChange]);

  const changeDraft = (next: OrganizerBranding) => {
    setDraft(next);
    onDraftChangeRef.current?.(next);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/organizer/editions/${editionId}/branding`, { headers: authHeaders, cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { branding?: OrganizerBrandingState; message?: string } | null;
        if (!response.ok || !data?.branding) throw new Error(data?.message ?? "Impossible de charger l'identité visuelle.");
        if (!cancelled) updateState(data.branding);
      })
      .catch((error) => {
        if (!cancelled) onToast("error", error instanceof Error ? error.message : "Impossible de charger l'identité visuelle.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authHeaders, editionId, onToast, updateState]);

  const localDirty =
    draft.primaryColor !== serverState.draft.primaryColor ||
    draft.accentColor !== serverState.draft.accentColor ||
    draft.logoUrl !== serverState.draft.logoUrl;

  useEffect(() => {
    onDraftStatusChange?.({ dirty: localDirty });
  }, [localDirty, onDraftStatusChange]);

  useEffect(() => {
    if (!localDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [localDirty]);

  const theme = useMemo(() => resolveRacebookTheme(draft), [draft]);

  const saveColors = async (silent = false) => {
    if (!isHexColor(draft.primaryColor) || !isHexColor(draft.accentColor)) {
      onToast("error", "Utilise des couleurs au format #RRGGBB.");
      return null;
    }
    setBusy("save");
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/branding`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: draft.primaryColor, accentColor: draft.accentColor }),
      });
      const data = (await response.json().catch(() => null)) as { branding?: OrganizerBrandingState; message?: string } | null;
      if (!response.ok || !data?.branding) throw new Error(data?.message ?? "Impossible d'enregistrer le brouillon.");
      updateState(data.branding);
      if (!silent) onToast("success", "Brouillon de la DA enregistré.");
      return data.branding;
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible d'enregistrer le brouillon.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
    if (localDirty && !(await saveColors(true))) return;
    const localPreviewUrl = URL.createObjectURL(image);
    onDraftChangeRef.current?.({ ...draft, logoUrl: localPreviewUrl });
    setBusy("logo");
    try {
      const formData = new FormData();
      formData.set("image", image);
      const response = await fetch(`/api/organizer/editions/${editionId}/branding`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { branding?: OrganizerBrandingState; message?: string } | null;
      if (!response.ok || !data?.branding) throw new Error(data?.message ?? "Impossible d'envoyer le logo.");
      updateState(data.branding);
      onToast("success", "Logo ajouté au brouillon.");
    } catch (error) {
      onDraftChangeRef.current?.(draft);
      onToast("error", error instanceof Error ? error.message : "Impossible d'envoyer le logo.");
    } finally {
      URL.revokeObjectURL(localPreviewUrl);
      setBusy(null);
    }
  };

  const removeLogo = async () => {
    if (localDirty && !(await saveColors(true))) return;
    onDraftChangeRef.current?.({ ...draft, logoUrl: null });
    setBusy("logo");
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/branding`, { method: "DELETE", headers: authHeaders });
      const data = (await response.json().catch(() => null)) as { branding?: OrganizerBrandingState; message?: string } | null;
      if (!response.ok || !data?.branding) throw new Error(data?.message ?? "Impossible de retirer le logo.");
      updateState(data.branding);
      onToast("success", "Logo retiré du brouillon.");
    } catch (error) {
      onDraftChangeRef.current?.(draft);
      onToast("error", error instanceof Error ? error.message : "Impossible de retirer le logo.");
    } finally {
      setBusy(null);
    }
  };

  const resetDraft = async () => {
    setBusy("reset");
    changeDraft({ ...draft, primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR, accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR });
    try {
      const colorsResponse = await fetch(`/api/organizer/editions/${editionId}/branding`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor: DEFAULT_RACEBOOK_PRIMARY_COLOR, accentColor: DEFAULT_RACEBOOK_ACCENT_COLOR }),
      });
      if (!colorsResponse.ok) throw new Error("Impossible de réinitialiser le brouillon.");
      const data = (await colorsResponse.json()) as { branding: OrganizerBrandingState };
      updateState(data.branding);
      onToast("success", "DA Pace Yourself restaurée dans le brouillon.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible de réinitialiser le brouillon.");
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (localDirty && !(await saveColors(true))) return;
    setBusy("publish");
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/branding`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });
      const data = (await response.json().catch(() => null)) as { branding?: OrganizerBrandingState; message?: string } | null;
      if (!response.ok || !data?.branding) throw new Error(data?.message ?? "Impossible de publier la DA.");
      updateState(data.branding);
      onToast("success", "Nouvelle DA publiée dans le RaceBook.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible de publier la DA.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement de l’identité visuelle...</p>;

  return (
    <div className={hideInlinePreview ? "grid gap-6" : "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${serverState.hasUnpublishedChanges || localDirty ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
            {serverState.hasUnpublishedChanges || localDirty ? "Brouillon non publié" : serverState.publishedAt ? "DA publiée" : "Thème Pace Yourself"}
          </span>
          {serverState.publishedAt ? <span className="text-xs text-muted-foreground">Publié le {new Date(serverState.publishedAt).toLocaleString("fr-FR")}</span> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["primaryColor", "accentColor"] as const).map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={`${formId}-${field}-text`}>{field === "primaryColor" ? "Couleur principale" : "Couleur d’accent"}</Label>
              <div className="flex gap-2">
                <Input id={`${formId}-${field}-picker`} aria-label={`Sélectionner ${field === "primaryColor" ? "la couleur principale" : "la couleur d’accent"}`} type="color" value={isHexColor(draft[field]) ? draft[field] : field === "primaryColor" ? DEFAULT_RACEBOOK_PRIMARY_COLOR : DEFAULT_RACEBOOK_ACCENT_COLOR} onChange={(event) => changeDraft({ ...draft, [field]: event.target.value.toUpperCase() })} className="w-14 p-1" />
                <Input id={`${formId}-${field}-text`} value={draft[field]} maxLength={7} onChange={(event) => changeDraft({ ...draft, [field]: event.target.value.toUpperCase() })} aria-invalid={!isHexColor(draft[field])} />
              </div>
            </div>
          ))}
        </div>

        {RACEBOOK_EDITION_LOGO_ENABLED ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor={`${formId}-logo`}>Logo officiel de l’édition</Label>
              <ContextualHelp text="PNG, JPEG, WebP ou AVIF, 5 Mo maximum. Un fond transparent est recommandé." />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Input id={`${formId}-logo`} type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => void uploadLogo(event)} disabled={busy !== null} className="max-w-sm" />
              {draft.logoUrl ? <Button type="button" variant="outline" onClick={() => void removeLogo()} disabled={busy !== null}>Retirer le logo</Button> : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void saveColors()} disabled={busy !== null || !localDirty}>Enregistrer le brouillon</Button>
          <Button type="button" variant="outline" onClick={() => changeDraft(serverState.draft)} disabled={busy !== null || !localDirty}>Annuler les changements</Button>
          <Button type="button" variant="outline" onClick={() => void resetDraft()} disabled={busy !== null}>Réinitialiser au thème Pace Yourself</Button>
          <Button type="button" onClick={() => void publish()} disabled={busy !== null || (!serverState.hasUnpublishedChanges && !localDirty)} className="ml-auto">Publier la DA</Button>
        </div>
      </div>

      {hideInlinePreview ? null : <div className="rounded-[28px] border border-border bg-[#ECEAE3] p-4 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aperçu mobile</p>
        <div className="space-y-3 rounded-2xl bg-white p-4">
          <div className="flex items-start gap-3">
            {RACEBOOK_EDITION_LOGO_ENABLED && theme.logoUrl ? <Image src={theme.logoUrl} alt={`Logo ${eventName}`} width={56} height={56} sizes="56px" unoptimized className="h-14 w-14 rounded-xl border object-contain p-1" /> : null}
            <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase" style={{ color: theme.primaryColor }}>{eventName}</p><p className="truncate text-lg font-bold">RaceBook</p><p className="text-xs text-muted-foreground">Édition sélectionnée</p></div>
          </div>
          <div className="flex gap-2"><span className="flex-1 rounded-xl px-2 py-2 text-center text-xs font-bold" style={{ backgroundColor: theme.primaryColor, color: theme.onPrimaryColor }}>Course</span><span className="flex-1 rounded-xl border px-2 py-2 text-center text-xs">Accès</span></div>
          <div className="rounded-xl border p-3" style={{ borderColor: theme.accentBorderColor, backgroundColor: theme.accentSurfaceColor }}><p className="text-xs font-bold">Informations importantes</p><p className="mt-1 text-xs text-muted-foreground">La couleur d’accent habille aussi les encarts non critiques.</p></div>
          <svg viewBox="0 0 240 56" role="img" aria-label="Aperçu du tracé" className="h-14 w-full"><polyline points="4,44 38,30 72,36 110,12 150,24 188,8 236,18" fill="none" stroke={theme.accentColor} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <button type="button" className="w-full rounded-xl px-3 py-2 text-sm font-bold" style={{ backgroundColor: theme.primaryColor, color: theme.onPrimaryColor }}>Action principale</button>
        </div>
      </div>}
    </div>
  );
}
