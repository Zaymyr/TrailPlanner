import { type NarrationScriptRequest, type NarrationStyle } from "./video-narration";

/**
 * Word budgets and prompt building blocks of the reel scripts, shared by the script route (one
 * narration per beat) and the content route (highlights: narration, caption and hashtags in one call).
 */

// Shown words per second of audio until the voice has been measured: tags, pauses and numbers
// read in words make it slower than plain French speech (see speech-rate in the generator).
export const DEFAULT_WORDS_PER_SECOND = 2.2;
// Silence the timeline keeps around each narration (NARRATION_GAP_MS in video-composition).
export const GAP_SECONDS_PER_BEAT = 0.5;
// A leg this far over its maxWords is sent back for a shorter version.
export const OVER_BUDGET_TOLERANCE = 1.1;
// Words as the budget counts them: a performance tag ("[excited]") is not spoken as words.
export const countWords = (text: string) => text.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length;
const FIXED_WORDS: Partial<Record<NarrationScriptRequest["beats"][number]["kind"], number>> = {
  intro: 18,
  outro: 12,
};
// Highlights reel (30-45 s): a short hook and a short call to action around 3 to 5 moments.
const HIGHLIGHT_FIXED_WORDS: Partial<Record<NarrationScriptRequest["beats"][number]["kind"], number>> = {
  intro: 10,
  outro: 8,
};
// Fast flight between two moments, one more than the moments (HIGHLIGHT_TRANSIT_MS in video-composition).
const HIGHLIGHT_TRANSIT_SECONDS = 1.2;
const HIGHLIGHT_MIN_WORDS = 7;
const HIGHLIGHT_MAX_WORDS = 30;

/**
 * A highlights reel spends its time on the moments: the target minus the transits and the
 * silences, shared equally between the moments (each is told on its own, not by its length).
 */
export const allocateHighlightWords = (beats: NarrationScriptRequest["beats"], targetSeconds: number, wordsPerSecond: number) => {
  const fixed = beats.reduce((sum, beat) => sum + (HIGHLIGHT_FIXED_WORDS[beat.kind] ?? 0), 0);
  const moments = beats.filter((beat) => HIGHLIGHT_FIXED_WORDS[beat.kind] === undefined);
  // Intro and outro keep 0.5 s of silence on each side, each moment 0.5 s after its sentence.
  const speakingSeconds = targetSeconds - HIGHLIGHT_TRANSIT_SECONDS * (moments.length + 1) - GAP_SECONDS_PER_BEAT * (moments.length + 4);
  const budget = Math.max(moments.length * HIGHLIGHT_MIN_WORDS, Math.round(speakingSeconds * wordsPerSecond) - fixed);
  const perMoment = Math.max(HIGHLIGHT_MIN_WORDS, Math.min(HIGHLIGHT_MAX_WORDS, Math.floor(budget / Math.max(1, moments.length))));
  return beats.map((beat) => HIGHLIGHT_FIXED_WORDS[beat.kind] ?? perMoment);
};

/**
 * Each leg is on screen for as long as its narration lasts, so its words follow its share of the
 * route (with a floor for short legs): a long stretch gets more to say instead of a silent dash,
 * and the camera keeps a steady pace from one leg to the next.
 */
