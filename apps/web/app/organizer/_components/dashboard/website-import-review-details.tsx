import type { RaceFormat, WebsiteImportFieldProposal, WebsiteImportPreview, WebsiteImportProposalValue } from "./types";

type ImportDocument = NonNullable<WebsiteImportPreview["documents"]>[number];
type DocumentFinding = ImportDocument["findings"][number];
type Reconciliation = NonNullable<WebsiteImportPreview["reconciliation"]>;
type RaceMatch = Reconciliation["raceMatches"][number];

const documentFieldLabels: Record<DocumentFinding["field"], string> = {
  distanceKm: "Distance",
  elevationGainM: "Dénivelé positif",
  elevationLossM: "Dénivelé négatif",
  startTime: "Heure de départ",
  bibPickup: "Retrait des dossards",
  cutoff: "Barrière horaire",
  aidStations: "Ravitaillements",
  mandatoryEquipment: "Matériel obligatoire",
  emergencyContact: "Contact de secours",
  liveTracking: "Suivi en direct",
};

const documentStatusLabels: Record<ImportDocument["status"], string> = {
  extracted: "Texte extrait",
  "ocr-pending": "OCR nécessaire",
  rejected: "Non analysé",
};

const comparisonLabels: Record<DocumentFinding["comparison"]["status"], string> = {
  concordant: "Concordant",
  conflict: "Écart à vérifier",
  unverified: "Non vérifié",
  "fill-missing": "Champ à compléter",
  same: "Valeur identique",
};

const comparisonSourceLabels: Record<NonNullable<DocumentFinding["comparison"]["comparedSource"]>, string> = {
  "current-data": "donnée actuelle",
  website: "site web",
  gpx: "GPX",
};

const reconciliationStatusLabels: Record<Reconciliation["status"], string> = {
  completed: "Analyse terminée",
  unavailable: "Analyse indisponible",
  failed: "Analyse échouée",
};

const reconciliationDecisionLabels: Record<RaceMatch["decision"], string> = {
  match: "Format correspondant",
  separate: "Format distinct",
  uncertain: "Correspondance incertaine",
};

const reconciliationActionLabels: Record<RaceMatch["fieldChanges"][number]["action"], string> = {
  add: "Ajouter",
  replace: "Remplacer",
  keep: "Conserver",
  unknown: "À examiner",
};

const confidenceLabels = {
  high: "Confiance élevée",
  medium: "Confiance moyenne",
  low: "Confiance faible",
} as const;

const scopeLabels: Record<DocumentFinding["scope"], string> = {
  event: "Événement",
  format: "Format",
  "format-unknown": "Format à identifier",
};

const proposalSourceLabels: Record<WebsiteImportFieldProposal["sourceKind"], string> = {
  gpx: "GPX",
  "structured-data": "Données structurées",
  html: "Site web",
  pdf: "Document",
  llm: "Analyse assistée",
};

