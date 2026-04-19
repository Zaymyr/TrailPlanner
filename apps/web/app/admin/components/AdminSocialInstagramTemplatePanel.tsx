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

type FieldSource = "db" | "template";

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

function SourceBadge({ source }: { source: FieldSource }) {
  const className =
    source === "db"
      ? "rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";

  return <span className={className}>{source === "db" ? "Plan DB" : "Template"}</span>;
}

function Field({
  id,
  label,
  value,
  onChange,
  source,
  helper,
  multiline = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  source: FieldSource;
  helper?: string;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SourceBadge source={source} />
      </div>
      {helper ? <p className="text-xs text-slate-500 dark:text-slate-400">{helper}</p> : null}
      {multiline ? (
        <textarea id={id} className={textareaClassName} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function SectionCard({
  title,
  source,
  description,
  children,
}: {
  title: string;
  source: FieldSource;
  description: string;
  children: React.ReactNode;
}) {
  const className =
    source === "db"
      ? "rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/20"
      : "rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-900/30";

  return (
    <section className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</p>
            <SourceBadge source={source} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function AdminSocialInstagramTemplatePanel({ draft, onDraftChange, onReset }: Props) {
  const updateField = <K extends keyof SocialInstagramTemplateDraft>(key: K, value: SocialInstagramTemplateDraft[K]) => {
    onDraftChange({ ...draft, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Lecture rapide</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <SourceBadge source="db" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Pre-rempli depuis le plan en base, mais surchargable localement.</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <SourceBadge source="template" />
          <span className="text-sm text-slate-600 dark:text-slate-400">Texte, branding ou hypothese visuelle propre au template social.</span>
        </div>
      </div>

      <SectionCard
        title="Course"
        source="db"
        description="Ces champs viennent du plan et de la course en base. Tu peux les ajuster localement si besoin."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="social-race-name" label="Nom de la course" value={draft.raceName} onChange={(value) => updateField("raceName", value)} source="db" />
          <Field id="social-race-subtitle" label="Sous-titre" value={draft.raceSubtitle} onChange={(value) => updateField("raceSubtitle", value)} source="db" />
          <Field id="social-race-year" label="Annee" value={draft.raceYear} onChange={(value) => updateField("raceYear", value)} source="db" />
          <Field id="social-start-date" label="Date affichee" value={draft.startDate} onChange={(value) => updateField("startDate", value)} source="db" />
          <Field id="social-race-location" label="Lieu" value={draft.raceLocation} onChange={(value) => updateField("raceLocation", value)} source="db" />
        </div>
      </SectionCard>

      <SectionCard
        title="Statistiques course"
        source="db"
        description="Distance, D+ et temps cible mappes depuis le plan actuel."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="social-distance" label="Distance (km)" value={draft.distanceKm} onChange={(value) => updateField("distanceKm", value)} source="db" />
          <Field id="social-elevation" label="Denivele + (m)" value={draft.elevationGainM} onChange={(value) => updateField("elevationGainM", value)} source="db" />
          <Field id="social-target-time" label="Temps objectif" value={draft.targetTimeLabel} onChange={(value) => updateField("targetTimeLabel", value)} source="db" />
        </div>
      </SectionCard>

      <SectionCard
        title="Besoins du plan"
        source="db"
        description="Besoins moyens et totaux derives du plan nutrition / hydratation."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="social-total-carbs" label="Glucides total (g)" value={draft.totalCarbsG} onChange={(value) => updateField("totalCarbsG", value)} source="db" />
          <Field id="social-total-water" label="Eau totale (L)" value={draft.totalWaterL} onChange={(value) => updateField("totalWaterL", value)} source="db" />
          <Field id="social-total-sodium" label="Sodium total (g)" value={draft.totalSodiumG} onChange={(value) => updateField("totalSodiumG", value)} source="db" />
          <Field id="social-avg-carbs" label="Glucides / h (g)" value={draft.avgCarbsG} onChange={(value) => updateField("avgCarbsG", value)} source="db" />
          <Field id="social-avg-water" label="Eau / h (ml)" value={draft.avgWaterMl} onChange={(value) => updateField("avgWaterMl", value)} source="db" />
          <Field id="social-avg-sodium" label="Sodium / h (mg)" value={draft.avgSodiumMg} onChange={(value) => updateField("avgSodiumMg", value)} source="db" />
        </div>
      </SectionCard>

      <SectionCard
        title="Ravitaillements"
        source="db"
        description="Liste pre-remplie depuis le plan. Tu peux editer, ajouter ou enlever localement pour le carousel."
      >
        <div className="mb-3 flex justify-end">
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
            <div key={`${station.name}-${index}`} className="rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-950/50">
              <div className="grid gap-3 md:grid-cols-[1.1fr_0.5fr_0.6fr_1.8fr_auto]">
                <Field
                  id={`station-name-${index}`}
                  label="Nom"
                  value={station.name}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "name", value))}
                  source="db"
                />
                <Field
                  id={`station-km-${index}`}
                  label="km"
                  value={station.km}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "km", value))}
                  source="db"
                />
                <Field
                  id={`station-eta-${index}`}
                  label="ETA"
                  value={station.eta}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "eta", value))}
                  source="db"
                />
                <Field
                  id={`station-take-${index}`}
                  label="Reprise"
                  value={station.take}
                  onChange={(value) => updateField("aidStations", updateAidStationField(draft.aidStations, index, "take", value))}
                  source="db"
                  helper="Tu peux simplifier ici ce qui sera affiche dans le template."
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
      </SectionCard>

      <SectionCard
        title="Textes & CTA"
        source="template"
        description="Copy purement editoriale pour rendre le carousel plus social et plus engageant."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field id="social-tagline" label="Tagline slide 1" value={draft.tagline} onChange={(value) => updateField("tagline", value)} source="template" multiline />
          <Field id="social-cta-1" label="CTA slide 1" value={draft.ctaS1} onChange={(value) => updateField("ctaS1", value)} source="template" />
          <Field id="social-cta-2" label="CTA slide 3" value={draft.ctaS2} onChange={(value) => updateField("ctaS2", value)} source="template" />
          <Field id="social-cta-4" label="CTA slide 4" value={draft.ctaS4} onChange={(value) => updateField("ctaS4", value)} source="template" />
          <Field id="social-handle" label="App / lien" value={draft.appHandle} onChange={(value) => updateField("appHandle", value)} source="template" />
        </div>
      </SectionCard>

      <SectionCard
        title="Hypotheses visuelles"
        source="template"
        description="Parametres utilises pour traduire les besoins en elements visuels du carousel."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Field id="social-gel-size" label="Glucides par gel (g)" value={draft.carbsPerGelG} onChange={(value) => updateField("carbsPerGelG", value)} source="template" />
          <Field id="social-cap-size" label="Sodium par capsule (mg)" value={draft.sodiumPerCapMg} onChange={(value) => updateField("sodiumPerCapMg", value)} source="template" />
          <Field id="social-flask-size" label="Volume flasque (ml)" value={draft.flaskMl} onChange={(value) => updateField("flaskMl", value)} source="template" />
        </div>
      </SectionCard>

      <SectionCard
        title="Direction visuelle"
        source="template"
        description="Couleur accent, ambiance et reset vers les valeurs par defaut derivees du plan."
      >
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
              Revenir aux valeurs du plan
            </Button>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
