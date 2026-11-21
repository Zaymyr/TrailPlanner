"use client";

import { useState, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { describeAutomationItem, formatAutomationDay } from "./automation-labels";
import type { ReelAutomationItemView, ReelAutomationView, RenderActivityView } from "./publications-api";

const MODE_LABELS: Record<ReelAutomationItemView["mode"], string> = { full: "Parcours complet", highlights: "Temps forts" };

export const AUTOMATION_TONE_CLASS = {
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

export function AutomationSwitch({ id, checked, disabled, onChange, label }: { id: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void; label: string }) {
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

/** One switch with its label and explanation (Paramètres tab). */
export function SettingRow({ id, label, checked, disabled, onChange, children }: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <AutomationSwitch id={id} label={label} checked={checked} disabled={disabled} onChange={onChange} />
      <div>
        <label htmlFor={id} className="font-medium text-foreground">{label}</label>
        {children}
      </div>
    </div>
  );
}

/**
 * Paramètres · reels: generation and publication switches (both off by default) and the caps.
 * Publication without review is behind a confirmation dialog.
 */
export function ReelAutomationSettings({ data, isLoading, error, busy, onSettings }: {
  data: ReelAutomationView | undefined;
  isLoading: boolean;
  error: string | null;
  busy: boolean;
  onSettings: (patch: { generationEnabled?: boolean; autoPublishEnabled?: boolean; confirmAutoPublish?: true }) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const settings = data?.settings;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatisation</CardTitle>
        <CardDescription>Ce que la plateforme fait toute seule. Tout est éteint par défaut.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {isLoading && !data ? <p className="text-muted-foreground">Chargement…</p> : null}
        {error ? <p className="text-red-600 dark:text-red-300">{error}</p> : null}
        {settings ? (
          <>
            <SettingRow
              id="automation-generation"
              label="Génération automatique"
              checked={settings.generationEnabled}
              disabled={busy}
              onChange={(next) => onSettings({ generationEnabled: next })}
            >
              <p className="text-xs text-muted-foreground">
                Rédige le texte, génère la voix (reels) et lance le rendu {settings.leadDays} jours avant la date prévue, puis crée le brouillon Instagram. Vaut pour les reels et les carrousels. Désactivée, plus rien ne démarre ; les rendus en cours se terminent.
              </p>
            </SettingRow>
            <SettingRow
              id="automation-publish"
              label="Publication automatique"
              checked={settings.autoPublishEnabled}
              disabled={busy || !settings.generationEnabled}
              onChange={(next) => (next ? setConfirmOpen(true) : onSettings({ autoPublishEnabled: false }))}
            >
              <p className="text-xs text-muted-foreground">
                Programme chaque brouillon automatique à sa date prévue à {settings.publishTime} (heure de Paris), sans relecture. Le mode simulation reste respecté.
              </p>
              {settings.autoPublishEnabled ? (
                <p className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                  Active : les publications partent sans validation humaine. Relis les brouillons avant leur créneau ou annule leur programmation.
                </p>
              ) : null}
            </SettingRow>
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Reels : formats en ligne avec GPX et 30 km (ravitos facultatifs) ; temps forts au-delà de 60 km, parcours complet en dessous. Au plus {settings.maxPerWeek} reels par semaine (lundi-dimanche) et {settings.maxPerDay} par jour. Par événement, du format le plus court au plus long : le plus long au plus tard 7 jours avant le départ, chacun au moins 7 jours avant le suivant.
            </p>
          </>
        ) : null}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publier sans relecture ?</DialogTitle>
            <DialogDescription>
              Chaque reel ou carrousel généré automatiquement sera programmé sur Instagram à sa date prévue, à {settings?.publishTime ?? "18:00"}, sans qu’un humain valide le texte ni l’image. Tu pourras toujours annuler une programmation. En mode simulation, rien n’atteint Instagram.
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

/** Reels tab: the upcoming automatic reels, with « Exclure » / « Rétablir » and the live render stage. */
export function ReelPlanList({ data, busy, highlightedItemId, renders, onItemAction, onRefresh }: {
  data: ReelAutomationView | undefined;
  busy: boolean;
  highlightedItemId: string | null;
  renders: Map<string, RenderActivityView>;
  onItemAction: (itemId: string, action: "exclude" | "include") => void;
  onRefresh: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const items = data?.items ?? [];
  const visible = showAll ? items : items.filter((item) => !isFinished(item));
  const publishTime = data?.settings.publishTime ?? "18:00";

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Prochains reels automatiques</CardTitle>
          {data && !data.settings.generationEnabled ? (
            <CardDescription>Génération automatique éteinte : rien ne démarre (Paramètres).</CardDescription>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Masquer les terminés" : "Tout afficher"}
          </Button>
          <Button type="button" variant="outline" className="h-8 px-2 text-xs" disabled={busy} onClick={onRefresh}>Recalculer</Button>
        </div>
      </CardHeader>
      <CardContent className="text-sm">
        {visible.length === 0 ? (
          <p className="text-muted-foreground">Rien de prévu pour l’instant.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {visible.map((item) => {
              const status = describeAutomationItem(item);
              const render = item.renderJobId ? renders.get(item.renderJobId) : undefined;
              const live = render && render.status === "active" && (item.status === "rendering" || item.status === "generating");
              return (
                <li key={item.id} id={`automation-${item.id}`} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 ${highlightedItemId === item.id ? "bg-brand/10" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{item.raceName ?? "Course supprimée"}</p>
                    <p className="text-xs text-muted-foreground">{MODE_LABELS[item.mode]} · {formatAutomationDay(item.plannedPublishDate)} à {publishTime}</p>
                    <p className={`text-xs ${AUTOMATION_TONE_CLASS[live ? "active" : status.tone]}`}>{live ? render.stage : status.label}</p>
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
      </CardContent>
    </Card>
  );
}
