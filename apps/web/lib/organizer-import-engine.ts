import { z } from "zod";

import type { OrganizerWebsiteImportFinding, OrganizerWebsiteImportPreview } from "./organizer-website-import";

export const ORGANIZER_IMPORT_CLAIM_FIELDS = [
  "name",
  "location",
  "officialWebsiteUrl",
  "startAddress",
  "shuttles",
  "officialParkings",
  "seriesName",
  "raceDate",
  "locationText",
  "distanceKm",
  "elevationGainM",
  "elevationLossM",
  "externalSiteUrl",
  "thumbnailUrl",
  "gpx",
  "aidStations",
  "startTime",
  "finishCutoffTime",
  "bibPickup",
  "mandatoryEquipment",
  "emergencyContact",
  "liveTracking",
] as const;

export const organizerImportClaimFieldSchema = z.enum(ORGANIZER_IMPORT_CLAIM_FIELDS);
export type OrganizerImportClaimField = z.infer<typeof organizerImportClaimFieldSchema>;

export const organizerImportAidStationClaimSchema = z.object({
  name: z.string().trim().min(1).max(200),
  distanceKm: z.number().finite().nonnegative(),
  waterRefill: z.boolean().nullable(),
  solidRefill: z.boolean().nullable(),
  assistanceAllowed: z.boolean().nullable(),
}).strict();

export type OrganizerImportAidStationClaim = z.infer<typeof organizerImportAidStationClaimSchema>;

export const organizerImportClaimValueSchema = z.union([
  z.string().trim().min(1).max(2_000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().trim().min(1).max(500)).max(100),
  z.array(organizerImportAidStationClaimSchema).max(100),
  z.null(),
]);

export type OrganizerImportClaimValue = z.infer<typeof organizerImportClaimValueSchema>;

export const organizerImportClaimScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), scopeKey: z.literal("event") }).strict(),
  z.object({ kind: z.literal("format"), scopeKey: z.string().trim().min(1).max(300) }).strict(),
]);

export type OrganizerImportClaimScope = z.infer<typeof organizerImportClaimScopeSchema>;

export const organizerImportSourceKindSchema = z.enum([
  "gpx",
  "structured-data",
  "official-page",
  "official-document",
  "ocr",
  "current-data",
  "previous-edition",
]);

export type OrganizerImportSourceKind = z.infer<typeof organizerImportSourceKindSchema>;

export const organizerImportEvidenceSchema = z.object({
  sourceId: z.string().trim().min(1).max(500),
  kind: organizerImportSourceKindSchema,
  label: z.string().trim().min(1).max(300),
  url: z.string().url().nullable(),
  page: z.number().int().positive().nullable(),
  edition: z.string().trim().min(1).max(100).nullable(),
  evidence: z.string().trim().min(1).max(2_000),
}).strict();

export type OrganizerImportEvidence = z.infer<typeof organizerImportEvidenceSchema>;

export const sourceClaimSchema = z.object({
  claimId: z.string().trim().min(1).max(500),
  scope: organizerImportClaimScopeSchema,
  field: organizerImportClaimFieldSchema,
  value: organizerImportClaimValueSchema,
  source: organizerImportEvidenceSchema.omit({ evidence: true }),
  evidence: z.string().trim().min(1).max(2_000),
  confidence: z.enum(["high", "medium", "low"]),
  claimRole: z.enum(["candidate", "current", "reference"]),
}).strict();

export type SourceClaim = z.infer<typeof sourceClaimSchema>;

