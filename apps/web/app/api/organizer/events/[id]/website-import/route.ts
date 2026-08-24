import { createHmac, randomUUID, timingSafeEqual } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimitAsync, withSecurityHeaders } from "../../../../../../lib/http";
import {
  buildSlug,
  jsonError,
  optionalTextOrNull,
  optionalUrlOrNull,
  requireAdminAuth,
  serviceHeaders,
  type OrganizerAuth,
  uuidParamSchema,
} from "../../../../../../lib/organizer";
import {
  buildOrganizerWebsiteImportAnalysis,
  buildOrganizerWebsiteImportPreview,
  computeOrganizerWebsiteImportPreviewHash,
  OrganizerWebsiteImportError,
  type OrganizerWebsiteImportPreview,
  type OrganizerWebsiteImportRace,
} from "../../../../../../lib/organizer-website-import";
import {
  organizerEventDetailsSchema,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
} from "../../../../../../lib/organizer-dashboard-details";
import {
  buildOrganizerDocumentSourceClaims,
  extractOrganizerDocument,
  reconcileOrganizerDocumentFindings,
  attachDocumentFindingsToFormats,
  ORGANIZER_DOCUMENT_MAX_BYTES,
  ORGANIZER_DOCUMENT_MAX_COUNT,
  validateOrganizerDocument,
} from "../../../../../../lib/organizer-document-import";
import {
  reconcileOrganizerImportWithLlm,
  resolveOrganizerFieldConflictsWithLlm,
  OrganizerImportReconciliationError,
  type OrganizerImportReconciliation,
} from "../../../../../../lib/organizer-import-reconciliation";
import {
  organizerImportEventFields,
  organizerImportRaceFields,
  type OrganizerImportFieldProposal,
  type OrganizerImportProposalSnapshot,
  type OrganizerImportProposalValue,
  type OrganizerImportRaceField,
} from "../../../../../../lib/organizer-import-proposals";
import {
  createOrganizerImportSession,
  deleteOrganizerImportSession,
  loadOrganizerImportSession,
  organizerImportSourceManifestSchema,
  updateOrganizerImportSession,
} from "../../../../../../lib/organizer-import-sessions";
import {
  buildFormatCandidates,
  buildSourceClaims,
  createSourceClaim,
  fieldResolutionSchema,
  formatCandidateSchema,
  groupClaimsIntoFieldResolutions,
  sourceClaimSchema,
  type FieldResolution,
  type OrganizerImportClaimValue,
  type OrganizerImportClaimField,
  type SourceClaim,
} from "../../../../../../lib/organizer-import-engine";
import {
  analyzeOrganizerOfficialSources,
  type OrganizerSourceAnalysis,
  type OrganizerSourceAssertion,
  type OrganizerSourceIntelligenceResult,
} from "../../../../../../lib/organizer-source-intelligence";

export const runtime = "nodejs";

const raceSelectionSchema = z.object({
  previewRaceKey: z.string().trim().min(1),
  mode: z.enum(["create", "update", "ignore"]),
  targetRaceId: z.string().uuid().nullable().optional(),
  selectedProposalIds: z.array(z.string().trim().min(1).max(240)).max(40).default([]),
});
const MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE = 70;

const temporaryDocumentReferenceSchema = z.object({
  path: z.string().trim().min(1).max(240),
  fileName: z.string().trim().min(1).max(200),
  mediaType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(ORGANIZER_DOCUMENT_MAX_BYTES),
});

const workflowConfirmedFormatSchema = z.object({
  candidateKeys: z.array(z.string().trim().min(1).max(300)).max(30),
  mode: z.enum(["create", "bind-existing", "ignore"]),
  targetRaceId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(300),
});

const workflowFieldSelectionSchema = z.object({
  scope: z.enum(["event", "format"]),
  raceId: z.string().uuid().nullable().optional(),
  field: z.string().trim().min(1).max(100),
  decision: z.enum(["claim", "keep", "missing"]),
  claimId: z.string().trim().min(1).max(300).nullable().optional(),
}).superRefine((selection, context) => {
  if (selection.scope === "format" && !selection.raceId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["raceId"], message: "Un format exige une cible." });
  }
  if (selection.decision === "claim" && !selection.claimId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["claimId"], message: "Une valeur exige une source." });
  }
});

const workflowRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("discover-formats"),
    editionId: z.string().uuid(),
    url: z.union([z.string().trim().url(), z.literal("")]).default(""),
    additionalUrls: z.array(z.string().trim().url()).max(12).default([]),
    // Backward-compatible request input. New clients use additionalUrls because these pages are not necessarily formats.
    formatUrls: z.array(z.string().trim().url()).max(12).default([]),
    documents: z.array(temporaryDocumentReferenceSchema).max(ORGANIZER_DOCUMENT_MAX_COUNT).default([]),
  }),
  z.object({
    action: z.literal("confirm-formats"),
    sessionId: z.string().uuid(),
    discoverySnapshot: z.unknown(),
    discoverySignature: z.string().regex(/^[a-f0-9]{64}$/),
    confirmedFormats: z.array(workflowConfirmedFormatSchema).max(30),
  }),
  z.object({ action: z.literal("analyze-fields"), sessionId: z.string().uuid() }),
  z.object({
    action: z.literal("apply-fields"),
    sessionId: z.string().uuid(),
    fieldSnapshot: z.unknown(),
    fieldSignature: z.string().regex(/^[a-f0-9]{64}$/),
    selections: z.array(workflowFieldSelectionSchema).max(500),
  }),
  z.object({ action: z.literal("cancel"), sessionId: z.string().uuid() }),
]);

type WorkflowRequest = z.infer<typeof workflowRequestSchema>;

const workflowActions = new Set<WorkflowRequest["action"]>([
  "discover-formats",
  "confirm-formats",
  "analyze-fields",
  "apply-fields",
  "cancel",
]);

const isWorkflowAction = (value: unknown): value is WorkflowRequest["action"] =>
  typeof value === "string" && workflowActions.has(value as WorkflowRequest["action"]);

const previewRequestSchema = z.object({
  action: z.literal("preview"),
  url: z.union([z.string().trim().url(), z.literal("")]).default(""),
  formatUrls: z.array(z.string().trim().url()).max(12).default([]),
  documents: z.array(temporaryDocumentReferenceSchema).max(ORGANIZER_DOCUMENT_MAX_COUNT).default([]),
});

const parsePreviewRequest = async (request: NextRequest) => {
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return { parsed: previewRequestSchema.safeParse(await request.json().catch(() => null)), documents: [] as File[] };
  }

  const formData = await request.formData();
  const files = formData.getAll("documents").filter((value): value is File => value instanceof File);
  const documentError = files.length > ORGANIZER_DOCUMENT_MAX_COUNT ? "Ajoute au maximum 8 documents." : files.map(validateOrganizerDocument).find(Boolean);
  if (documentError) return { parsed: previewRequestSchema.safeParse({}), documents: files };

  let formatUrls: unknown = [];
  try {
    formatUrls = JSON.parse(String(formData.get("formatUrls") ?? "[]"));
  } catch {
    formatUrls = null;
  }

  return {
    parsed: previewRequestSchema.safeParse({
      action: formData.get("action"),
      url: formData.get("url"),
      formatUrls,
      documents: [],
    }),
    documents: files,
  };
};

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });

const applyRequestSchema = z.object({
  action: z.literal("apply"),
  url: z.union([z.string().trim().url(), z.literal("")]).default(""),
  formatUrls: z.array(z.string().trim().url()).max(12).default([]),
  previewHash: z.string().trim().min(16),
  eventRaceDate: isoDateSchema.optional(),
  eventEditionEndDate: isoDateSchema.optional(),
  selectedEditionYear: z.string().trim().optional(),
  proposalSnapshot: z.unknown(),
  proposalSignature: z.string().regex(/^[a-f0-9]{64}$/),
  selectedEventProposalIds: z.array(z.string().trim().min(1).max(240)).max(30).default([]),
  raceSelections: z.array(raceSelectionSchema).default([]),
});

const proposalValueSchema = z.union([
  z.string().max(2_000),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(z.string().trim().min(1).max(500)).max(100),
  z.array(
    z.object({
      name: z.string().trim().min(1).max(200),
      distanceKm: z.number().finite().nonnegative(),
      waterRefill: z.boolean().nullable(),
      solidRefill: z.boolean().nullable(),
      assistanceAllowed: z.boolean().nullable(),
    })
  ).max(100),
]);

const proposalSnapshotSchema = z.object({
  version: z.literal(1),
  eventId: z.string().uuid(),
  previewHash: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAt: z.string().datetime(),
  proposals: z.array(
    z.object({
      id: z.string().trim().min(1).max(240),
      scope: z.enum(["event", "format"]),
      previewRaceKey: z.string().nullable(),
      field: z.enum([...organizerImportEventFields, ...organizerImportRaceFields]),
      label: z.string().trim().min(1).max(200),
      value: proposalValueSchema,
      currentValue: proposalValueSchema,
      sourceKind: z.enum(["gpx", "structured-data", "html", "pdf", "llm"]),
      sourceLabel: z.string().trim().min(1).max(200),
      sourceUrl: z.string().url().nullable(),
      evidence: z.array(z.string().trim().min(1).max(500)).max(8),
      confidence: z.enum(["high", "medium", "low"]),
      comparison: z.enum(["fill-missing", "same", "conflict", "unverified"]),
      recommended: z.boolean(),
    })
  ).max(300),
});

const PROPOSAL_SNAPSHOT_TTL_MS = 30 * 60_000;

const serializeProposalSnapshot = (snapshot: OrganizerImportProposalSnapshot) => JSON.stringify(snapshot);

const signProposalSnapshot = (snapshot: OrganizerImportProposalSnapshot, secret: string) =>
  createHmac("sha256", secret).update(serializeProposalSnapshot(snapshot)).digest("hex");

const verifyProposalSnapshot = (snapshot: OrganizerImportProposalSnapshot, signature: string, secret: string) => {
  const expected = Buffer.from(signProposalSnapshot(snapshot, secret), "hex");
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
};

const canonicalizeWorkflowValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalizeWorkflowValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeWorkflowValue(child)])
    );
  }
  return value;
};

const serializeWorkflowValue = (value: unknown) => JSON.stringify(canonicalizeWorkflowValue(value));

const signWorkflowSnapshot = (kind: "discovery" | "fields", value: unknown, secret: string) =>
  createHmac("sha256", secret).update(`${kind}:`).update(serializeWorkflowValue(value)).digest("hex");

const verifyWorkflowSnapshot = (
  kind: "discovery" | "fields",
  value: unknown,
  signature: string,
  secret: string
) => {
  const expected = Buffer.from(signWorkflowSnapshot(kind, value, secret), "hex");
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
};

const workflowDiscoverySnapshotSchema = z.object({
  version: z.literal(2),
  eventId: z.string().uuid(),
  editionId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  candidates: z.array(formatCandidateSchema).max(30),
  eventClaims: z.array(sourceClaimSchema).max(100).default([]),
});

const workflowPublicClaimSchema = z.object({
  id: z.string().trim().min(1).max(500),
  value: proposalValueSchema,
  source: z.object({
    kind: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(300),
    url: z.string().url().nullable(),
    fileName: z.string().nullable(),
    page: z.number().int().positive().nullable(),
    editionYear: z.string().nullable(),
  }),
  evidence: z.array(z.string().trim().min(1).max(2_000)).max(8),
  confidence: z.enum(["high", "medium", "low"]),
});

const workflowPublicResolutionSchema = z.object({
  field: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1_000),
  currentValue: proposalValueSchema,
  claims: z.array(workflowPublicClaimSchema).max(100),
  recommendedClaimId: z.string().nullable(),
  status: z.enum(["safe", "review", "conflict", "missing"]),
});

const workflowFieldReportSchema = z.object({
  scope: z.enum(["event", "format"]),
  raceId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(300),
  resolutions: z.array(workflowPublicResolutionSchema).max(100),
});

const workflowFieldSnapshotSchema = z.object({
  version: z.literal(2),
  eventId: z.string().uuid(),
  editionId: z.string().uuid(),
  sessionId: z.string().uuid(),
  expiresAt: z.string().datetime(),
  eventReport: workflowFieldReportSchema,
  formatReports: z.array(workflowFieldReportSchema).max(30),
});

const workflowConfirmedSessionFormatSchema = z.object({
  formatKey: z.string().trim().min(1).max(300),
  candidateKeys: z.array(z.string().trim().min(1).max(300)).max(30),
  raceId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  mode: z.enum(["create", "bind-existing"]),
  dataStatus: z.enum(["draft", "complete"]),
  missingRequiredFields: z.array(z.enum(["race_date", "distance_km", "elevation_gain_m"])),
});

const confirmFormatsRpcResponseSchema = z.object({
  sessionId: z.string().uuid(),
  formats: z.array(z.object({
    formatKey: z.string(),
    raceId: z.string().uuid(),
    name: z.string(),
    mode: z.enum(["create", "bind-existing"]),
    dataStatus: z.enum(["draft", "complete"]),
    missingRequiredFields: z.array(z.enum(["race_date", "distance_km", "elevation_gain_m"])),
  })),
  createdCount: z.number().int().nonnegative(),
  boundExistingCount: z.number().int().nonnegative(),
});

const applyFieldsRpcResponseSchema = z.object({
  sessionId: z.string().uuid(),
  formatsUpdated: z.number().int().nonnegative(),
  draftsRemaining: z.number().int().nonnegative(),
  formatsCompleted: z.number().int().nonnegative(),
});

const emptyWebsitePreview = (): OrganizerWebsiteImportPreview => ({
  source: { provider: "generic", url: "", label: "Documents fournis" },
  event: {
    name: null,
    location: null,
    raceDate: null,
    officialWebsiteUrl: null,
    thumbnailUrl: null,
    logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
  },
  races: [],
  missingFields: [],
  warnings: [],
  canApply: false,
});

const loadTemporaryOrganizerImportDocuments = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  userId: string,
  references: Array<z.infer<typeof temporaryDocumentReferenceSchema>>
) =>
  Promise.all(
    references.map(async (reference, index) => {
      if (!reference.path.startsWith(`${userId}/`)) {
        throw new OrganizerWebsiteImportError("AUTH_FAILED", "Document temporaire non autorisé.");
      }
      const response = await fetch(
        `${serviceConfig.supabaseUrl}/storage/v1/object/organizer-imports/${reference.path}`,
        { headers: serviceHeaders(serviceConfig, ""), cache: "no-store" }
      );
      if (!response.ok) throw new OrganizerWebsiteImportError("INVALID_DATA", "Impossible de récupérer un document temporaire.");
      const data = await response.arrayBuffer();
      const document = {
        name: reference.fileName,
        type: reference.mediaType,
        size: data.byteLength,
        arrayBuffer: async () => data,
      };
      const validationError = validateOrganizerDocument(document);
      if (validationError) throw new OrganizerWebsiteImportError("INVALID_DATA", validationError);
      return { document, sourceId: `document:${index}:${reference.fileName}` };
    })
  );

