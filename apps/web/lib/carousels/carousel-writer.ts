import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z as z4 } from "zod/v4";

import { countEmojis, findCopiedPhrase, findUnprovidedNumbers, REEL_CAPTION_MAX_EMOJIS, REEL_CAPTION_MIN_EMOJIS } from "../reel-content";
import { normalizeHashtags } from "../social-posts";
import type { CarouselContent } from "./carousel-render";
import { CAROUSEL_SERIES_LABELS, type CarouselSeries, type CarouselSnapshot } from "./carousel-snapshot";

/**
 * Instagram caption of a carousel: one Claude call (same model, fallback and checks as the reel
 * writer, `lib/reel-writer.ts`), then the same guards: no figure absent from the facts
 * (`findUnprovidedNumbers`), no copy of the slide text (`findCopiedPhrase`), 2 to 8 emojis, 3 to 5
 * hashtags; one low-effort revision, the remaining problems kept as warnings.
 */

const MODEL = "claude-opus-5-5";
const MAX_TOKENS = 16_000;
export const CAROUSEL_MIN_HASHTAGS = 3;
export const CAROUSEL_MAX_HASHTAGS = 5;
export const CAROUSEL_CAPTION_MAX_CHARS = 2_200;

const SERIES_BRIEF: Record<CarouselSeries, string> = {
  plan: "« Le plan chiffré » : combien de glucides, d'eau et de sodium par heure selon trois objectifs de temps, et les grammes tronçon par tronçon.",
  brief: "« Le brief » : ce qu'il faut savoir avant la course (barrières horaires ou ravitos, puis le livret coureur ou le plan de course).",
  week: "« La semaine qui vient » : les courses du lundi au dimanche qui arrive.",
};

const systemPrompt = (series: CarouselSeries) => `Tu écris la description Instagram d'un carrousel de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course. Série : ${SERIES_BRIEF[series]}

La description est lue sous les images : elle ne les recopie pas. Ton vivant et complice, tutoiement, vocabulaire trail, jamais vulgaire.
- Première ligne : une accroche avec un emoji (seule visible avant « plus »).
- 2 à 4 phrases courtes qui donnent envie de faire glisser les images et un conseil concret, sans reprendre les phrases des images.
- Une question qui donne envie de répondre en commentaire.
- L'appel à l'action : ton plan de course est dans l'appli Pace Yourself, lien en bio.
- ${REEL_CAPTION_MIN_EMOJIS + 1} à ${REEL_CAPTION_MAX_EMOJIS - 2} emojis pertinents (⛰️ 🏃 🌙 ⏱️ 🥤 🍌 💪 👉…), jamais en rafale. Pas de promesse de performance, pas de conseil médical.
- Au plus ${CAROUSEL_CAPTION_MAX_CHARS} caractères, sans hashtags dans le texte.
Hashtags : ${CAROUSEL_MIN_HASHTAGS} à ${CAROUSEL_MAX_HASHTAGS}, minuscules, sans accents, espaces ni #, dont paceyourself.

RÈGLE ABSOLUE sur les chiffres : n'écris que des nombres présents dans les faits reçus, tels quels (même arrondi, même unité). Aucun chiffre calculé, estimé ou déduit. Sans chiffre fourni, formule sans chiffre.`;

const outputSchema = z4.object({ caption: z4.string(), hashtags: z4.array(z4.string()) });

/** Every text drawn on the slides, for the copy check. */
export const collectSlideTexts = (snapshot: CarouselSnapshot): string[] => {
  if (snapshot.series === "plan") {
    return [snapshot.h1, "Ton objectif change tout.", snapshot.sentence.map((part) => part.text).join(""), "Ton plan exact · lien en bio"];
  }
  if (snapshot.series === "brief") {
    return [snapshot.cover.headline, snapshot.stations.title, snapshot.stations.lead, snapshot.closing.title, snapshot.closing.lead, snapshot.closing.cta];
  }
  return ["Ta course y est ? Ton plan de course en 2 minutes, lien en bio.", snapshot.subtitle];
};

export type CaptionProblems = string[];

