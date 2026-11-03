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
const KIND_WEIGHT: Record<NarrationScriptRequest["beats"][number]["kind"], number> = {
  intro: 1,
  start: 1.1,
  climb: 1.3,
  descent: 1,
  flat: 0.8,
  aid: 0.9,
  lifeBase: 1.1,
  finish: 1,
  outro: 0.6,
};

/** Splits the word budget of the whole video across beats, giving climbs a little more room. */
const allocateWords = (beats: NarrationScriptRequest["beats"], targetSeconds: number) => {
  const budget = Math.max(beats.length * 8, Math.round(targetSeconds * WORDS_PER_SECOND * 0.85));
  const totalWeight = beats.reduce((sum, beat) => sum + KIND_WEIGHT[beat.kind], 0);
  return beats.map((beat) => Math.max(7, Math.min(32, Math.round((budget * KIND_WEIGHT[beat.kind]) / totalWeight))));
};

const SYSTEM_PROMPT = `Tu es la voix off des reels verticaux de Pace Yourself, l'application qui aide les traileurs à préparer leur plan de course.

Le reel survole tout le parcours en 3D, du départ à l'arrivée. Tu racontes la course comme un coureur expérimenté qui briefe un ami la veille : on doit comprendre ce qui nous attend et comment la gérer. Le parcours est découpé en tronçons consécutifs ; ta phrase pour un tronçon est lue quand la caméra y entre, puis la caméra file jusqu'au tronçon suivant.

Ton récit :
- est continu : chaque tronçon enchaîne avec le précédent et annonce la suite (« pas de difficulté jusqu'au pied de la montée vers le Mont Thou », « longue montée de 7 kilomètres, prends ton temps », « on bascule ensuite vers le ravito de… ») ; jamais une lecture de fiches point par point ;
- donne des conseils de gestion simples et concrets liés au terrain (rythme confortable sur le plat, gérer la montée, garder des jambes pour la descente, s'alimenter à la base de vie) ;
- mentionne les ravitos naturellement, en passant, sans lister systématiquement tous les services ; insiste seulement sur une base de vie ou une barrière horaire ;
- utilise les sommets et lieux fournis pour situer (« la montée vers… ») ;
- n'invente rien : uniquement les faits fournis (noms, kilomètres, dénivelés, pourcentages, services, horaires) ; pas de météo, de paysage ni d'anecdote ;
- est écrit pour l'oreille : tutoiement, phrases courtes, ton complice et énergique ; nombres tels qu'on les dit (« 6,2 kilomètres », « 9 pour cent »), aucun symbole ni abréviation (%, km, m, D+), pas d'emoji ;
- raccourcis les lieux trop longs : garde le nom du lieu, jamais une adresse postale ;
- respecte maxWords de chaque tronçon : c'est le temps disponible dans une vidéo de deux minutes au plus ;
- l'intro présente la course en une phrase d'accroche ; l'outro invite à préparer son plan de course sur pace-yourself point com.

Renvoie une narration pour chaque id reçu, dans le même ordre.`;

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
  const { race, beats, targetSeconds } = parsed.data;
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
      maxWords: maxWords[index],
    })),
  };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(scriptOutputSchema) },
      system: SYSTEM_PROMPT,
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
    if (error instanceof Anthropic.AuthenticationError) return jsonError("La clé Anthropic est refusée.", 502);
    if (error instanceof Anthropic.APIError) {
      console.error("Video narration script error", error.status, error.message);
      return jsonError("Le service de rédaction est indisponible.", 502);
    }
    console.error("Video narration script error", error);
    return jsonError("Le script n’a pas pu être rédigé.", 500);
  }
}