const deleteTemporaryOrganizerImportDocuments = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  userId: string,
  references: Array<z.infer<typeof temporaryDocumentReferenceSchema>>
) => {
  await Promise.all(
    references
      .filter((reference) => reference.path.startsWith(`${userId}/`))
      .map((reference) =>
        fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/organizer-imports/${reference.path}`, {
          method: "DELETE",
          headers: serviceHeaders(serviceConfig, ""),
          cache: "no-store",
        }).catch(() => null)
      )
  );
};

const eventContextSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location: z.string().nullable().optional(),
  race_date: z.string().nullable().optional(),
  organizer_details: z.unknown().nullable().optional(),
  race_event_editions: z.array(z.object({
    id: z.string().uuid(),
    edition_year: z.number().int(),
    start_date: z.string(),
    end_date: z.string(),
    is_current: z.boolean(),
  })).nullable().optional(),
  races: z
    .array(
      z.object({
        id: z.string().uuid(),
        edition_id: z.string().uuid().nullable().optional(),
        edition_group_id: z.string().uuid(),
        series_name: z.string(),
        name: z.string(),
        race_date: z.string().nullable().optional(),
        distance_km: z.number(),
        elevation_gain_m: z.number(),
        elevation_loss_m: z.number().nullable().optional(),
        external_site_url: z.string().nullable().optional(),
        location_text: z.string().nullable().optional(),
        thumbnail_url: z.string().nullable().optional(),
        gpx_storage_path: z.string().nullable().optional(),
        organizer_details: z.unknown().nullable().optional(),
        is_live: z.boolean(),
        data_status: z.enum(["draft", "complete"]).optional().default("complete"),
        missing_required_fields: z.array(z.string()).optional().default([]),
      })
    )
    .nullable()
    .optional(),
});

const aidStationCountSchema = z.object({ count: z.number().int().nonnegative() });

type EventContext = z.infer<typeof eventContextSchema>;
type EventRace = NonNullable<EventContext["races"]>[number];

const getEventRacesForEdition = (event: EventContext, raceDate: string | null | undefined) => {
  const editionYear = raceDate?.slice(0, 4) ?? null;
  const edition = (event.race_event_editions ?? []).find(
    (candidate) => String(candidate.edition_year) === editionYear
  ) ?? (event.race_event_editions ?? []).find((candidate) => candidate.is_current) ?? null;
  return (event.races ?? []).filter((race) =>
    edition
      ? race.edition_id === edition.id || (!race.edition_id && race.race_date?.slice(0, 4) === String(edition.edition_year))
      : !editionYear || race.race_date?.slice(0, 4) === editionYear
  );
};

const buildDocumentOnlyPreview = (event: EventContext): OrganizerWebsiteImportPreview => ({
  source: { provider: "generic", url: "", label: "Documents fournis" },
  event: {
    name: event.name,
    location: event.location ?? null,
    raceDate: event.race_date ?? null,
    officialWebsiteUrl: parseOrganizerEventDetails(event.organizer_details).officialWebsiteUrl,
    thumbnailUrl: null,
    logistics: { mandatoryEquipment: [], shuttles: null, startAddress: null, officialParkings: null },
  },
  races: getEventRacesForEdition(event, event.race_date).map((race) => {
    const values = [
      ["name", "Nom du format", race.name],
      ["raceDate", "Date", race.race_date ?? null],
      ["distanceKm", "Distance", `${race.distance_km} km`],
      ["elevationGainM", "Dénivelé positif", `${race.elevation_gain_m} m`],
      ["elevationLossM", "Dénivelé négatif", race.elevation_loss_m === null ? null : `${race.elevation_loss_m} m`],
      ["locationText", "Lieu", race.location_text ?? null],
      ["externalSiteUrl", "Page du format", race.external_site_url ?? null],
    ] as const;
    return {
      key: `existing:${race.id}`,
      name: race.name,
      seriesName: race.series_name,
      raceDate: race.race_date ?? null,
      locationText: race.location_text ?? null,
      distanceKm: race.distance_km,
      elevationGainM: race.elevation_gain_m,
      elevationLossM: race.elevation_loss_m ?? null,
      externalSiteUrl: race.external_site_url ?? null,
      thumbnailUrl: race.thumbnail_url ?? null,
      aidStations: [],
      gpxContent: null,
      gpxStorageLabel: null,
      missingFields: [],
      hasReliableGpx: Boolean(race.gpx_storage_path),
      assessment: {
        score: 100,
        coverageScore: 100,
        reliabilityScore: 100,
        foundCount: values.filter(([, , value]) => value !== null).length,
        totalCount: values.length,
        reliableCount: 0,
        findings: values.map(([key, label, value]) => ({
          key,
          label,
          value,
          required: ["name", "raceDate", "distanceKm", "elevationGainM"].includes(key),
          confidence: value === null ? null : "high" as const,
          sourceUrl: null,
          sourceLabel: value === null ? null : "Données actuelles",
        })),
      },
    };
  }),
  missingFields: [],
  warnings: [],
  canApply: true,
});

const proposalLabels: Record<string, string> = {
  name: "Nom",
  seriesName: "Nom de série",
  raceDate: "Date",
  location: "Lieu de l'événement",
  locationText: "Lieu du format",
  distanceKm: "Distance",
  elevationGainM: "Dénivelé positif",
  elevationLossM: "Dénivelé négatif",
  officialWebsiteUrl: "Site officiel",
  externalSiteUrl: "Page du format",
  thumbnailUrl: "Image",
  gpx: "Trace GPX",
  aidStations: "Ravitaillements",
  startTime: "Heure de départ",
  finishCutoffTime: "Heure limite d'arrivée",
  bibPickup: "Retrait des dossards",
  mandatoryEquipment: "Matériel obligatoire",
  startAddress: "Adresse de départ",
  shuttles: "Navettes",
  officialParkings: "Parkings officiels",
};

const normalizeProposalValue = (value: OrganizerImportProposalValue) =>
  typeof value === "string" ? value.trim().toLocaleLowerCase("fr-FR") : JSON.stringify(value);

const compareProposalValues = (
  value: OrganizerImportProposalValue,
  currentValue: OrganizerImportProposalValue
): OrganizerImportFieldProposal["comparison"] => {
  const currentMissing =
    currentValue === null ||
    currentValue === "" ||
    (Array.isArray(currentValue) && currentValue.length === 0);
  if (currentMissing) return "fill-missing";
  return normalizeProposalValue(value) === normalizeProposalValue(currentValue) ? "same" : "conflict";
};

const buildProposal = (input: Omit<OrganizerImportFieldProposal, "label" | "comparison" | "recommended">) => {
  const comparison = compareProposalValues(input.value, input.currentValue);
  return {
    ...input,
    label: proposalLabels[input.field] ?? input.field,
    comparison,
    recommended: comparison === "fill-missing" || comparison === "same",
  } satisfies OrganizerImportFieldProposal;
};

const findingSourceKind = (race: OrganizerWebsiteImportRace, field: OrganizerImportRaceField) =>
  race.hasReliableGpx && ["distanceKm", "elevationGainM", "elevationLossM", "gpx", "aidStations"].includes(field)
    ? "gpx" as const
    : race.assessment?.findings.find((finding) => finding.key === field)?.sourceLabel === "Données structurées"
      ? "structured-data" as const
      : "html" as const;

const buildOrganizerImportProposals = (
  preview: OrganizerWebsiteImportPreview,
  event: EventContext,
  documents: Array<{
    sourceId: string;
    fileName: string;
    findings: Array<{
      field: string;
      value: string;
      formatHint: string | null;
      confidence: "medium" | "low";
      evidence: string;
    }>;
  }>,
  reconciliation: OrganizerImportReconciliation | null
) => {
  const proposals: OrganizerImportFieldProposal[] = [];
  const eventDetails = parseOrganizerEventDetails(event.organizer_details);
  const scopedEventRaces = getEventRacesForEdition(event, preview.event.raceDate ?? event.race_date);
  const logistics = preview.event.logistics ?? {
    mandatoryEquipment: [],
    shuttles: null,
    startAddress: null,
    officialParkings: null,
  };
  const addEvent = (
    field: (typeof organizerImportEventFields)[number],
    value: OrganizerImportProposalValue,
    currentValue: OrganizerImportProposalValue,
    sourceUrl: string | null
  ) => {
    if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) return;
    proposals.push(buildProposal({
      id: `event:${field}:website`,
      scope: "event",
      previewRaceKey: null,
      field,
      value,
      currentValue,
      sourceKind: "html",
      sourceLabel: preview.source.label,
      sourceUrl,
      evidence: [],
      confidence: preview.source.provider === "generic" ? "medium" : "high",
    }));
  };

  if (preview.source.url) {
    addEvent("name", preview.event.name, event.name, preview.source.url || null);
    addEvent("location", preview.event.location, event.location ?? null, preview.source.url || null);
    addEvent("officialWebsiteUrl", preview.event.officialWebsiteUrl, eventDetails.officialWebsiteUrl, preview.source.url || null);
    addEvent(
      "mandatoryEquipment",
      logistics.mandatoryEquipment,
      eventDetails.mandatoryEquipment.items.map((item) => item.label),
      preview.source.url || null
    );
    addEvent("startAddress", logistics.startAddress, eventDetails.access.startAddress, preview.source.url || null);
    addEvent("shuttles", logistics.shuttles, eventDetails.access.shuttles, preview.source.url || null);
    addEvent("officialParkings", logistics.officialParkings, eventDetails.access.officialParkings, preview.source.url || null);

    for (const race of preview.races) {
    const reconciliationMatch = reconciliation?.raceMatches.find((match) => match.previewRaceKey === race.key) ?? null;
    const deterministicTarget = findMatchingSeriesRace(race, scopedEventRaces);
    const target = reconciliationMatch?.decision === "match" && reconciliationMatch.targetRaceId
      ? (event.races ?? []).find((candidate) => candidate.id === reconciliationMatch.targetRaceId) ?? deterministicTarget
      : deterministicTarget;
    const raceDetails = parseOrganizerRaceDetails(target?.organizer_details);
    const values: Array<[OrganizerImportRaceField, OrganizerImportProposalValue, OrganizerImportProposalValue]> = [
      ["name", race.name, target?.name ?? null],
      ["seriesName", race.seriesName, target?.series_name ?? null],
      ["raceDate", race.raceDate, target?.race_date ?? null],
      ["locationText", race.locationText, target?.location_text ?? null],
      ["distanceKm", race.distanceKm, target?.distance_km ?? null],
      ["elevationGainM", race.elevationGainM, target?.elevation_gain_m ?? null],
      ["elevationLossM", race.elevationLossM, target?.elevation_loss_m ?? null],
      ["externalSiteUrl", race.externalSiteUrl, target?.external_site_url ?? null],
      ["thumbnailUrl", race.thumbnailUrl, target?.thumbnail_url ?? null],
      ["gpx", race.gpxContent ? "GPX disponible" : null, target?.gpx_storage_path ? "GPX existant" : null],
      [
        "aidStations",
        race.aidStations.map((station) => ({
          name: station.name,
          distanceKm: station.distanceKm,
          waterRefill: station.waterRefill,
          solidRefill: null,
          assistanceAllowed: null,
        })),
        [],
      ],
      ["startTime", null, raceDetails.schedule.startTime],
      ["finishCutoffTime", null, raceDetails.schedule.finishCutoffTime],
      ["bibPickup", null, raceDetails.bibPickup.schedule],
      ["mandatoryEquipment", [], raceDetails.mandatoryEquipment.items.map((item) => item.label)],
    ];

    for (const [field, value, currentValue] of values) {
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
      const assessmentFinding = race.assessment?.findings.find((finding) => finding.key === field);
      const llmChange = reconciliationMatch?.fieldChanges.find((change) => change.field === field) ?? null;
      const proposal = buildProposal({
        id: `format:${race.key}:${field}:website`,
        scope: "format",
        previewRaceKey: race.key,
        field,
        value,
        currentValue,
        sourceKind: findingSourceKind(race, field),
        sourceLabel: assessmentFinding?.sourceLabel ?? preview.source.label,
        sourceUrl: assessmentFinding?.sourceUrl ?? race.externalSiteUrl,
        evidence: llmChange?.evidence ?? [],
        confidence: assessmentFinding?.confidence ?? (race.hasReliableGpx ? "high" : "medium"),
      });
      proposals.push({
        ...proposal,
        recommended: proposal.recommended && (!llmChange || llmChange.action !== "unknown"),
      });
    }
  }
  }

  const normalizeName = (value: string) => normalizeComparableName(value).replace(/\b\d+(?:[.,]\d+)?\s*km\b/g, "").trim();
  const parseNumber = (value: string) => {
    const match = value.match(/\b(\d{1,5}(?:[.,]\d+)?)\b/);
    return match ? Number(match[1].replace(",", ".")) : null;
  };
  const parseTime = (value: string) => {
    const match = value.match(/\b(\d{1,2})\s*[h:]\s*(\d{0,2})\b/i);
    if (!match) return null;
    return `${match[1].padStart(2, "0")}:${(match[2] || "00").padStart(2, "0")}`;
  };

  for (const document of documents) {
    for (const [findingIndex, finding] of document.findings.entries()) {
      const race = finding.formatHint
        ? preview.races.find((candidate) => {
            const candidateNames = [candidate.name, candidate.seriesName].map(normalizeName);
            return candidateNames.includes(normalizeName(finding.formatHint!));
          }) ?? null
        : null;
      const target = race ? findMatchingSeriesRace(race, scopedEventRaces) : null;
      const raceDetails = parseOrganizerRaceDetails(target?.organizer_details);
      let field: OrganizerImportRaceField | null = null;
      let value: OrganizerImportProposalValue = null;
      let currentValue: OrganizerImportProposalValue = null;
      if (finding.field === "distanceKm" || finding.field === "elevationGainM" || finding.field === "elevationLossM") {
        field = finding.field;
        value = parseNumber(finding.value);
        currentValue = field === "distanceKm"
          ? target?.distance_km ?? null
          : field === "elevationGainM"
            ? target?.elevation_gain_m ?? null
            : target?.elevation_loss_m ?? null;
      } else if (finding.field === "startTime") {
        field = "startTime";
        value = parseTime(finding.value);
        currentValue = raceDetails.schedule.startTime;
      } else if (finding.field === "cutoff") {
        field = "finishCutoffTime";
        value = parseTime(finding.value);
        currentValue = raceDetails.schedule.finishCutoffTime;
      } else if (finding.field === "bibPickup") {
        field = "bibPickup";
        value = finding.value;
        currentValue = raceDetails.bibPickup.schedule;
      } else if (finding.field === "mandatoryEquipment") {
        field = "mandatoryEquipment";
        value = [finding.value];
        currentValue = race
          ? raceDetails.mandatoryEquipment.items.map((item) => item.label)
          : eventDetails.mandatoryEquipment.items.map((item) => item.label);
      }
      if (!field || value === null) continue;
      const scope = race ? "format" as const : "event" as const;
      proposals.push(buildProposal({
        id: `${scope}:${race?.key ?? "event"}:${field}:pdf:${document.sourceId}:${findingIndex}`,
        scope,
        previewRaceKey: race?.key ?? null,
        field,
        value,
        currentValue,
        sourceKind: "pdf",
        sourceLabel: document.fileName,
        sourceUrl: null,
        evidence: [finding.evidence],
        confidence: finding.confidence,
      }));
    }
  }

  return proposals;
};

const buildRestError = (message: string) =>
  withSecurityHeaders(
    NextResponse.json(
      { message },
      {
        status: 429,
      }
    )
  );

const normalizeComparableName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const datesShareYear = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left?.slice(0, 4) && right?.slice(0, 4) && left.slice(0, 4) === right.slice(0, 4));

const getEditionYear = (value: string | null | undefined) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 4) : null;

const alignRaceDateToEditionRange = (
  raceDate: string | null,
  editionStartDate: string | null | undefined,
  editionEndDate?: string | null
) => {
  const startYear = getEditionYear(editionStartDate);
  if (!startYear) return raceDate;
  if (!raceDate) return editionStartDate ?? null;

  const endDate = editionEndDate && editionEndDate >= editionStartDate! ? editionEndDate : editionStartDate!;
  const candidateYears = Array.from(new Set([startYear, getEditionYear(endDate)].filter((year): year is string => Boolean(year))));
  const alignedDate = candidateYears
    .map((year) => `${year}${raceDate.slice(4)}`)
    .find((candidate) => {
      const parsed = new Date(`${candidate}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate && candidate >= editionStartDate! && candidate <= endDate;
    });
  return alignedDate ?? editionStartDate ?? raceDate;
};

