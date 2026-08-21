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
            "Tu reconcilies des informations de courses trail. Tu ne dois jamais inventer une valeur ni fusionner deux formats par seule proximite de distance. Propose un match uniquement lorsque les preuves fournies sont compatibles (nom, date, distance, denivele, horaires ou source). Pour chaque format importe, retourne un objet JSON avec summary, warnings et raceMatches. Une decision match doit utiliser uniquement un targetRaceId existant; sinon utilise separate ou uncertain. Cite les elements fournis dans evidence et explique toute ambiguite.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Organizer import LLM reconciliation failed", response.status, await response.text());
    throw new Error("La réconciliation LLM est indisponible.");
  }

  const body = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string | null } }> } | null;
  const content = body?.choices?.[0]?.message?.content;
  if (!content) throw new Error("La réconciliation LLM n'a retourné aucune proposition.");

  const parsed = reconciliationSchema.safeParse(JSON.parse(content));
  if (!parsed.success) {
    console.error("Invalid organizer import LLM reconciliation", parsed.error.flatten());
    throw new Error("La réponse de réconciliation LLM est invalide.");
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