export const formatCandidateSchema = z.object({
  candidateKey: z.string().trim().min(1).max(300),
  detectionKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  names: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  proposedName: z.string().trim().min(1).max(300),
  edition: z.object({
    date: z.string().nullable(),
    year: z.string().regex(/^\d{4}$/).nullable(),
  }).strict(),
  existenceConfidence: z.enum(["high", "medium", "low"]),
  evidence: z.array(organizerImportEvidenceSchema).min(1).max(30),
  claims: z.array(sourceClaimSchema).max(100),
  completeness: z.object({
    knownRequiredFields: z.array(organizerImportClaimFieldSchema),
    missingRequiredFields: z.array(organizerImportClaimFieldSchema),
  }).strict(),
  suggestedExistingRaceId: z.string().trim().min(1).nullable(),
}).strict();

export type FormatCandidate = z.infer<typeof formatCandidateSchema>;

export const confirmedFormatSchema = z.object({
  formatKey: z.string().trim().min(1).max(300),
  candidateKeys: z.array(z.string().trim().min(1).max(300)).min(1).max(30),
  mode: z.enum(["create", "bind-existing"]),
  name: z.string().trim().min(1).max(300),
  raceId: z.string().trim().min(1).nullable(),
}).strict().superRefine((format, context) => {
  if (format.mode === "create" && format.raceId !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["raceId"], message: "Un nouveau format ne doit pas avoir de raceId." });
  }
  if (format.mode === "bind-existing" && format.raceId === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["raceId"], message: "Un rattachement exige un raceId." });
  }
});

export type ConfirmedFormat = z.infer<typeof confirmedFormatSchema>;

export const fieldResolutionSchema = z.object({
  resolutionId: z.string().trim().min(1).max(700),
  scope: organizerImportClaimScopeSchema,
  field: organizerImportClaimFieldSchema,
  status: z.enum(["resolved", "conflict", "missing"]),
  currentClaim: sourceClaimSchema.nullable(),
  claims: z.array(sourceClaimSchema).max(100),
  referenceClaims: z.array(sourceClaimSchema).max(100),
  recommendedClaimId: z.string().trim().min(1).max(500).nullable(),
  requiresLlm: z.boolean(),
  canPreselect: z.boolean(),
  reason: z.string().trim().min(1).max(500),
}).strict();

export type FieldResolution = z.infer<typeof fieldResolutionSchema>;

export type OrganizerImportFieldValues = Partial<Record<OrganizerImportClaimField, OrganizerImportClaimValue | undefined>>;

export type OrganizerImportFormatData = {
  formatKey: string;
  raceId?: string | null;
  name?: string | null;
  seriesName?: string | null;
  edition?: string | null;
  values: OrganizerImportFieldValues;
};

export type OrganizerImportExistingRace = {
  id: string;
  name: string;
  seriesName?: string | null;
  raceDate?: string | null;
  distanceKm?: number | null;
};

export type BuildSourceClaimsInput = {
  preview?: OrganizerWebsiteImportPreview | null;
  scopeKeyByPreviewRaceKey?: Record<string, string>;
  currentData?: {
    event?: OrganizerImportFieldValues;
    formats?: OrganizerImportFormatData[];
  } | null;
  previousEditionData?: {
    edition: string | null;
    event?: OrganizerImportFieldValues;
    formats?: OrganizerImportFormatData[];
  } | null;
  additionalClaims?: SourceClaim[];
};

export type GroupClaimsIntoFieldResolutionsOptions = {
  expectedScopes?: OrganizerImportClaimScope[];
  expectedFields?: OrganizerImportClaimField[];
};

const REQUIRED_FORMAT_FIELDS: OrganizerImportClaimField[] = ["name", "raceDate", "distanceKm", "elevationGainM"];

const normalizeText = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr-FR")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const isPresentClaimValue = (value: OrganizerImportClaimValue | undefined): value is Exclude<OrganizerImportClaimValue, null> => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

const sourceKindForFinding = (finding: OrganizerWebsiteImportFinding | undefined): OrganizerImportSourceKind => {
  if (!finding) return "official-page";
  if (finding.key === "gpx" || /gpx/i.test(finding.sourceLabel ?? "")) return "gpx";
  if (/json.?ld|structured/i.test(finding.sourceLabel ?? "")) return "structured-data";
  return "official-page";
};