const alignRaceToEventDate = (
  race: OrganizerWebsiteImportRace,
  eventRaceDate: string | null | undefined,
  eventEditionEndDate?: string | null
): OrganizerWebsiteImportRace => {
  const raceDate = alignRaceDateToEditionRange(race.raceDate, eventRaceDate, eventEditionEndDate);
  return {
    ...race,
    raceDate,
    missingFields: raceDate ? race.missingFields.filter((field) => field !== "Date format") : race.missingFields,
  };
};

const buildPreviewWarnings = (preview: OrganizerWebsiteImportPreview, event: EventContext) => {
  const warnings = [...preview.warnings];
  if (preview.event.name && normalizeComparableName(preview.event.name) !== normalizeComparableName(event.name)) {
    warnings.push("Le nom detecte ne correspond pas exactement a l'evenement claimé. Verifie avant validation.");
  }
  if (preview.event.raceDate && event.race_date && !datesShareYear(preview.event.raceDate, event.race_date)) {
    warnings.push("La date detectee semble pointer vers une autre edition que celle actuellement selectionnee.");
  }
  return warnings;
};

const buildRaceWarnings = (previewRace: OrganizerWebsiteImportRace, eventRace: EventRace | null) => {
  const warnings = [...(previewRace.missingFields.length > 0 ? ["Format partiellement incomplet."] : [])];
  if (!eventRace) return warnings;
  const nameMismatch =
    normalizeComparableName(previewRace.seriesName || previewRace.name) !== normalizeComparableName(eventRace.series_name || eventRace.name);
  if (nameMismatch) warnings.push("Le format cible suggere un libelle different.");
  if (previewRace.raceDate && eventRace.race_date && !datesShareYear(previewRace.raceDate, eventRace.race_date)) {
    warnings.push("La date detectee ne correspond pas a l'edition actuelle de ce format.");
  }
  return warnings;
};

const findMatchingSeriesRace = (previewRace: OrganizerWebsiteImportRace, races: EventRace[]) => {
  const targetName = normalizeComparableName(previewRace.seriesName || previewRace.name);
  const exactName = races.find(
    (race) =>
      normalizeComparableName(race.series_name || race.name) === targetName ||
      normalizeComparableName(race.name) === normalizeComparableName(previewRace.name)
  );
  if (exactName) return exactName;

  if (previewRace.distanceKm !== null) {
    const byDistance = races.find(
      (race) =>
        Math.abs(race.distance_km - previewRace.distanceKm!) <= 1 &&
        (!previewRace.raceDate || !race.race_date || datesShareYear(previewRace.raceDate, race.race_date))
    );
    if (byDistance) return byDistance;
  }

  return null;
};

const findSuggestedRace = (
  previewRace: OrganizerWebsiteImportRace,
  races: EventRace[],
  targetEditionYear: string | null,
  targetEditionId?: string | null
) =>
  findMatchingSeriesRace(
    previewRace,
    targetEditionId
      ? races.filter((race) => race.edition_id === targetEditionId || (!race.edition_id && getEditionYear(race.race_date) === targetEditionYear))
      : targetEditionYear ? races.filter((race) => getEditionYear(race.race_date) === targetEditionYear) : races
  );

const buildAugmentedPreview = (preview: OrganizerWebsiteImportPreview, event: EventContext) => ({
  ...preview,
  warnings: buildPreviewWarnings(preview, event),
  races: preview.races.map((race) => {
    const targetEventDate = preview.event.raceDate ?? event.race_date ?? null;
    const targetEditionYear = getEditionYear(targetEventDate);
    const targetEdition = (event.race_event_editions ?? []).find((edition) => String(edition.edition_year) === targetEditionYear) ?? null;
    const alignedRace = alignRaceToEventDate(race, targetEventDate, targetEdition?.end_date);
    const suggested = findSuggestedRace(alignedRace, event.races ?? [], targetEditionYear, targetEdition?.id);
    return {
      key: race.key,
      name: race.name,
      seriesName: race.seriesName,
      raceDate: alignedRace.raceDate,
      locationText: race.locationText,
      distanceKm: race.distanceKm,
      elevationGainM: race.elevationGainM,
      elevationLossM: race.elevationLossM,
      externalSiteUrl: race.externalSiteUrl,
      thumbnailUrl: race.thumbnailUrl,
      missingFields: alignedRace.missingFields,
      warnings: buildRaceWarnings(race, suggested),
      suggestedTargetRaceId: suggested?.id ?? null,
      canCreate:
        !race.key.startsWith("existing:") &&
        alignedRace.missingFields.length === 0 &&
        (!race.assessment || race.assessment.score >= MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE),
      hasReliableGpx: race.hasReliableGpx,
      detectedAidStationCount: race.aidStations.length,
      assessment: race.assessment ?? null,
    };
  }),
});

type ExtractedWorkflowDocument = Awaited<ReturnType<typeof extractOrganizerDocument>>;

