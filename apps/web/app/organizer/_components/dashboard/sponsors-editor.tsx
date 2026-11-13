import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { OrganizerSponsor } from "./types";
import { PartnerSlotsEditor } from "./partner-slots-editor";
import { Field, FileField, SelectField, SwitchRow } from "./form-kit";

const toPatch = (sponsor: OrganizerSponsor) => ({
  name: sponsor.name,
  websiteUrl: sponsor.websiteUrl,
  isActive: sponsor.isActive,
  showOnLoading: sponsor.showOnLoading,
  showInBanner: sponsor.showInBanner,
  position: sponsor.position,
  tier: sponsor.tier,
  category: sponsor.category,
  contextualPlacement: sponsor.contextualPlacement,
});

const tierLabels: Record<OrganizerSponsor["tier"], string> = {
  principal: "Partenaire principal",
  official: "Partenaire officiel",
  service: "Partenaire de service",
};

const placementLabels: Record<OrganizerSponsor["contextualPlacement"], string> = {
  none: "Aucun emplacement contextuel",
  aid_stations: "Ravitos",
  equipment: "Matériel",
  access: "Accès",
  services: "Services",
};

export function SponsorsEditor({
  editionId,
  authHeaders,
  onSummaryChange,
  onToast,
}: {
  editionId: string;
  authHeaders: Record<string, string>;
  onSummaryChange: (summary: { sponsors: number; clicks: number }) => void;
  onToast: (type: "success" | "error", message: string) => void;
}) {
  const [sponsors, setSponsors] = useState<OrganizerSponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [newImage, setNewImage] = useState<File | null>(null);
  const [newShowOnLoading, setNewShowOnLoading] = useState(false);
  const [newShowInBanner, setNewShowInBanner] = useState(true);
  const [newTier, setNewTier] = useState<OrganizerSponsor["tier"]>("official");
  const [newCategory, setNewCategory] = useState("");
  const [newContextualPlacement, setNewContextualPlacement] = useState<OrganizerSponsor["contextualPlacement"]>("none");
  const [newSponsorSubmitted, setNewSponsorSubmitted] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<OrganizerSponsor | null>(null);
  const [dirtySponsorIds, setDirtySponsorIds] = useState<Set<string>>(() => new Set());
  const formId = useId();

  const updateSummary = useCallback((items: OrganizerSponsor[]) => {
    onSummaryChange({
      sponsors: items.filter((sponsor) => sponsor.isActive).length,
      clicks: items.reduce((total, sponsor) => total + sponsor.clickCount, 0),
    });
  }, [onSummaryChange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/organizer/editions/${editionId}/sponsors`, { headers: authHeaders, cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { sponsors?: OrganizerSponsor[]; message?: string } | null;
        if (!response.ok) throw new Error(data?.message ?? "Impossible de charger les sponsors.");
        if (!cancelled) {
          const items = data?.sponsors ?? [];
          setSponsors(items);
          updateSummary(items);
        }
      })
      .catch((error) => {
        if (!cancelled) onToast("error", error instanceof Error ? error.message : "Impossible de charger les sponsors.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authHeaders, editionId, onToast, updateSummary]);

  useEffect(() => {
    if (dirtySponsorIds.size === 0) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirtySponsorIds]);

  const loadingSponsorCount = useMemo(
    () => sponsors.filter((sponsor) => sponsor.isActive && sponsor.showOnLoading).length,
    [sponsors],
  );

  const persistSponsor = async (next: OrganizerSponsor, successMessage?: string) => {
    setBusyId(next.id);
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors/${next.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(toPatch(next)),
      });
      const data = (await response.json().catch(() => null)) as { sponsor?: OrganizerSponsor; message?: string } | null;
      if (!response.ok || !data?.sponsor) throw new Error(data?.message ?? "Impossible d'enregistrer le sponsor.");
      setSponsors((current) => {
        const items = current.map((sponsor) => sponsor.id === next.id ? data.sponsor! : sponsor).sort((a, b) => a.position - b.position);
        updateSummary(items);
        return items;
      });
      setDirtySponsorIds((current) => {
        const nextDirty = new Set(current);
        nextDirty.delete(next.id);
        return nextDirty;
      });
      if (successMessage) onToast("success", successMessage);
      return true;
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible d'enregistrer le sponsor.");
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const changeSponsor = (id: string, patch: Partial<OrganizerSponsor>, markDirty = true) => {
    setSponsors((current) => current.map((sponsor) => sponsor.id === id ? { ...sponsor, ...patch } : sponsor));
    if (markDirty) setDirtySponsorIds((current) => new Set(current).add(id));
  };

  const toggleSponsor = async (sponsor: OrganizerSponsor, patch: Partial<OrganizerSponsor>) => {
    const next = { ...sponsor, ...patch };
    changeSponsor(sponsor.id, patch);
    if (!(await persistSponsor(next))) {
      changeSponsor(sponsor.id, sponsor, false);
      setDirtySponsorIds((current) => {
        const nextDirty = new Set(current);
        nextDirty.delete(sponsor.id);
        return nextDirty;
      });
    }
  };

  const createSponsor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewSponsorSubmitted(true);
    if (!newName.trim() || !newImage) {
      return;
    }
    setBusyId("new");
    try {
      const formData = new FormData();
      formData.set("name", newName);
      formData.set("websiteUrl", newWebsiteUrl);
      formData.set("isActive", "true");
      formData.set("showOnLoading", String(newShowOnLoading));
      formData.set("showInBanner", String(newShowInBanner));
      formData.set("tier", newTier);
      formData.set("category", newCategory);
      formData.set("contextualPlacement", newContextualPlacement);
      formData.set("image", newImage);
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors`, { method: "POST", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { sponsor?: OrganizerSponsor; message?: string } | null;
      if (!response.ok || !data?.sponsor) throw new Error(data?.message ?? "Impossible d'ajouter le sponsor.");
      const items = [...sponsors, data.sponsor].sort((a, b) => a.position - b.position);
      setSponsors(items);
      updateSummary(items);
      setNewName("");
      setNewWebsiteUrl("");
      setNewImage(null);
      setNewShowOnLoading(false);
      setNewShowInBanner(true);
      setNewTier("official");
      setNewCategory("");
      setNewContextualPlacement("none");
      setNewSponsorSubmitted(false);
      onToast("success", "Sponsor ajouté.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible d'ajouter le sponsor.");
    } finally {
      setBusyId(null);
    }
  };

  const replaceLogo = async (sponsor: OrganizerSponsor, image: File) => {
    setBusyId(sponsor.id);
    try {
      const formData = new FormData();
      formData.set("image", image);
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors/${sponsor.id}`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { sponsor?: OrganizerSponsor; message?: string } | null;
      if (!response.ok || !data?.sponsor) throw new Error(data?.message ?? "Impossible de remplacer le logo.");
      setSponsors((current) => current.map((item) => item.id === sponsor.id ? data.sponsor! : item));
      onToast("success", "Logo remplacé.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible de remplacer le logo.");
    } finally {
      setBusyId(null);
    }
  };

  const removeSponsor = async (sponsor: OrganizerSponsor) => {
    setBusyId(sponsor.id);
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors/${sponsor.id}`, { method: "DELETE", headers: authHeaders });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(data?.message ?? "Impossible de supprimer le sponsor.");
      const items = sponsors.filter((item) => item.id !== sponsor.id).map((item, position) => ({ ...item, position }));
      setSponsors(items);
      setDirtySponsorIds((current) => {
        const nextDirty = new Set(current);
        nextDirty.delete(sponsor.id);
        return nextDirty;
      });
      updateSummary(items);
      onToast("success", "Sponsor supprimé.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible de supprimer le sponsor.");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (!pendingRemoval) return;
    const timeout = window.setTimeout(() => {
      void removeSponsor(pendingRemoval);
      setPendingRemoval(null);
    }, 6000);
    return () => window.clearTimeout(timeout);
  }, [pendingRemoval, removeSponsor]);

  const moveSponsor = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= sponsors.length) return;
    const next = [...sponsors];
    const first = { ...next[index]!, position: otherIndex };
    const second = { ...next[otherIndex]!, position: index };
    next[index] = second;
    next[otherIndex] = first;
    setSponsors(next);
    setBusyId("order");
    try {
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          sponsors: next.map((sponsor) => ({ id: sponsor.id, position: sponsor.position })),
        }),
      });
      const data = (await response.json().catch(() => null)) as { sponsors?: OrganizerSponsor[]; message?: string } | null;
      if (!response.ok || !data?.sponsors) {
        throw new Error(data?.message ?? "Impossible d'enregistrer l'ordre des sponsors.");
      }
      const savedSponsors = [...data.sponsors].sort((a, b) => a.position - b.position);
      setSponsors(savedSponsors);
      updateSummary(savedSponsors);
      onToast("success", "Ordre des sponsors mis à jour.");
    } catch (error) {
      const response = await fetch(`/api/organizer/editions/${editionId}/sponsors`, { headers: authHeaders, cache: "no-store" }).catch(() => null);
      const data = response?.ok ? await response.json().catch(() => null) as { sponsors?: OrganizerSponsor[] } | null : null;
      if (data?.sponsors) setSponsors(data.sponsors);
      onToast("error", error instanceof Error ? error.message : "Impossible d'enregistrer l'ordre des sponsors.");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des sponsors...</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-foreground">Sponsors de l’édition</h3><p className="text-sm text-muted-foreground">Logo, niveau et emplacements visibles dans le Livret coureur.</p></div><span className="font-mono text-sm text-muted-foreground">{sponsors.length} sponsor{sponsors.length > 1 ? "s" : ""}</span></div>
      <PartnerSlotsEditor editionId={editionId} authHeaders={authHeaders} sponsors={sponsors} onToast={onToast} />
      {sponsors.length > 0 ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label="Logos des sponsors">
        {sponsors.filter((sponsor) => sponsor.id !== pendingRemoval?.id).map((sponsor) => <button key={`logo-${sponsor.id}`} type="button" className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-3 text-center hover:border-brand-border" onClick={() => document.getElementById(`sponsor-editor-${sponsor.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <Image src={sponsor.logoUrl} alt="" width={72} height={56} sizes="72px" unoptimized className="h-14 w-[72px] object-contain" />
          <span className="line-clamp-2 text-xs font-semibold text-foreground">{sponsor.name}</span>
        </button>)}
      </div> : null}
      {sponsors.filter((sponsor) => sponsor.id !== pendingRemoval?.id).map((sponsor, index) => {
        const loadingDisabled = !sponsor.showOnLoading && loadingSponsorCount >= 2;
        const activationDisabled = !sponsor.isActive && sponsor.showOnLoading && loadingSponsorCount >= 2;
        return (
          <div id={`sponsor-editor-${sponsor.id}`} key={sponsor.id} className="grid scroll-mt-4 gap-4 rounded-lg border border-border p-4 lg:grid-cols-[88px_1fr_auto]">
            <div className="space-y-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-white p-2">
                <Image src={sponsor.logoUrl} alt={`Logo ${sponsor.name}`} width={80} height={80} sizes="80px" unoptimized className="max-h-full max-w-full object-contain" />
              </div>
              <FileField label={`Logo de ${sponsor.name}`} value={{ name: sponsor.name, previewUrl: sponsor.logoUrl }} accept="image/png,image/jpeg,image/webp,image/avif" maxSizeLabel="PNG, JPEG, WebP ou AVIF" onChange={(image) => void replaceLogo(sponsor, image)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor={`${formId}-${sponsor.id}-name`}>Nom</Label><Input id={`${formId}-${sponsor.id}-name`} value={sponsor.name} maxLength={80} onChange={(event) => changeSponsor(sponsor.id, { name: event.target.value })} onBlur={() => sponsor.name.trim() && void persistSponsor(sponsor)} /></div>
              <div className="space-y-1"><Label htmlFor={`${formId}-${sponsor.id}-website`}>Site web</Label><Input id={`${formId}-${sponsor.id}-website`} type="url" value={sponsor.websiteUrl ?? ""} onChange={(event) => changeSponsor(sponsor.id, { websiteUrl: event.target.value || null })} onBlur={() => void persistSponsor(sponsor)} placeholder="https://..." /></div>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-${sponsor.id}-tier`}>Niveau</Label>
                <SelectField id={`${formId}-${sponsor.id}-tier`} value={sponsor.tier} options={Object.entries(tierLabels).map(([value, label]) => ({ value, label }))} onValueChange={(value) => void toggleSponsor(sponsor, { tier: value as OrganizerSponsor["tier"] })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${formId}-${sponsor.id}-placement`}>Placement contextuel</Label>
                <SelectField id={`${formId}-${sponsor.id}-placement`} value={sponsor.contextualPlacement} options={Object.entries(placementLabels).map(([value, label]) => ({ value, label }))} onValueChange={(value) => void toggleSponsor(sponsor, { contextualPlacement: value as OrganizerSponsor["contextualPlacement"] })} />
              </div>
              <div className="space-y-1 sm:col-span-2"><Label htmlFor={`${formId}-${sponsor.id}-category`}>Catégorie ou rôle</Label><Input id={`${formId}-${sponsor.id}-category`} value={sponsor.category ?? ""} maxLength={60} onChange={(event) => changeSponsor(sponsor.id, { category: event.target.value || null })} onBlur={() => void persistSponsor(sponsor)} placeholder="Ex. équipementier officiel, hébergement partenaire" /></div>
              <SwitchRow label="Actif" checked={sponsor.isActive} disabled={activationDisabled} onCheckedChange={(isActive) => void toggleSponsor(sponsor, { isActive })} />
              <SwitchRow label="Écran de chargement" checked={sponsor.showOnLoading} disabled={loadingDisabled} onCheckedChange={(showOnLoading) => void toggleSponsor(sponsor, { showOnLoading })} />
              <SwitchRow label="Bloc partenaires" checked={sponsor.showInBanner} onCheckedChange={(showInBanner) => void toggleSponsor(sponsor, { showInBanner })} />
              <p className="text-sm font-semibold text-foreground">{sponsor.impressionCount} vue{sponsor.impressionCount > 1 ? "s" : ""} · {sponsor.clickCount} clic{sponsor.clickCount > 1 ? "s" : ""}</p>
            </div>
            <div className="flex flex-row gap-2 lg:flex-col">
              <div className="flex gap-2"><Button type="button" variant="ghost" aria-label="Monter le sponsor" onClick={() => void moveSponsor(index, -1)} disabled={index === 0 || busyId !== null}>↑</Button><Button type="button" variant="ghost" aria-label="Descendre le sponsor" onClick={() => void moveSponsor(index, 1)} disabled={index === sponsors.length - 1 || busyId !== null}>↓</Button></div>
              <Button type="button" variant="outline" className="border-red-300 text-red-700" onClick={() => setPendingRemoval(sponsor)} disabled={busyId === sponsor.id}>Supprimer</Button>
            </div>
          </div>
        );
      })}
      {sponsors.length < 10 ? (
        <details className="group rounded-lg border border-dashed border-border bg-card p-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-brand marker:content-none">+ Ajouter un sponsor<span className="ml-auto text-muted-foreground group-open:hidden">Ouvrir</span></summary>
        <form className="space-y-4 rounded-lg border border-dashed border-border p-4" onSubmit={createSponsor}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nom" htmlFor={`${formId}-new-name`} error={newSponsorSubmitted && !newName.trim() ? "Indique le nom du sponsor." : undefined}><Input id={`${formId}-new-name`} maxLength={80} value={newName} aria-invalid={newSponsorSubmitted && !newName.trim() || undefined} onChange={(event) => setNewName(event.target.value)} /></Field>
            <div className="space-y-1"><Label htmlFor={`${formId}-new-website`}>Site web optionnel</Label><Input id={`${formId}-new-website`} type="url" value={newWebsiteUrl} onChange={(event) => setNewWebsiteUrl(event.target.value)} /></div>
            <Field label="Logo" error={newSponsorSubmitted && !newImage ? "Ajoute un logo au sponsor." : undefined}><FileField label="Choisir un logo" accept="image/png,image/jpeg,image/webp,image/avif" value={newImage ? { name: newImage.name } : null} maxSizeLabel="PNG, JPEG, WebP ou AVIF" onChange={setNewImage} onRemove={() => setNewImage(null)} /></Field>
            <div className="space-y-1"><Label htmlFor={`${formId}-new-tier`}>Niveau</Label><SelectField id={`${formId}-new-tier`} value={newTier} options={Object.entries(tierLabels).map(([value, label]) => ({ value, label }))} onValueChange={(value) => setNewTier(value as OrganizerSponsor["tier"])} /></div>
            <div className="space-y-1"><Label htmlFor={`${formId}-new-placement`}>Placement contextuel</Label><SelectField id={`${formId}-new-placement`} value={newContextualPlacement} options={Object.entries(placementLabels).map(([value, label]) => ({ value, label }))} onValueChange={(value) => setNewContextualPlacement(value as OrganizerSponsor["contextualPlacement"])} /></div>
            <div className="space-y-1 md:col-span-2"><Label htmlFor={`${formId}-new-category`}>Catégorie ou rôle</Label><Input id={`${formId}-new-category`} maxLength={60} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="Ex. équipementier officiel" /></div>
            <div className="grid gap-3 md:col-span-2 sm:grid-cols-2"><SwitchRow label="Écran de chargement" checked={newShowOnLoading} disabled={loadingSponsorCount >= 2} onCheckedChange={setNewShowOnLoading} /><SwitchRow label="Bloc partenaires" checked={newShowInBanner} onCheckedChange={setNewShowInBanner} /></div>
          </div>
          <Button type="submit" disabled={busyId === "new"}>{busyId === "new" ? "Ajout..." : "Ajouter le sponsor"}</Button>
        </form>
        </details>
      ) : null}
      {pendingRemoval ? <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">Sponsor supprimé <Button type="button" variant="ghost" onClick={() => setPendingRemoval(null)}>Annuler</Button></div> : null}
    </div>
  );
}
