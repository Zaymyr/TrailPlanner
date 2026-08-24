import { Button } from "../../../../components/ui/button";
import type {
  RaceFormat,
  WebsiteImportDiscoveryWorkflow,
  WebsiteImportFieldReport,
  WebsiteImportFieldSelection,
  WebsiteImportFormatCandidate,
  WebsiteImportFormatDecision,
  WebsiteImportReviewWorkflow,
  WebsiteImportValue,
} from "./types";

const confidenceLabels = {
  high: "Confiance élevée",
  medium: "Confiance moyenne",
  low: "Confiance faible",
} as const;

const statusLabels = {
  safe: "Sûr",
  review: "À vérifier",
  conflict: "Conflit",
  missing: "Manquant",
} as const;

const confidenceTone = (confidence: "high" | "medium" | "low") =>
  confidence === "high"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : confidence === "medium"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-slate-200 bg-slate-50 text-slate-700";

const statusTone = (status: "safe" | "review" | "conflict" | "missing") =>
  status === "safe"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : status === "review"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : status === "conflict"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-slate-200 bg-slate-50 text-slate-700";

const isMissingValue = (value: WebsiteImportValue) =>
  value === null ||
  (typeof value === "string" && value.trim().length === 0) ||
  (Array.isArray(value) && value.length === 0);

