import "server-only";

import { z } from "zod";

import type { OrganizerWebsiteImportPreview } from "./organizer-website-import";

const reconciliationSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  raceMatches: z
    .array(
      z.object({
        previewRaceKey: z.string().trim().min(1),
        targetRaceId: z.string().uuid().nullable(),
        decision: z.enum(["match", "separate", "uncertain"]),
        confidence: z.enum(["high", "medium", "low"]),
        rationale: z.string().trim().min(1).max(1_000),
        evidence: z.array(z.string().trim().min(1).max(500)).max(6),
        fieldChanges: z
          .array(
            z.object({
              field: z.string().trim().min(1).max(100),
              importedValue: z.string().trim().min(1).max(500).nullable(),
              currentValue: z.string().trim().min(1).max(500).nullable(),
              action: z.enum(["add", "replace", "keep", "unknown"]),
              rationale: z.string().trim().min(1).max(500),
              evidence: z.array(z.string().trim().min(1).max(500)).max(4),
            })
          )
          .max(12),
      })
    )
    .max(30),
});

export type OrganizerImportReconciliation = z.infer<typeof reconciliationSchema>;

type ReconciliationInput = {
  preview: OrganizerWebsiteImportPreview;
  existingRaces: Array<{
    id: string;
    name: string;
    seriesName: string;
    raceDate: string | null;
    distanceKm: number;
    elevationGainM: number;
    elevationLossM: number | null;
  }>;
  documents: Array<{ fileName: string; text: string | null }>;
};

const MAX_DOCUMENT_TEXT_LENGTH = 16_000;

export class OrganizerImportReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrganizerImportReconciliationError";
  }
}

const getProviderErrorMessage = (status: number, body: unknown) => {
  if (typeof body === "object" && body !== null && "error" in body) {
    const providerError = (body as { error?: { message?: unknown; code?: unknown; type?: unknown } }).error;
    const message = typeof providerError?.message === "string" ? providerError.message : null;
    const code = typeof providerError?.code === "string" ? providerError.code : typeof providerError?.type === "string" ? providerError.type : null;
    if (message) return code ? `${message} (${code})` : message;
  }
  if (status === 401) return "La clé OpenAI est refusée ou expirée.";
  if (status === 429) return "Le quota ou la limite de débit OpenAI est atteint.";
  if (status === 404) return "Le modèle OpenAI configuré est introuvable.";
  return `OpenAI a refusé la demande (HTTP ${status}).`;
};

export async function reconcileOrganizerImportWithLlm(input: ReconciliationInput): Promise<OrganizerImportReconciliation | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const model = process.env.OPENAI_ORGANIZER_IMPORT_MODEL?.trim() || "gpt-4.1-mini";
  const knownRaceIds = new Set(input.existingRaces.map((race) => race.id));
  const payload = {
    importedEvent: input.preview.event,
    importedFormats: input.preview.races.map(({ gpxContent: _gpxContent, aidStations, ...race }) => ({ ...race, aidStations })),
    existingFormats: input.existingRaces,
    roadbooks: input.documents.map((document) => ({
      fileName: document.fileName,
      text: document.text?.slice(0, MAX_DOCUMENT_TEXT_LENGTH) ?? null,
    })),
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Tu reconcilies des informations de courses trail. Tu ne dois jamais inventer une valeur ni fusionner deux formats par seule proximite de distance. Propose un match uniquement lorsque les preuves fournies sont compatibles (nom, date, distance, denivele, horaires ou source). Pour chaque format importe, retourne un objet JSON avec summary, warnings et raceMatches. Chaque raceMatch doit contenir fieldChanges: pour chaque champ pertinent, indique la valeur importee, la valeur actuelle, et action add, replace, keep ou unknown. Une decision match doit utiliser uniquement un targetRaceId existant; sinon utilise separate ou uncertain. Cite les elements fournis dans evidence et explique toute ambiguite.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = getProviderErrorMessage(response.status, errorBody);
    console.error("Organizer import LLM reconciliation failed", response.status, message);
    throw new OrganizerImportReconciliationError(message);
  }

  const body = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }> } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new OrganizerImportReconciliationError("OpenAI n'a retourné aucune proposition.");

  let decoded: unknown;
  try {
    decoded = JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    throw new OrganizerImportReconciliationError("OpenAI a retourné un JSON illisible.");
  }
  const parsed = reconciliationSchema.safeParse(decoded);
  if (!parsed.success) {
    console.error("Invalid organizer import LLM reconciliation", parsed.error.flatten());
    throw new OrganizerImportReconciliationError("OpenAI a retourné une structure de données invalide.");
  }

  return {
    ...parsed.data,
    raceMatches: parsed.data.raceMatches.map((match) =>
      match.targetRaceId && !knownRaceIds.has(match.targetRaceId)
        ? { ...match, targetRaceId: null, decision: "uncertain" as const, confidence: "low" as const }
        : match
    ),
  };
}