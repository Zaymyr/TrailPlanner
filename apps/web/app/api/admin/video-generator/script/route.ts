import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z as z4 } from "zod/v4";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { NARRATION_STYLES, narrationScriptRequestSchema, type NarrationScriptRequest, type NarrationStyle } from "../../../../../lib/video-narration";

// Room for a draft and, when it runs over its word budget, a quick revision.
export const maxDuration = 120;

// Shown words per second of audio until the voice has been measured: tags, pauses and numbers
// read in words make it slower than plain French speech (see speech-rate in the generator).
const DEFAULT_WORDS_PER_SECOND = 2.2;
// Silence the timeline keeps around each narration (NARRATION_GAP_MS in video-composition).
const GAP_SECONDS_PER_BEAT = 0.5;
// A leg this far over its maxWords is sent back for a shorter version.
const OVER_BUDGET_TOLERANCE = 1.1;
// Words as the budget counts them: a performance tag ("[excited]") is not spoken as words.
const countWords = (text: string) => text.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length;
const FIXED_WORDS: Partial<Record<NarrationScriptRequest["beats"][number]["kind"], number>> = {
  intro: 18,
  outro: 12,
};

/**
 * Each leg is on screen for as long as its narration lasts, so its words follow its share of the
 * route (with a floor for short legs): a long stretch gets more to say instead of a silent dash,
 * and the camera keeps a steady pace from one leg to the next.
 */
const allocateWords = (beats: NarrationScriptRequest["beats"], targetSeconds: number, wordsPerSecond: number) => {
  const fixed = beats.reduce((sum, beat) => sum + (FIXED_WORDS[beat.kind] ?? 0), 0);
  const legs = beats.filter((beat) => FIXED_WORDS[beat.kind] === undefined);
  // The video lasts as long as the voice: the words that fill the target once the gaps are out.
  const speakingSeconds = targetSeconds - GAP_SECONDS_PER_BEAT * (beats.length + 2);
  const budget = Math.max(legs.length * 9, Math.round(speakingSeconds * wordsPerSecond) - fixed);
  const totalKm = legs.reduce((sum, beat) => sum + Math.max(0, beat.endKm - beat.startKm), 0);
  return beats.map((beat) => {
    const fixedWords = FIXED_WORDS[beat.kind];
    if (fixedWords !== undefined) return fixedWords;
    const share = totalKm > 0 ? Math.max(0, beat.endKm - beat.startKm) / totalKm : 1 / Math.max(1, legs.length);
    const words = budget * (0.25 / Math.max(1, legs.length) + 0.75 * share);
    return Math.max(9, Math.min(48, Math.round(words)));
  });
};

// Each reel picks a voice persona and an opening, so two races (or two drafts) do not sound alike.
const STYLE_PROMPTS: Record<NarrationStyle, string> = {
  pote: "Tu parles comme un pote traileur qui explique la course à un autre pote, la veille au soir, une bière à la main : décontracté, complice, avec le vocabulaire du trail (ça grimpe sec, ça envoie, ça déroule, relancer, gérer, les cuisses qui chauffent, être dans le dur, taper dans le ravito, les bornes, le D+ dit « dénivelé »…). Familier, mais jamais vulgaire.",
  coach: "Tu parles comme un coach de trail qui briefe son athlète la veille : posé, précis, bienveillant, centré sur la stratégie (allure, gestion de l'effort, alimentation, moments où la course se joue), avec le vocabulaire du trail. Des consignes claires, pas de blabla.",
  commentateur: "Tu commentes la course en direct, comme un commentateur sportif passionné qui suit le coureur depuis l'hélico : rythme, énergie, sens du spectacle, la tension monte sur les gros morceaux, et tu t'adresses au coureur. Toujours avec les seuls faits fournis.",
  suspense: "Tu racontes le parcours comme un récit à suspense : tu fais monter la tension, tu tease ce qui arrive (« et là… tu crois que c'est fini ? »), phrases courtes, quelques silences suggérés par la ponctuation, une vraie chute à l'arrivée.",
  chambreur: "Tu es le pote chambreur qui charrie gentiment : humour, second degré, petites piques sur les cuisses qui vont souffrir, mais un vrai conseil derrière chaque vanne. Jamais méchant ni vulgaire.",
};

const OPENINGS = [
  "une question directe au coureur",
  "le chiffre le plus marquant de la course",
  "l'heure ou l'ambiance du départ",
  "une promesse de ce qui l'attend",
  "une interpellation courte et punchy",
  "le défi que représente la course en une image",
];

const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

