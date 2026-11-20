import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z as z4 } from "zod/v4";

import {
  checkUnprovidedNumbers,
  collectAllowedNumbers,
  REEL_CAPTION_MAX_CHARS,
  REEL_CAPTION_MAX_EMOJIS,
  REEL_CAPTION_MIN_EMOJIS,
  REEL_COVER_TEXT_MAX_WORDS,
  REEL_HOOK_MAX_WORDS,
  REEL_MAX_HASHTAGS,
  REEL_MIN_HASHTAGS,
  sanitizeReelContent,
  type ReelContent,
  type ReelContentWarning,
} from "./reel-content";
import {
  INSTAGRAM_CAPTION_MAX_CHARS,
  INSTAGRAM_MAX_HASHTAGS,
  NARRATION_STYLES,
  type InstagramCaptionRequest,
  type NarrationScriptRequest,
  type NarrationStyle,
  type ReelContentRequest,
} from "./video-narration";
import {
  allocateHighlightWords,
  allocateWords,
  buildSystemPrompt,
  countWords,
  DEFAULT_WORDS_PER_SECOND,
  OPENINGS,
  OVER_BUDGET_TOLERANCE,
  pick,
} from "./video-script-prompt";

/**
 * Server cores of the AI writer routes (`/content`, `/script`, `/caption`), shared with the
 * automatic reel pipeline. Each returns either its result or the message and HTTP status the
 * route answers with, so the routes keep their exact behaviour.
 */
export type WriterResult<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

export const WRITER_NOT_CONFIGURED = "La rédaction par IA n’est pas configurée : ajoutez ANTHROPIC_API_KEY côté serveur.";

const MODEL = "claude-opus-5-5";
// Thinking is always on with this model and counts toward max_tokens: leave room for it,
// otherwise the JSON is cut mid-string.
const MAX_TOKENS = 16_000;

const fail = (status: number, message: string): WriterResult<never> => ({ ok: false, status, message });

/** Anthropic and parsing errors, as the routes reported them. */
const describeWriterError = (error: unknown, labels: { logLabel: string; cutShort: string; fallback: string; authMessage?: boolean }): WriterResult<never> => {
  if (error instanceof Anthropic.RateLimitError) return fail(429, "Trop de demandes, réessayez dans un instant.");
  if (error instanceof Error && /structured output|JSON/i.test(error.message)) {
    console.error(`${labels.logLabel} cut short`, error.message);
    return fail(502, labels.cutShort);
  }
  if (labels.authMessage !== false && error instanceof Anthropic.AuthenticationError) return fail(502, "La clé Anthropic est refusée.");
  if (error instanceof Anthropic.APIError) {
    console.error(`${labels.logLabel} error`, error.status, error.message);
    return fail(502, "Le service de rédaction est indisponible.");
  }
  console.error(`${labels.logLabel} error`, error);
  return fail(500, labels.fallback);
};

// -- Highlights reel content (one call) --------------------------------------------------------

const CONTENT_PROMPT = `

FORMAT DE SORTIE : cette fois tu ne renvoies pas seulement les narrations, mais tout le texte du reel en un seul objet JSON. Ce format remplace la dernière phrase des règles ci-dessus.
- hook : l'accroche des 2 premières secondes, ${REEL_HOOK_MAX_WORDS} mots au plus, une question ou une affirmation forte, dite sous chiffreChoc et nomCourt : n'y répète pas le nom de la course et ne cite aucun chiffre absent des données ;
- script_segments : une entrée par id reçu (hl-intro, chaque temps fort, hl-outro), avec highlight_id et text, dans l'ordre, chaque text dans ses minWords / maxWords. Le text de hl-intro COMMENCE par le hook, mot pour mot, puis éventuellement quelques mots ;
- cta : la phrase de fin dite à voix haute, celle de hl-outro : le plan de course de cette course est prêt dans l'appli Pace Yourself, lien en bio ;
- caption : la description Instagram, lue sous le reel. Ce n'est PAS la voix off : ne reprends aucune phrase du script, écris un autre texte, dans le même ton et le même style que la vidéo (vivant, complice, tutoiement, vocabulaire trail). Structure, en lignes courtes séparées par des retours à la ligne : une première ligne qui accroche, avec un emoji ; 2 à 4 phrases courtes sur ce qui rend cette course particulière et un conseil concret ; une question qui donne envie de répondre en commentaire ; puis l'appel à l'action : ton plan de course pour cette course est prêt dans l'appli Pace Yourself, lien en bio. Mets ${REEL_CAPTION_MIN_EMOJIS + 1} à ${REEL_CAPTION_MAX_EMOJIS - 2} emojis pertinents (⛰️ 🏃 🌙 🔦 ⏱️ 🥤 💪 👆…), en début ou fin de ligne, jamais en rafale. Parle de « livret coureur » ou de « plan de course », jamais de promesse de performance ; au plus ${REEL_CAPTION_MAX_CHARS} caractères, sans hashtags dans le texte ;
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

export type ReelContentResult = { content: ReelContent; warnings: ReelContentWarning[]; style: NarrationStyle };

/** One call for all the text of a highlights reel; limits and invented figures are checked here. */
export const writeReelContent = async (request: ReelContentRequest): Promise<WriterResult<ReelContentResult>> => {
  const { race, beats, targetSeconds, voiceModel, wordsPerSecond, notes, shortName, shockFigure, aidStations } = request;
  const maxWords = allocateHighlightWords(beats, targetSeconds, wordsPerSecond ?? DEFAULT_WORDS_PER_SECOND);
  const budgets = beats.map((beat, index) => ({ id: beat.id, maxWords: maxWords[index] }));
  const style = request.style ?? pick(NARRATION_STYLES);
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
    model: MODEL,
    max_tokens: MAX_TOKENS,
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
    if (response.stop_reason === "refusal") return fail(502, "La rédaction a été refusée par le modèle.");
    if (!response.parsed_output) return fail(502, "Le contenu reçu est incomplet, réessayez.");

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

    return { ok: true, value: { content: result.content, warnings: result.problems, style } };
  } catch (error) {
    return describeWriterError(error, { logLabel: "Reel content", cutShort: "Le contenu a été coupé avant la fin, réessayez.", fallback: "Le contenu n’a pas pu être rédigé." });
  }
};

// -- Full narration script -----------------------------------------------------------------------

const scriptOutputSchema = z4.object({
  beats: z4.array(z4.object({ id: z4.string(), narration: z4.string() })),
});

export type NarrationScriptResult = { beats: Array<{ id: string; narration: string }>; style: NarrationStyle };

/** The narration of every beat (full or highlights), shortened once when it runs over its word budget. */
export const writeNarrationScript = async (request: NarrationScriptRequest): Promise<WriterResult<NarrationScriptResult>> => {
  const { race, beats, targetSeconds, voiceModel, wordsPerSecond, notes, mode } = request;
  const maxWords = (mode === "highlights" ? allocateHighlightWords : allocateWords)(beats, targetSeconds, wordsPerSecond ?? DEFAULT_WORDS_PER_SECOND);
  const style = request.style ?? pick(NARRATION_STYLES);
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
    model: MODEL,
    max_tokens: MAX_TOKENS,
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

    if (response.stop_reason === "refusal") return fail(502, "La rédaction a été refusée par le modèle.");
    let output = response.parsed_output;
    if (!output) return fail(502, "Le script reçu est incomplet, réessayez.");

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
    return { ok: true, value: { beats: result, style } };
  } catch (error) {
    return describeWriterError(error, { logLabel: "Video narration script", cutShort: "Le script a été coupé avant la fin, réessayez.", fallback: "Le script n’a pas pu être rédigé." });
  }
};

// -- Instagram caption (full reels) --------------------------------------------------------------

const CAPTION_SYSTEM_PROMPT = `Tu écris la description Instagram des reels de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course. Le reel survole le parcours d'une course en 3D avec une voix off.

