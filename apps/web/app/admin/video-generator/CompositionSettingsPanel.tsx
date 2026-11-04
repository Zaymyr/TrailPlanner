"use client";

import React, { useState, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import type { VideoAidStation } from "../../../lib/video-generator";
import { MAP_AMBIANCES } from "./map-appearance";
import {
  AID_SERVICES,
  getAidStationServices,
  MAPBOX_STYLE_URL_PATTERN,
  PROFILE_SLOPE_CLASSES,
  VIDEO_DURATION_PRESETS,
  type VideoCompositionSettings,
} from "./video-composition";

type BooleanSettingKey = {
  [Key in keyof VideoCompositionSettings]: VideoCompositionSettings[Key] extends boolean ? Key : never;
}[keyof VideoCompositionSettings];

type CompositionSettingsPanelProps = {
  /** Ids of the beats kept in the narration, to flag stations left out. */
  narratedIds: Set<string>;
  autoDurationSeconds: number;
  /** False when the race has no start time: the day/night look cannot be estimated. */
  dayNightAvailable: boolean;
  aidStations: VideoAidStation[];
  cameraActionsDisabled: boolean;
  onChange: (settings: VideoCompositionSettings) => void;
  onFitOverview: () => void;
  onResetCamera: () => void;
  settings: VideoCompositionSettings;
};

const INFORMATION_TOGGLES: Array<[BooleanSettingKey, string]> = [
  ["showTitle", "Titre"],
  ["showDistance", "Distance"],
  ["showElevation", "Dénivelé"],
  ["showStartInfo", "Départ (lieu, heure)"],
  ["showAidStations", "Ravitaillements"],
  ["showSubtitles", "Sous-titres (voix)"],
  ["showCaptions", "Encart du tronçon"],
  ["showAidBubbles", "Bulles des ravitos"],
  ["showProfile", "Profil altimétrique"],
  ["showCurrentKm", "Kilomètre en cours"],
];

/** Settings group, collapsed by default: the defaults are good, so details stay out of the way. */
function PanelSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <details className="group border-t border-border pt-2">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        {title}
        <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-2 pb-2 pt-2">{children}</div>
    </details>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="h-4 w-4 accent-brand" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<[T, string]>;
  value: T;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap rounded-md border border-border bg-muted/30 p-1">
      {options.map(([optionValue, optionLabel]) => (
        <Button
          key={optionValue}
          type="button"
          aria-pressed={value === optionValue}
          className="h-8 flex-1 px-2 text-xs"
          variant={value === optionValue ? "default" : "ghost"}
          onClick={() => onChange(optionValue)}
        >
          {optionLabel}
        </Button>
      ))}
    </div>
  );
}