export const createSourceClaim = (input: Omit<SourceClaim, "claimId">): SourceClaim => ({
  ...input,
  claimId: `claim:${stableHash(JSON.stringify([
    input.scope.kind,
    input.scope.scopeKey,
    input.field,
    input.value,
    input.source.kind,
    input.source.sourceId,
    input.source.page,
  ]))}`,
});

const makeWebsiteClaim = (input: {
  preview: OrganizerWebsiteImportPreview;
  scope: OrganizerImportClaimScope;
  field: OrganizerImportClaimField;
  value: OrganizerImportClaimValue | undefined;
  finding?: OrganizerWebsiteImportFinding;
  fallbackEvidence: string;
}): SourceClaim | null => {
  if (!isPresentClaimValue(input.value)) return null;
  const sourceUrl = input.finding?.sourceUrl ?? input.preview.source.url;
  const sourceLabel = input.finding?.sourceLabel ?? input.preview.source.label;
  return createSourceClaim({
    scope: input.scope,
    field: input.field,
    value: input.value,
    source: {
      sourceId: sourceUrl || `${input.preview.source.provider}:${input.scope.scopeKey}`,
      kind: sourceKindForFinding(input.finding),
      label: sourceLabel || "Site officiel",
      url: sourceUrl || null,
      page: null,
      edition: null,
    },
    evidence: input.finding?.value ?? input.fallbackEvidence,
    confidence: input.finding?.confidence ?? (input.preview.source.provider === "generic" ? "medium" : "high"),
    claimRole: "candidate",
  });
};

const buildWebsiteClaims = (
  preview: OrganizerWebsiteImportPreview,
  scopeKeyByPreviewRaceKey: Record<string, string> = {}
): SourceClaim[] => {
  const claims: SourceClaim[] = [];
  const eventScope: OrganizerImportClaimScope = { kind: "event", scopeKey: "event" };
  const eventValues: Array<[OrganizerImportClaimField, OrganizerImportClaimValue | undefined]> = [
    ["name", preview.event.name ?? undefined],
    ["location", preview.event.location ?? undefined],
    ["officialWebsiteUrl", preview.event.officialWebsiteUrl ?? undefined],
    ["mandatoryEquipment", preview.event.logistics.mandatoryEquipment],
    ["startAddress", preview.event.logistics.startAddress ?? undefined],
    ["shuttles", preview.event.logistics.shuttles ?? undefined],
    ["officialParkings", preview.event.logistics.officialParkings ?? undefined],
  ];
  for (const [field, value] of eventValues) {
    const claim = makeWebsiteClaim({
      preview,
      scope: eventScope,
      field,
      value,
      fallbackEvidence: typeof value === "string" ? value : `${field} détecté sur la source officielle`,
    });
    if (claim) claims.push(claim);
  }

  for (const race of preview.races) {
    const scopeKey = scopeKeyByPreviewRaceKey[race.key] ?? race.key;
    const scope: OrganizerImportClaimScope = { kind: "format", scopeKey };
    const aidStations: OrganizerImportAidStationClaim[] = race.aidStations.map((station) => ({
      name: station.name,
      distanceKm: station.distanceKm,
      waterRefill: station.waterRefill,
      solidRefill: null,
      assistanceAllowed: null,
    }));
    const values: Array<[OrganizerImportClaimField, OrganizerImportClaimValue | undefined]> = [
      ["name", race.name],
      ["seriesName", race.seriesName],
      ["raceDate", race.raceDate ?? undefined],
      ["locationText", race.locationText ?? undefined],
      ["distanceKm", race.distanceKm ?? undefined],
      ["elevationGainM", race.elevationGainM ?? undefined],
      ["elevationLossM", race.elevationLossM ?? undefined],
      ["externalSiteUrl", race.externalSiteUrl ?? undefined],
      ["thumbnailUrl", race.thumbnailUrl ?? undefined],
      ["gpx", race.gpxContent ? true : undefined],
      ["aidStations", aidStations],
    ];
    for (const [field, value] of values) {
      const finding = race.assessment?.findings.find((candidate) => candidate.key === field);
      const claim = makeWebsiteClaim({
        preview,
        scope,
        field,
        value,
        finding,
        fallbackEvidence: typeof value === "string" || typeof value === "number"
          ? String(value)
          : `${field} détecté pour ${race.name}`,
      });
      if (claim) claims.push(claim);
    }
  }
  return claims;
};