export const allocateWords = (beats: NarrationScriptRequest["beats"], targetSeconds: number, wordsPerSecond: number) => {
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
export const STYLE_PROMPTS: Record<NarrationStyle, string> = {
  pote: "Tu parles comme un pote traileur qui explique la course à un autre pote, la veille au soir, une bière à la main : décontracté, complice, avec le vocabulaire du trail (ça grimpe sec, ça envoie, ça déroule, relancer, gérer, les cuisses qui chauffent, être dans le dur, taper dans le ravito, les bornes, le D+ dit « dénivelé »…). Familier, mais jamais vulgaire.",
  coach: "Tu parles comme un coach de trail qui briefe son athlète la veille : posé, précis, bienveillant, centré sur la stratégie (allure, gestion de l'effort, alimentation, moments où la course se joue), avec le vocabulaire du trail. Des consignes claires, pas de blabla.",
  commentateur: "Tu commentes la course en direct, comme un commentateur sportif passionné qui suit le coureur depuis l'hélico : rythme, énergie, sens du spectacle, la tension monte sur les gros morceaux, et tu t'adresses au coureur. Toujours avec les seuls faits fournis.",
  suspense: "Tu racontes le parcours comme un récit à suspense : tu fais monter la tension, tu tease ce qui arrive (« et là… tu crois que c'est fini ? »), phrases courtes, quelques silences suggérés par la ponctuation, une vraie chute à l'arrivée.",
  chambreur: "Tu es le pote chambreur qui charrie gentiment : humour, second degré, petites piques sur les cuisses qui vont souffrir, mais un vrai conseil derrière chaque vanne. Jamais méchant ni vulgaire.",
};

export const OPENINGS = [
  "une question directe au coureur",
  "le chiffre le plus marquant de la course",
  "l'heure ou l'ambiance du départ",
  "une promesse de ce qui l'attend",
  "une interpellation courte et punchy",
  "le défi que représente la course en une image",
];

export const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];

export const buildSystemPrompt = (
  style: NarrationStyle,
  opening: string,
  voiceModel: NarrationScriptRequest["voiceModel"],
  mode: NarrationScriptRequest["mode"] = "full",
) =>
  `${mode === "highlights" ? HIGHLIGHTS_PROMPT_HEAD : SYSTEM_PROMPT_HEAD}${STYLE_PROMPTS[style]}

Pour ce reel, l'intro s'ouvre sur ${opening}. Varie tes formulations : pas de phrases toutes faites ni de tics (« c'est parti », « accroche-toi ») répétés d'un tronçon à l'autre ; le brouillon de chaque tronçon ne sert qu'à connaître les faits, ne reprends pas sa façon de dire.

${mode === "highlights" ? HIGHLIGHTS_PROMPT_RULES : SYSTEM_PROMPT_RULES}${voiceModel === "v3" ? V3_TAGS_PROMPT : ""}`;

export const PROMPT_INTRO = `Tu es la voix off des reels de Pace Yourself, l'appli qui aide les traileurs à préparer leur plan de course.

`;

const SYSTEM_PROMPT_HEAD = `${PROMPT_INTRO}Le reel survole tout le parcours en 3D, du départ à l'arrivée. `;

export const HIGHLIGHTS_PROMPT_HEAD = `${PROMPT_INTRO}Ce reel ne montre que les temps forts du parcours en 3D : la caméra s'attarde sur chacun puis file au suivant en une seconde, sans survoler le reste. `;

export const NOTES_RULE = `Si consignes est fourni, ce sont les consignes de l'équipe pour cette course : elles passent avant toutes les autres règles et avant ton style (par exemple « bâtons interdits » : ne parle jamais de bâtons, même pour conseiller de ne pas en prendre).`;

// Shared by both modes: the reel never states a number that is not in the facts.
export const FACTS_RULE = `- n'invente rien : uniquement les faits fournis (noms, kilomètres, dénivelés, pourcentages, services, horaires) ; pas de météo, de paysage ni d'anecdote ;`;
export const EAR_RULE = `- écris pour l'oreille : tutoiement, phrases courtes, pas d'emoji ; les nombres s'affichent en sous-titres, donc écris-les en chiffres avec leur unité courte (« 6,2 km », « 850 m D+ », « 9 % », « km 12 », « 14h30 ») : la voix les lit automatiquement en toutes lettres ;
- garde les lieux courts : le nom du lieu, jamais une adresse postale ;`;

