import { z } from "zod";

import { buildDefaultCaption, CAPTION_MAX_HASHTAGS, DEFAULT_HASHTAGS, normalizeHashtags } from "./social-posts";
import type { NarrationScriptRequest } from "./video-narration";
import { countWords, OVER_BUDGET_TOLERANCE } from "./video-script-prompt";

/**
 * Text content of a highlights reel, written in one Claude call (script, hook, call to action,
 * Instagram caption, hashtags, cover text), validated here and stored with the narration and the
 * render job. See docs/08-decisions/2026-11-19-reel-highlights-and-figures.md (decision 10).
 */

export const REEL_HOOK_MAX_WORDS = 12;
export const REEL_COVER_TEXT_MAX_WORDS = 6;
export const REEL_MIN_HASHTAGS = 8;
export const REEL_MAX_HASHTAGS = 15;
export const REEL_CAPTION_MAX_CHARS = 2_200;
const COVER_TEXT_STORED_MAX_CHARS = 200;

export const reelContentSchema = z.object({
  hook: z.string().max(300),
  script_segments: z.array(z.object({ highlight_id: z.string().min(1).max(80), text: z.string().max(600) })).max(40),
  cta: z.string().max(300),
  caption: z.string().max(REEL_CAPTION_MAX_CHARS),
  hashtags: z.array(z.string().max(100)).max(30),
  cover_text: z.string().max(COVER_TEXT_STORED_MAX_CHARS),
});
export type ReelContent = z.infer<typeof reelContentSchema>;

export const REEL_CONTENT_FIELDS = ["hook", "script_segments", "cta", "caption", "hashtags", "cover_text"] as const;
export type ReelContentField = (typeof REEL_CONTENT_FIELDS)[number];

export const reelContentWarningSchema = z.object({
  field: z.enum(REEL_CONTENT_FIELDS),
  message: z.string(),
});
export type ReelContentWarning = z.infer<typeof reelContentWarningSchema>;

export const reelContentResponseSchema = z.object({
  content: reelContentSchema,
  warnings: z.array(reelContentWarningSchema),
  style: z.string().optional(),
});

/** Request of the content route: the script request (highlights) plus the facts the hook and caption may use. */
export type ReelContentFacts = {
  race: NarrationScriptRequest["race"] & { raceDate?: string | null };
  beats: NarrationScriptRequest["beats"];
  shortName?: string | null;
  shockFigure?: string | null;
  aidStations?: { name: string; km: number; cutoffTime: string | null }[];
};

// ---------------------------------------------------------------------------------------------
// Numbers: nothing the reel says may be absent from the facts it was given

type NumberMatch = { text: string; variants: string[][] };

// Whole-token patterns, tried in this order at each position. A "3D" (the reel is "en 3D") is not a number.
const NUMBER_PATTERN = new RegExp([
  // Clock time: 18h12, 18 h 12 (kept whole; "14h" alone falls to the plain number).
  String.raw`(?<![\d.,])(\d{1,2})\s?[hH]\s?(\d{2})(?!\d)`,
  // Thousands: "5 520", "5 520" (no-break or narrow no-break space), "5 520,5".
  String.raw`(?<![\d.,])\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?(?![\d])`,
  // Plain number: 82, 6,2, 6.2.
  String.raw`(?<![\d.,])\d+(?:[.,]\d+)?(?![\d])(?!D(?![+\p{L}\d]))`,
].join("|"), "gu");

const canonical = (raw: string) => {
  const value = Number(raw.replace(/[  \s]/g, "").replace(",", "."));
  return Number.isFinite(value) ? String(value) : raw;
};

const timeToken = (hours: string, minutes: string) => `${Number(hours)}h${minutes}`;

const isGroupedThousands = (text: string) => /^\d{1,3}(?:[   ]\d{3})+/.test(text);