const buildDataClaims = (input: {
  role: "current" | "reference";
  sourceKind: "current-data" | "previous-edition";
  sourceLabel: string;
  edition: string | null;
  event?: OrganizerImportFieldValues;
  formats?: OrganizerImportFormatData[];
}): SourceClaim[] => {
  const claims: SourceClaim[] = [];
  const appendValues = (scope: OrganizerImportClaimScope, values: OrganizerImportFieldValues) => {
    for (const field of ORGANIZER_IMPORT_CLAIM_FIELDS) {
      const value = values[field];
      if (!isPresentClaimValue(value)) continue;
      claims.push(createSourceClaim({
        scope,
        field,
        value,
        source: {
          sourceId: `${input.sourceKind}:${scope.scopeKey}:${input.edition ?? "current"}`,
          kind: input.sourceKind,
          label: input.sourceLabel,
          url: null,
          page: null,
          edition: input.edition,
        },
        evidence: `${input.sourceLabel} · ${field}`,
        confidence: input.role === "current" ? "high" : "medium",
        claimRole: input.role,
      }));
    }
  };
  if (input.event) appendValues({ kind: "event", scopeKey: "event" }, input.event);
  for (const format of input.formats ?? []) {
    appendValues(
      { kind: "format", scopeKey: format.formatKey },
      {
        ...format.values,
        name: format.values.name ?? format.name ?? undefined,
        seriesName: format.values.seriesName ?? format.seriesName ?? undefined,
      }
    );
  }
  return claims;
};

export function buildSourceClaims(input: BuildSourceClaimsInput): SourceClaim[] {
  const claims: SourceClaim[] = [];
  if (input.preview) claims.push(...buildWebsiteClaims(input.preview, input.scopeKeyByPreviewRaceKey));
  if (input.currentData) {
    claims.push(...buildDataClaims({
      role: "current",
      sourceKind: "current-data",
      sourceLabel: "Données Organizer actuelles",
      edition: null,
      event: input.currentData.event,
      formats: input.currentData.formats,
    }));
  }
  if (input.previousEditionData) {
    claims.push(...buildDataClaims({
      role: "reference",
      sourceKind: "previous-edition",
      sourceLabel: "Édition précédente",
      edition: input.previousEditionData.edition,
      event: input.previousEditionData.event,
      formats: input.previousEditionData.formats,
    }));
  }
  claims.push(...(input.additionalClaims ?? []).map((claim) => sourceClaimSchema.parse(claim)));

  const byId = new Map<string, SourceClaim>();
  for (const claim of claims) byId.set(claim.claimId, claim);
  return [...byId.values()];
}

const formatYear = (date: string | null | undefined) => date?.match(/^(\d{4})-/)?.[1] ?? null;