const buildSystemPrompt = (style: NarrationStyle, opening: string, voiceModel: NarrationScriptRequest["voiceModel"]) =>
  `${SYSTEM_PROMPT_HEAD}${STYLE_PROMPTS[style]}

Pour ce reel, l'intro s'ouvre sur ${opening}. Varie tes formulations : pas de phrases toutes faites ni de tics (« c'est parti », « accroche-toi ») répétés d'un tronçon à l'autre ; le brouillon de chaque tronçon ne sert qu'à connaître les faits, ne reprends pas sa façon de dire.

${SYSTEM_PROMPT_RULES}${voiceModel === "v3" ? V3_TAGS_PROMPT : ""}`;

const SYSTEM_PROMPT_HEAD = `Tu es la voix off des reels de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course.

Le reel survole tout le parcours en 3D, du départ à l'arrivée. `;

const SYSTEM_PROMPT_RULES = `Si consignes est fourni, ce sont les consignes de l'équipe pour cette course : elles passent avant toutes les autres règles et avant ton style (par exemple « bâtons interdits » : ne parle jamais de bâtons, même pour conseiller de ne pas en prendre).

Le parcours est découpé en tronçons consécutifs. Ta phrase pour un tronçon commence quand la caméra y entre et dure tout le tronçon : la caméra avance au rythme de ta voix. Donc :
- le récit est continu et sans trou : chaque tronçon enchaîne naturellement avec le précédent (« bon, une fois en haut… », « et là, ça redescend… ») et annonce la suite ; jamais une lecture de fiches point par point ;
- un tronçon long mérite plus de mots qu'un court : vise entre minWords et maxWords, au plus près de maxWords sans jamais le dépasser (un nombre et son unité comptent pour un mot) : la vidéo dure exactement le temps de ta voix, donc ces bornes calent le récit sur la durée visée ; sur un long passage roulant, raconte comment le gérer plutôt que de te taire ;
- donne des conseils concrets et perso liés au terrain (pars cool sur le plat, mets-toi en mode diesel dans la montée, garde des cuisses pour la descente, prends le temps de manger à la base de vie) ;
- cite les ravitos naturellement, en passant, sans lister tous les services ; insiste seulement sur une base de vie ou une barrière horaire ;
- ta phrase suit la caméra dans l'ordre du parcours : un tronçon de type aid ou lifeBase commence au ravito, donc ta phrase commence par lui ; un ravito de ravitosTraverses est atteint à momentDuTroncon de la durée du tronçon : cite-le avant ce moment dans ta phrase (à 40 %, dans les premiers 40 % de tes mots), jamais après, sinon la caméra l'a déjà dépassé ;
- utilise les sommets, lieux et heures estimées fournis (de nuit : frontale ; au lever du jour…) ;
- n'invente rien : uniquement les faits fournis (noms, kilomètres, dénivelés, pourcentages, services, horaires) ; pas de météo, de paysage ni d'anecdote ;
- écris pour l'oreille : tutoiement, phrases courtes, pas d'emoji ; les nombres s'affichent en sous-titres, donc écris-les en chiffres avec leur unité courte (« 6,2 km », « 850 m D+ », « 9 % », « km 12 », « 14h30 ») : la voix les lit automatiquement en toutes lettres ;
- garde les lieux courts : le nom du lieu, jamais une adresse postale ;
- l'intro accroche en une phrase ; l'outro invite à télécharger l'appli Pace Yourself, dispo sur iPhone et Android, pour préparer son plan de course, sur le même ton.

Renvoie une narration pour chaque id reçu, dans le même ordre.`;

// Only for the expressive v3 voice: it reads bracketed tags as performance directions.
const V3_TAGS_PROMPT = `

La voix est le modèle expressif ElevenLabs v3 : tu peux ajouter quelques indications de jeu en anglais entre crochets, placées juste avant les mots concernés, pour donner de la vie : [excited], [cheerful], [laughs], [chuckles], [sighs], [whispers], [curious], [determined], [relieved]. Au plus une par tronçon, pas dans chaque tronçon, jamais deux d'affilée ; elles ne comptent pas dans maxWords. Exemples : « [excited] Allez, c'est parti ! », « [sighs] Et là, ça grimpe sec… », « [laughs] Garde des cuisses, tu vas en avoir besoin. »`;

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
  const { race, beats, targetSeconds, voiceModel, wordsPerSecond, notes } = parsed.data;
  const maxWords = allocateWords(beats, targetSeconds, wordsPerSecond ?? DEFAULT_WORDS_PER_SECOND);
  const style = parsed.data.style ?? pick(NARRATION_STYLES);
  const system = buildSystemPrompt(style, pick(OPENINGS), voiceModel);

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
      minWords: Math.max(5, Math.round(maxWords[index] * 0.85)),
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