export function CompositionSettingsPanel({
  narratedIds,
  autoDurationSeconds,
  dayNightAvailable,
  aidStations,
  cameraActionsDisabled,
  onChange,
  onFitOverview,
  onResetCamera,
  settings,
}: CompositionSettingsPanelProps) {
  const [copied, setCopied] = useState(false);
  const [customStyleDraft, setCustomStyleDraft] = useState(settings.customStyleUrl ?? "");
  const update = <Key extends keyof VideoCompositionSettings>(key: Key, value: VideoCompositionSettings[Key]) =>
    onChange({ ...settings, [key]: value });
  const disabledStations = new Set(settings.disabledAidStationIds);

  const copyConfiguration = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 text-foreground">
      {/* Quick access: what is worth changing per video. */}
      <div className="space-y-2 pb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réglages rapides</p>
        <label className="block space-y-1 text-sm">
          <span className="flex justify-between font-medium">
            Relief
            <span className="tabular-nums text-muted-foreground">×{settings.terrainExaggeration.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</span>
          </span>
          <input
            aria-label="Exagération du relief"
            type="range"
            className="w-full accent-brand"
            min={1}
            max={3}
            step={0.05}
            value={settings.terrainExaggeration}
            onChange={(event) => update("terrainExaggeration", Number(event.target.value))}
          />
        </label>
        <div className="space-y-1 text-sm">
          <span className="font-medium">Qualité de la vidéo</span>
        <Segmented
          label="Résolution d’export"
          value={settings.resolution}
          options={[["540p", "540p (test)"], ["1080p", "1080p"]]}
          onChange={(value) => update("resolution", value)}
        />
        </div>
      </div>

      <PanelSection title="Format et durée">
        <Segmented
          label="Format de prévisualisation"
          value={settings.viewport}
          options={[["portrait", "Instagram 9:16"], ["landscape", "Classique 16:9"]]}
          onChange={(value) => update("viewport", value)}
        />
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Durée totale</span>
          <select
            aria-label="Durée de la vidéo"
            className="min-h-9 w-full rounded-md border border-input bg-card px-2 text-sm"
            value={settings.durationMode === "auto" ? "auto" : settings.durationSeconds}
            onChange={(event) => onChange(event.target.value === "auto"
              ? { ...settings, durationMode: "auto" }
              : { ...settings, durationMode: "manual", durationSeconds: Number(event.target.value) })}
          >
            <option value="auto">Auto selon le parcours ({autoDurationSeconds} s minimum)</option>
            {VIDEO_DURATION_PRESETS.map((duration) => <option key={duration} value={duration}>{duration} secondes</option>)}
          </select>
          <span className="block text-xs text-muted-foreground">
            {settings.durationMode === "auto"
              ? "La vidéo s’allonge si la narration en a besoin."
              : "Durée fixe : la narration doit tenir dedans."}
          </span>
        </label>
      </PanelSection>

      <PanelSection title="Carte">
        <Segmented
          label="Style de carte"
          value={settings.mapStyle}
          options={[["paceyourself", "Pace Yourself"], ["classic", "Satellite"], ["standard", "Standard 3D"], ["custom", "Mon style"]]}
          onChange={(value) => update("mapStyle", value)}
        />
        {settings.mapStyle === "custom" ? (
          <label className="block space-y-1 text-xs">
            <span className="font-medium">URL du style Mapbox Studio</span>
            <input
              aria-label="URL du style Mapbox Studio"
              className="min-h-9 w-full rounded-md border border-input bg-card px-2 font-mono text-xs"
              placeholder="mapbox://styles/compte/identifiant"
              value={customStyleDraft}
              onChange={(event) => {
                const value = event.target.value.trim();
                setCustomStyleDraft(value);
                if (MAPBOX_STYLE_URL_PATTERN.test(value)) update("customStyleUrl", value);
              }}
            />
            <span className="text-muted-foreground">
              {settings.customStyleUrl ? "Style appliqué." : "Créez un style sur studio.mapbox.com puis collez son URL « Share ». En attendant, le style Pace Yourself est utilisé."}
            </span>
          </label>
        ) : null}
        <Segmented
          label="Ambiance"
          value={settings.mapAmbiance}
          options={Object.entries(MAP_AMBIANCES).map(([value, ambiance]) => [value as VideoCompositionSettings["mapAmbiance"], ambiance.label])}
          onChange={(value) => update("mapAmbiance", value)}
        />
        <Toggle label="Masquer les noms de lieux et de routes" checked={settings.hideMapLabels} onChange={(checked) => update("hideMapLabels", checked)} />
        <Toggle label="Afficher les sommets (nom, altitude)" checked={settings.showPeaks} onChange={(checked) => update("showPeaks", checked)} />
        <Toggle label="Jour / nuit selon l’heure estimée" checked={settings.dayNight} onChange={(checked) => update("dayNight", checked)} />
        {settings.dayNight ? (
          <p className="text-xs text-muted-foreground">
            {dayNightAvailable
              ? "Heure de passage estimée avec une allure classique, recalée sur les barrières horaires."
              : "Heure de départ inconnue pour ce format : la lumière reste celle du jour."}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection title="Tracé et caméra">
        <Segmented
          label="Affichage du tracé"
          value={settings.revealMode}
          options={[["progressive", "Tracé progressif"], ["full", "Tracé complet"]]}
          onChange={(value) => update("revealMode", value)}
        />
        <div className="grid grid-cols-2 items-center gap-2">
          <Segmented
            label="Épaisseur du tracé"
            value={settings.routeWidth}
            options={[["normal", "Fin"], ["bold", "Épais"]]}
            onChange={(value) => update("routeWidth", value)}
          />
          <Toggle label="Halo lumineux" checked={settings.routeGlow} onChange={(checked) => update("routeGlow", checked)} />
          <Toggle label="Liseré blanc" checked={settings.routeCasing} onChange={(checked) => update("routeCasing", checked)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-8 flex-1 px-2 text-xs" disabled={cameraActionsDisabled} onClick={onFitOverview}>Vue d’ensemble</Button>
          <Button type="button" variant="outline" className="h-8 flex-1 px-2 text-xs" disabled={cameraActionsDisabled} onClick={onResetCamera}>Réinitialiser</Button>
        </div>
      </PanelSection>

      <PanelSection title="Informations affichées">
        <div className="grid grid-cols-2 gap-x-2">
          {INFORMATION_TOGGLES.map(([key, label]) => (
            <Toggle key={key} label={label} checked={settings[key]} onChange={(checked) => update(key, checked)} />
          ))}
        </div>
        {settings.showProfile ? (
          <>
            <Segmented
              label="Profil altimétrique"
              value={settings.profileMode}
              options={[["window", "Section défilante"], ["full", "Parcours entier"]]}
              onChange={(value) => update("profileMode", value)}
            />
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Couleurs des pentes">
              {PROFILE_SLOPE_CLASSES.map((slopeClass) => (
                <li key={slopeClass.id} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: slopeClass.color }} />
                  {slopeClass.label}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </PanelSection>

      <PanelSection title="Couleurs et marque">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="Couleur du parcours" type="color" className="h-8 w-10 cursor-pointer rounded border border-border bg-card" value={settings.routeColor} onChange={(event) => update("routeColor", event.target.value)} />
            Parcours
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="Couleur de la section racontée" type="color" className="h-8 w-10 cursor-pointer rounded border border-border bg-card" value={settings.highlightColor} onChange={(event) => update("highlightColor", event.target.value)} />
            Section racontée
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input aria-label="Couleur d’accentuation" type="color" className="h-8 w-10 cursor-pointer rounded border border-border bg-card" value={settings.accentColor} onChange={(event) => update("accentColor", event.target.value)} />
            Accent
          </label>
          <Toggle label="Logo Pace Yourself" checked={settings.showLogo} onChange={(checked) => update("showLogo", checked)} />
          <Toggle label="CTA final" checked={settings.showCta} onChange={(checked) => update("showCta", checked)} />
        </div>
      </PanelSection>

      <PanelSection title="Séquences">
        <div className="grid grid-cols-2 gap-x-2">
          <Toggle label="Introduction" checked={settings.introEnabled} onChange={(checked) => update("introEnabled", checked)} />
          <Toggle label="Conclusion" checked={settings.outroEnabled} onChange={(checked) => update("outroEnabled", checked)} />
        </div>
      </PanelSection>

      <PanelSection title={`Ravitaillements (${aidStations.length})`}>
        {aidStations.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun ravitaillement enregistré pour ce format.</p>
        ) : (
          <ul className="max-h-44 space-y-0.5 overflow-y-auto pr-1">
            {aidStations.map((station) => {
              const enabled = !disabledStations.has(station.id);
              return (
                <li key={station.id} className="flex items-center justify-between gap-2">
                  <Toggle
                    label={[
                      `${station.name} · km ${station.distanceKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`,
                      station.isLifeBase ? "base de vie" : null,
                      getAidStationServices(station).map((service) => AID_SERVICES[service]).join(", ").toLowerCase() || null,
                    ].filter(Boolean).join(" · ")}
                    checked={enabled}
                    onChange={(checked) => update(
                      "disabledAidStationIds",
                      checked
                        ? settings.disabledAidStationIds.filter((id) => id !== station.id)
                        : [...settings.disabledAidStationIds, station.id],
                    )}
                  />
                  {enabled && settings.showAidStations && !narratedIds.has(station.id) ? (
                    <span className="shrink-0 text-[10px] text-muted-foreground" title="Trop proche d’un autre moment raconté, ou vidéo trop courte pour tout raconter">non raconté</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PanelSection>

      <Button type="button" variant="outline" className="h-8 w-full text-xs" onClick={() => void copyConfiguration()}>
        {copied ? "Configuration copiée" : "Copier la configuration (JSON)"}
      </Button>
    </div>
  );
}