export function buildFormatCandidates(
  preview: OrganizerWebsiteImportPreview,
  existingRaces: OrganizerImportExistingRace[] = []
): FormatCandidate[] {
  const claims = buildWebsiteClaims(preview);
  return preview.races.map((race) => {
    const raceClaims = claims.filter((claim) => claim.scope.kind === "format" && claim.scope.scopeKey === race.key);
    const names = Array.from(new Set([race.name, race.seriesName].map((name) => name.trim()).filter(Boolean)));
    const normalizedNames = new Set(names.map(normalizeText));
    const year = formatYear(race.raceDate);
    const exactMatches = existingRaces.filter((existing) => {
      const existingNames = [existing.name, existing.seriesName ?? ""].map(normalizeText).filter(Boolean);
      const nameMatches = existingNames.some((name) => normalizedNames.has(name));
      const existingYear = formatYear(existing.raceDate);
      return nameMatches && (!year || !existingYear || year === existingYear);
    });
    const nameFinding = race.assessment?.findings.find((finding) => finding.key === "name");
    const sourceUrl = nameFinding?.sourceUrl ?? race.externalSiteUrl ?? preview.source.url;
    const evidence: OrganizerImportEvidence[] = [{
      sourceId: sourceUrl || `${preview.source.provider}:${race.key}`,
      kind: sourceKindForFinding(nameFinding),
      label: nameFinding?.sourceLabel ?? preview.source.label,
      url: sourceUrl || null,
      page: null,
      edition: year,
      evidence: nameFinding?.value ?? race.name,
    }];
    const knownRequiredFields = REQUIRED_FORMAT_FIELDS.filter((field) => raceClaims.some((claim) => claim.field === field));
    const missingRequiredFields = REQUIRED_FORMAT_FIELDS.filter((field) => !knownRequiredFields.includes(field));
    return formatCandidateSchema.parse({
      candidateKey: race.key,
      detectionKeys: [race.key],
      names,
      proposedName: race.name,
      edition: { date: race.raceDate, year },
      existenceConfidence: nameFinding?.confidence ?? (preview.source.provider === "generic" ? "medium" : "high"),
      evidence,
      claims: raceClaims,
      completeness: { knownRequiredFields, missingRequiredFields },
      suggestedExistingRaceId: exactMatches.length === 1 ? exactMatches[0].id : null,
    });
  });
}

const metricTolerance = (left: number, right: number, absolute: number, relative: number) =>
  Math.max(absolute, Math.max(Math.abs(left), Math.abs(right)) * relative);

const normalizeStringArray = (value: string[]) => value.map(normalizeText).filter(Boolean).sort();
const normalizeAidStations = (value: OrganizerImportAidStationClaim[]) => [...value]
  .map((station) => ({
    ...station,
    name: normalizeText(station.name),
    distanceKm: Number(station.distanceKm.toFixed(2)),
  }))
  .sort((left, right) => left.distanceKm - right.distanceKm || left.name.localeCompare(right.name));

export function organizerClaimValuesAreConcordant(
  field: OrganizerImportClaimField,
  left: OrganizerImportClaimValue,
  right: OrganizerImportClaimValue
): boolean {
  if (left === null || right === null) return left === right;
  if (field === "distanceKm" && typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= metricTolerance(left, right, 0.5, 0.02);
  }
  if ((field === "elevationGainM" || field === "elevationLossM") && typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) <= metricTolerance(left, right, 100, 0.08);
  }
  if (typeof left === "string" && typeof right === "string") return normalizeText(left) === normalizeText(right);
  if (typeof left === "number" && typeof right === "number") return left === right;
  if (typeof left === "boolean" && typeof right === "boolean") return left === right;
  if (Array.isArray(left) && Array.isArray(right)) {
    const leftIsText = left.every((item) => typeof item === "string");
    const rightIsText = right.every((item) => typeof item === "string");
    if (leftIsText && rightIsText) {
      return JSON.stringify(normalizeStringArray(left as string[])) === JSON.stringify(normalizeStringArray(right as string[]));
    }
    return JSON.stringify(normalizeAidStations(left as OrganizerImportAidStationClaim[])) ===
      JSON.stringify(normalizeAidStations(right as OrganizerImportAidStationClaim[]));
  }
  return false;
}