const parseDocumentMetric = (value: string) => {
  const match = value.match(/\b(\d{1,5}(?:[.,]\d+)?)\b/);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const attachWorkflowDocumentFindings = (
  documents: ExtractedWorkflowDocument[],
  preview: OrganizerWebsiteImportPreview
) => {
  const formatNames = preview.races.flatMap((race) => [race.name, race.seriesName]).filter(Boolean);
  return documents.map((document) => ({
    ...document,
    findings: attachDocumentFindingsToFormats(document.findings, formatNames).map((finding) => {
      if (finding.scope !== "format-unknown" || finding.field !== "distanceKm") return finding;
      const distanceKm = parseDocumentMetric(finding.value);
      if (distanceKm === null) return finding;
      const matchingRaces = preview.races.filter(
        (race) => race.distanceKm !== null && Math.abs(race.distanceKm - distanceKm) <= Math.max(0.5, distanceKm * 0.02)
      );
      return matchingRaces.length === 1
        ? { ...finding, scope: "format" as const, formatHint: matchingRaces[0].name }
        : finding;
    }),
  }));
};

const buildDocumentFormatCandidates = (documents: ExtractedWorkflowDocument[]) => {
  const candidates = documents.flatMap((document, documentIndex) =>
    document.findings.flatMap((finding) => {
      if (finding.scope !== "format-unknown" || finding.field !== "distanceKm") return [];
      const distanceKm = parseDocumentMetric(finding.value);
      if (distanceKm === null || distanceKm <= 0) return [];
      const candidateKey = `document:${documentIndex}:${finding.page ?? 0}:${distanceKm}`;
      const source = {
        sourceId: document.sourceId,
        kind: "official-document" as const,
        label: document.fileName,
        url: null,
        page: finding.page,
        edition: null,
      };
      const distanceClaim = createSourceClaim({
        scope: { kind: "format", scopeKey: candidateKey },
        field: "distanceKm",
        value: distanceKm,
        source,
        evidence: finding.evidence,
        confidence: finding.confidence,
        claimRole: "candidate",
      });
      return [formatCandidateSchema.parse({
        candidateKey,
        detectionKeys: [candidateKey],
        names: [`${distanceKm} km`],
        proposedName: `${distanceKm} km`,
        edition: { date: null, year: null },
        existenceConfidence: finding.confidence,
        evidence: [{ ...source, evidence: finding.evidence }],
        claims: [distanceClaim],
        completeness: {
          knownRequiredFields: ["distanceKm"],
          missingRequiredFields: ["name", "raceDate", "elevationGainM"],
        },
        suggestedExistingRaceId: null,
      })];
    })
  );
  return [...new Map(candidates.map((candidate) => [candidate.candidateKey, candidate])).values()];
};

const sourceRoleLabels: Record<OrganizerSourceAnalysis["role"], string> = {
  event_overview: "page générale de l’événement",
  single_format: "page d’un format",
  multi_format: "page de plusieurs formats",
  regulation: "règlement",
  schedule: "programme ou horaires",
  logistics: "informations pratiques",
  registration: "inscriptions",
  results_archive: "résultats ou archives",
  other: "autre source officielle",
  unusable: "source inexploitable",
};

const normalizeSourceDate = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
  const numericMatch = trimmed.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  const monthNames: Record<string, string> = {
    janvier: "01", fevrier: "02", mars: "03", avril: "04", mai: "05", juin: "06",
    juillet: "07", aout: "08", septembre: "09", octobre: "10", novembre: "11", decembre: "12",
  };
  const normalized = trimmed.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const namedMatch = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  const candidate = isoMatch
    ? trimmed
    : numericMatch
      ? `${numericMatch[3]}-${numericMatch[2].padStart(2, "0")}-${numericMatch[1].padStart(2, "0")}`
      : namedMatch && monthNames[namedMatch[2]]
        ? `${namedMatch[3]}-${monthNames[namedMatch[2]]}-${namedMatch[1].padStart(2, "0")}`
        : null;
  if (!candidate) return null;
  const date = new Date(`${candidate}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : null;
};

const normalizeSourceTime = (value: string) => {
  const match = value.trim().match(/^(\d{1,2})(?:\s*h\s*|:)(\d{0,2})$/i);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] || "0");
  return hours < 24 && minutes < 60
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    : null;
};

const sourceRoleAllowsAssertion = (analysis: OrganizerSourceAnalysis, assertion: OrganizerSourceAssertion) => {
  if (["registration", "results_archive", "other", "unusable"].includes(analysis.role)) return false;
  if (analysis.role === "schedule") {
    return assertion.scope === "format" && ["name", "raceDate", "startTime", "finishCutoffTime"].includes(assertion.field);
  }
  if (analysis.role === "logistics") {
    return ["locationText", "mandatoryEquipment"].includes(assertion.field);
  }
  return true;
};

const normalizeSourceAssertion = (
  assertion: OrganizerSourceAssertion,
  scope: "event" | "format"
): { field: OrganizerImportClaimField; value: OrganizerImportClaimValue } | null => {
  if (scope === "event") {
    if (assertion.field === "name" && typeof assertion.value === "string") {
      return { field: "name", value: assertion.value };
    }
    if (assertion.field === "locationText" && typeof assertion.value === "string") {
      return { field: "location", value: assertion.value };
    }
    if (assertion.field === "mandatoryEquipment" && Array.isArray(assertion.value)) {
      return { field: "mandatoryEquipment", value: assertion.value };
    }
    return null;
  }

  if (["distanceKm", "elevationGainM", "elevationLossM"].includes(assertion.field)) {
    if (typeof assertion.value !== "number" || assertion.value < 0) return null;
    if (assertion.field === "distanceKm" && assertion.value === 0) return null;
    return { field: assertion.field, value: assertion.value };
  }
  if (assertion.field === "mandatoryEquipment") {
    return Array.isArray(assertion.value) ? { field: assertion.field, value: assertion.value } : null;
  }
  if (assertion.field === "raceDate") {
    return typeof assertion.value === "string" && normalizeSourceDate(assertion.value)
      ? { field: assertion.field, value: normalizeSourceDate(assertion.value)! }
      : null;
  }
  if (assertion.field === "startTime" || assertion.field === "finishCutoffTime") {
    return typeof assertion.value === "string" && normalizeSourceTime(assertion.value)
      ? { field: assertion.field, value: normalizeSourceTime(assertion.value)! }
      : null;
  }
  return typeof assertion.value === "string"
    ? { field: assertion.field, value: assertion.value }
    : null;
};

const buildIntelligenceEvidenceSource = (
  analysis: OrganizerSourceAnalysis,
  evidence: string,
  documents: ExtractedWorkflowDocument[]
): SourceClaim["source"] => {
  const documentPrefix = "urn:organizer-document:";
  if (analysis.url.startsWith(documentPrefix)) {
    let sourceId = analysis.url.slice(documentPrefix.length);
    try { sourceId = decodeURIComponent(sourceId); } catch { /* Keep the bounded urn suffix. */ }
    const document = documents.find((candidate) => candidate.sourceId === sourceId) ?? null;
    const normalizedEvidence = evidence.replace(/\s+/g, " ").trim();
    const page = document?.pages.find((candidate) =>
      candidate.text.replace(/\s+/g, " ").includes(normalizedEvidence)
    )?.page ?? null;
    return {
      sourceId,
      kind: "official-document",
      label: document?.fileName || analysis.title || "Document officiel",
      url: null,
      page,
      edition: null,
    };
  }
  return {
    sourceId: analysis.url,
    kind: "official-page",
    label: `Source officielle · ${sourceRoleLabels[analysis.role]}`,
    url: analysis.url,
    page: null,
    edition: null,
  };
};

const buildSourceIntelligenceCandidates = (
  analyses: OrganizerSourceAnalysis[],
  existingRaces: EventRace[],
  documents: ExtractedWorkflowDocument[]
) => {
  const eventClaims: SourceClaim[] = [];
  const formatGroups = new Map<string, Array<{ analysis: OrganizerSourceAnalysis; assertion: OrganizerSourceAssertion }>>();
  const formatEnrichmentGroups = new Map<string, Array<{ analysis: OrganizerSourceAnalysis; assertion: OrganizerSourceAssertion }>>();
  const candidateRoles = new Set<OrganizerSourceAnalysis["role"]>([
    "event_overview", "single_format", "multi_format", "regulation",
  ]);

  for (const analysis of analyses) {
    for (const assertion of analysis.assertions) {
      if (!sourceRoleAllowsAssertion(analysis, assertion)) continue;
      if (assertion.scope === "event") {
        const normalized = normalizeSourceAssertion(assertion, "event");
        if (!normalized) continue;
        eventClaims.push(createSourceClaim({
          scope: { kind: "event", scopeKey: "event" },
          ...normalized,
          source: buildIntelligenceEvidenceSource(analysis, assertion.evidence, documents),
          evidence: assertion.evidence,
          confidence: analysis.confidence,
          claimRole: "candidate",
        }));
        continue;
      }
      if (!assertion.formatName) continue;
      const key = normalizeComparableName(assertion.formatName);
      if (!key) continue;
      const groups = candidateRoles.has(analysis.role) ? formatGroups : formatEnrichmentGroups;
      const group = groups.get(key) ?? [];
      group.push({ analysis, assertion });
      groups.set(key, group);
    }
  }

  const builtCandidates = [
    ...[...formatGroups.entries()].map(([normalizedName, entries]) => ({ normalizedName, entries, canEstablishFormat: true })),
    ...[...formatEnrichmentGroups.entries()].map(([normalizedName, entries]) => ({ normalizedName, entries, canEstablishFormat: false })),
  ].flatMap(({ normalizedName, entries, canEstablishFormat }, groupIndex) => {
    const names = Array.from(new Set(entries.map(({ assertion }) => assertion.formatName!).filter(Boolean)));
    const proposedName = names[0];
    if (!proposedName) return [];
    const candidateKey = `source:${groupIndex}:${normalizedName.slice(0, 220)}`;
    const claims = entries.flatMap(({ analysis, assertion }) => {
      const normalized = normalizeSourceAssertion(assertion, "format");
      if (!normalized) return [];
      return [createSourceClaim({
        scope: { kind: "format", scopeKey: candidateKey },
        ...normalized,
        source: buildIntelligenceEvidenceSource(analysis, assertion.evidence, documents),
        evidence: assertion.evidence,
        confidence: analysis.confidence,
        claimRole: "candidate",
      })];
    });
    if (!claims.some((claim) => claim.field === "name")) {
      const first = entries[0];
      claims.unshift(createSourceClaim({
        scope: { kind: "format", scopeKey: candidateKey },
        field: "name",
        value: proposedName,
        source: buildIntelligenceEvidenceSource(first.analysis, first.assertion.evidence, documents),
        evidence: first.assertion.evidence,
        confidence: first.analysis.confidence,
        claimRole: "candidate",
      }));
    }
    const evidence = entries.map(({ analysis, assertion }) => ({
      ...buildIntelligenceEvidenceSource(analysis, assertion.evidence, documents),
      evidence: assertion.evidence,
    })).slice(0, 30);
    const knownRequiredFields = (["name", "raceDate", "distanceKm", "elevationGainM"] as OrganizerImportClaimField[])
      .filter((field) => claims.some((claim) => claim.field === field));
    const missingRequiredFields = (["name", "raceDate", "distanceKm", "elevationGainM"] as OrganizerImportClaimField[])
      .filter((field) => !knownRequiredFields.includes(field));
    const raceDate = claims.find((claim) => claim.field === "raceDate" && typeof claim.value === "string")?.value;
    const exactExisting = existingRaces.filter((race) =>
      [race.name, race.series_name].some((name) => normalizeComparableName(name) === normalizedName)
    );
    return [{
      canEstablishFormat,
      candidate: formatCandidateSchema.parse({
        candidateKey,
        detectionKeys: [candidateKey],
        names,
        proposedName,
        edition: {
          date: typeof raceDate === "string" ? raceDate : null,
          year: typeof raceDate === "string" ? raceDate.slice(0, 4) : null,
        },
        existenceConfidence: entries.some(({ analysis }) => analysis.confidence === "high")
          ? "high"
          : entries.some(({ analysis }) => analysis.confidence === "medium") ? "medium" : "low",
        evidence,
        claims: claims.slice(0, 100),
        completeness: { knownRequiredFields, missingRequiredFields },
        suggestedExistingRaceId: exactExisting.length === 1 ? exactExisting[0].id : null,
      }),
    }];
  });
  return {
    eventClaims: [...new Map(eventClaims.map((claim) => [claim.claimId, claim])).values()],
    candidates: builtCandidates.filter((entry) => entry.canEstablishFormat).map((entry) => entry.candidate),
    enrichmentCandidates: builtCandidates.filter((entry) => !entry.canEstablishFormat).map((entry) => entry.candidate),
  };
};

const mergeSourceIntelligenceCandidates = (
  deterministicCandidates: Array<z.infer<typeof formatCandidateSchema>>,
  intelligentCandidates: Array<z.infer<typeof formatCandidateSchema>>,
  appendMissing = true
) => {
  const merged = [...deterministicCandidates];
  for (const candidate of intelligentCandidates) {
    const targetIndex = merged.findIndex((target) =>
      target.names.some((name) => candidate.names.some((candidateName) =>
        normalizeComparableName(name) === normalizeComparableName(candidateName)
      ))
    );
    if (targetIndex < 0) {
      if (appendMissing) merged.push(candidate);
      continue;
    }
    const target = merged[targetIndex];
    const reScopedClaims = candidate.claims.map((claim) => createSourceClaim({
      ...claim,
      scope: { kind: "format", scopeKey: target.candidateKey },
    }));
    const claims = [...target.claims, ...reScopedClaims]
      .filter((claim, index, all) => all.findIndex((candidateClaim) => candidateClaim.claimId === claim.claimId) === index)
      .slice(0, 100);
    const requiredFields = ["name", "raceDate", "distanceKm", "elevationGainM"] as OrganizerImportClaimField[];
    merged[targetIndex] = formatCandidateSchema.parse({
      ...target,
      detectionKeys: Array.from(new Set([...target.detectionKeys, ...candidate.detectionKeys])).slice(0, 30),
      names: Array.from(new Set([...target.names, ...candidate.names])).slice(0, 30),
      existenceConfidence: target.existenceConfidence === "high" || candidate.existenceConfidence === "high"
        ? "high"
        : target.existenceConfidence === "medium" || candidate.existenceConfidence === "medium" ? "medium" : "low",
      evidence: [...target.evidence, ...candidate.evidence].slice(0, 30),
      claims,
      completeness: {
        knownRequiredFields: requiredFields.filter((field) => claims.some((claim) => claim.field === field)),
        missingRequiredFields: requiredFields.filter((field) => !claims.some((claim) => claim.field === field)),
      },
      suggestedExistingRaceId: target.suggestedExistingRaceId ?? candidate.suggestedExistingRaceId,
    });
  }
  return merged;
};

const buildSourceAnalysisWarnings = (result: OrganizerSourceIntelligenceResult) => [
  ...result.warnings,
  ...(result.usedLlm ? ["Lecture assistée par IA utilisée pour les sources ambiguës ou incomplètes."] : []),
];

const buildSourceAudit = (result: OrganizerSourceIntelligenceResult) => result.sources.map((source) => ({
  sourceUrl: source.url.startsWith("urn:organizer-document:") ? null : source.url,
  title: source.title || null,
  role: source.role,
  roleLabel: sourceRoleLabels[source.role],
  confidence: source.confidence,
  evidence: source.evidence,
  assertionCount: source.assertions.length,
}));

const loadWorkflowSources = async (
  auth: OrganizerAuth,
  event: EventContext,
  editionId: string,
  manifest: z.infer<typeof organizerImportSourceManifestSchema>,
  options: { analyzeOfficialSources?: boolean } = {}
) => {
  const temporaryDocuments = await loadTemporaryOrganizerImportDocuments(
    auth.serviceConfig,
    auth.user.id,
    manifest.documents
  );
  const extractedDocuments = await Promise.all(
    temporaryDocuments.map(async ({ document, sourceId }) => extractOrganizerDocument(document, sourceId))
  );
  const edition = (event.race_event_editions ?? []).find((candidate) => candidate.id === editionId) ?? null;
  if (!edition) throw new OrganizerWebsiteImportError("INVALID_DATA", "L'édition sélectionnée est inconnue.");

  let preview = emptyWebsitePreview();
  let websiteWarning: string | null = null;
  const primaryUrl = manifest.url || manifest.additionalUrls[0] || "";
  const additionalUrls = manifest.url ? manifest.additionalUrls : manifest.additionalUrls.slice(1);
  let sourceDocuments: Awaited<ReturnType<typeof buildOrganizerWebsiteImportAnalysis>>["sourceDocuments"] = [];
  if (primaryUrl) {
    try {
      const analysis = await buildOrganizerWebsiteImportAnalysis(primaryUrl, { additionalUrls });
      preview = analysis.preview;
      sourceDocuments = analysis.sourceDocuments;
    } catch (error) {
      if (temporaryDocuments.length === 0) throw error;
      console.error("Unable to analyze organizer website; using documents only", error);
      websiteWarning = "Le site n'a pas pu être analysé; les documents restent exploitables.";
    }
  }
  if (!primaryUrl || !preview.source.url) {
    preview = buildDocumentOnlyPreview({ ...event, race_date: edition.start_date });
  }
  const sourceIntelligence: OrganizerSourceIntelligenceResult =
    options.analyzeOfficialSources && (sourceDocuments.length > 0 || extractedDocuments.some((document) => document.text))
      ? await analyzeOrganizerOfficialSources({
          sources: [
            ...sourceDocuments
              .filter((source) => source.discovery !== "discovered")
              .map((source) => ({
                url: source.url,
                title: source.title ?? "",
                text: source.text,
                isPrimary: source.isPrimary,
              })),
            ...extractedDocuments.flatMap((document) => document.text ? [{
              url: `urn:organizer-document:${encodeURIComponent(document.sourceId)}`,
              title: document.fileName,
              text: document.text,
              isPrimary: false,
            }] : []),
            ...sourceDocuments
              .filter((source) => source.discovery === "discovered")
              .map((source) => ({
                url: source.url,
                title: source.title ?? "",
                text: source.text,
                isPrimary: source.isPrimary,
              })),
          ],
        })
      : { sources: [], warnings: [], usedLlm: false };
  return {
    preview,
    sourceDocuments,
    sourceIntelligence,
    documents: attachWorkflowDocumentFindings(extractedDocuments, preview),
    websiteWarning,
  };
};

const loadEventContext = async (serviceConfig: ReturnType<typeof serviceHeaders> extends never ? never : Parameters<typeof serviceHeaders>[0], eventId: string) => {
  const response = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${eventId}&select=id,name,location,race_date,organizer_details,race_event_editions(id,edition_year,start_date,end_date,is_current),races(id,edition_id,edition_group_id,series_name,name,race_date,distance_km,elevation_gain_m,elevation_loss_m,external_site_url,location_text,thumbnail_url,gpx_storage_path,organizer_details,is_live,data_status,missing_required_fields)&limit=1`,
    {
      headers: serviceHeaders(serviceConfig, ""),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    console.error("Unable to load organizer event import context", await response.text());
    return null;
  }

  return z.array(eventContextSchema).parse(await response.json())[0] ?? null;
};

const invokeOrganizerImportRpc = async <Schema extends z.ZodTypeAny>(
  auth: OrganizerAuth,
  name: "confirm_organizer_import_formats" | "apply_organizer_import_field_patches",
  payload: Record<string, unknown>,
  schema: Schema
): Promise<z.infer<Schema>> => {
  const response = await fetch(`${auth.serviceConfig.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serviceHeaders(auth.serviceConfig),
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error(`Unable to execute ${name}`, detail);
    throw new OrganizerWebsiteImportError("INVALID_DATA", "Impossible d'appliquer l'étape d'import.");
  }
  return schema.parse(await response.json());
};

const raceToWorkflowValues = (race: EventRace) => {
  const details = parseOrganizerRaceDetails(race.organizer_details);
  const missing = new Set(race.missing_required_fields);
  return {
    name: race.name,
    seriesName: race.series_name,
    raceDate: missing.has("race_date") ? undefined : race.race_date ?? undefined,
    locationText: race.location_text ?? undefined,
    distanceKm: missing.has("distance_km") ? undefined : race.distance_km,
    elevationGainM: missing.has("elevation_gain_m") ? undefined : race.elevation_gain_m,
    elevationLossM: race.elevation_loss_m ?? undefined,
    externalSiteUrl: race.external_site_url ?? undefined,
    thumbnailUrl: race.thumbnail_url ?? undefined,
    gpx: race.gpx_storage_path ? true : undefined,
    startTime: details.schedule.startTime ?? undefined,
    finishCutoffTime: details.schedule.finishCutoffTime ?? undefined,
    bibPickup: details.bibPickup.schedule ?? undefined,
    mandatoryEquipment: details.mandatoryEquipment.items.map((item) => item.label),
  } satisfies Partial<Record<OrganizerImportClaimField, OrganizerImportClaimValue | undefined>>;
};

const buildWorkflowClaims = (
  preview: OrganizerWebsiteImportPreview,
  documents: ExtractedWorkflowDocument[],
  event: EventContext,
  editionId: string,
  confirmedFormats: Array<z.infer<typeof workflowConfirmedSessionFormatSchema>>,
  discoveryCandidates: Array<z.infer<typeof formatCandidateSchema>>,
  discoveryEventClaims: SourceClaim[]
) => {
  const scopeKeyByPreviewRaceKey: Record<string, string> = {};
  for (const format of confirmedFormats) {
    for (const candidateKey of format.candidateKeys) {
      const candidate = discoveryCandidates.find((item) => item.candidateKey === candidateKey);
      for (const detectionKey of candidate?.detectionKeys ?? [candidateKey]) {
        scopeKeyByPreviewRaceKey[detectionKey] = format.raceId;
      }
    }
  }

  const eventRaceById = new Map((event.races ?? []).map((race) => [race.id, race]));
  const currentFormats = confirmedFormats.flatMap((format) => {
    const race = eventRaceById.get(format.raceId);
    return race
      ? [{ formatKey: format.raceId, raceId: race.id, name: race.name, seriesName: race.series_name, values: raceToWorkflowValues(race) }]
      : [];
  });
  const eventDetails = parseOrganizerEventDetails(event.organizer_details);

  const formatKeyByHint: Record<string, string> = {};
  for (const race of preview.races) {
    const scopeKey = scopeKeyByPreviewRaceKey[race.key];
    if (!scopeKey) continue;
    formatKeyByHint[race.name] = scopeKey;
    formatKeyByHint[race.seriesName] = scopeKey;
  }
  for (const format of confirmedFormats) formatKeyByHint[format.name] = format.raceId;
  const documentScopeByEvidence = new Map<string, string>();
  for (const format of confirmedFormats) {
    for (const candidateKey of format.candidateKeys) {
      const candidate = discoveryCandidates.find((item) => item.candidateKey === candidateKey);
      if (!candidateKey.startsWith("document:") || !candidate) continue;
      for (const claim of candidate.claims.filter((item) => item.field === "distanceKm")) {
        documentScopeByEvidence.set(
          `${claim.source.sourceId}:${claim.source.page ?? 0}:${claim.value}`,
          format.raceId
        );
      }
    }
  }
  const documentClaims = documents.flatMap((document) => buildOrganizerDocumentSourceClaims({
    ...document,
    findings: document.findings.map((finding) => {
      if (finding.scope === "format-unknown" && finding.field === "mandatoryEquipment") {
        return { ...finding, scope: "event" as const };
      }
      if (finding.scope === "format-unknown" && finding.field === "distanceKm") {
        const distanceKm = parseDocumentMetric(finding.value);
        const raceId = distanceKm === null
          ? null
          : documentScopeByEvidence.get(`${document.sourceId}:${finding.page ?? 0}:${distanceKm}`) ?? null;
        if (raceId) {
          const syntheticHint = `document-scope:${raceId}`;
          formatKeyByHint[syntheticHint] = raceId;
          return { ...finding, scope: "format" as const, formatHint: syntheticHint };
        }
      }
      return finding;
    }),
  }, formatKeyByHint));
  const discoveredFormatClaims = discoveryCandidates.flatMap((candidate) => {
    const targetScopeKey = scopeKeyByPreviewRaceKey[candidate.candidateKey];
    if (!targetScopeKey) return [];
    return candidate.claims.map((claim) => createSourceClaim({
      ...claim,
      scope: { kind: "format", scopeKey: targetScopeKey },
    }));
  });
  const additionalClaimCounts = new Map<string, number>();
  const additionalClaims = [
    ...documentClaims,
    ...discoveryEventClaims,
    ...discoveredFormatClaims,
  ].filter((claim) => {
    const key = `${claim.scope.kind}:${claim.scope.scopeKey}:${claim.field}`;
    const count = additionalClaimCounts.get(key) ?? 0;
    if (count >= 12) return false;
    additionalClaimCounts.set(key, count + 1);
    return true;
  });

  const edition = (event.race_event_editions ?? []).find((candidate) => candidate.id === editionId) ?? null;
  const previousFormats = confirmedFormats.flatMap((format) => {
    const currentRace = eventRaceById.get(format.raceId);
    if (!currentRace) return [];
    const previous = (event.races ?? [])
      .filter((race) => race.edition_group_id === currentRace.edition_group_id && race.id !== currentRace.id)
      .filter((race) => !edition || !race.race_date || race.race_date < edition.start_date)
      .sort((left, right) => (right.race_date ?? "").localeCompare(left.race_date ?? ""))[0];
    return previous
      ? [{ formatKey: format.raceId, raceId: previous.id, name: previous.name, seriesName: previous.series_name, values: raceToWorkflowValues(previous) }]
      : [];
  });

  return buildSourceClaims({
    preview,
    scopeKeyByPreviewRaceKey,
    currentData: {
      event: {
        name: event.name,
        location: event.location ?? undefined,
        officialWebsiteUrl: eventDetails.officialWebsiteUrl ?? undefined,
        mandatoryEquipment: eventDetails.mandatoryEquipment.items.map((item) => item.label),
        startAddress: eventDetails.access.startAddress ?? undefined,
        shuttles: eventDetails.access.shuttles ?? undefined,
        officialParkings: eventDetails.access.officialParkings ?? undefined,
      },
      formats: currentFormats,
    },
    previousEditionData: previousFormats.length > 0
      ? { edition: edition ? String(edition.edition_year - 1) : null, formats: previousFormats }
      : null,
    additionalClaims,
  });
};

const workflowEventFields: OrganizerImportClaimField[] = [
  "name",
  "location",
  "officialWebsiteUrl",
  "mandatoryEquipment",
  "startAddress",
  "shuttles",
  "officialParkings",
];

const workflowFormatFields: OrganizerImportClaimField[] = [
  "name",
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
];

const toWorkflowPublicClaim = (claim: SourceClaim): z.infer<typeof workflowPublicClaimSchema> => ({
  id: claim.claimId,
  value: claim.value,
  source: {
    kind: claim.source.kind,
    label: claim.source.label,
    url: claim.source.url,
    fileName: claim.source.kind === "official-document" || claim.source.kind === "ocr" ? claim.source.label : null,
    page: claim.source.page,
    editionYear: claim.source.edition,
  },
  evidence: [claim.evidence],
  confidence: claim.confidence,
});

const buildWorkflowFieldReport = (
  scope: "event" | "format",
  raceId: string | null,
  name: string,
  fields: OrganizerImportClaimField[],
  resolutions: FieldResolution[]
): z.infer<typeof workflowFieldReportSchema> => {
  const scopeKey = scope === "event" ? "event" : raceId;
  return workflowFieldReportSchema.parse({
    scope,
    raceId,
    name,
    resolutions: fields.map((field) => {
      const resolution = resolutions.find(
        (candidate) => candidate.scope.kind === scope && candidate.scope.scopeKey === scopeKey && candidate.field === field
      );
      if (!resolution) {
        return {
          field,
          label: proposalLabels[field] ?? field,
          reason: "Aucune source applicable ne renseigne ce champ.",
          currentValue: null,
          claims: [],
          recommendedClaimId: null,
          status: "missing" as const,
        };
      }
      const publicClaims = resolution.claims.map(toWorkflowPublicClaim);
      const recommendationIsApplicable = resolution.recommendedClaimId !== null &&
        publicClaims.some((claim) => claim.id === resolution.recommendedClaimId);
      const status = resolution.status === "conflict"
        ? "conflict" as const
        : resolution.status === "missing"
          ? "missing" as const
          : resolution.canPreselect || Boolean(resolution.currentClaim)
            ? "safe" as const
            : "review" as const;
      return {
        field,
        label: proposalLabels[field] ?? field,
        reason: resolution.reason,
        currentValue: resolution.currentClaim?.value ?? null,
        claims: publicClaims,
        recommendedClaimId: recommendationIsApplicable ? resolution.recommendedClaimId : null,
        status,
      };
    }),
  });
};

const applyLlmConflictRecommendations = async (resolutions: FieldResolution[]) => {
  let warnings: string[] = [];
  try {
    const result = await resolveOrganizerFieldConflictsWithLlm({ resolutions });
    if (!result) return { resolutions, warnings: ["Le LLM n'est pas configuré; les conflits restent à valider manuellement."] };
    warnings = result.warnings;
    const decisions = new Map(result.resolutions.map((resolution) => [resolution.resolutionId, resolution]));
    return {
      resolutions: resolutions.map((resolution) => {
        const decision = decisions.get(resolution.resolutionId);
        if (!decision || decision.decision !== "select") return resolution;
        return fieldResolutionSchema.parse({
          ...resolution,
          recommendedClaimId: decision.selectedClaimId,
          reason: `${resolution.reason} Recommandation LLM : ${decision.rationale}`,
        });
      }),
      warnings,
    };
  } catch (error) {
    console.error("Organizer field conflict LLM unavailable", error);
    return {
      resolutions,
      warnings: [error instanceof OrganizerImportReconciliationError
        ? error.message
        : "Le LLM n'a pas pu départager les sources; les conflits restent manuels."],
    };
  }
};

const updateEventFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  event: EventContext,
  proposals: OrganizerImportFieldProposal[]
) => {
  if (proposals.length === 0) return;
  const currentDetails = parseOrganizerEventDetails(event.organizer_details);
  const byField = new Map(proposals.map((proposal) => [proposal.field, proposal.value]));
  const nextDetails = {
    ...currentDetails,
    officialWebsiteUrl: typeof byField.get("officialWebsiteUrl") === "string"
      ? byField.get("officialWebsiteUrl") as string
      : currentDetails.officialWebsiteUrl,
    mandatoryEquipment: Array.isArray(byField.get("mandatoryEquipment"))
      ? {
          ...currentDetails.mandatoryEquipment,
          items: (byField.get("mandatoryEquipment") as string[]).map((label, index) => ({
            id: `information-import-${index}`,
            label,
            required: true,
            cold: false,
            heat: false,
            note: null,
          })),
        }
      : currentDetails.mandatoryEquipment,
    access: {
      ...currentDetails.access,
      startAddress: typeof byField.get("startAddress") === "string"
        ? byField.get("startAddress") as string
        : currentDetails.access.startAddress,
      shuttles: typeof byField.get("shuttles") === "string"
        ? byField.get("shuttles") as string
        : currentDetails.access.shuttles,
      officialParkings: typeof byField.get("officialParkings") === "string"
        ? byField.get("officialParkings") as string
        : currentDetails.access.officialParkings,
    },
  };
  const updatePayload: Record<string, unknown> = { organizer_details: nextDetails };
  if (typeof byField.get("name") === "string") updatePayload.name = byField.get("name");
  if (typeof byField.get("location") === "string") updatePayload.location = byField.get("location");

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_events?id=eq.${event.id}`, {
    method: "PATCH",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(updatePayload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to update organizer event from website import", await response.text());
    throw new Error("Unable to update event.");
  }
};

const uploadRaceGpx = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  eventId: string,
  raceId: string,
  race: OrganizerWebsiteImportRace
) => {
  if (!race.gpxContent) return null;
  const storagePath = `organizer/${eventId}/${raceId}/website-import-${Date.now()}.gpx`;
  const uploadResponse = await fetch(`${serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${storagePath}`, {
    method: "POST",
    headers: {
      apikey: serviceConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${serviceConfig.supabaseServiceRoleKey}`,
      "Content-Type": "application/gpx+xml",
      "x-upsert": "true",
    },
    body: race.gpxContent,
    cache: "no-store",
  });

  if (!uploadResponse.ok) {
    console.error("Unable to upload organizer website import GPX", await uploadResponse.text());
    throw new Error("Unable to upload GPX.");
  }

  return storagePath;
};

const hydrateAidStationsIfEmpty = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  raceId: string,
  race: OrganizerWebsiteImportRace
) => {
  if (race.aidStations.length === 0) return 0;

  const countResponse = await fetch(
    `${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations?race_id=eq.${raceId}&select=count`,
    {
      headers: { ...serviceHeaders(serviceConfig, ""), Prefer: "count=exact", Range: "0-0" },
      cache: "no-store",
    }
  );

  if (!countResponse.ok) {
    console.error("Unable to inspect race aid stations before website import", await countResponse.text());
    return 0;
  }

  const countHeader = countResponse.headers.get("content-range");
  const existingCount = countHeader ? Number(countHeader.split("/")[1] ?? "0") : 0;
  if (Number.isFinite(existingCount) && existingCount > 0) return 0;

  const insertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/race_aid_stations`, {
    method: "POST",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(
      race.aidStations.map((station, index) => ({
        race_id: raceId,
        name: station.name,
        km: station.distanceKm,
        water_available: station.waterRefill,
        solid_available: false,
        assistance_allowed: false,
        order_index: index,
      }))
    ),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to hydrate aid stations from website import", await insertResponse.text());
    return 0;
  }

  return race.aidStations.length;
};

const getSelectedProposalValue = (
  proposals: OrganizerImportFieldProposal[],
  field: OrganizerImportRaceField
) => proposals.find((proposal) => proposal.field === field)?.value;

const applyProposalValuesToRace = (
  race: OrganizerWebsiteImportRace,
  proposals: OrganizerImportFieldProposal[]
): OrganizerWebsiteImportRace => {
  const text = (field: OrganizerImportRaceField, fallback: string | null) => {
    const value = getSelectedProposalValue(proposals, field);
    return typeof value === "string" ? value : fallback;
  };
  const number = (field: OrganizerImportRaceField, fallback: number | null) => {
    const value = getSelectedProposalValue(proposals, field);
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  };
  const name = text("name", race.name) ?? race.name;
  return {
    ...race,
    name,
    seriesName: name,
    raceDate: text("raceDate", race.raceDate),
    locationText: text("locationText", race.locationText),
    distanceKm: number("distanceKm", race.distanceKm),
    elevationGainM: number("elevationGainM", race.elevationGainM),
    elevationLossM: number("elevationLossM", race.elevationLossM),
    externalSiteUrl: text("externalSiteUrl", race.externalSiteUrl),
    thumbnailUrl: text("thumbnailUrl", race.thumbnailUrl),
  };
};

const buildImportedRaceDetails = (
  currentValue: unknown,
  proposals: OrganizerImportFieldProposal[]
) => {
  const details = parseOrganizerRaceDetails(currentValue);
  const startTime = getSelectedProposalValue(proposals, "startTime");
  const finishCutoffTime = getSelectedProposalValue(proposals, "finishCutoffTime");
  const bibPickup = getSelectedProposalValue(proposals, "bibPickup");
  const mandatoryEquipment = getSelectedProposalValue(proposals, "mandatoryEquipment");
  return {
    ...details,
    schedule: {
      ...details.schedule,
      startTime: typeof startTime === "string" ? startTime : details.schedule.startTime,
      finishCutoffTime: typeof finishCutoffTime === "string" ? finishCutoffTime : details.schedule.finishCutoffTime,
    },
    bibPickup: typeof bibPickup === "string"
      ? { ...details.bibPickup, schedule: bibPickup }
      : details.bibPickup,
    mandatoryEquipment: Array.isArray(mandatoryEquipment)
      ? {
          ...details.mandatoryEquipment,
          overrideEnabled: true,
          items: (mandatoryEquipment as string[]).map((label, index) => ({
            id: `information-import-${index}`,
            label,
            required: true,
            cold: false,
            heat: false,
            note: null,
          })),
        }
      : details.mandatoryEquipment,
  };
};

const createRaceFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  eventId: string,
  race: OrganizerWebsiteImportRace,
  proposals: OrganizerImportFieldProposal[],
  editionGroupId: string | null,
  editionId: string
) => {
  const selectedFields = new Set(proposals.map((proposal) => proposal.field));
  const requiredFields: OrganizerImportRaceField[] = ["name", "raceDate", "distanceKm", "elevationGainM"];
  if (
    requiredFields.some((field) => !selectedFields.has(field)) ||
    !race.raceDate ||
    race.distanceKm === null ||
    race.elevationGainM === null
  ) {
    throw new Error("Incomplete race preview.");
  }

  const raceId = randomUUID();
  const gpxStoragePath = selectedFields.has("gpx") && race.gpxContent
    ? await uploadRaceGpx(serviceConfig, eventId, raceId, race)
    : null;
  // `gpx_path` is a legacy required column, while `gpx_storage_path` accurately signals whether a GPX was imported.
  const legacyGpxPath = gpxStoragePath ?? `organizer/${eventId}/${raceId}.gpx`;
  const insertResponse = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races`, {
    method: "POST",
    headers: {
      ...serviceHeaders(serviceConfig),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      id: raceId,
      event_id: eventId,
      edition_id: editionId,
      edition_group_id: editionGroupId ?? raceId,
      slug: buildSlug(race.name, "organizer"),
      series_name: race.name,
      name: race.name,
      race_date: race.raceDate,
      distance_km: race.distanceKm,
      elevation_gain_m: race.elevationGainM,
      elevation_loss_m: selectedFields.has("elevationLossM") ? race.elevationLossM : null,
      location_text: selectedFields.has("locationText") ? race.locationText : null,
      external_site_url: selectedFields.has("externalSiteUrl") ? race.externalSiteUrl : null,
      thumbnail_url: selectedFields.has("thumbnailUrl") ? race.thumbnailUrl : null,
      gpx_path: legacyGpxPath,
      gpx_hash: gpxStoragePath ? `website-import:${raceId}` : `manual:${raceId}`,
      gpx_storage_path: gpxStoragePath,
      gpx_sha256: gpxStoragePath ? null : null,
      is_live: true,
      is_public: true,
      created_by: null,
      organizer_details: buildImportedRaceDetails(null, proposals),
    }),
    cache: "no-store",
  });

  if (!insertResponse.ok) {
    console.error("Unable to create organizer race from website import", await insertResponse.text());
    throw new Error("Unable to create race.");
  }

  const createdRace = z
    .array(z.object({ id: z.string().uuid() }))
    .parse(await insertResponse.json())[0];
  const createdAidStations = selectedFields.has("aidStations")
    ? await hydrateAidStationsIfEmpty(serviceConfig, createdRace.id, race)
    : 0;

  return { raceId: createdRace.id, gpxUploaded: Boolean(gpxStoragePath), createdAidStations };
};

const ensureEventEdition = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  event: EventContext,
  startDate: string,
  endDate: string
) => {
  const editionYear = Number(startDate.slice(0, 4));
  const existing = (event.race_event_editions ?? []).find((edition) => edition.edition_year === editionYear) ?? null;
  const normalizedEndDate = endDate >= startDate ? endDate : startDate;
  const response = await fetch(
    existing
      ? `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions?id=eq.${existing.id}`
      : `${serviceConfig.supabaseUrl}/rest/v1/race_event_editions`,
    {
      method: existing ? "PATCH" : "POST",
      headers: { ...serviceHeaders(serviceConfig), Prefer: "return=representation" },
      body: JSON.stringify(
        existing
          ? { start_date: startDate, end_date: normalizedEndDate }
          : {
              event_id: event.id,
              edition_year: editionYear,
              start_date: startDate,
              end_date: normalizedEndDate,
              is_current: !(event.race_event_editions ?? []).some((edition) => edition.is_current),
            }
      ),
      cache: "no-store",
    }
  );
  if (!response.ok) throw new Error("Unable to persist event edition.");
  return z.array(z.object({ id: z.string().uuid(), start_date: z.string(), end_date: z.string() })).parse(await response.json())[0] ?? null;
};

const updateRaceFromPreview = async (
  serviceConfig: Parameters<typeof serviceHeaders>[0],
  existingRace: EventRace,
  race: OrganizerWebsiteImportRace,
  proposals: OrganizerImportFieldProposal[],
  editionId: string
) => {
  const selectedFields = new Set(proposals.map((proposal) => proposal.field));
  const updatePayload: Record<string, unknown> = { edition_id: editionId };
  if (selectedFields.has("name") || selectedFields.has("seriesName")) {
    updatePayload.name = race.name || existingRace.name;
    updatePayload.series_name = race.name || existingRace.series_name;
  }
  if (selectedFields.has("raceDate")) updatePayload.race_date = race.raceDate ?? existingRace.race_date ?? null;
  if (selectedFields.has("locationText")) updatePayload.location_text = race.locationText;
  if (selectedFields.has("externalSiteUrl")) updatePayload.external_site_url = race.externalSiteUrl;
  if (selectedFields.has("distanceKm")) updatePayload.distance_km = race.distanceKm;
  if (selectedFields.has("elevationGainM")) updatePayload.elevation_gain_m = race.elevationGainM;
  if (selectedFields.has("elevationLossM")) updatePayload.elevation_loss_m = race.elevationLossM;
  if (selectedFields.has("thumbnailUrl") && !existingRace.thumbnail_url) updatePayload.thumbnail_url = race.thumbnailUrl;
  const organizerDetailFields: OrganizerImportRaceField[] = ["startTime", "finishCutoffTime", "bibPickup", "mandatoryEquipment"];
  if (organizerDetailFields.some((field) => selectedFields.has(field))) {
    updatePayload.organizer_details = buildImportedRaceDetails(existingRace.organizer_details, proposals);
  }

  let gpxUploaded = false;
  if (selectedFields.has("gpx") && !existingRace.gpx_storage_path && race.gpxContent) {
    const gpxStoragePath = await uploadRaceGpx(serviceConfig, existingRace.id, existingRace.id, race);
    updatePayload.gpx_path = gpxStoragePath;
    updatePayload.gpx_hash = gpxStoragePath ? `website-import:${existingRace.id}` : null;
    updatePayload.gpx_storage_path = gpxStoragePath;
    updatePayload.gpx_sha256 = null;
    gpxUploaded = Boolean(gpxStoragePath);
  }

  const response = await fetch(`${serviceConfig.supabaseUrl}/rest/v1/races?id=eq.${existingRace.id}`, {
    method: "PATCH",
    headers: serviceHeaders(serviceConfig),
    body: JSON.stringify(updatePayload),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Unable to update organizer race from website import", await response.text());
    throw new Error("Unable to update race.");
  }

  const createdAidStations = selectedFields.has("aidStations")
    ? await hydrateAidStationsIfEmpty(serviceConfig, existingRace.id, race)
    : 0;
  return { raceId: existingRace.id, gpxUploaded, createdAidStations };
};

const workflowResponse = (body: Record<string, unknown>) =>
  withSecurityHeaders(NextResponse.json(body));

const handleOrganizerImportWorkflow = async (
  auth: OrganizerAuth,
  event: EventContext,
  request: WorkflowRequest
) => {
  try {
    if (request.action === "discover-formats") {
      const edition = (event.race_event_editions ?? []).find((candidate) => candidate.id === request.editionId);
      if (!edition) return jsonError("L'édition sélectionnée est inconnue.", 404);
      const additionalUrls = Array.from(new Set([...request.additionalUrls, ...request.formatUrls]));
      if (!request.url && additionalUrls.length === 0 && request.documents.length === 0) {
        return jsonError("Ajoute au moins une URL ou un document officiel.", 400);
      }
      const sourceManifest = organizerImportSourceManifestSchema.parse({
        url: request.url,
        additionalUrls,
        documents: request.documents,
      });
      const sources = await loadWorkflowSources(auth, event, request.editionId, sourceManifest, {
        analyzeOfficialSources: true,
      });
      const editionRaces = (event.races ?? []).filter((race) =>
        race.edition_id === edition.id || (!race.edition_id && race.race_date?.slice(0, 4) === String(edition.edition_year))
      );
      const deterministicWebsiteCandidates = buildFormatCandidates(sources.preview, editionRaces.map((race) => ({
        id: race.id,
        name: race.name,
        seriesName: race.series_name,
        raceDate: race.race_date ?? null,
        distanceKm: race.distance_km,
      })));
      const intelligentSources = buildSourceIntelligenceCandidates(
        sources.sourceIntelligence.sources,
        editionRaces,
        sources.documents
      );
      const websiteCandidates = mergeSourceIntelligenceCandidates(
        mergeSourceIntelligenceCandidates(deterministicWebsiteCandidates, intelligentSources.candidates),
        intelligentSources.enrichmentCandidates,
        false
      );
      const candidateKeyByHint = new Map<string, string>();
      for (const candidate of websiteCandidates) {
        for (const name of candidate.names) candidateKeyByHint.set(normalizeComparableName(name), candidate.candidateKey);
      }
      const documentClaims = sources.documents.flatMap((document) => {
        const mapping = Object.fromEntries(
          [...candidateKeyByHint.entries()].map(([name, candidateKey]) => [name, candidateKey])
        );
        return buildOrganizerDocumentSourceClaims({
          ...document,
          findings: document.findings.map((finding) => ({
            ...finding,
            formatHint: finding.formatHint ? normalizeComparableName(finding.formatHint) : null,
          })),
        }, mapping);
      });
      const enrichedWebsiteCandidates = websiteCandidates.map((candidate) => {
        const claims = documentClaims.filter(
          (claim) => claim.scope.kind === "format" && claim.scope.scopeKey === candidate.candidateKey
        );
        if (claims.length === 0) return candidate;
        const boundedClaims = [...candidate.claims, ...claims].slice(0, 100);
        return formatCandidateSchema.parse({
          ...candidate,
          claims: boundedClaims,
          evidence: [
            ...candidate.evidence,
            ...boundedClaims
              .filter((claim) => !candidate.claims.some((existing) => existing.claimId === claim.claimId))
              .map((claim) => ({ ...claim.source, evidence: claim.evidence })),
          ].slice(0, 30),
        });
      });
      const candidates = [...enrichedWebsiteCandidates, ...buildDocumentFormatCandidates(sources.documents)].slice(0, 30);
      const discoverySnapshot = workflowDiscoverySnapshotSchema.parse({
        version: 2,
        eventId: event.id,
        editionId: request.editionId,
        expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
        candidates,
        eventClaims: intelligentSources.eventClaims,
      });
      const session = await createOrganizerImportSession(auth, {
        eventId: event.id,
        editionId: request.editionId,
        sourceManifest,
        discoverySnapshot,
      });
      if (!session) {
        await deleteTemporaryOrganizerImportDocuments(auth.serviceConfig, auth.user.id, request.documents);
        return jsonError("Impossible de créer la session d'import.", 502);
      }
      return workflowResponse({
        workflow: {
          sessionId: session.id,
          step: "formats",
          expiresAt: session.expires_at,
          candidates,
          sourceAudit: buildSourceAudit(sources.sourceIntelligence),
          discoverySnapshot,
          discoverySignature: signWorkflowSnapshot(
            "discovery",
            discoverySnapshot,
            auth.serviceConfig.supabaseServiceRoleKey
          ),
          warnings: [
            ...(sources.websiteWarning ? [sources.websiteWarning] : []),
            ...buildSourceAnalysisWarnings(sources.sourceIntelligence),
            ...candidates.flatMap((candidate) =>
              candidate.edition.year && candidate.edition.year !== String(edition.edition_year)
                ? [`${candidate.proposedName} semble appartenir à l'édition ${candidate.edition.year}, pas à ${edition.edition_year}.`]
                : []
            ),
            ...sources.documents.flatMap((document) => document.message ? [`${document.fileName}: ${document.message}`] : []),
          ],
        },
      });
    }

    const session = await loadOrganizerImportSession(auth, request.sessionId, event.id);
    if (!session) return jsonError("La session d'import est introuvable ou expirée.", 409);

    if (request.action === "cancel") {
      const cancelled = await deleteOrganizerImportSession(auth, session);
      return workflowResponse({ cancelled });
    }

    if (request.action === "confirm-formats") {
      if (session.status !== "discovered") return jsonError("Les formats ont déjà été confirmés.", 409);
      const parsedSnapshot = workflowDiscoverySnapshotSchema.safeParse(request.discoverySnapshot);
      if (!parsedSnapshot.success) return jsonError("Le relevé des formats est invalide.", 409);
      const snapshot = parsedSnapshot.data;
      if (
        snapshot.eventId !== event.id ||
        snapshot.editionId !== session.edition_id ||
        Date.parse(snapshot.expiresAt) <= Date.now() ||
        serializeWorkflowValue(snapshot) !== serializeWorkflowValue(session.discovery_snapshot) ||
        !verifyWorkflowSnapshot("discovery", snapshot, request.discoverySignature, auth.serviceConfig.supabaseServiceRoleKey)
      ) {
        return jsonError("Le relevé des formats a expiré ou a été modifié.", 409);
      }

      const knownCandidateKeys = new Set(snapshot.candidates.map((candidate) => candidate.candidateKey));
      const submittedKeys = request.confirmedFormats.flatMap((format) => format.candidateKeys);
      if (submittedKeys.some((key) => !knownCandidateKeys.has(key))) {
        return jsonError("Un format confirmé ne fait pas partie du relevé.", 409);
      }
      if (new Set(submittedKeys).size !== submittedKeys.length) {
        return jsonError("Un format détecté ne peut être traité qu'une fois.", 400);
      }
      if (snapshot.candidates.some((candidate) => !submittedKeys.includes(candidate.candidateKey))) {
        return jsonError("Confirme ou ignore chaque format détecté.", 400);
      }
      const actionable = request.confirmedFormats.filter((format) => format.mode !== "ignore");
      if (actionable.length === 0) return jsonError("Conserve au moins un format.", 400);
      if (request.confirmedFormats.some((format) => format.mode === "ignore" && format.candidateKeys.length === 0)) {
        return jsonError("Un ajout manuel ne peut pas être ignoré.", 400);
      }
      if (actionable.some((format) => format.mode === "bind-existing" ? !format.targetRaceId : Boolean(format.targetRaceId))) {
        return jsonError("La cible d'un format est incohérente.", 400);
      }
      const edition = (event.race_event_editions ?? []).find((candidate) => candidate.id === session.edition_id)!;
      const editionRaceIds = new Set((event.races ?? []).filter((race) =>
        race.edition_id === edition.id || (!race.edition_id && race.race_date?.slice(0, 4) === String(edition.edition_year))
      ).map((race) => race.id));
      const bindingTargets = actionable.flatMap((format) => format.targetRaceId ? [format.targetRaceId] : []);
      if (bindingTargets.some((raceId) => !editionRaceIds.has(raceId)) || new Set(bindingTargets).size !== bindingTargets.length) {
        return jsonError("Chaque rattachement doit viser un format unique de cette édition.", 409);
      }

      const rpcFormats = actionable.map((format) => ({
        formatKey: format.candidateKeys[0] ?? `manual:${randomUUID()}`,
        candidateKeys: format.candidateKeys,
        mode: format.mode,
        ...(format.mode === "bind-existing" ? { raceId: format.targetRaceId } : {}),
        name: format.name,
      }));
      const confirmed = await invokeOrganizerImportRpc(
        auth,
        "confirm_organizer_import_formats",
        { p_session_id: session.id, p_formats: rpcFormats },
        confirmFormatsRpcResponseSchema
      );
      const candidateKeysByFormatKey = new Map(
        rpcFormats.map((format, index) => [format.formatKey, actionable[index].candidateKeys])
      );
      const confirmedFormats = confirmed.formats.map((format) => workflowConfirmedSessionFormatSchema.parse({
        ...format,
        candidateKeys: candidateKeysByFormatKey.get(format.formatKey) ?? [],
      }));
      return workflowResponse({
        workflow: {
          sessionId: session.id,
          step: "fields",
          confirmedFormats,
        },
      });
    }

    const confirmedFormats = z.array(workflowConfirmedSessionFormatSchema).parse(session.confirmed_formats);

    if (request.action === "analyze-fields") {
      if (session.status !== "formats_confirmed" && session.status !== "fields_analyzed") {
        return jsonError("Confirme d'abord les formats.", 409);
      }
      const discoverySnapshot = workflowDiscoverySnapshotSchema.parse(session.discovery_snapshot);
      const sources = await loadWorkflowSources(auth, event, session.edition_id, session.source_manifest);
      const claims = buildWorkflowClaims(
        sources.preview,
        sources.documents,
        event,
        session.edition_id,
        confirmedFormats,
        discoverySnapshot.candidates,
        discoverySnapshot.eventClaims
      );
      const groupedResolutions = groupClaimsIntoFieldResolutions(claims);
      const llmResult = await applyLlmConflictRecommendations(groupedResolutions);
      const eventReport = buildWorkflowFieldReport("event", null, event.name, workflowEventFields, llmResult.resolutions);
      const formatReports = confirmedFormats.map((format) => buildWorkflowFieldReport(
        "format",
        format.raceId,
        format.name,
        workflowFormatFields,
        llmResult.resolutions
      ));
      const fieldSnapshot = workflowFieldSnapshotSchema.parse({
        version: 2,
        eventId: event.id,
        editionId: session.edition_id,
        sessionId: session.id,
        expiresAt: new Date(session.expires_at).toISOString(),
        eventReport,
        formatReports,
      });
      const updated = await updateOrganizerImportSession(auth, session, {
        status: "fields_analyzed",
        field_snapshot: fieldSnapshot,
      });
      if (!updated) return jsonError("Impossible d'enregistrer le rapport d'analyse.", 502);
      return workflowResponse({
        workflow: {
          sessionId: session.id,
          step: "review",
          confirmedFormats,
          eventReport,
          formatReports,
          fieldSnapshot,
          fieldSignature: signWorkflowSnapshot("fields", fieldSnapshot, auth.serviceConfig.supabaseServiceRoleKey),
          warnings: [
            ...(sources.websiteWarning ? [sources.websiteWarning] : []),
            ...llmResult.warnings,
            ...sources.documents.flatMap((document) => document.message ? [`${document.fileName}: ${document.message}`] : []),
          ],
        },
      });
    }

    if (session.status !== "fields_analyzed") return jsonError("Analyse d'abord les champs.", 409);
    const parsedSnapshot = workflowFieldSnapshotSchema.safeParse(request.fieldSnapshot);
    if (!parsedSnapshot.success) return jsonError("Le rapport signé est invalide.", 409);
    const fieldSnapshot = parsedSnapshot.data;
    if (
      fieldSnapshot.eventId !== event.id ||
      fieldSnapshot.editionId !== session.edition_id ||
      fieldSnapshot.sessionId !== session.id ||
      Date.parse(fieldSnapshot.expiresAt) <= Date.now() ||
      serializeWorkflowValue(fieldSnapshot) !== serializeWorkflowValue(session.field_snapshot) ||
      !verifyWorkflowSnapshot("fields", fieldSnapshot, request.fieldSignature, auth.serviceConfig.supabaseServiceRoleKey)
    ) {
      return jsonError("Le rapport signé a expiré ou a été modifié.", 409);
    }

    const reportByKey = new Map<string, z.infer<typeof workflowPublicResolutionSchema>>();
    for (const report of [fieldSnapshot.eventReport, ...fieldSnapshot.formatReports]) {
      for (const resolution of report.resolutions) {
        reportByKey.set(`${report.scope}:${report.raceId ?? "event"}:${resolution.field}`, resolution);
      }
    }
    const selectionKeys = request.selections.map(
      (selection) => `${selection.scope}:${selection.raceId ?? "event"}:${selection.field}`
    );
    if (new Set(selectionKeys).size !== selectionKeys.length) {
      return jsonError("Un champ ne peut recevoir qu'une seule décision.", 400);
    }
    const validatedSelections = request.selections.map((selection, index) => {
      const key = selectionKeys[index];
      const resolution = reportByKey.get(key);
      if (!resolution) throw new OrganizerWebsiteImportError("INVALID_DATA", "Une décision ne correspond pas au rapport signé.");
      if (selection.decision === "claim") {
        const claim = resolution.claims.find((candidate) => candidate.id === selection.claimId);
        if (!claim) throw new OrganizerWebsiteImportError("INVALID_DATA", "La source choisie n'est pas applicable à ce champ.");
        return { selection, resolution, value: claim.value };
      }
      if (selection.claimId) throw new OrganizerWebsiteImportError("INVALID_DATA", "Une décision sans source ne doit pas fournir de claimId.");
      if (selection.decision === "missing" && resolution.currentValue !== null) {
        throw new OrganizerWebsiteImportError("INVALID_DATA", "Un champ déjà renseigné doit être conservé ou remplacé.");
      }
      return { selection, resolution, value: null };
    });

    const eventPatch: Record<string, unknown> = {};
    const eventDetails = parseOrganizerEventDetails(event.organizer_details);
    let nextEventDetails = eventDetails;
    let eventDetailsChanged = false;
    const eventSelections = validatedSelections.filter(({ selection }) => selection.scope === "event" && selection.decision === "claim");
    for (const { selection, value } of eventSelections) {
      if (selection.field === "name" && typeof value === "string") eventPatch.name = value;
      if (selection.field === "location" && typeof value === "string") eventPatch.location = value;
      if (selection.field === "officialWebsiteUrl" && typeof value === "string") {
        nextEventDetails = { ...nextEventDetails, officialWebsiteUrl: value };
        eventDetailsChanged = true;
      }
      if (selection.field === "mandatoryEquipment" && Array.isArray(value) && value.every((item) => typeof item === "string")) {
        nextEventDetails = {
          ...nextEventDetails,
          mandatoryEquipment: {
            ...nextEventDetails.mandatoryEquipment,
            items: value.map((label, index) => ({ id: `information-import-${index}`, label, required: true, cold: false, heat: false, note: null })),
          },
        };
        eventDetailsChanged = true;
      }
      if (["startAddress", "shuttles", "officialParkings"].includes(selection.field) && typeof value === "string") {
        const accessKey = selection.field as "startAddress" | "shuttles" | "officialParkings";
        nextEventDetails = { ...nextEventDetails, access: { ...nextEventDetails.access, [accessKey]: value } };
        eventDetailsChanged = true;
      }
    }
    if (eventDetailsChanged) eventPatch.organizerDetails = nextEventDetails;

    const eventRaceById = new Map((event.races ?? []).map((race) => [race.id, race]));
    const racePatches: Array<{ raceId: string; fields: Record<string, unknown>; missingRequiredFields: string[] }> = [];
    const uploadedGpxPaths: string[] = [];
    const gpxSelections = validatedSelections.filter(
      ({ selection, value }) => selection.scope === "format" && selection.field === "gpx" && selection.decision === "claim" && value === true
    );
    let refreshedPreview: OrganizerWebsiteImportPreview | null = null;
    if (gpxSelections.length > 0) {
      refreshedPreview = (await loadWorkflowSources(auth, event, session.edition_id, session.source_manifest)).preview;
    }

    for (const format of confirmedFormats) {
      const race = eventRaceById.get(format.raceId);
      if (!race) throw new OrganizerWebsiteImportError("INVALID_DATA", "Un brouillon confirmé est introuvable.");
      const fields: Record<string, unknown> = {};
      const missingRequiredFields = new Set(race.missing_required_fields);
      let raceDetails = parseOrganizerRaceDetails(race.organizer_details);
      let raceDetailsChanged = false;
      const selections = validatedSelections.filter(({ selection }) => selection.scope === "format" && selection.raceId === race.id);
      for (const { selection, value } of selections) {
        if (selection.decision === "missing") {
          if (selection.field === "raceDate") missingRequiredFields.add("race_date");
          if (selection.field === "distanceKm") missingRequiredFields.add("distance_km");
          if (selection.field === "elevationGainM") missingRequiredFields.add("elevation_gain_m");
          continue;
        }
        if (selection.decision !== "claim") continue;
        if (selection.field === "raceDate") missingRequiredFields.delete("race_date");
        if (selection.field === "distanceKm") missingRequiredFields.delete("distance_km");
        if (selection.field === "elevationGainM") missingRequiredFields.delete("elevation_gain_m");
        const directFieldMap: Partial<Record<OrganizerImportClaimField, string>> = {
          name: "name",
          seriesName: "seriesName",
          raceDate: "raceDate",
          distanceKm: "distanceKm",
          elevationGainM: "elevationGainM",
          elevationLossM: "elevationLossM",
          externalSiteUrl: "externalSiteUrl",
          locationText: "locationText",
          thumbnailUrl: "thumbnailUrl",
          aidStations: "aidStations",
        };
        const directField = directFieldMap[selection.field as OrganizerImportClaimField];
        if (directField === "aidStations" && Array.isArray(value)) {
          if (!value.every((station) => typeof station === "object" && station !== null && "name" in station)) {
            throw new OrganizerWebsiteImportError("INVALID_DATA", "Les ravitaillements sélectionnés sont invalides.");
          }
          fields.aidStations = value.map((station, index) => ({
              name: station.name,
              distanceKm: station.distanceKm,
              ...(typeof station.waterRefill === "boolean" ? { waterRefill: station.waterRefill } : {}),
              ...(typeof station.solidRefill === "boolean" ? { solidRefill: station.solidRefill } : {}),
              ...(typeof station.assistanceAllowed === "boolean" ? { assistanceAllowed: station.assistanceAllowed } : {}),
              orderIndex: index,
          }));
        } else if (directField) {
          fields[directField] = value;
        }
        if (selection.field === "startTime" && typeof value === "string") {
          raceDetails = { ...raceDetails, schedule: { ...raceDetails.schedule, startTime: value } };
          raceDetailsChanged = true;
        }
        if (selection.field === "finishCutoffTime" && typeof value === "string") {
          raceDetails = { ...raceDetails, schedule: { ...raceDetails.schedule, finishCutoffTime: value } };
          raceDetailsChanged = true;
        }
        if (selection.field === "bibPickup" && typeof value === "string") {
          raceDetails = { ...raceDetails, bibPickup: { ...raceDetails.bibPickup, schedule: value } };
          raceDetailsChanged = true;
        }
        if (selection.field === "mandatoryEquipment" && Array.isArray(value) && value.every((item) => typeof item === "string")) {
          raceDetails = {
            ...raceDetails,
            mandatoryEquipment: {
              ...raceDetails.mandatoryEquipment,
              overrideEnabled: true,
              items: value.map((label, index) => ({ id: `information-import-${index}`, label, required: true, cold: false, heat: false, note: null })),
            },
          };
          raceDetailsChanged = true;
        }
        if (selection.field === "gpx" && value === true && !race.gpx_storage_path && refreshedPreview) {
          const discoverySnapshot = workflowDiscoverySnapshotSchema.parse(session.discovery_snapshot);
          const previewKeys = format.candidateKeys.flatMap((candidateKey) =>
            discoverySnapshot.candidates.find((candidate) => candidate.candidateKey === candidateKey)?.detectionKeys ?? []
          );
          const previewRace = refreshedPreview.races.find((candidate) => previewKeys.includes(candidate.key));
          if (!previewRace?.gpxContent) {
            throw new OrganizerWebsiteImportError("INVALID_DATA", "La trace GPX sélectionnée n'est plus disponible.");
          }
          const storagePath = await uploadRaceGpx(auth.serviceConfig, event.id, race.id, previewRace);
          if (storagePath) {
            uploadedGpxPaths.push(storagePath);
            fields.gpxPath = storagePath;
            fields.gpxHash = `website-import:${race.id}`;
            fields.gpxStoragePath = storagePath;
            fields.gpxSha256 = null;
          }
        }
      }
      if (raceDetailsChanged) fields.organizerDetails = raceDetails;
      racePatches.push({ raceId: race.id, fields, missingRequiredFields: [...missingRequiredFields] });
    }

    let applied: z.infer<typeof applyFieldsRpcResponseSchema>;
    try {
      applied = await invokeOrganizerImportRpc(
        auth,
        "apply_organizer_import_field_patches",
        { p_session_id: session.id, p_event_patch: eventPatch, p_race_patches: racePatches },
        applyFieldsRpcResponseSchema
      );
    } catch (error) {
      await Promise.all(uploadedGpxPaths.map((path) =>
        fetch(`${auth.serviceConfig.supabaseUrl}/storage/v1/object/race-gpx/${path}`, {
          method: "DELETE",
          headers: serviceHeaders(auth.serviceConfig, ""),
          cache: "no-store",
        }).catch(() => null)
      ));
      throw error;
    }
    await deleteOrganizerImportSession(auth, session);
    return workflowResponse({
      applied: {
        eventUpdated: Object.keys(eventPatch).length > 0,
        formatsUpdated: applied.formatsUpdated,
        draftsRemaining: applied.draftsRemaining,
        formatsCompleted: applied.formatsCompleted,
      },
    });
  } catch (error) {
    if (request.action === "discover-formats") {
      await deleteTemporaryOrganizerImportDocuments(auth.serviceConfig, auth.user.id, request.documents);
    }
    if (error instanceof z.ZodError) {
      console.error(
        "Invalid organizer import workflow data",
        error.issues.map((issue) => ({ code: issue.code, path: issue.path.join("."), message: issue.message }))
      );
      return jsonError(
        "Une information extraite n'a pas pu être normalisée. Vérifie les sources ou réessaie sans le document concerné.",
        400
      );
    }
    if (error instanceof Error && "code" in error) {
      const code = (error as { code?: string }).code;
      const status = code === "FETCH_FAILED" ? 502 : code === "AUTH_REQUIRED" ? 403 : code === "AUTH_FAILED" ? 401 : 422;
      return jsonError(error.message, status);
    }
    console.error("Unexpected organizer import workflow error", error);
    return jsonError("Impossible de poursuivre l'import Organizer.", 500);
  }
};

