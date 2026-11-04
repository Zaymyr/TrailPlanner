import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextRequest, NextResponse } from "next/server";
import { z as z4 } from "zod/v4";

import { withSecurityHeaders } from "../../../../../lib/http";
import { extractBearerToken, fetchSupabaseUser, getSupabaseAnonConfig, isAdminUser } from "../../../../../lib/supabase";
import {
  INSTAGRAM_CAPTION_MAX_CHARS,
  INSTAGRAM_MAX_HASHTAGS,
  instagramCaptionRequestSchema,
} from "../../../../../lib/video-narration";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Tu écris la description Instagram des reels de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course. Le reel survole le parcours d'une course en 3D avec une voix off.

La description raconte une petite histoire de la course, sur le ton d'un pote traileur : décontracté, complice, vocabulaire du trail, jamais vulgaire.
- Première ligne : une accroche forte qui donne envie de regarder (c'est la seule visible avant « plus »).
- Puis 3 à 6 lignes courtes : la course (nom, distance, dénivelé, lieu et date si fournis), les moments clés du parcours (grosses montées, sommets, base de vie, barrières), un conseil de gestion.
- Termine par un appel à l'action : prépare ton plan de course avec l'appli Pace Yourself (lien en bio), dispo sur iPhone et Android, et une question pour faire réagir en commentaire.
- Quelques emojis bien choisis (⛰️ 🏃 ⏱️ 💧…), pas plus d'un par ligne, sauts de ligne entre les blocs.
- N'invente rien : uniquement les faits fournis.
- 500 à 1 200 caractères, sans hashtags dans le texte.

Hashtags : 15 à 20, en minuscules, sans accents ni espaces, sans le #. Mélange des hashtags génériques trail (trail, trailrunning, ultratrail…), spécifiques à la course (son nom, l'édition), au lieu et à la région s'ils se déduisent des faits, et paceyourself.`;

const captionOutputSchema = z4.object({
  caption: z4.string(),
  hashtags: z4.array(z4.string()),
});

const jsonError = (message: string, status: number) =>
  withSecurityHeaders(NextResponse.json({ message }, { status }));

/** Keeps hashtags Instagram accepts: letters, digits and underscores, unique, 30 at most. */
const cleanHashtags = (hashtags: string[]) => {
  const seen = new Set<string>();
  return hashtags
    .map((tag) => tag.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter((tag) => tag.length > 1 && !seen.has(tag) && Boolean(seen.add(tag)))
    .slice(0, INSTAGRAM_MAX_HASHTAGS);
};

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

  const parsed = instagramCaptionRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(`Requête invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      // Thinking is always on and counts toward max_tokens.
      max_tokens: 16_000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(captionOutputSchema) },
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Voici la course et le récit du reel (tronçon par tronçon), au format JSON :\n${JSON.stringify(parsed.data, null, 2)}`,
      }],
    });

    if (response.stop_reason === "refusal") return jsonError("La rédaction a été refusée par le modèle.", 502);
    const output = response.parsed_output;
    if (!output) return jsonError("La description reçue est incomplète, réessayez.", 502);
    return withSecurityHeaders(NextResponse.json({
      caption: output.caption.trim().slice(0, INSTAGRAM_CAPTION_MAX_CHARS),
      hashtags: cleanHashtags(output.hashtags),
    }));
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return jsonError("Trop de demandes, réessayez dans un instant.", 429);
    if (error instanceof Error && /structured output|JSON/i.test(error.message)) {
      return jsonError("La description a été coupée avant la fin, réessayez.", 502);
    }
    if (error instanceof Anthropic.APIError) {
      console.error("Instagram caption error", error.status, error.message);
      return jsonError("Le service de rédaction est indisponible.", 502);
    }
    console.error("Instagram caption error", error);
    return jsonError("La description n’a pas pu être rédigée.", 500);
  }
}