const sourcePriority: Record<OrganizerImportSourceKind, number> = {
  gpx: 100,
  "structured-data": 90,
  "current-data": 85,
  "official-document": 80,
  "official-page": 70,
  "previous-edition": 50,
  ocr: 30,
};

const confidencePriority = { high: 3, medium: 2, low: 1 } as const;
const sortClaims = (left: SourceClaim, right: SourceClaim) =>
  confidencePriority[right.confidence] - confidencePriority[left.confidence] ||
  sourcePriority[right.source.kind] - sourcePriority[left.source.kind] ||
  left.claimId.localeCompare(right.claimId);

const groupConcordantClaims = (field: OrganizerImportClaimField, claims: SourceClaim[]) => {
  const groups: SourceClaim[][] = [];
  for (const claim of claims) {
    const group = groups.find((candidate) => organizerClaimValuesAreConcordant(field, candidate[0].value, claim.value));
    if (group) group.push(claim);
    else groups.push([claim]);
  }
  return groups;
};

export function groupClaimsIntoFieldResolutions(
  claims: SourceClaim[],
  options: GroupClaimsIntoFieldResolutionsOptions = {}
): FieldResolution[] {
  const parsedClaims = claims.map((claim) => sourceClaimSchema.parse(claim));
  const grouped = new Map<string, {
    scope: OrganizerImportClaimScope;
    field: OrganizerImportClaimField;
    claims: SourceClaim[];
  }>();
  for (const claim of parsedClaims) {
    const key = `${claim.scope.kind}:${claim.scope.scopeKey}:${claim.field}`;
    const existing = grouped.get(key);
    grouped.set(key, {
      scope: claim.scope,
      field: claim.field,
      claims: [...(existing?.claims ?? []), claim],
    });
  }
  for (const scope of options.expectedScopes ?? []) {
    for (const field of options.expectedFields ?? []) {
      const key = `${scope.kind}:${scope.scopeKey}:${field}`;
      if (!grouped.has(key)) grouped.set(key, { scope, field, claims: [] });
    }
  }

  return [...grouped.entries()].map(([groupKey, entry]) => {
    const group = entry.claims;
    const currentClaims = group.filter((claim) => claim.claimRole === "current").sort(sortClaims);
    const candidateClaims = group.filter((claim) => claim.claimRole === "candidate").sort(sortClaims);
    const referenceClaims = group.filter((claim) => claim.claimRole === "reference").sort(sortClaims);
    const decisionClaims = [...currentClaims.slice(0, 1), ...candidateClaims];
    const valueGroups = groupConcordantClaims(entry.field, decisionClaims);
    const hasConflict = valueGroups.length > 1;
    const currentClaim = currentClaims[0] ?? null;
    const recommendedClaim = hasConflict ? null : currentClaim ?? candidateClaims[0] ?? null;
    const fillsMissing = currentClaim === null && candidateClaims.length > 0;
    const canPreselect = fillsMissing && !hasConflict && recommendedClaim?.claimRole === "candidate" && recommendedClaim.confidence === "high";
    const status: FieldResolution["status"] = decisionClaims.length === 0
      ? "missing"
      : hasConflict
        ? "conflict"
        : "resolved";
    const reason = status === "missing"
      ? "Aucune source applicable ne renseigne ce champ."
      : status === "conflict"
        ? "Plusieurs sources applicables proposent des valeurs incompatibles."
        : currentClaim
          ? "Les sources applicables concordent avec la valeur actuelle."
          : "Les sources applicables concordent sur une valeur.";
    return fieldResolutionSchema.parse({
      resolutionId: `resolution:${groupKey}`,
      scope: entry.scope,
      field: entry.field,
      status,
      currentClaim,
      claims: candidateClaims,
      referenceClaims,
      recommendedClaimId: recommendedClaim?.claimId ?? null,
      requiresLlm: hasConflict,
      canPreselect,
      reason,
    });
  }).sort((left, right) => left.resolutionId.localeCompare(right.resolutionId));
}