La description raconte une petite histoire de la course, sur le ton d'un pote traileur : décontracté, complice, vocabulaire du trail, jamais vulgaire.
- Première ligne : une accroche forte qui donne envie de regarder (c'est la seule visible avant « plus »).
- Puis 3 à 6 lignes courtes : la course (nom, distance, dénivelé, lieu et date si fournis), les moments clés du parcours (grosses montées, sommets, base de vie, barrières), un conseil de gestion.
- Termine par un appel à l'action : prépare ton plan de course avec l'appli Pace Yourself (lien en bio), dispo sur iPhone et Android, et une question pour faire réagir en commentaire.
- Quelques emojis bien choisis (⛰️ 🏃 ⏱️ 💧…), pas plus d'un par ligne, sauts de ligne entre les blocs.
- N'invente rien : uniquement les faits fournis.
- 500 à 1 200 caractères, sans hashtags dans le texte.

Hashtags : 3 à 5 (Instagram n'en accepte pas plus), en minuscules, sans accents ni espaces, sans le #. Choisis les plus utiles : le nom de la course, un ou deux hashtags trail génériques (trail, trailrunning, ultratrail…) et paceyourself.`;

const captionOutputSchema = z4.object({
  caption: z4.string(),
  hashtags: z4.array(z4.string()),
});

/** Keeps hashtags Instagram accepts: letters, digits and underscores, unique, 5 at most. */
const cleanHashtags = (hashtags: string[]) => {
  const seen = new Set<string>();
  return hashtags
    .map((tag) => tag.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter((tag) => tag.length > 1 && !seen.has(tag) && Boolean(seen.add(tag)))
    .slice(0, INSTAGRAM_MAX_HASHTAGS);
};

export type InstagramCaptionResult = { caption: string; hashtags: string[] };

export const writeInstagramCaption = async (request: InstagramCaptionRequest): Promise<WriterResult<InstagramCaptionResult>> => {
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(captionOutputSchema) },
      system: CAPTION_SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Voici la course et le récit du reel (tronçon par tronçon), au format JSON :\n${JSON.stringify(request, null, 2)}`,
      }],
    });

    if (response.stop_reason === "refusal") return fail(502, "La rédaction a été refusée par le modèle.");
    const output = response.parsed_output;
    if (!output) return fail(502, "La description reçue est incomplète, réessayez.");
    return { ok: true, value: { caption: output.caption.trim().slice(0, INSTAGRAM_CAPTION_MAX_CHARS), hashtags: cleanHashtags(output.hashtags) } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return fail(429, "Trop de demandes, réessayez dans un instant.");
    if (error instanceof Error && /structured output|JSON/i.test(error.message)) return fail(502, "La description a été coupée avant la fin, réessayez.");
    if (error instanceof Anthropic.APIError) {
      console.error("Instagram caption error", error.status, error.message);
      return fail(502, "Le service de rédaction est indisponible.");
    }
    console.error("Instagram caption error", error);
    return fail(500, "La description n’a pas pu être rédigée.");
  }
};