/** Problems of a caption draft: invented figures, copied slide text, emojis, hashtags, length. */
export const checkCarouselCaption = (
  output: { caption: string; hashtags: string[] },
  allowed: Array<string | number>,
  slideTexts: string[],
): { caption: string; hashtags: string[]; problems: CaptionProblems } => {
  const caption = output.caption.trim().slice(0, CAROUSEL_CAPTION_MAX_CHARS);
  const hashtags = normalizeHashtags(output.hashtags).slice(0, CAROUSEL_MAX_HASHTAGS);
  const problems: string[] = [];
  const invented = findUnprovidedNumbers(caption, allowed);
  if (invented.length) problems.push(`La description cite des chiffres absents des données : ${invented.join(", ")}.`);
  const copied = findCopiedPhrase(caption, slideTexts);
  if (copied) problems.push(`La description recopie le texte des images (« ${copied} »).`);
  const emojis = countEmojis(caption);
  if (emojis < REEL_CAPTION_MIN_EMOJIS) problems.push(`La description manque d’emojis (${emojis}, au moins ${REEL_CAPTION_MIN_EMOJIS}).`);
  if (emojis > REEL_CAPTION_MAX_EMOJIS) problems.push(`Trop d’emojis (${emojis}, au plus ${REEL_CAPTION_MAX_EMOJIS}).`);
  if (hashtags.length < CAROUSEL_MIN_HASHTAGS) problems.push(`Il faut ${CAROUSEL_MIN_HASHTAGS} à ${CAROUSEL_MAX_HASHTAGS} hashtags (${hashtags.length}).`);
  if (/#[\p{L}\p{N}_]/u.test(caption)) problems.push("Pas de hashtag dans le texte de la description.");
  return { caption: caption.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1").trim(), hashtags, problems };
};

export type CarouselCaptionResult = { ok: true; content: CarouselContent } | { ok: false; message: string };

export const writeCarouselCaption = async ({ series, facts, allowed, snapshot }: {
  series: CarouselSeries;
  facts: Record<string, unknown>;
  allowed: Array<string | number>;
  snapshot: CarouselSnapshot;
}): Promise<CarouselCaptionResult> => {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, message: "La rédaction par IA n’est pas configurée : ajoutez ANTHROPIC_API_KEY côté serveur." };
  const slideTexts = collectSlideTexts(snapshot);
  const client = new Anthropic();
  const ask = (messages: Anthropic.Beta.BetaMessageParam[], effort: "low" | "medium") => client.beta.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort, format: betaZodOutputFormat(outputSchema) },
    system: systemPrompt(series),
    messages,
  });
  try {
    const first: Anthropic.Beta.BetaMessageParam[] = [{
      role: "user",
      content: `Carrousel ${CAROUSEL_SERIES_LABELS[series]}. Faits, au format JSON :\n${JSON.stringify(facts, null, 2)}\n\nTexte déjà écrit sur les images (ne le recopie pas) :\n${slideTexts.map((text) => `- ${text}`).join("\n")}`,
    }];
    const response = await ask(first, "medium");
    if (response.stop_reason === "refusal" || !response.parsed_output) return { ok: false, message: "La description n’a pas pu être rédigée." };
    let result = checkCarouselCaption(response.parsed_output, allowed, slideTexts);
    if (result.problems.length) {
      const revision = await ask([
        ...first,
        { role: "assistant", content: JSON.stringify(response.parsed_output) },
        { role: "user", content: `Corrige uniquement ces points, en gardant le ton et les faits : ${result.problems.join(" ")} Renvoie l'objet complet.` },
      ], "low").catch(() => null);
      if (revision && revision.stop_reason !== "refusal" && revision.parsed_output) {
        const revised = checkCarouselCaption(revision.parsed_output, allowed, slideTexts);
        if (revised.problems.length <= result.problems.length) result = revised;
      }
    }
    return { ok: true, content: { caption: result.caption, hashtags: result.hashtags, warnings: result.problems } };
  } catch (error) {
    console.error("Carousel caption error", error instanceof Error ? error.message : error);
    return { ok: false, message: error instanceof Anthropic.RateLimitError ? "Trop de demandes, réessayez dans un instant." : "Le service de rédaction est indisponible." };
  }
};