const readNumbers = (text: string): NumberMatch[] => {
  const found: NumberMatch[] = [];
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const token = match[0];
    if (match[1] !== undefined && match[2] !== undefined) {
      // "18h12": the time itself; the hour alone also passes when the facts only give the hour.
      found.push({ text: token, variants: [[timeToken(match[1], match[2])]] });
    } else if (isGroupedThousands(token)) {
      const parts = token.split(/[   ]/);
      const merged = [canonical(token)];
      // A plain space may separate two figures ("km 12 850 m"): either reading is accepted.
      found.push({ text: token, variants: token.includes(" ") ? [merged, parts.map(canonical)] : [merged] });
    } else {
      found.push({ text: token, variants: [[canonical(token)]] });
    }
  }
  return found;
};

/** Canonical tokens of every number in `text` ("5 520" -> "5520", "6,2" -> "6.2", "18h12" -> "18h12" and "18"). */
const readAllowedTokens = (text: string) => {
  const tokens: string[] = [];
  for (const match of readNumbers(text)) {
    for (const variant of match.variants) tokens.push(...variant);
    const time = /^(\d{1,2})\s?[hH]\s?\d{2}$/.exec(match.text);
    if (time) tokens.push(canonical(time[1]));
  }
  return tokens;
};

/**
 * Numbers written in `text` that are not among `allowedNumbers`, as they appear in the text. The
 * allowed values are numbers or free text whose numbers count ("km 12", "Samedi 14h30", "+600 m").
 * French formats are read: narrow no-break spaces ("5 520"), decimal commas ("6,2"), times
 * ("18h12") and percentages ("9 %"); a time is allowed whole, or by its hour when the facts only
 * give that hour.
 */
export const findUnprovidedNumbers = (text: string, allowedNumbers: Iterable<string | number>): string[] => {
  const allowed = new Set<string>();
  for (const item of allowedNumbers) {
    if (typeof item === "number") {
      if (Number.isFinite(item)) allowed.add(String(Number(item.toFixed(6))));
    } else {
      readAllowedTokens(item).forEach((token) => allowed.add(token));
    }
  }
  const unprovided: string[] = [];
  for (const match of readNumbers(text)) {
    if (match.variants.some((variant) => variant.every((token) => allowed.has(token)))) continue;
    // "18h12" with only the hour provided is not accepted: the minutes are an invention.
    if (!unprovided.includes(match.text)) unprovided.push(match.text);
  }
  return unprovided;
};

/** Every figure the writer was given, as strings and numbers for `findUnprovidedNumbers`. */
export const collectAllowedNumbers = (facts: ReelContentFacts): (string | number)[] => {
  const allowed: (string | number)[] = [
    facts.race.title,
    facts.race.subtitle ?? "",
    facts.race.startDetail ?? "",
    facts.race.raceDate ?? "",
    facts.shortName ?? "",
    facts.shockFigure ?? "",
    facts.race.distanceKm,
    // The highlights themselves ("3 temps forts") are known to the writer.
    facts.beats.filter((beat) => beat.kind !== "intro" && beat.kind !== "outro").length,
  ];
  if (facts.race.elevationGainM !== null) allowed.push(facts.race.elevationGainM);
  for (const beat of facts.beats) {
    allowed.push(beat.title, beat.startKm, beat.endKm, beat.cutoffTime ?? "", beat.narration, ...beat.facts, ...beat.services);
    for (const passage of beat.passages) allowed.push(passage.name, passage.km);
  }
  for (const station of facts.aidStations ?? []) allowed.push(station.name, station.km, station.cutoffTime ?? "");
  return allowed;
};

// ---------------------------------------------------------------------------------------------
// Limits

const FIELD_LABELS: Record<ReelContentField, string> = {
  hook: "L’accroche",
  script_segments: "Le script",
  cta: "L’appel à l’action",
  caption: "La description",
  hashtags: "Les hashtags",
  cover_text: "Le texte de couverture",
};

const startsWithText = (text: string, prefix: string) => {
  const flat = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  return flat(prefix) !== "" && flat(text).startsWith(flat(prefix));
};

/** The id of the intro beat, whose spoken text starts with the hook. */
export const REEL_INTRO_ID = "hl-intro";

export type ReelBeatBudget = { id: string; maxWords: number };

