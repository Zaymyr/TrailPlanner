import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import type { OrganizerSponsor } from "./types";

const toPatch = (sponsor: OrganizerSponsor) => ({
  name: sponsor.name,
  websiteUrl: sponsor.websiteUrl,
  isActive: sponsor.isActive,
  showOnLoading: sponsor.showOnLoading,
  showInBanner: sponsor.showInBanner,
  position: sponsor.position,
});

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
  const [dirtySponsorIds, setDirtySponsorIds] = useState<Set<string>>(() => new Set());

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
    if (!newImage) {
      onToast("error", "Ajoute un logo au sponsor.");
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
      onToast("success", "Sponsor ajouté.");
    } catch (error) {
      onToast("error", error instanceof Error ? error.message : "Impossible d'ajouter le sponsor.");
    } finally {
      setBusyId(null);
    }
  };

  const replaceLogo = async (sponsor: OrganizerSponsor, event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    event.target.value = "";
    if (!image) return;
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
    if (!window.confirm(`Supprimer le sponsor ${sponsor.name} ?`)) return;
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

  const moveSponsor = async (index: number, direction: -1 | 1) => {
    const otherIndex = index + direction;
    if (otherIndex < 0 || otherIndex >= sponsors.length) return;
    const next = [...sponsors];
    const first = { ...next[index]!, position: otherIndex };
    const second = { ...next[otherIndex]!, position: index };
    next[index] = second;
    next[otherIndex] = first;
    setSponsors(next);
    const [firstSaved, secondSaved] = await Promise.all([persistSponsor(first), persistSponsor(second)]);
    if (firstSaved && secondSaved) onToast("success", "Ordre des sponsors mis à jour.");
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des sponsors...</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        Jusqu'à 10 sponsors par édition, dont 2 maximum sur l'écran de chargement. Les changements de placement sont enregistrés immédiatement.
      </div>
      {sponsors.map((sponsor, index) => {
        const loadingDisabled = !sponsor.showOnLoading && loadingSponsorCount >= 2;
        const activationDisabled = !sponsor.isActive && sponsor.showOnLoading && loadingSponsorCount >= 2;
        return (
          <div key={sponsor.id} className="grid gap-4 rounded-lg border border-border p-4 lg:grid-cols-[88px_1fr_auto]">
            <div className="space-y-2">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-border bg-white p-2">
                <img src={sponsor.logoUrl} alt={`Logo ${sponsor.name}`} className="max-h-full max-w-full object-contain" />
              </div>
              <Label className="block cursor-pointer text-xs text-brand">Remplacer<Input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => void replaceLogo(sponsor, event)} /></Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Nom</Label><Input value={sponsor.name} maxLength={80} onChange={(event) => changeSponsor(sponsor.id, { name: event.target.value })} onBlur={() => sponsor.name.trim() && void persistSponsor(sponsor)} /></div>
              <div className="space-y-1"><Label>Site web</Label><Input type="url" value={sponsor.websiteUrl ?? ""} onChange={(event) => changeSponsor(sponsor.id, { websiteUrl: event.target.value || null })} onBlur={() => void persistSponsor(sponsor)} placeholder="https://..." /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sponsor.isActive} disabled={activationDisabled} onChange={(event) => void toggleSponsor(sponsor, { isActive: event.target.checked })} /> Actif</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sponsor.showOnLoading} disabled={loadingDisabled} onChange={(event) => void toggleSponsor(sponsor, { showOnLoading: event.target.checked })} /> Écran de chargement</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sponsor.showInBanner} onChange={(event) => void toggleSponsor(sponsor, { showInBanner: event.target.checked })} /> Bandeau RaceBook</label>
              <p className="text-sm font-semibold text-foreground">{sponsor.clickCount} clic{sponsor.clickCount > 1 ? "s" : ""}</p>
            </div>
            <div className="flex flex-row gap-2 lg:flex-col">
              <Button type="button" variant="outline" onClick={() => void persistSponsor(sponsor, "Sponsor enregistré.")} disabled={busyId === sponsor.id}>Enregistrer</Button>
              <div className="flex gap-2"><Button type="button" variant="ghost" aria-label="Monter le sponsor" onClick={() => void moveSponsor(index, -1)} disabled={index === 0}>↑</Button><Button type="button" variant="ghost" aria-label="Descendre le sponsor" onClick={() => void moveSponsor(index, 1)} disabled={index === sponsors.length - 1}>↓</Button></div>
              <Button type="button" variant="outline" className="border-red-300 text-red-700" onClick={() => void removeSponsor(sponsor)} disabled={busyId === sponsor.id}>Supprimer</Button>
            </div>
          </div>
        );
      })}
      {sponsors.length < 10 ? (
        <form className="space-y-4 rounded-lg border border-dashed border-border p-4" onSubmit={createSponsor}>
          <h3 className="font-semibold text-foreground">Ajouter un sponsor</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Nom</Label><Input required maxLength={80} value={newName} onChange={(event) => setNewName(event.target.value)} /></div>
            <div className="space-y-1"><Label>Site web optionnel</Label><Input type="url" value={newWebsiteUrl} onChange={(event) => setNewWebsiteUrl(event.target.value)} /></div>
            <div className="space-y-1"><Label>Logo</Label><Input required type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={(event) => setNewImage(event.target.files?.[0] ?? null)} /></div>
            <div className="flex flex-wrap items-end gap-4 pb-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newShowOnLoading} disabled={loadingSponsorCount >= 2} onChange={(event) => setNewShowOnLoading(event.target.checked)} /> Chargement</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newShowInBanner} onChange={(event) => setNewShowInBanner(event.target.checked)} /> Bandeau</label></div>
          </div>
          <Button type="submit" disabled={busyId === "new"}>{busyId === "new" ? "Ajout..." : "Ajouter le sponsor"}</Button>
        </form>
      ) : null}
    </div>
  );
}
