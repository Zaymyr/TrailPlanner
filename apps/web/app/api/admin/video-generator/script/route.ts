import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z as z4 } from "zod/v4";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { NARRATION_STYLES, narrationScriptRequestSchema } from "../../../../../lib/video-narration";
import {
  allocateHighlightWords,
  allocateWords,
  buildSystemPrompt,
  countWords,
  DEFAULT_WORDS_PER_SECOND,
  OPENINGS,
  OVER_BUDGET_TOLERANCE,
  pick,
} from "../../../../../lib/video-script-prompt";

// Room for a draft and, when it runs over its word budget, a quick revision.
export const maxDuration = 120;

const scriptOutputSchema = z4.object({
  beats: z4.array(z4.object({ id: z4.string(), narration: z4.string() })),
});

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

export async function POST(request: NextRequest) {
  const supabaseAnon = getSupabaseAnonConfig();
  if (!supabaseAnon) return jsonError("Supabase configuration is missing.", 500);

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token) return jsonError("Missing access token.", 401);
  const user = await fetchSupabaseUser(token, supabaseAnon);
  if (!user?.id) return jsonError("Invalid session.", 401);
  if (!isAdminUser(user)) return jsonError("Not authorized.", 403);

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("La rédaction par IA n’est pas configurée : ajoutez ANTHROPIC_API_KEY côté serveur.", 503);
  }

  const parsed = narrationScriptRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Admin-only route: naming the offending field makes a limit or data problem diagnosable.
    const issue = parsed.error.issues[0];
    console.error("Video narration script request rejected", parsed.error.issues.slice(0, 5));
    return jsonError(`Requête de script invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }
  const { race, beats, targetSeconds, voiceModel, wordsPerSecond, notes, mode } = parsed.data;
  const maxWords = (mode === "highlights" ? allocateHighlightWords : allocateWords)(beats, targetSeconds, wordsPerSecond ?? DEFAULT_WORDS_PER_SECOND);
  const style = parsed.data.style ?? pick(NARRATION_STYLES);
  const system = buildSystemPrompt(style, pick(OPENINGS), voiceModel, mode);

  const input = {
    course: race,
    ...(notes?.trim() ? { consignes: notes.trim() } : {}),
    dureeVideoCibleSecondes: targetSeconds,
    troncons: beats.map((beat, index) => ({
      id: beat.id,
      type: beat.kind,
      titre: beat.title,
      deKm: Number(beat.startKm.toFixed(1)),
      aKm: Number(beat.endKm.toFixed(1)),
      faits: beat.facts,
      servicesAuDebut: beat.services,
      barriereHoraire: beat.cutoffTime,
      brouillon: beat.narration,
      ravitosTraverses: beat.passages.map((passage) => ({ nom: passage.name, km: passage.km, momentDuTroncon: `${Math.round(passage.moment * 100)} %` })),
      minWords: Math.max(mode === "highlights" ? 4 : 5, Math.round(maxWords[index] * 0.85)),
      maxWords: maxWords[index],
    })),
  };

  const client = new Anthropic();
  const askClaude = (messages: Anthropic.Beta.BetaMessageParam[], effort: "low" | "medium") => client.beta.messages.parse({
    model: "claude-opus-5-5",
    // Thinking is always on with this model and counts toward max_tokens: leave room for it,
    // otherwise the JSON is cut mid-string.
    max_tokens: 16_000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(scriptOutputSchema) },
    system,
    messages,
  });
  try {
    const firstMessages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: `Voici le parcours et ses tronçons, au format JSON :\n${JSON.stringify(input, null, 2)}` },
    ];
    const response = await askClaude(firstMessages, "medium");

    if (response.stop_reason === "refusal") return jsonError("La rédaction a été refusée par le modèle.", 502);
    let output = response.parsed_output;
    if (!output) return jsonError("Le script reçu est incomplet, réessayez.", 502);

    // The reel lasts as long as the voice, so a script over its word budget makes the video longer
    // than chosen: one quick revision shortens the legs that overshoot. Its failure keeps the draft.
    const maxById = new Map(beats.map((beat, index) => [beat.id, maxWords[index]]));
    const overBudget = output.beats.flatMap((beat) => {
      const max = maxById.get(beat.id);
      const words = countWords(beat.narration);
      return max !== undefined && words > max * OVER_BUDGET_TOLERANCE ? [{ id: beat.id, words, max }] : [];
    });
    if (overBudget.length) {
      const revision = await askClaude([
        ...firstMessages,
        { role: "assistant", content: JSON.stringify(output) },
        {
          role: "user",
          content: `Trop long : la vidéo dure le temps de ta voix. Raccourcis ces tronçons sous leur maxWords, en gardant le ton, l'ordre et les faits : ${overBudget
            .map((beat) => `${beat.id} (${beat.words} mots, max ${beat.max})`).join(", ")}. Renvoie toutes les narrations, les autres inchangées.`,
        },
      ], "low").catch((error: unknown) => {
        console.error("Video narration script revision failed", error instanceof Error ? error.message : error);
        return null;
      });
      if (revision?.stop_reason !== "refusal" && revision?.parsed_output?.beats.length) output = revision.parsed_output;
    }

    const knownIds = new Set(beats.map((beat) => beat.id));
    const result = output.beats
      .filter((beat) => knownIds.has(beat.id))
      .map((beat) => ({ id: beat.id, narration: beat.narration.trim().slice(0, 600) }))
      .filter((beat) => beat.narration.length > 0);
    return withSecurityHeaders(NextResponse.json({ beats: result, style }));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return jsonError("Trop de demandes, réessayez dans un instant.", 429);
    if (error instanceof Error && /structured output|JSON/i.test(error.message)) {
      console.error("Video narration script cut short", error.message);
      return jsonError("Le script a été coupé avant la fin, réessayez.", 502);
    }
    if (error instanceof Anthropic.AuthenticationError) return jsonError("La clé Anthropic est refusée.", 502);
    if (error instanceof Anthropic.APIError) {
      console.error("Video narration script error", error.status, error.message);
      return jsonError("Le service de rédaction est indisponible.", 502);
    }
    console.error("Video narration script error", error);
    return jsonError("Le script n’a pas pu être rédigé.", 500);
  }
}