type RawReelContent = {
  hook: string;
  script_segments: { highlight_id: string; text: string }[];
  cta: string;
  caption: string;
  hashtags: string[];
  cover_text: string;
};

export type SanitizedReelContent = { content: ReelContent; problems: ReelContentWarning[] };

/**
 * Cleans a parsed output and checks every limit: trimmed texts, hashtags normalised (ASCII
 * lowercase, unique, 15 at most), unknown ids dropped, a repeated id kept once, one segment per
 * beat. Texts are never cut except the caption (Instagram's hard limit); what breaks a limit is
 * reported in `problems`, for one revision, then for the admin.
 */
export const sanitizeReelContent = (raw: RawReelContent, beats: ReelBeatBudget[]): SanitizedReelContent => {
  const problems: ReelContentWarning[] = [];
  const problem = (field: ReelContentField, message: string) => problems.push({ field, message });

  const budgets = new Map(beats.map((beat) => [beat.id, beat.maxWords]));
  const seen = new Set<string>();
  const script_segments = raw.script_segments
    .filter((segment) => budgets.has(segment.highlight_id) && !seen.has(segment.highlight_id) && Boolean(seen.add(segment.highlight_id)))
    .map((segment) => ({ highlight_id: segment.highlight_id, text: segment.text.trim().slice(0, 600) }));
  const hook = raw.hook.trim();
  const hookWords = countWords(hook);

  const missing = beats.filter((beat) => !script_segments.some((segment) => segment.highlight_id === beat.id && segment.text));
  if (missing.length) problem("script_segments", `Texte manquant pour : ${missing.map((beat) => beat.id).join(", ")}.`);
  for (const segment of script_segments) {
    const max = budgets.get(segment.highlight_id) ?? 0;
    const words = countWords(segment.text);
    // The intro starts with the hook, which may be 12 words long.
    const limit = Math.max(max * OVER_BUDGET_TOLERANCE, segment.highlight_id === REEL_INTRO_ID ? REEL_HOOK_MAX_WORDS : 0);
    if (words > limit) problem("script_segments", `${segment.highlight_id} : ${words} mots pour ${max} au plus.`);
  }
  const intro = script_segments.find((segment) => segment.highlight_id === REEL_INTRO_ID);
  if (intro && hook && !startsWithText(intro.text, hook)) problem("hook", `${REEL_INTRO_ID} doit commencer par l’accroche.`);

  if (!hook) problem("hook", "Accroche manquante.");
  else if (hookWords > REEL_HOOK_MAX_WORDS) problem("hook", `${FIELD_LABELS.hook} fait ${hookWords} mots (${REEL_HOOK_MAX_WORDS} au plus).`);

  const cta = raw.cta.trim();
  if (!cta) problem("cta", "Appel à l’action manquant.");

  const cover_text = raw.cover_text.trim();
  const coverWords = countWords(cover_text);
  if (!cover_text) problem("cover_text", "Texte de couverture manquant.");
  else if (coverWords > REEL_COVER_TEXT_MAX_WORDS) problem("cover_text", `${FIELD_LABELS.cover_text} fait ${coverWords} mots (${REEL_COVER_TEXT_MAX_WORDS} au plus).`);

  const allHashtags = normalizeHashtags(raw.hashtags);
  const hashtags = allHashtags.slice(0, REEL_MAX_HASHTAGS);
  if (hashtags.length < REEL_MIN_HASHTAGS) problem("hashtags", `${hashtags.length} hashtags valides pour ${REEL_MIN_HASHTAGS} à ${REEL_MAX_HASHTAGS} attendus.`);

  const caption = raw.caption.trim();
  if (!caption) problem("caption", "Description manquante.");
  else if (caption.length > REEL_CAPTION_MAX_CHARS) problem("caption", `La description dépasse ${REEL_CAPTION_MAX_CHARS} caractères (${caption.length}) : elle a été coupée.`);

  return {
    content: {
      hook: hook.slice(0, 300),
      script_segments,
      cta: cta.slice(0, 300),
      caption: caption.slice(0, REEL_CAPTION_MAX_CHARS),
      hashtags,
      cover_text: cover_text.slice(0, COVER_TEXT_STORED_MAX_CHARS),
    },
    problems,
  };
};