export const HIGHLIGHTS_PROMPT_RULES = `${NOTES_RULE}

Chaque tronçon est un temps fort isolé (la plus grosse montée, la dernière montée, la grande descente, un ravito ou une base de vie stratégique, le passage de nuit), dans l'ordre du parcours. Ta phrase commence quand la caméra arrive sur le temps fort et dure le temps qu'elle y reste. Donc :
- une ou deux phrases courtes par temps fort, entre minWords et maxWords, au plus près de maxWords sans jamais le dépasser (un nombre et son unité comptent pour un mot) : le reel entier dure 30 à 45 secondes ;
- dis pourquoi ce moment compte et donne un conseil concret lié au terrain (mode diesel dans la montée, garde des cuisses pour la descente, fais le plein au ravito, frontale de nuit) ; insiste sur une barrière horaire quand elle est fournie ;
- enchaîne d'un temps fort au suivant par une transition très courte (« plus loin… », « et en fin de course… ») : le reste du parcours n'est pas montré, ne le raconte pas ;
${FACTS_RULE} ne cite aucun chiffre absent de course ou des faits du tronçon ;
${EAR_RULE}
- l'intro (hl-intro) est l'accroche des 2 premières secondes, dite sous le chiffre choc et le nom de la course : sa première phrase est une question ou une affirmation forte de 12 mots au plus, sans aucun chiffre absent de course ; l'outro invite à télécharger l'appli Pace Yourself, dispo sur iPhone et Android, pour préparer son plan de course, sur le même ton.

Renvoie une narration pour chaque id reçu, dans le même ordre.`;

const SYSTEM_PROMPT_RULES = `${NOTES_RULE}

Le parcours est découpé en tronçons consécutifs. Ta phrase pour un tronçon commence quand la caméra y entre et dure tout le tronçon : la caméra avance au rythme de ta voix. Donc :
- le récit est continu et sans trou : chaque tronçon enchaîne naturellement avec le précédent (« bon, une fois en haut… », « et là, ça redescend… ») et annonce la suite ; jamais une lecture de fiches point par point ;
- un tronçon long mérite plus de mots qu'un court : vise entre minWords et maxWords, au plus près de maxWords sans jamais le dépasser (un nombre et son unité comptent pour un mot) : la vidéo dure exactement le temps de ta voix, donc ces bornes calent le récit sur la durée visée ; sur un long passage roulant, raconte comment le gérer plutôt que de te taire ;
- donne des conseils concrets et perso liés au terrain (pars cool sur le plat, mets-toi en mode diesel dans la montée, garde des cuisses pour la descente, prends le temps de manger à la base de vie) ;
- cite les ravitos naturellement, en passant, sans lister tous les services ; insiste seulement sur une base de vie ou une barrière horaire ;
- ta phrase suit la caméra dans l'ordre du parcours : un tronçon de type aid ou lifeBase commence au ravito, donc ta phrase commence par lui ; un ravito de ravitosTraverses est atteint à momentDuTroncon de la durée du tronçon : cite-le avant ce moment dans ta phrase (à 40 %, dans les premiers 40 % de tes mots), jamais après, sinon la caméra l'a déjà dépassé ;
- utilise les sommets, lieux et heures estimées fournis (de nuit : frontale ; au lever du jour…) ;
${FACTS_RULE}
${EAR_RULE}
- l'intro accroche en une phrase ; l'outro invite à télécharger l'appli Pace Yourself, dispo sur iPhone et Android, pour préparer son plan de course, sur le même ton.

Renvoie une narration pour chaque id reçu, dans le même ordre.`;

// Only for the expressive v3 voice: it reads bracketed tags as performance directions.
export const V3_TAGS_PROMPT = `

La voix est le modèle expressif ElevenLabs v3 : tu peux ajouter quelques indications de jeu en anglais entre crochets, placées juste avant les mots concernés, pour donner de la vie : [excited], [cheerful], [laughs], [chuckles], [sighs], [whispers], [curious], [determined], [relieved]. Au plus une par tronçon, pas dans chaque tronçon, jamais deux d'affilée ; elles ne comptent pas dans maxWords. Exemples : « [excited] Allez, c'est parti ! », « [sighs] Et là, ça grimpe sec… », « [laughs] Garde des cuisses, tu vas en avoir besoin. »`;

