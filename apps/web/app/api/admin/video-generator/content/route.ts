import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest } from "next/server";
import { z as z4 } from "zod/v4";

import {
  checkUnprovidedNumbers,
  collectAllowedNumbers,
  REEL_CAPTION_MAX_CHARS,
  REEL_COVER_TEXT_MAX_WORDS,
  REEL_HOOK_MAX_WORDS,
  REEL_MAX_HASHTAGS,
  REEL_MIN_HASHTAGS,
  sanitizeReelContent,
} from "../../../../../lib/reel-content";
import { NARRATION_STYLES, reelContentRequestSchema } from "../../../../../lib/video-narration";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import {
  allocateHighlightWords,
  buildSystemPrompt,
  DEFAULT_WORDS_PER_SECOND,
  OPENINGS,
  pick,
} from "../../../../../lib/video-script-prompt";

// Room for a draft and one low-effort revision.
export const maxDuration = 120;

const CONTENT_PROMPT = `

FORMAT DE SORTIE : cette fois tu ne renvoies pas seulement les narrations, mais tout le texte du reel en un seul objet JSON. Ce format remplace la dernière phrase des règles ci-dessus.
- hook : l'accroche des 2 premières secondes, ${REEL_HOOK_MAX_WORDS} mots au plus, une question ou une affirmation forte, dite sous chiffreChoc et nomCourt : n'y répète pas le nom de la course et ne cite aucun chiffre absent des données ;
- script_segments : une entrée par id reçu (hl-intro, chaque temps fort, hl-outro), avec highlight_id et text, dans l'ordre, chaque text dans ses minWords / maxWords. Le text de hl-intro COMMENCE par le hook, mot pour mot, puis éventuellement quelques mots ;
- cta : la phrase de fin dite à voix haute, celle de hl-outro : le plan de course de cette course est prêt dans l'appli Pace Yourself, lien en bio ;
- caption : la description Instagram, ton sobre et crédible, sans exagération ni emoji en rafale : 2 à 4 phrases (la course, ce qui compte dans le parcours, un conseil) puis un appel à l'action vers le plan de course dans l'appli Pace Yourself (lien en bio) ; au plus ${REEL_CAPTION_MAX_CHARS} caractères, sans hashtags dans le texte. Parle de « livret coureur » ou de « plan de course », jamais de promesse de performance ;
- hashtags : ${REEL_MIN_HASHTAGS} à ${REEL_MAX_HASHTAGS}, en minuscules, sans accents, espaces ni #, mélange de hashtags de niche (le nom de la course, nomCourt) et de hashtags trail génériques (trail, trailrunning, ultratrail…), et paceyourself ;
- cover_text : le texte de couverture, ${REEL_COVER_TEXT_MAX_WORDS} mots au plus.

RÈGLE ABSOLUE sur les chiffres, dans TOUS les champs : n'écris que des nombres présents dans les données reçues (course, chiffreChoc, troncons, ravitos), tels quels (même arrondi, même unité). Aucun chiffre calculé, estimé, déduit ou arrondi autrement. Sans chiffre fourni pour une idée, formule-la sans chiffre.`;

const contentOutputSchema = z4.object({
  hook: z4.string(),
  script_segments: z4.array(z4.object({ highlight_id: z4.string(), text: z4.string() })),
  cta: z4.string(),
  caption: z4.string(),
  hashtags: z4.array(z4.string()),
  cover_text: z4.string(),
});