/** Numbers of the texts that are not in the facts, one warning per field. */
export const checkUnprovidedNumbers = (content: ReelContent, allowedNumbers: Iterable<string | number>): ReelContentWarning[] => {
  const allowed = [...allowedNumbers];
  const fields: { field: ReelContentField; text: string }[] = [
    { field: "hook", text: content.hook },
    { field: "script_segments", text: content.script_segments.map((segment) => segment.text).join("\n") },
    { field: "cta", text: content.cta },
    { field: "caption", text: content.caption },
    { field: "cover_text", text: content.cover_text },
  ];
  return fields.flatMap(({ field, text }) => {
    const found = findUnprovidedNumbers(text, allowed);
    return found.length ? [{ field, message: `${FIELD_LABELS[field]} cite des chiffres absents des données : ${found.join(", ")}.` }] : [];
  });
};

// ---------------------------------------------------------------------------------------------
// Editor helpers

/** Narration texts by beat id: the segments, with the hook opening the intro when the text lacks it. */
export const buildNarrationOverrides = (content: ReelContent): Record<string, string> => {
  const overrides: Record<string, string> = {};
  for (const segment of content.script_segments) {
    const text = segment.text.trim();
    if (!text) continue;
    overrides[segment.highlight_id] = segment.highlight_id === REEL_INTRO_ID && content.hook && !startsWithText(text, content.hook)
      ? `${content.hook.trim()} ${text}`
      : text;
  }
  return overrides;
};

const firstSentence = (text: string) => /^.*?[.!?…](?=\s|$)/su.exec(text.trim())?.[0] ?? text.trim();

/**
 * The content as stored with the video: the current narration texts (edited by hand or not), the
 * hook as the first sentence of the intro, the call to action as the outro, and the current
 * caption, hashtags and cover text of the Instagram panel.
 */
export const assembleReelContent = ({
  base,
  narrations,
  caption,
  hashtags,
  coverText,
}: {
  base: ReelContent | null;
  narrations: { id: string; text: string }[];
  caption: string;
  hashtags: string[];
  coverText: string;
}): ReelContent => {
  const segments = narrations
    .filter((narration) => narration.text.trim())
    .map((narration) => ({ highlight_id: narration.id, text: narration.text.trim().slice(0, 600) }));
  const intro = segments.find((segment) => segment.highlight_id === REEL_INTRO_ID);
  const outro = segments.find((segment) => segment.highlight_id === "hl-outro");
  const baseHook = base?.hook ?? "";
  return {
    hook: (intro && (!baseHook || !startsWithText(intro.text, baseHook)) ? firstSentence(intro.text) : baseHook).slice(0, 300),
    script_segments: segments,
    cta: (outro?.text ?? base?.cta ?? "").slice(0, 300),
    caption: caption.trim().slice(0, REEL_CAPTION_MAX_CHARS),
    hashtags: normalizeHashtags(hashtags).slice(0, 30),
    cover_text: coverText.trim().slice(0, COVER_TEXT_STORED_MAX_CHARS),
  };
};

// ---------------------------------------------------------------------------------------------
// Publications

/** Content as read from a row: null when absent or unreadable (old rows, hand-edited data). */
export const parseReelContent = (value: unknown): ReelContent | null => {
  const parsed = reelContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

/**
 * Starting point of an Instagram draft made from a render job: the caption, hashtags and cover
 * text written with the video when it has content, otherwise the plain template. Always editable;
 * `cover_url` is never set (Instagram takes the first frame), the cover text is only stored.
 */
export const buildDraftPrefill = (raceTitle: string, content: ReelContent | null) => {
  const hashtags = content ? normalizeHashtags(content.hashtags).slice(0, CAPTION_MAX_HASHTAGS) : [];
  return {
    caption: content?.caption.trim() || buildDefaultCaption(raceTitle),
    hashtags: hashtags.length ? hashtags : DEFAULT_HASHTAGS,
    coverText: content?.cover_text.trim() || null,
  };
};
