import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z as z4 } from "zod/v4";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import { narrationScriptRequestSchema, type NarrationScriptRequest } from "../../../../../lib/video-narration";

export const maxDuration = 60;

const MAX_WORDS: Record<NarrationScriptRequest["beats"][number]["kind"], number> = {
  intro: 22,
  start: 16,
  climb: 24,
  descent: 22,
  flat: 18,
  aid: 16,
  lifeBase: 20,
  finish: 16,
  outro: 14,
};

const SYSTEM_PROMPT = `Tu écris la voix off des reels verticaux de Pace Yourself, l'application qui aide les traileurs à préparer leur plan de course.

Le reel survole le parcours en 3D. Chaque moment que tu reçois est montré à l'écran pendant que ta phrase est lue par une voix de synthèse, donc :
- écris pour l'oreille : phrases courtes, rythme, tutoiement, ton énergique et complice de coureur à coureur ;
- raconte une progression : le départ, la montée en tension sur les difficultés, le soulagement aux ravitos, l'émotion de l'arrivée ; relie les moments entre eux plutôt que d'aligner des fiches ;
- n'invente rien : n'utilise que les faits fournis (noms, kilomètres, dénivelés, pourcentages, services, horaires). Pas de météo, de paysage ou d'anecdote non fournis ;
- écris les nombres comme on les dit (« six virgule deux kilomètres » peut rester « 6,2 kilomètres », « 9 pour cent »), jamais de symboles ni d'abréviations (%, km, m, D+), pas d'emoji ;
- respecte maxWords pour chaque moment, c'est la place disponible dans la vidéo ;
- le moment "outro" invite à préparer son plan de course sur pace-yourself point com.

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
  if (!parsed.success) return jsonError("Requête de script invalide.", 400);
  const { race, beats, targetSeconds } = parsed.data;

  const input = {
    course: race,
    dureeVideoSecondes: targetSeconds,
    moments: beats.map((beat) => ({
      id: beat.id,
      type: beat.kind,
      titre: beat.title,
      deKm: Number(beat.startKm.toFixed(1)),
      aKm: Number(beat.endKm.toFixed(1)),
      faits: beat.facts,
      services: beat.services,
      barriereHoraire: beat.cutoffTime,
      brouillon: beat.narration,
      maxWords: MAX_WORDS[beat.kind],
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
      messages: [{ role: "user", content: `Voici le parcours et ses moments, au format JSON :\n${JSON.stringify(input, null, 2)}` }],
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