/** One call for all the text of a highlights reel; limits and invented figures are checked here. */
export async function POST(request: NextRequest) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  if (!process.env.ANTHROPIC_API_KEY) {
    return renderJsonError("La rédaction par IA n’est pas configurée : ajoutez ANTHROPIC_API_KEY côté serveur.", 503);
  }

  const parsed = reelContentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error("Reel content request rejected", parsed.error.issues.slice(0, 5));
    return renderJsonError(`Requête de contenu invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }
  const { race, beats, targetSeconds, voiceModel, wordsPerSecond, notes, shortName, shockFigure, aidStations } = parsed.data;
  const maxWords = allocateHighlightWords(beats, targetSeconds, wordsPerSecond ?? DEFAULT_WORDS_PER_SECOND);
  const budgets = beats.map((beat, index) => ({ id: beat.id, maxWords: maxWords[index] }));
  const style = parsed.data.style ?? pick(NARRATION_STYLES);
  const system = `${buildSystemPrompt(style, pick(OPENINGS), voiceModel, "highlights")}${CONTENT_PROMPT}`;
  const allowedNumbers = collectAllowedNumbers({ race, beats, shortName, shockFigure, aidStations });

  const input = {
    course: race,
    ...(shortName ? { nomCourt: shortName } : {}),
    ...(shockFigure ? { chiffreChoc: shockFigure } : {}),
    ...(notes?.trim() ? { consignes: notes.trim() } : {}),
    dureeVideoCibleSecondes: targetSeconds,
    ravitos: aidStations.map((station) => ({ nom: station.name, km: station.km, barriereHoraire: station.cutoffTime })),
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
      minWords: Math.max(4, Math.round(maxWords[index] * 0.85)),
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
    output_config: { effort, format: betaZodOutputFormat(contentOutputSchema) },
    system,
    messages,
  });
  const check = (output: z4.infer<typeof contentOutputSchema>) => {
    const sanitized = sanitizeReelContent(output, budgets);
    return { content: sanitized.content, problems: [...sanitized.problems, ...checkUnprovidedNumbers(sanitized.content, allowedNumbers)] };
  };

  try {
    const firstMessages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: `Voici la course et ses temps forts, au format JSON :\n${JSON.stringify(input, null, 2)}` },
    ];
    const response = await askClaude(firstMessages, "medium");
    if (response.stop_reason === "refusal") return renderJsonError("La rédaction a été refusée par le modèle.", 502);
    if (!response.parsed_output) return renderJsonError("Le contenu reçu est incomplet, réessayez.", 502);

    let result = check(response.parsed_output);
    // One quick revision for a broken limit or a figure that is not in the data. Its failure keeps the draft.
    if (result.problems.length) {
      const revision = await askClaude([
        ...firstMessages,
        { role: "assistant", content: JSON.stringify(response.parsed_output) },
        {
          role: "user",
          content: `Corrige uniquement ces points, en gardant le ton, l'ordre et les faits : ${result.problems.map((problem) => problem.message).join(" ")} Rappel : seuls les chiffres des données reçues sont permis ; reformule sans chiffre plutôt que d'en inventer. Renvoie l'objet complet, le reste inchangé.`,
        },
      ], "low").catch((error: unknown) => {
        console.error("Reel content revision failed", error instanceof Error ? error.message : error);
        return null;
      });
      if (revision && revision.stop_reason !== "refusal" && revision.parsed_output) {
        const revised = check(revision.parsed_output);
        // A revision that is worse than the draft is not kept.
        if (revised.problems.length <= result.problems.length) result = revised;
      }
    }

    return renderJson({ content: result.content, warnings: result.problems, style });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return renderJsonError("Trop de demandes, réessayez dans un instant.", 429);
    if (error instanceof Error && /structured output|JSON/i.test(error.message)) {
      console.error("Reel content cut short", error.message);
      return renderJsonError("Le contenu a été coupé avant la fin, réessayez.", 502);
    }
    if (error instanceof Anthropic.AuthenticationError) return renderJsonError("La clé Anthropic est refusée.", 502);
    if (error instanceof Anthropic.APIError) {
      console.error("Reel content error", error.status, error.message);
      return renderJsonError("Le service de rédaction est indisponible.", 502);
    }
    console.error("Reel content error", error);
    return renderJsonError("Le contenu n’a pas pu être rédigé.", 500);
  }
}