export async function POST(request: NextRequest, context: { params: { id?: string } }) {
  const auth = await requireAdminAuth(request);
  if ("error" in auth) return auth.error;

  const parsedParams = uuidParamSchema.safeParse(context.params);
  if (!parsedParams.success) return jsonError("Invalid event id.", 400);

  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data") ?? false;
  const rawBody = isMultipart ? null : await request.json().catch(() => null);
  const parsedWorkflow = !isMultipart && isWorkflowAction(rawBody?.action)
    ? workflowRequestSchema.safeParse(rawBody)
    : null;
  if (parsedWorkflow && !parsedWorkflow.success) return jsonError("Invalid import workflow request.", 400);
  const isApply = rawBody?.action === "apply";
  const previewRequest = isMultipart ? await parsePreviewRequest(request) : { parsed: previewRequestSchema.safeParse(rawBody), documents: [] as File[] };
  const parsedBody = parsedWorkflow
    ? null
    : isApply ? applyRequestSchema.safeParse(rawBody) : previewRequest.parsed;
  if (parsedBody && !parsedBody.success) return jsonError("Invalid import request.", 400);
  if (!parsedWorkflow && !parsedBody) return jsonError("Invalid import request.", 400);
  const temporaryDocumentReferences = parsedBody?.success && parsedBody.data.action === "preview" ? parsedBody.data.documents : [];

  const rateLimit = await checkRateLimitAsync(`organizer-website-import:${auth.user.id}:${parsedParams.data.id}`, 6, 60_000);
  if (!rateLimit.allowed) {
    return withSecurityHeaders(
      NextResponse.json(
        { message: "Too many requests." },
        { status: 429, headers: { "Retry-After": Math.ceil((rateLimit.retryAfter ?? 0) / 1000).toString() } }
      )
    );
  }

  const event = await loadEventContext(auth.serviceConfig, parsedParams.data.id);
  if (!event) return jsonError("Unable to load event.", 502);

  if (parsedWorkflow?.success) {
    return handleOrganizerImportWorkflow(auth, event, parsedWorkflow.data);
  }

  if (!parsedBody?.success) return jsonError("Invalid import request.", 400);

  try {
    const temporaryDocuments = await loadTemporaryOrganizerImportDocuments(
      auth.serviceConfig,
      auth.user.id,
      temporaryDocumentReferences
    );
    const sourceDocuments = [
      ...previewRequest.documents.map((document, index) => ({ document, sourceId: `document:${index}:${document.name}` })),
      ...temporaryDocuments,
    ];
    let preview = emptyWebsitePreview();
    let websiteImportWarning: string | null = null;
    if (parsedBody.data.url) {
      try {
        preview = await buildOrganizerWebsiteImportPreview(parsedBody.data.url, { formatUrls: parsedBody.data.formatUrls });
      } catch (websiteError) {
        if (sourceDocuments.length === 0) throw websiteError;
        console.error("Unable to preview organizer website import; continuing with supplied documents", websiteError);
        websiteImportWarning = "Le site n'a pas pu être analysé, mais les documents fournis restent disponibles pour la vérification.";
      }
    }
    if (!parsedBody.data.url && (sourceDocuments.length > 0 || parsedBody.data.action === "apply")) {
      preview = buildDocumentOnlyPreview(event);
    }
    const previewHash = computeOrganizerWebsiteImportPreviewHash(preview);
    let augmentedPreview = buildAugmentedPreview(preview, event);

    if (parsedBody.data.action === "preview") {
      const scopedEventRaces = getEventRacesForEdition(event, preview.event.raceDate ?? event.race_date);
      const formatCandidates = [
        ...scopedEventRaces.map((race) => ({
          name: race.name,
          distanceKm: race.distance_km,
          elevationGainM: race.elevation_gain_m,
          elevationLossM: race.elevation_loss_m ?? null,
          startTime: parseOrganizerRaceDetails(race.organizer_details).schedule.startTime,
          bibPickup: parseOrganizerRaceDetails(race.organizer_details).bibPickup.locations.map((location) => location.location ?? "").join(" ") || parseOrganizerRaceDetails(race.organizer_details).bibPickup.schedule,
          cutoff: parseOrganizerRaceDetails(race.organizer_details).schedule.finishCutoffTime,
        })),
        ...preview.races.map((race) => ({
          name: race.name,
          distanceKm: race.distanceKm,
          elevationGainM: race.elevationGainM,
          elevationLossM: race.elevationLossM,
        })),
      ];
      const formatNames = formatCandidates.map((race) => race.name);
      const documents = await Promise.all(
        sourceDocuments.map(async ({ document: file, sourceId }) => {
          const document = await extractOrganizerDocument(file, sourceId);
          const findings = attachDocumentFindingsToFormats(document.findings, formatNames);
          return { ...document, findings: reconcileOrganizerDocumentFindings(findings, formatCandidates) };
        })
      );
      const documentWarnings = documents.map((document) =>
        document.status === "extracted"
          ? `Document analysé : ${document.fileName} (${document.pageCount ?? 0} page(s), texte extrait).`
          : `${document.fileName} : ${document.message ?? "Document en attente d'extraction."}`
      );
      let reconciliationStatus: "completed" | "unavailable" | "failed" = "unavailable";
      let reconciliationMessage = "OPENAI_API_KEY n'est pas configurée : aucun rapprochement LLM n'a été exécuté.";
      let reconciliation = null;
      try {
        reconciliation = await reconcileOrganizerImportWithLlm({
          preview,
          existingRaces: scopedEventRaces.map((race) => ({
            id: race.id,
            name: race.name,
            seriesName: race.series_name,
            raceDate: race.race_date ?? null,
            distanceKm: race.distance_km,
            elevationGainM: race.elevation_gain_m,
            elevationLossM: race.elevation_loss_m ?? null,
          })),
          documents: documents.map((document) => ({ fileName: document.fileName, text: document.text })),
        });
        if (reconciliation) {
          reconciliationStatus = "completed";
          reconciliationMessage = "Réconciliation LLM terminée. Vérifie les changements proposés avant d'appliquer l'import.";
        }
      } catch (reconciliationError) {
        console.error("Organizer import LLM reconciliation unavailable", reconciliationError);
        reconciliationStatus = "failed";
        reconciliationMessage =
          reconciliationError instanceof OrganizerImportReconciliationError
            ? reconciliationError.message
            : "La réconciliation LLM a échoué. Les données extraites restent disponibles sans proposition de rapprochement.";
      }
      if (reconciliation) {
        const highConfidenceMatches = new Map(
          reconciliation.raceMatches
            .filter((match) => match.decision === "match" && match.confidence === "high" && match.targetRaceId)
            .map((match) => [match.previewRaceKey, match.targetRaceId])
        );
        augmentedPreview = {
          ...augmentedPreview,
          races: augmentedPreview.races.map((race) => ({
            ...race,
            suggestedTargetRaceId: highConfidenceMatches.get(race.key) ?? race.suggestedTargetRaceId,
          })),
        };
      }
      const proposalSnapshot = proposalSnapshotSchema.parse({
        version: 1,
        eventId: event.id,
        previewHash,
        expiresAt: new Date(Date.now() + PROPOSAL_SNAPSHOT_TTL_MS).toISOString(),
        proposals: buildOrganizerImportProposals(preview, event, documents, reconciliation),
      }) as OrganizerImportProposalSnapshot;
      const proposalSignature = signProposalSnapshot(
        proposalSnapshot,
        auth.serviceConfig.supabaseServiceRoleKey
      );
      return withSecurityHeaders(
        NextResponse.json({
          preview: {
            ...augmentedPreview,
            warnings: [
              ...augmentedPreview.warnings,
              ...(websiteImportWarning ? [websiteImportWarning] : []),
              ...(reconciliation ? [`Réconciliation LLM : ${reconciliation.summary}`, ...reconciliation.warnings] : [reconciliationMessage]),
              ...documentWarnings,
            ],
            documents: documents.map(({ text: _text, ...document }) => document),
            reconciliation: reconciliation
              ? { ...reconciliation, status: reconciliationStatus, message: reconciliationMessage }
              : { status: reconciliationStatus, message: reconciliationMessage, summary: "Aucune proposition de rapprochement.", warnings: [], raceMatches: [] },
            previewHash,
            proposalSnapshot,
            proposalSignature,
          },
        })
      );
    }

    const parsedSnapshot = proposalSnapshotSchema.safeParse(parsedBody.data.proposalSnapshot);
    if (!parsedSnapshot.success) return jsonError("Le snapshot de revue est invalide. Relance l'analyse.", 409);
    const proposalSnapshot = parsedSnapshot.data as OrganizerImportProposalSnapshot;
    if (
      proposalSnapshot.eventId !== event.id ||
      proposalSnapshot.previewHash !== parsedBody.data.previewHash ||
      Date.parse(proposalSnapshot.expiresAt) <= Date.now() ||
      !verifyProposalSnapshot(
        proposalSnapshot,
        parsedBody.data.proposalSignature,
        auth.serviceConfig.supabaseServiceRoleKey
      )
    ) {
      return jsonError("La revue signée a expiré ou a été modifiée. Relance l'analyse.", 409);
    }

    if (previewHash !== parsedBody.data.previewHash) {
      return jsonError("The preview is outdated. Run the analysis again before applying.", 409);
    }

    const proposalById = new Map(proposalSnapshot.proposals.map((proposal) => [proposal.id, proposal]));
    const selectedEventProposals = parsedBody.data.selectedEventProposalIds.map((id) => proposalById.get(id)).filter(
      (proposal): proposal is OrganizerImportFieldProposal => Boolean(proposal?.scope === "event")
    );
    if (selectedEventProposals.length !== parsedBody.data.selectedEventProposalIds.length) {
      return jsonError("Une proposition événement est inconnue.", 409);
    }
    const eventFieldKeys = selectedEventProposals.map((proposal) => proposal.field);
    if (new Set(eventFieldKeys).size !== eventFieldKeys.length) {
      return jsonError("Sélectionne au maximum une proposition par champ événement.", 400);
    }

    const previewRaceMap = new Map(preview.races.map((race) => [race.key, race]));
    const eventRaceMap = new Map((event.races ?? []).map((race) => [race.id, race]));
    const actionableSelections = parsedBody.data.raceSelections.filter((selection) => selection.mode !== "ignore");
    const selectedPreviewKeys = actionableSelections.map((selection) => selection.previewRaceKey);
    if (new Set(selectedPreviewKeys).size !== selectedPreviewKeys.length) {
      return jsonError("Un format de la revue ne peut être appliqué qu'une fois.", 400);
    }
    const selectedUpdateTargets = actionableSelections
      .filter((selection) => selection.mode === "update")
      .map((selection) => selection.targetRaceId)
      .filter((target): target is string => Boolean(target));
    if (new Set(selectedUpdateTargets).size !== selectedUpdateTargets.length) {
      return jsonError("Un format existant ne peut être ciblé qu'une fois.", 400);
    }
    const eventPreview = parsedBody.data.eventRaceDate
      ? { ...preview, event: { ...preview.event, raceDate: parsedBody.data.eventRaceDate } }
      : preview;
    const targetEventDate = eventPreview.event.raceDate ?? event.race_date ?? null;
    const targetEditionYear = getEditionYear(targetEventDate);
    const hasEventUpdate = selectedEventProposals.length > 0 || Boolean(parsedBody.data.eventRaceDate?.trim());

    if (!hasEventUpdate && actionableSelections.length === 0) {
      return jsonError("No applicable changes selected.", 400);
    }

    if (!targetEventDate) return jsonError("Ajoute une date d'édition avant l'import.", 409);
    const existingTargetEdition = (event.race_event_editions ?? []).find((edition) => String(edition.edition_year) === targetEditionYear) ?? null;
    const targetEdition = await ensureEventEdition(
      auth.serviceConfig,
      event,
      targetEventDate,
      parsedBody.data.eventEditionEndDate ?? existingTargetEdition?.end_date ?? targetEventDate
    );
    if (!targetEdition) return jsonError("Unable to persist event edition.", 502);

    await updateEventFromPreview(auth.serviceConfig, event, selectedEventProposals);

    let createdRaces = 0;
    let updatedRaces = 0;
    let gpxUploads = 0;
    let hydratedAidStations = 0;

    for (const selection of actionableSelections) {
      const previewRace = previewRaceMap.get(selection.previewRaceKey);
      if (!previewRace) return jsonError("Incoherent preview selection.", 409);
      if (previewRace.assessment && previewRace.assessment.score < MIN_ACTIONABLE_WEBSITE_IMPORT_SCORE) {
        return jsonError("This format score is too low to import. Analyse a more specific format page.", 400);
      }

      const selectedRaceProposals = selection.selectedProposalIds.map((id) => proposalById.get(id)).filter(
        (proposal): proposal is OrganizerImportFieldProposal =>
          Boolean(proposal?.scope === "format" && proposal.previewRaceKey === selection.previewRaceKey)
      );
      if (selectedRaceProposals.length !== selection.selectedProposalIds.length) {
        return jsonError("Une proposition de format est inconnue.", 409);
      }
      const selectedFieldKeys = selectedRaceProposals.map((proposal) => proposal.field);
      if (new Set(selectedFieldKeys).size !== selectedFieldKeys.length) {
        return jsonError("Sélectionne au maximum une proposition par champ de format.", 400);
      }
      if (selectedRaceProposals.length === 0) {
        return jsonError("Sélectionne au moins un champ à importer pour ce format.", 400);
      }

      const proposedRace = applyProposalValuesToRace(previewRace, selectedRaceProposals);
      const alignedRace = alignRaceToEventDate(proposedRace, targetEdition.start_date, targetEdition.end_date);
      const existingEdition = findSuggestedRace(alignedRace, event.races ?? [], targetEditionYear, targetEdition.id);
      const seriesReference = findMatchingSeriesRace(alignedRace, event.races ?? []);

      if (selection.mode === "create") {
        if (existingEdition) {
          return jsonError("Ce format existe déjà dans l'édition. Choisis explicitement « Mettre à jour ».", 409);
        }
        const result = await createRaceFromPreview(
          auth.serviceConfig,
          parsedParams.data.id,
          alignedRace,
          selectedRaceProposals,
          seriesReference?.edition_group_id ?? null,
          targetEdition.id
        );
        createdRaces += 1;
        gpxUploads += result.gpxUploaded ? 1 : 0;
        hydratedAidStations += result.createdAidStations;
        continue;
      }

      const selectedTargetRace = selection.targetRaceId ? eventRaceMap.get(selection.targetRaceId) ?? null : null;
      const targetRaceIsInEdition = selectedTargetRace && (
        selectedTargetRace.edition_id === targetEdition.id ||
        (!selectedTargetRace.edition_id && getEditionYear(selectedTargetRace.race_date) === targetEditionYear)
      );
      if (!selectedTargetRace || !targetRaceIsInEdition) {
        return jsonError("La cible de mise à jour doit appartenir à l'édition sélectionnée.", 409);
      }
      const result = await updateRaceFromPreview(
        auth.serviceConfig,
        selectedTargetRace,
        alignedRace,
        selectedRaceProposals,
        targetEdition.id
      );
      updatedRaces += 1;
      gpxUploads += result.gpxUploaded ? 1 : 0;
      hydratedAidStations += result.createdAidStations;
    }

    return withSecurityHeaders(
      NextResponse.json({
        applied: {
          eventUpdated: true,
          createdRaces,
          updatedRaces,
          gpxUploads,
          hydratedAidStations,
        },
      })
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Invalid website import payload.", 400);
    }
    if (error instanceof Error && "code" in error) {
      const code = (error as { code?: string }).code;
      const status =
        code === "INVALID_URL"
          ? 400
          : code === "AUTH_REQUIRED"
            ? 403
            : code === "AUTH_FAILED"
              ? 401
              : code === "FETCH_FAILED"
                ? 502
                : 422;
      return jsonError(error.message, status);
    }
    console.error("Unexpected organizer website import error", error);
    return jsonError("Unable to import this website.", 500);
  } finally {
    await deleteTemporaryOrganizerImportDocuments(auth.serviceConfig, auth.user.id, temporaryDocumentReferences);
  }
}