export const formatWebsiteImportValue = (value: WebsiteImportValue) => {
  if (isMissingValue(value)) return "Non renseigné";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : typeof item.name === "string"
            ? item.name
            : JSON.stringify(item)
      )
      .join(" · ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export const getWebsiteImportCandidateKey = (candidate: WebsiteImportFormatCandidate) =>
  candidate.candidateKey;

const normalizedName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const buildInitialWebsiteImportFormatDecisions = (
  candidates: WebsiteImportFormatCandidate[],
  existingRaces: RaceFormat[]
): WebsiteImportFormatDecision[] =>
  candidates.flatMap((candidate, index) => {
    const candidateKey = getWebsiteImportCandidateKey(candidate);
    if (!candidateKey) return [];
    const name = candidate.proposedName.trim() || candidate.names[0]?.trim() || `Format ${index + 1}`;
    const exactTarget = existingRaces.find(
      (race) => normalizedName(race.series_name || race.name) === normalizedName(name)
    ) ?? existingRaces.find((race) => race.id === candidate.suggestedExistingRaceId);
    return [{
      groupId: `candidate-${candidateKey}`,
      candidateKeys: [candidateKey],
      mode: exactTarget ? "bind-existing" : "create",
      targetRaceId: exactTarget?.id ?? null,
      name,
    }];
  });

const selectionKey = (scope: "event" | "format", raceId: string | null | undefined, field: string) =>
  `${scope}:${raceId ?? "event"}:${field}`;

export const buildInitialWebsiteImportFieldSelections = (
  workflow: WebsiteImportReviewWorkflow
): Record<string, WebsiteImportFieldSelection> => {
  const reports = [workflow.eventReport, ...workflow.formatReports];
  return Object.fromEntries(
    reports.flatMap((report) =>
      report.resolutions.map((resolution) => {
        const recommended = resolution.claims.find(
          (claim) => claim.id === resolution.recommendedClaimId && claim.confidence === "high"
        );
        const base = {
          scope: report.scope,
          ...(report.scope === "format" && report.raceId ? { raceId: report.raceId } : {}),
          field: resolution.field,
        } as const;
        const selection: WebsiteImportFieldSelection =
          resolution.status === "safe" && isMissingValue(resolution.currentValue) && recommended
            ? { ...base, decision: "claim", claimId: recommended.id }
            : isMissingValue(resolution.currentValue)
              ? { ...base, decision: "missing" }
              : { ...base, decision: "keep" };
        return [selectionKey(report.scope, report.raceId, resolution.field), selection] as const;
      })
    )
  );
};

const evidenceText = (evidence: WebsiteImportFormatCandidate["evidence"][number]) =>
  evidence.evidence;

const evidenceSource = (evidence: WebsiteImportFormatCandidate["evidence"][number]) => {
  const label = evidence.label;
  const page = evidence.page ? ` · page ${evidence.page}` : "";
  const year = evidence.edition ? ` · édition ${evidence.edition}` : "";
  return `${label}${page}${year}`;
};

export function WebsiteImportFormatDiscoveryReview({
  workflow,
  decisions,
  existingRaces,
  onChange,
  onAddManual,
  onMerge,
  onSeparate,
  onRemove,
}: {
  workflow: WebsiteImportDiscoveryWorkflow;
  decisions: WebsiteImportFormatDecision[];
  existingRaces: RaceFormat[];
  onChange: (groupId: string, change: Partial<WebsiteImportFormatDecision>) => void;
  onAddManual: () => void;
  onMerge: (groupId: string, targetGroupId: string) => void;
  onSeparate: (groupId: string, candidateKey: string) => void;
  onRemove: (groupId: string) => void;
}) {
  const candidateByKey = new Map(
    workflow.candidates.map((candidate) => [getWebsiteImportCandidateKey(candidate), candidate])
  );
  const confirmedCount = decisions.filter((decision) => decision.mode !== "ignore").length;
  const createdCount = decisions.filter((decision) => decision.mode === "create").length;
  const boundCount = decisions.filter((decision) => decision.mode === "bind-existing").length;
  const ignoredCount = decisions.filter((decision) => decision.mode === "ignore").length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Étape 1 sur 2 · Confirmer les formats</p>
            <p className="mt-1 text-xs text-muted-foreground">
              L’existence d’un format est évaluée séparément de la complétude de ses informations.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-primary">{confirmedCount}</p>
            <p className="text-xs text-muted-foreground">format{confirmedCount > 1 ? "s" : ""} après validation</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">{createdCount} à créer</span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-800">{boundCount} existant{boundCount > 1 ? "s" : ""}</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">{ignoredCount} ignoré{ignoredCount > 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Corrige le nom, regroupe les doublons ou rattache une détection à un format existant.
        </p>
        <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={onAddManual}>
          Ajouter un format oublié
        </Button>
      </div>

      {decisions.map((decision, decisionIndex) => {
        const candidates = decision.candidateKeys
          .map((candidateKey) => candidateByKey.get(candidateKey))
          .filter((candidate): candidate is WebsiteImportFormatCandidate => Boolean(candidate));
        const evidence = candidates.flatMap((candidate) => candidate.evidence);
        const missingFields = Array.from(new Set(candidates.flatMap((candidate) => candidate.completeness.missingRequiredFields)));
        const detectedEditions = Array.from(new Set(candidates.map((candidate) => candidate.edition.date ?? candidate.edition.year).filter(Boolean)));
        const confidence = candidates.some((candidate) => candidate.existenceConfidence === "low")
          ? "low"
          : candidates.some((candidate) => candidate.existenceConfidence === "medium")
            ? "medium"
            : "high";

        return (
          <section key={decision.groupId} className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Format final {decisionIndex + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {decision.manual ? "Ajout manuel" : `${decision.candidateKeys.length} détection${decision.candidateKeys.length > 1 ? "s regroupées" : ""}`}
                </p>
                {detectedEditions.length > 0 ? (
                  <p className="text-xs text-muted-foreground">Édition détectée : {detectedEditions.join(" · ")}</p>
                ) : null}
              </div>
              {decision.manual ? (
                <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => onRemove(decision.groupId)}>
                  Retirer cet ajout
                </button>
              ) : (
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceTone(confidence)}`}>
                  Existence · {confidenceLabels[confidence].replace("Confiance ", "")}
                </span>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)]">
              <label className="space-y-1 text-xs font-medium text-foreground">
                Nom confirmé
                <input
                  type="text"
                  maxLength={160}
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={decision.name}
                  onChange={(event) => onChange(decision.groupId, { name: event.target.value })}
                />
              </label>
              <label className="space-y-1 text-xs font-medium text-foreground">
                Décision
                <select
                  className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground"
                  value={decision.mode}
                  onChange={(event) => {
                    const mode = event.target.value as WebsiteImportFormatDecision["mode"];
                    onChange(decision.groupId, {
                      mode,
                      targetRaceId: mode === "bind-existing" ? decision.targetRaceId : null,
                    });
                  }}
                >
                  <option value="create">Créer un brouillon</option>
                  <option value="bind-existing">Rattacher à l’existant</option>
                  {!decision.manual ? <option value="ignore">Ignorer</option> : null}
                </select>
              </label>
              {decision.mode === "bind-existing" ? (
                <label className="space-y-1 text-xs font-medium text-foreground">
                  Format existant
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground"
                    value={decision.targetRaceId ?? ""}
                    onChange={(event) => onChange(decision.groupId, { targetRaceId: event.target.value || null })}
                  >
                    <option value="">Choisir une cible</option>
                    {existingRaces.map((race) => (
                      <option key={race.id} value={race.id}>{race.series_name || race.name} · {race.race_date?.slice(0, 10) ?? "sans date"}</option>
                    ))}
                  </select>
                </label>
              ) : !decision.manual && decisions.length > 1 ? (
                <label className="space-y-1 text-xs font-medium text-foreground">
                  Regrouper avec
                  <select
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground"
                    value=""
                    onChange={(event) => event.target.value && onMerge(decision.groupId, event.target.value)}
                  >
                    <option value="">Aucun regroupement</option>
                    {decisions
                      .filter(
                        (candidate) =>
                          candidate.groupId !== decision.groupId &&
                          candidate.mode !== "ignore" &&
                          !candidate.manual
                      )
                      .map((candidate) => <option key={candidate.groupId} value={candidate.groupId}>{candidate.name}</option>)}
                  </select>
                </label>
              ) : (
                <div />
              )}
            </div>

            {decision.candidateKeys.length > 1 ? (
              <div className="flex flex-wrap gap-2">
                {decision.candidateKeys.map((candidateKey) => {
                  const candidate = candidateByKey.get(candidateKey);
                  return (
                    <button
                      key={candidateKey}
                      type="button"
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:border-primary"
                      onClick={() => onSeparate(decision.groupId, candidateKey)}
                    >
                      {candidate?.names[0] ?? candidateKey} · séparer
                    </button>
                  );
                })}
              </div>
            ) : null}

            {evidence.length > 0 ? (
              <details className="rounded-md border border-border/60 bg-muted/20 px-3 py-2" open={confidence !== "high"}>
                <summary className="cursor-pointer text-xs font-medium text-foreground">Preuves d’existence ({evidence.length})</summary>
                <div className="mt-2 space-y-2">
                  {evidence.map((item, index) => {
                    const url = item.url;
                    return (
                      <div key={`${decision.groupId}-evidence-${index}`} className="border-l-2 border-border pl-2 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{evidenceSource(item)}</p>
                        <p className="break-words">{evidenceText(item)}</p>
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">Ouvrir la source</a> : null}
                      </div>
                    );
                  })}
                </div>
              </details>
            ) : null}

            {missingFields.length > 0 && decision.mode !== "ignore" ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Format incomplet : {missingFields.join(", ")}. Il sera quand même créé comme brouillon masqué.
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

const reportCounts = (report: WebsiteImportFieldReport) => ({
  safe: report.resolutions.filter((item) => item.status === "safe").length,
  review: report.resolutions.filter((item) => item.status === "review").length,
  conflict: report.resolutions.filter((item) => item.status === "conflict").length,
  missing: report.resolutions.filter((item) => item.status === "missing").length,
});

function FieldReportReview({
  report,
  selections,
  onSelectionChange,
}: {
  report: WebsiteImportFieldReport;
  selections: Record<string, WebsiteImportFieldSelection>;
  onSelectionChange: (key: string, selection: WebsiteImportFieldSelection) => void;
}) {
  const counts = reportCounts(report);
  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {report.scope === "event" ? "Événement" : "Format"}
          </p>
          <h3 className="font-semibold text-foreground">{report.name}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium">
          {(["safe", "review", "conflict", "missing"] as const).map((status) => (
            <span key={status} className={`rounded-full border px-2 py-0.5 ${statusTone(status)}`}>
              {statusLabels[status]} {counts[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {report.resolutions.map((resolution) => {
          const key = selectionKey(report.scope, report.raceId, resolution.field);
          const selected = selections[key];
          const selectionBase = {
            scope: report.scope,
            ...(report.scope === "format" && report.raceId ? { raceId: report.raceId } : {}),
            field: resolution.field,
          } as const;
          return (
            <div key={key} className="space-y-3 rounded-md border border-border/60 bg-background p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{resolution.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Actuel : <span className="font-medium text-foreground">{formatWebsiteImportValue(resolution.currentValue)}</span>
                  </p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone(resolution.status)}`}>
                  {statusLabels[resolution.status]}
                </span>
              </div>
              {resolution.reason ? (
                <p className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
                  Arbitrage assisté : {resolution.reason}
                </p>
              ) : null}

              <div className="space-y-2">
                {!isMissingValue(resolution.currentValue) ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2.5">
                    <input
                      type="radio"
                      name={key}
                      className="mt-0.5 h-4 w-4"
                      checked={selected?.decision === "keep"}
                      onChange={() => onSelectionChange(key, { ...selectionBase, decision: "keep" })}
                    />
                    <span className="text-sm text-foreground">Garder la valeur actuelle</span>
                  </label>
                ) : null}

                {resolution.claims.map((claim) => {
                  const checked = selected?.decision === "claim" && selected.claimId === claim.id;
                  const recommended = resolution.recommendedClaimId === claim.id;
                  const sourceDetails = [
                    claim.source.label,
                    claim.source.fileName && claim.source.fileName !== claim.source.label
                      ? claim.source.fileName
                      : null,
                    claim.source.editionYear ? `édition ${claim.source.editionYear}` : null,
                    claim.source.page ? `page ${claim.source.page}` : null,
                  ].filter(Boolean).join(" · ");
                  return (
                    <label key={claim.id} className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 ${checked ? "border-primary bg-primary/5" : "border-border/60"}`}>
                      <input
                        type="radio"
                        name={key}
                        className="mt-0.5 h-4 w-4"
                        checked={checked}
                        onChange={() => onSelectionChange(key, { ...selectionBase, decision: "claim", claimId: claim.id })}
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex flex-wrap items-center justify-between gap-2">
                          <span className="break-words text-sm font-medium text-foreground">{formatWebsiteImportValue(claim.value)}</span>
                          <span className="flex flex-wrap gap-1.5">
                            {recommended ? (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                Recommandation
                              </span>
                            ) : null}
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceTone(claim.confidence)}`}>
                              {confidenceLabels[claim.confidence]}
                            </span>
                          </span>
                        </span>
                        <span className="block text-xs text-muted-foreground">{sourceDetails}</span>
                        <span className="block break-words border-l-2 border-border pl-2 text-xs text-muted-foreground">Preuve : {claim.evidence.join(" · ")}</span>
                        {claim.source.url ? <a href={claim.source.url} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-primary hover:underline" onClick={(event) => event.stopPropagation()}>Ouvrir la source</a> : null}
                      </span>
                    </label>
                  );
                })}

                {resolution.currentValue === null ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-dashed border-border/70 p-2.5">
                    <input
                      type="radio"
                      name={key}
                      className="mt-0.5 h-4 w-4"
                      checked={selected?.decision === "missing"}
                      onChange={() => onSelectionChange(key, { ...selectionBase, decision: "missing" })}
                    />
                    <span className="text-sm text-muted-foreground">Laisser ce champ manquant</span>
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function WebsiteImportFieldReview({
  workflow,
  selections,
  onSelectionChange,
}: {
  workflow: WebsiteImportReviewWorkflow;
  selections: Record<string, WebsiteImportFieldSelection>;
  onSelectionChange: (key: string, selection: WebsiteImportFieldSelection) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">Étape 2 sur 2 · Valider les informations</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Chaque valeur reste liée à sa source et à sa preuve. Les conflits ne sont jamais sélectionnés automatiquement.
        </p>
      </div>
      <FieldReportReview report={workflow.eventReport} selections={selections} onSelectionChange={onSelectionChange} />
      {workflow.formatReports.map((report, index) => (
        <FieldReportReview key={report.raceId ?? `${report.name}-${index}`} report={report} selections={selections} onSelectionChange={onSelectionChange} />
      ))}
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Tu peux appliquer une revue partielle. Tout format encore incomplet restera en brouillon et masqué du catalogue jusqu’à sa complétion.
      </p>
    </div>
  );
}
