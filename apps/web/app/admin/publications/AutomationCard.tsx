"use client";

import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { describeAutomationItem, formatAutomationDay } from "./automation-labels";
import type { ReelAutomationItemView, ReelAutomationView } from "./publications-api";

const MODE_LABELS: Record<ReelAutomationItemView["mode"], string> = { full: "Parcours complet", highlights: "Temps forts" };

const TONE_CLASS = {
  muted: "text-muted-foreground",
  active: "text-sky-700 dark:text-sky-300",
  done: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-700 dark:text-amber-300",
  error: "text-red-600 dark:text-red-300",
} as const;

// The server refuses an item in the middle of a step (lease) with a 409.
const canExclude = (item: ReelAutomationItemView) =>
  item.status === "planned" || item.status === "failed" || item.status === "generating" || (item.status === "skipped" && item.reason !== "excluded");

const isFinished = (item: ReelAutomationItemView) =>
  item.status === "scheduled" || item.status === "failed" || (item.status === "skipped" && item.reason !== "too_late");

function Switch({ id, checked, disabled, onChange, label }: { id: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-brand" : "bg-slate-300 dark:bg-slate-700"}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
    </button>
  );
}

/**
 * « Automatisation »: the two switches (both off by default), the caps, and the upcoming plan with
 * « Exclure » / « Rétablir ». Publication without review is behind a confirmation dialog.
 */
export function AutomationCard({ data, isLoading, error, busy, highlightedItemId, onSettings, onItemAction, onRefresh }: {
  data: ReelAutomationView | undefined;
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  highlightedItemId: string | null;
  onSettings: (patch: { generationEnabled?: boolean; autoPublishEnabled?: boolean; confirmAutoPublish?: true }) => void;
  onItemAction: (itemId: string, action: "exclude" | "include") => void;
  onRefresh: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const settings = data?.settings;
  const items = data?.items ?? [];
  const visible = showAll ? items : items.filter((item) => !isFinished(item));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatisation</CardTitle>
        <CardDescription>
          Calendrier des reels tiré du catalogue : formats en ligne avec GPX, au moins un ravito et 30 km. Temps forts au-delà de 60 km, parcours complet en dessous.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {isLoading && !data ? <p className="text-muted-foreground">Chargement…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {settings ? (
          <>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Switch
                  id="automation-generation"
                  label="Génération automatique"
                  checked={settings.generationEnabled}
                  disabled={busy}
                  onChange={(next) => onSettings({ generationEnabled: next })}
                />
                <div>
                  <label htmlFor="automation-generation" className="font-medium text-foreground">Génération automatique</label>
                  <p className="text-xs text-muted-foreground">
                    Rédige le texte, génère la voix et lance le rendu {settings.leadDays} jours avant la date prévue, puis crée le brouillon Instagram. Désactivée, plus rien ne démarre ; les rendus en cours se terminent.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Switch
                  id="automation-publish"
                  label="Publication automatique"
                  checked={settings.autoPublishEnabled}
                  disabled={busy || !settings.generationEnabled}
                  onChange={(next) => (next ? setConfirmOpen(true) : onSettings({ autoPublishEnabled: false }))}
                />
                <div>
                  <label htmlFor="automation-publish" className="font-medium text-foreground">Publication automatique</label>
                  <p className="text-xs text-muted-foreground">
                    Programme chaque brouillon à sa date prévue à {settings.publishTime} (heure de Paris), sans relecture. Le mode simulation reste respecté.
                  </p>
                  {settings.autoPublishEnabled ? (
                    <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      Active : les reels partent sans validation humaine. Relis les brouillons avant leur créneau ou annule leur programmation.
                    </p>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Limites : {settings.maxPerWeek} reels par semaine (lundi-dimanche) et {settings.maxPerDay} par jour. Par événement, du format le plus court au plus long : le plus long au plus tard 7 jours avant le départ, chacun au moins 7 jours avant le suivant.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-foreground">Prochains reels</h3>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowAll((value) => !value)}>
                    {showAll ? "Masquer les terminés" : "Tout afficher"}
                  </Button>
                  <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={busy} onClick={onRefresh}>Recalculer</Button>
                </div>
              </div>
              {visible.length === 0 ? (
                <p className="text-muted-foreground">Rien de prévu pour l’instant.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
                  {visible.map((item) => {
                    const status = describeAutomationItem(item);
                    return (
                      <li key={item.id} id={`automation-${item.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${highlightedItemId === item.id ? "bg-brand/10" : ""}`}>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.raceName ?? "Course supprimée"}</p>
                          <p className="text-xs text-muted-foreground">{MODE_LABELS[item.mode]} · {formatAutomationDay(item.plannedPublishDate)} à {settings.publishTime}</p>
                          <p className={`text-xs ${TONE_CLASS[status.tone]}`}>{status.label}</p>
                        </div>
                        {item.status === "skipped" && item.reason === "excluded" ? (
                          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => onItemAction(item.id, "include")}>Rétablir</Button>
                        ) : canExclude(item) ? (
                          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" disabled={busy} onClick={() => onItemAction(item.id, "exclude")}>Exclure</Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier sans relecture ?</DialogTitle>
            <DialogDescription>
              Chaque reel généré automatiquement sera programmé sur Instagram à sa date prévue, à {settings?.publishTime ?? "18:00"}, sans qu’un humain valide le texte ni la vidéo. Tu pourras toujours annuler une programmation dans la liste des publications. En mode simulation, rien n’atteint Instagram.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>Annuler</Button>
            <Button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                onSettings({ autoPublishEnabled: true, confirmAutoPublish: true });
              }}
            >
              Activer la publication automatique
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
