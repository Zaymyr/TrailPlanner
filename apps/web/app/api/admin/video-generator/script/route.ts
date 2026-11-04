import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z as z4 } from "zod/v4";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationScriptRequestSchema, type NarrationScriptRequest } from "../../../../../lib/video-narration";

export const maxDuration = 60;

// French voice-over runs at about 2.4 words per second.
const WORDS_PER_SECOND = 2.4;
const FIXED_WORDS: Partial<Record<NarrationScriptRequest["beats"][number]["kind"], number>> = {
  intro: 18,
  outro: 12,
};

/**
 * Each leg is on screen for as long as its narration lasts, so its words follow its share of the
 * route (with a floor for short legs): a long stretch gets more to say instead of a silent dash,
 * and the camera keeps a steady pace from one leg to the next.
 */
const allocateWords = (beats: NarrationScriptRequest["beats"], targetSeconds: number) => {
  const fixed = beats.reduce((sum, beat) => sum + (FIXED_WORDS[beat.kind] ?? 0), 0);
  const legs = beats.filter((beat) => FIXED_WORDS[beat.kind] === undefined);
  const budget = Math.max(legs.length * 10, Math.round(targetSeconds * WORDS_PER_SECOND * 0.9) - fixed);
  const totalKm = legs.reduce((sum, beat) => sum + Math.max(0, beat.endKm - beat.startKm), 0);
  return beats.map((beat) => {
    const fixedWords = FIXED_WORDS[beat.kind];
    if (fixedWords !== undefined) return fixedWords;
    const share = totalKm > 0 ? Math.max(0, beat.endKm - beat.startKm) / totalKm : 1 / Math.max(1, legs.length);
    const words = budget * (0.25 / Math.max(1, legs.length) + 0.75 * share);
    return Math.max(9, Math.min(48, Math.round(words)));
  });
};

const SYSTEM_PROMPT = `Tu es la voix off des reels de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course.

Le reel survole tout le parcours en 3D, du départ à l'arrivée. Tu parles comme un pote traileur qui explique la course à un autre pote, la veille au soir, une bière à la main : décontracté, complice, un peu chambreur, avec le vocabulaire du trail (ça grimpe sec, ça envoie, ça déroule, relancer, gérer, les cuisses qui chauffent, sortir les bâtons, être dans le dur, taper dans le ravito, les bornes, le D+ dit « dénivelé »…). Familier, mais jamais vulgaire.

Le parcours est découpé en tronçons consécutifs. Ta phrase pour un tronçon commence quand la caméra y entre et dure tout le tronçon : la caméra avance au rythme de ta voix. Donc :
- le récit est continu et sans trou : chaque tronçon enchaîne naturellement avec le précédent (« bon, une fois en haut… », « et là, ça redescend… ») et annonce la suite ; jamais une lecture de fiches point par point ;
- un tronçon long mérite plus de mots qu'un court : vise entre minWords et maxWords, au plus près de maxWords ; sur un long passage roulant, raconte comment le gérer plutôt que de te taire ;
- donne des conseils concrets et perso liés au terrain (pars cool sur le plat, mets-toi en mode diesel dans la montée, garde des cuisses pour la descente, prends le temps de manger à la base de vie) ;
- cite les ravitos naturellement, en passant, sans lister tous les services ; insiste seulement sur une base de vie ou une barrière horaire ;
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
  const { race, beats, targetSeconds, voiceModel } = parsed.data;
  const maxWords = allocateWords(beats, targetSeconds);

  const input = {
    course: race,
    dureeVideoMaxSecondes: targetSeconds,
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
      minWords: Math.max(5, Math.round(maxWords[index] * 0.75)),
      maxWords: maxWords[index],
    })),
  };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      // Thinking is always on with this model and counts toward max_tokens: leave room for it,
      // otherwise the JSON is cut mid-string.
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(scriptOutputSchema) },
      system: voiceModel === "v3" ? SYSTEM_PROMPT + V3_TAGS_PROMPT : SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Voici le parcours et ses tronçons, au format JSON :\n${JSON.stringify(input, null, 2)}` }],
    });

    if (response.stop_reason === "refusal") return jsonError("La rédaction a été refusée par le modèle.", 502);
    const output = response.parsed_output;
    if (!output) return jsonError("Le script reçu est incomplet, réessayez.", 502);

    const knownIds = new Set(beats.map((beat) => beat.id));
    const result = output.beats
      .filter((beat) => knownIds.has(beat.id))
      .map((beat) => ({ id: beat.id, narration: beat.narration.trim().slice(0, 600) }))
      .filter((beat) => beat.narration.length > 0);
    return withSecurityHeaders(NextResponse.json({ beats: result }));
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
