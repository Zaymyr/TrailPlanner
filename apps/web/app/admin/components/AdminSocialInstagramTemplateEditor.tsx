"use client";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type {
  SocialInstagramTemplateAccentKey,
  SocialInstagramTemplateAidStation,
  SocialInstagramTemplateDraft,
} from "../../../lib/social-instagram-template-draft";

type Props = {
  draft: SocialInstagramTemplateDraft;
  onDraftChange: (draft: SocialInstagramTemplateDraft) => void;
  onReset: () => void;
};

const SECTION_TITLE_CLASS = "mb-3 border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:border-slate-800 dark:text-emerald-300";
const FIELD_GRID_CLASS = "grid gap-3 md:grid-cols-2";
const textareaClassName =
  "min-h-[84px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring";

const accentSwatches: Array<{ key: SocialInstagramTemplateAccentKey; label: string; color: string }> = [
  { key: "forest", label: "Forest", color: "#335424" },
  { key: "moss", label: "Moss", color: "#2f6051" },
  { key: "earth", label: "Earth", color: "#785437" },
  { key: "slate", label: "Slate", color: "#38506c" },
];

function updateAidStationField(
  stations: SocialInstagramTemplateAidStation[],
  index: number,
  key: keyof SocialInstagramTemplateAidStation,
  value: string
) {
  return stations.map((station, stationIndex) =>
    stationIndex === index ? { ...station, [key]: value } : station
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {multiline ? (
        <textarea id={id} className={textareaClassName} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

export default function AdminSocialInstagramTemplateEditor({ draft, onDraftChange, onReset }: Props) {
  const updateField = <K extends keyof SocialInstagramTemplateDraft>(key: K, value: SocialInstagramTemplateDraft[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  return (
    <div className="space-y-6">
      <section>
        <p className={SECTION_TITLE_CLASS}>Course</p>
        <div className={FIELD_GRID_CLASS}>
          <Field id="social-race-name" label="Nom de la course" value={draft.raceName} onChange={(value) => updateField("raceName", value)} />
          <Field id="social-race-subtitle" label="Sous-titre" value={draft.raceSubtitle} onChange={(value) => updateField("raceSubtitle", value)} />
          <Field id="social-race-year" label="Annee" value={draft.raceYear} onChange={(value) => updateField("raceYear", value)} />
          <Field id="social-start-date" label="Date affichee" value={draft.startDate} onChange={(value) => updateField("startDate", value)} />
          <Field id="social-race-location" label="Lieu" value={draft.raceLocation} onChange={(value) => updateField("raceLocation", value)} />
        </div>
      </section>

      <section>
        <p className={SECTION_TITLE_CLASS}>Statistiques</p>
        <div className={FIELD_GRID_CLASS}>
          <Field id="social-distance" label="Distance (km)" value={draft.distanceKm} onChange={(value) => updateField("distanceKm", value)} />
          <Field id="social-elevation" label="Denivele + (m)" value={draft.elevationGainM} onChange={(value) => updateField("elevationGainM", value)} />
          <Field id="social-target-time" label="Temps objectif" value={draft.targetTimeLabel} onChange={(value) => updateField("targetTimeLabel", value)} />
        </div>
      </section>

      <section>
        <p className={SECTION_TITLE_CLASS}>Textes & CTAs</p>
        <div className={FIELD_GRID_CLASS}>
          <Field id="social-tagline" label="Tagline slide 1" value={draft.tagline} onChange={(value) => updateField("tagline", value)} multiline />
          <Field id="social-cta-1" label="CTA slide 1" value={draft.ctaS1} onChange={(value) => updateField("ctaS1", value)} />
          <Field id="social-cta-2" label="CTA slide 2" value={draft.ctaS2} onChange={(value) => updateField("ctaS2", value)} />
          <Field id="social-cta-4" label="CTA slide 4" value={draft.ctaS4} onChange={(value) => updateField("ctaS4", value)} />
          <Field id="social-handle" label="App / lien" value={draft.appHandle} onChange={(value) => updateField("appHandle", value)} />
        </div>
      </section>

      <section>
        <p className={SECTION_TITLE_CLASS}>Nutrition</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="social-total-carbs" label="Glucides total (g)" value={draft.totalCarbsG} onChange={(value) => updateField("totalCarbsG", value)} />
          <Field id="social-total-water" label="Eau totale (L)" value={draft.totalWaterL} onChange={(value) => updateField("totalWaterL", value)} />
          <Field id="social-total-sodium" label="Sodium total (g)" value={draft.totalSodiumG} onChange={(value) => updateField("totalSodiumG", value)} />
          <Field id="social-avg-carbs" label="Glucides / h (g)" value={draft.avgCarbsG} onChange={(value) => updateField("avgCarbsG", value)} />
          <Field id="social-avg-water" label="Eau / h (ml)" value={draft.avgWaterMl} onChange={(value) => updateField("avgWaterMl", value)} />
          <Field id="social-avg-sodium" label="Sodium / h (mg)" value={draft.avgSodiumMg} onChange={(value) => updateField("avgSodiumMg", value)} />
          <Field id="social-gel-size" label="Glucides par gel (g)" value={draft.carbsPerGelG} onChange={(value) => updateField("carbsPerGelG", value)} />
          <Field id="social-cap-size" label="Sodium par capsule (mg)" value={draft.sodiumPerCapMg} onChange={(value) => updateField("sodiumPerCapMg", value)} />
          <Field id="social-flask-size" label="Volume flasque (ml)" value={draft.flaskMl} onChange={(value) => updateField("flaskMl", value)} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3">
          <p className={SECTION_TITLE_CLASS}>Ravitaillements</p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              updateField("aidStations", [
                ...draft.aidStations,
                { name: "Nouveau ravito", km: "", eta: "", take: "A preciser" },
              ])
            }
          >
            Ajouter un ravito
          </Button>
        </div>

        <div className="space-y-3">
          {draft.aidStations.map((station, index) => (
            <div key={`${station.name}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="grid gap-3 md:grid-cols-[1.2fr_0.45fr_0.6fr_1.8fr_auto]">
                <Field
                  id={`station-name-${index}`}
                  label="Nom"
                  value={station.name}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "name", value))}
                />
                <Field
                  id={`station-km-${index}`}
                  label="km"
                  value={station.km}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "km", value))}
                />
                <Field
                  id={`station-eta-${index}`}
                  label="ETA"
                  value={station.eta}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "eta", value))}
                />
                <Field
                  id={`station-take-${index}`}
                  label="Reprise"
                  value={station.take}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "take", value))}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => updateField("aidStations", draft.aidStations.filter((_, stationIndex) => stationIndex !== index))}
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className={SECTION_TITLE_CLASS}>Tweaks</p>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Couleur accent</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {accentSwatches.map((accent) => {
                  const isActive = draft.accentKey === accent.key;

                  return (
                    <button
                      key={accent.key}
                      type="button"
                      onClick={() => updateField("accentKey", accent.key)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accent.color }} />
                      {accent.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                checked={draft.darkSlide1}
                onChange={(event) => updateField("darkSlide1", event.target.checked)}
              />
              Slide 1 sur fond sombre
            </label>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onReset}>
                Revenir aux valeurs DB
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