const formatProposalValue = (value: WebsiteImportProposalValue) => {
  if (value === null) return "Non renseigné";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Liste vide";
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : `${item.name} · ${item.distanceKm} km`
      )
      .join(" · ");
  }
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
};

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} Ko`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
};

const confidenceTone = (confidence: "high" | "medium" | "low") =>
  confidence === "high"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : confidence === "medium"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

const comparisonTone = (status: DocumentFinding["comparison"]["status"]) =>
  status === "conflict"
    ? "border-red-200 bg-red-50 text-red-800"
    : status === "fill-missing"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "same" || status === "concordant"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

function EvidenceList({ evidence }: { evidence: string[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="space-y-1 border-l-2 border-border/70 pl-2 text-xs text-muted-foreground">
      {evidence.map((item, index) => (
        <p key={`${item}-${index}`} className="break-words">
          {item}
        </p>
      ))}
    </div>
  );
}

function DocumentFindingCard({ finding }: { finding: DocumentFinding }) {
  const comparison = finding.comparison;
  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{documentFieldLabels[finding.field]}</p>
          <p className="break-words text-sm text-muted-foreground">{finding.value}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceTone(finding.confidence)}`}>
            {confidenceLabels[finding.confidence]}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${comparisonTone(comparison.status)}`}>
            {comparisonLabels[comparison.status]}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {scopeLabels[finding.scope]}
        {finding.formatHint ? ` · ${finding.formatHint}` : ""}
      </p>
      <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Preuve :</span> {finding.evidence}
      </div>
      {comparison.comparedValue ? (
        <p className="text-xs text-muted-foreground">
          Comparé à {comparison.comparedSource ? comparisonSourceLabels[comparison.comparedSource] : "la donnée disponible"} :{" "}
          <span className="font-medium text-foreground">{comparison.comparedValue}</span>
        </p>
      ) : null}
      {finding.alternatives.length > 0 ? (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">
            {finding.alternatives.length} autre{finding.alternatives.length > 1 ? "s" : ""} lecture{finding.alternatives.length > 1 ? "s" : ""}
          </summary>
          <div className="mt-2 space-y-2 border-l-2 border-border/70 pl-2">
            {finding.alternatives.map((alternative, index) => (
              <div key={`${alternative.field}-${alternative.value}-${index}`}>
                <p className="font-medium text-foreground">{documentFieldLabels[alternative.field]} : {alternative.value}</p>
                <p>{alternative.evidence}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function DocumentsReview({ documents }: { documents: ImportDocument[] }) {
  if (documents.length === 0) return null;
  const findingCount = documents.reduce((total, document) => total + document.findings.length, 0);
  return (
    <details className="rounded-md border border-border/60 bg-card px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Documents analysés ({documents.length}) · {findingCount} observation{findingCount > 1 ? "s" : ""}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Ces observations sont proposées pour la revue. Elles ne modifient aucune donnée automatiquement.
        </p>
        {documents.map((document) => (
          <section key={document.sourceId} className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-foreground">{document.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(document.sizeBytes)}
                  {document.pageCount ? ` · ${document.pageCount} page${document.pageCount > 1 ? "s" : ""}` : ""}
                  {` · ${document.extractionMethod === "pdf-text" ? "extraction du texte" : "OCR en attente"}`}
                </p>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${document.status === "extracted" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                {documentStatusLabels[document.status]}
              </span>
            </div>
            {document.message ? <p className="text-xs text-muted-foreground">{document.message}</p> : null}
            {document.findings.length > 0 ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {document.findings.map((finding, index) => (
                  <DocumentFindingCard key={`${finding.field}-${finding.value}-${index}`} finding={finding} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aucune observation exploitable dans ce document.</p>
            )}
          </section>
        ))}
      </div>
    </details>
  );
}

function MatchReview({ match, preview, existingRaces }: { match: RaceMatch; preview: WebsiteImportPreview; existingRaces: RaceFormat[] }) {
  const importedRace = preview.races.find((race) => race.key === match.previewRaceKey);
  const targetRace = existingRaces.find((race) => race.id === match.targetRaceId);
  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{importedRace?.name ?? match.previewRaceKey}</p>
          <p className="text-xs text-muted-foreground">
            Cible : {targetRace?.series_name ?? targetRace?.name ?? match.targetRaceId ?? "aucun format existant"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground">
            {reconciliationDecisionLabels[match.decision]}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceTone(match.confidence)}`}>
            {confidenceLabels[match.confidence]}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{match.rationale}</p>
      <EvidenceList evidence={match.evidence} />
      {match.fieldChanges.length > 0 ? (
        <details className="rounded-md border border-border/50 bg-muted/20 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            Comparaison champ par champ ({match.fieldChanges.length})
          </summary>
          <div className="mt-3 space-y-2">
            {match.fieldChanges.map((change, index) => (
              <div key={`${change.field}-${index}`} className="space-y-1.5 rounded-md border border-border/50 bg-card p-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-foreground">{change.field}</p>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 font-medium text-foreground">
                    {reconciliationActionLabels[change.action]}
                  </span>
                </div>
                <div className="grid gap-1 text-muted-foreground sm:grid-cols-2">
                  <p>Import : <span className="font-medium text-foreground">{change.importedValue ?? "non renseigné"}</span></p>
                  <p>Actuel : <span className="font-medium text-foreground">{change.currentValue ?? "non renseigné"}</span></p>
                </div>
                <p className="text-muted-foreground">{change.rationale}</p>
                <EvidenceList evidence={change.evidence} />
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReconciliationReview({ reconciliation, preview, existingRaces }: { reconciliation: Reconciliation; preview: WebsiteImportPreview; existingRaces: RaceFormat[] }) {
  return (
    <details className="rounded-md border border-border/60 bg-card px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Rapprochement assisté · {reconciliationStatusLabels[reconciliation.status]}
      </summary>
      <div className="mt-3 space-y-3">
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">{reconciliation.summary || reconciliation.message}</p>
          {reconciliation.summary && reconciliation.message && reconciliation.summary !== reconciliation.message ? <p className="mt-1">{reconciliation.message}</p> : null}
          {reconciliation.warnings.map((warning, index) => <p key={`${warning}-${index}`} className="mt-1 text-amber-800">{warning}</p>)}
        </div>
        {reconciliation.raceMatches.length > 0 ? (
          <div className="space-y-2">
            {reconciliation.raceMatches.map((match, index) => (
              <MatchReview key={`${match.previewRaceKey}-${match.targetRaceId ?? "none"}-${index}`} match={match} preview={preview} existingRaces={existingRaces} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Aucune proposition de rapprochement disponible.</p>
        )}
      </div>
    </details>
  );
}

export function WebsiteImportProposalChoices({
  preview,
  scope,
  previewRaceKey = null,
  selectedProposalIds,
  onSelectionChange,
}: {
  preview: WebsiteImportPreview;
  scope: "event" | "format";
  previewRaceKey?: string | null;
  selectedProposalIds: string[];
  onSelectionChange: (proposalIds: string[]) => void;
}) {
  const proposals = preview.proposalSnapshot.proposals.filter(
    (proposal) => proposal.scope === scope && (scope === "event" || proposal.previewRaceKey === previewRaceKey)
  );
  if (proposals.length === 0) return null;

  return (
    <details open className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground">
        Champs à intégrer ({selectedProposalIds.length}/{proposals.length})
      </summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          Coche la source à appliquer. Choisir une autre source pour le même champ remplace automatiquement la précédente.
        </p>
        {proposals.map((proposal) => {
          const checked = selectedProposalIds.includes(proposal.id);
          return (
            <label key={proposal.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-card p-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
                checked={checked}
                onChange={(event) => {
                  if (!event.target.checked) {
                    onSelectionChange(selectedProposalIds.filter((id) => id !== proposal.id));
                    return;
                  }
                  const competingIds = new Set(
                    proposals.filter((candidate) => candidate.field === proposal.field).map((candidate) => candidate.id)
                  );
                  onSelectionChange([...selectedProposalIds.filter((id) => !competingIds.has(id)), proposal.id]);
                }}
              />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{proposal.label}</span>
                  <span className="flex flex-wrap gap-1.5">
                    {proposal.recommended ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Recommandé</span>
                    ) : null}
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${comparisonTone(proposal.comparison)}`}>
                      {comparisonLabels[proposal.comparison]}
                    </span>
                  </span>
                </span>
                <span className="block break-words text-sm text-foreground">{formatProposalValue(proposal.value)}</span>
                <span className="block text-xs text-muted-foreground">
                  {proposalSourceLabels[proposal.sourceKind]} · {proposal.sourceLabel} · {confidenceLabels[proposal.confidence]}
                </span>
                {proposal.currentValue !== null ? (
                  <span className="block text-xs text-muted-foreground">
                    Valeur actuelle : <span className="font-medium text-foreground">{formatProposalValue(proposal.currentValue)}</span>
                  </span>
                ) : null}
                {proposal.evidence.length > 0 ? <EvidenceList evidence={proposal.evidence} /> : null}
                {proposal.sourceUrl ? (
                  <a
                    href={proposal.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Ouvrir la source
                  </a>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </details>
  );
}

export function WebsiteImportReviewDetails({ preview, existingRaces }: { preview: WebsiteImportPreview; existingRaces: RaceFormat[] }) {
  const documents = preview.documents ?? [];
  if (documents.length === 0 && !preview.reconciliation) return null;

  return (
    <div className="space-y-2">
      <DocumentsReview documents={documents} />
      {preview.reconciliation ? (
        <ReconciliationReview reconciliation={preview.reconciliation} preview={preview} existingRaces={existingRaces} />
      ) : null}
    </div>
  );
}
