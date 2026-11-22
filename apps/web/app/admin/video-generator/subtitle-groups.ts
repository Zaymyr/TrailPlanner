/**
 * Burned-in subtitles of the reels: short groups of words cut at natural boundaries, timed word
 * by word from the ElevenLabs character timing when it is available. Pure module, no DOM.
 */

export type SubtitleGroup = { text: string; startMs: number; endMs: number };

// -- Layout: the Instagram safe zones -------------------------------------------------------
// Reels tab: Instagram covers the bottom (account, caption, sound, from about y = 1570 of 1920) and
// the right edge (action column, about 13 % of the width). Feed: the reel is cropped to 4:5, so only
// y = 285 to 1635 shows, without any interface. The subtitle box is centred horizontally (equal
// margins, clear of the action column) so it does not lean left in the feed. Centred on 82 % of the
// height since 2026-11-22 (was 77.5 %, judged too high): one line ends near y = 1613, inside the feed
// crop; two lines end near y = 1643, a few pixels past it, and both reach into the Reels caption area
// (the caption text is short and at the very bottom).
export const SUBTITLE_CENTER_Y_RATIO = 0.82;
/** Instagram's unsafe bottom (Reels caption) starts here (share of the frame height; 1570 px on 1920). */
export const SUBTITLE_SAFE_BOTTOM_RATIO = 1570 / 1920;
/** Left and right edges of the box: symmetric, the right 13 % (action column) stays empty. */
export const SUBTITLE_LEFT_RATIO = 0.13;
export const SUBTITLE_RIGHT_RATIO = 0.87;
export const SUBTITLE_FONT_CQMIN = 4.2;
export const SUBTITLE_LINE_HEIGHT = 1.3;
export const SUBTITLE_PADDING_Y_CQMIN = 0.9;
export const SUBTITLE_PADDING_X_CQMIN = 2.4;
export const SUBTITLE_MAX_LINES = 2;

/**
 * Worst-case subtitle box (two lines) in pixels, from the style constants. A frame is 100 cqmin
 * tall in landscape and wide in portrait: `cqmin` is the shorter side.
 */
export const getSubtitleBoxBounds = (width: number, height: number, lines = SUBTITLE_MAX_LINES) => {
  const cqmin = Math.min(width, height) / 100;
  const boxHeight = (lines * SUBTITLE_FONT_CQMIN * SUBTITLE_LINE_HEIGHT + 2 * SUBTITLE_PADDING_Y_CQMIN) * cqmin;
  const centerY = height * SUBTITLE_CENTER_Y_RATIO;
  return {
    left: width * SUBTITLE_LEFT_RATIO,
    right: width * SUBTITLE_RIGHT_RATIO,
    top: centerY - boxHeight / 2,
    bottom: centerY + boxHeight / 2,
  };
};

// -- Grouping rules ----------------------------------------------------------------------------
export const SUBTITLE_MIN_WORDS = 2;
export const SUBTITLE_MAX_WORDS = 5;
/** A silence longer than this between two words is a natural place to change subtitle. */
export const SUBTITLE_PAUSE_MS = 250;
/** Two groups separated by less than this stay on screen without a blank between them. */
const SUBTITLE_BRIDGE_MS = 300;
/** Comfortable width of one line at the subtitle font size; beyond it the group wraps. */
const SUBTITLE_LINE_CHARS = 32;

const PREPOSITIONS_AND_CONJUNCTIONS = [
  "à", "au", "aux", "en", "sur", "sous", "dans", "par", "pour", "avec", "vers", "chez", "entre", "jusqu'à", "jusqu'au", "jusqu'aux",
  "de", "du", "des", "et", "ou", "mais", "car", "donc", "comme", "quand", "lorsque", "puisque", "si", "où", "dont", "qui", "que", "qu'",
  "sans", "avant", "après", "depuis", "pendant", "contre", "selon", "dès", "durant", "malgré", "parmi", "lors", "hors",
];

/** Words a subtitle must never end on: articles, contractions, prepositions, determiners, conjunctions, clitics. */
export const FRENCH_FUNCTION_WORDS: ReadonlySet<string> = new Set([
  ...PREPOSITIONS_AND_CONJUNCTIONS,
  "le", "la", "les", "l'", "un", "une", "d'", "jusqu'", "ton", "ta", "tes", "son", "sa", "ses", "ce", "cet", "cette", "ces",
  "mon", "ma", "mes", "notre", "nos", "votre", "vos", "leur", "leurs", "ne", "n'", "plus", "qu'", "j'", "m'", "t'", "s'", "c'",
  "je", "tu", "il", "elle", "on", "ils", "elles", "te", "me", "se",
]);

const PHRASE_STARTERS: ReadonlySet<string> = new Set(PREPOSITIONS_AND_CONJUNCTIONS);

/** Proper names keep these small words inside ("Hivernale des Templiers", "Cap de la Hague"). */
const NAME_CONNECTORS: ReadonlySet<string> = new Set(["de", "du", "des", "d'", "la", "le", "les", "l'", "sur", "sous", "en", "au", "aux"]);

const UNIT_PATTERN = /^(km|m|h|min|s|kg|g|cal|kcal|l|ml|mm|°c|°|%|d\+|d-|km\/h|m\/h|m\/min|mètres?|kilomètres?|heures?|minutes?|secondes?|kilos?|grammes?|calories?|degrés?)$/iu;
const NUMBER_PATTERN = /^[+\-−~]?\d[\d.,:h'’]*$/iu;
const SENTENCE_END_PATTERN = /[.!?…]["'»”’)\]]*$/u;
const STRONG_PUNCTUATION_PATTERN = /[,;:–—]["'»”’)\]]*$/u;
const CLOSING_TOKEN = /^[?!:;»…)\]]+$/u;
const OPENING_TOKEN = /^[«(\[–—]+$/u;

const normalize = (word: string) => word.replace(/[’‘]/g, "'").toLowerCase();
/** The word without surrounding punctuation, for dictionary and shape tests. */
const core = (word: string) => normalize(word).replace(/^[«("\[]+/u, "").replace(/[\s.,;:!?…»"”)\]–—]+$/u, "");

const isFunctionWord = (word: string) => {
  const stripped = core(word);
  return FRENCH_FUNCTION_WORDS.has(stripped) || (stripped.endsWith("'") && stripped.length <= 7);
};
const isNumber = (word: string) => NUMBER_PATTERN.test(core(word)) && /\d/.test(word);
const isUnit = (word: string) => UNIT_PATTERN.test(core(word));

const ELISION = /^(?:qu|jusqu|[ldjnsmtc])['’]/iu;
const isCapitalised = (word: string) => {
  const bare = word.replace(/^[«("\[]+/u, "").replace(ELISION, "");
  return /^\p{Lu}/u.test(bare) && !isUnit(word) && !/\d/.test(word);
};

export type SubtitleWord = {
  text: string;
  /** Start and end in ms from the narration start; null when the voice timing is not exact. */
  startMs: number | null;
  endMs: number | null;
};

/** Words of the displayed text with their index range; lone punctuation sticks to its neighbour. */
export const splitDisplayedWords = (shown: string) => {
  const words: Array<{ text: string; first: number; last: number }> = [];
  let pendingOpening: { text: string; first: number } | null = null;
  let cursor = 0;
  for (const token of shown.split(" ")) {
    const first = cursor;
    const last = cursor + token.length - 1;
    cursor += token.length + 1;
    if (!token) continue;
    if (CLOSING_TOKEN.test(token) && words.length) {
      const previous = words[words.length - 1];
      previous.text = `${previous.text} ${token}`;
      previous.last = last;
    } else if (OPENING_TOKEN.test(token)) {
      pendingOpening = { text: token, first };
    } else if (pendingOpening) {
      words.push({ text: `${pendingOpening.text} ${token}`, first: pendingOpening.first, last });
      pendingOpening = null;
    } else {
      words.push({ text: token, first, last });
    }
  }
  if (pendingOpening) words.push({ text: pendingOpening.text, first: pendingOpening.first, last: pendingOpening.first + pendingOpening.text.length - 1 });
  return words;
};

/**
 * Start and end of every displayed word from the per-character timing of the raw narration
 * (voice tags included). `rawIndex[i]` is the raw index of displayed character i. End times come
 * from the last character, start times (optional, absent from older clips) from the first one.
 */
export const getWordTimings = (
  shown: string,
  rawIndex: number[],
  rawOffset: number,
  characterEndMs?: number[],
  characterStartMs?: number[],
): SubtitleWord[] => {
  const words = splitDisplayedWords(shown);
  const hasStarts = Boolean(characterStartMs && characterEndMs && characterStartMs.length === characterEndMs.length);
  return words.map((word) => {
    const endMs = characterEndMs?.[rawIndex[word.last] - rawOffset];
    const startMs = hasStarts ? characterStartMs?.[rawIndex[word.first] - rawOffset] : undefined;
    return {
      text: word.text,
      endMs: endMs ?? null,
      startMs: startMs === undefined || endMs === undefined ? null : Math.min(startMs, endMs),
    };
  });
};

type Atom = { words: SubtitleWord[]; text: string; chars: number; strongEnd: boolean; sentenceEnd: boolean };

const isSentenceEnd = (word: string) => SENTENCE_END_PATTERN.test(word);
const isStrongEnd = (word: string) => STRONG_PUNCTUATION_PATTERN.test(word) || isSentenceEnd(word);

/** Number + unit ("5 520 m D+", "13 %") and proper-name sequences stay in one piece. */
const buildAtoms = (sentence: SubtitleWord[]): Atom[] => {
  const atoms: SubtitleWord[][] = [];
  let index = 0;
  while (index < sentence.length) {
    let end = index + 1;
    const word = sentence[index].text;
    if (isNumber(word) && !isStrongEnd(word)) {
      // Digits groups ("5 520"), then every unit that follows ("m D+").
      while (end < sentence.length && isNumber(sentence[end].text) && !isStrongEnd(sentence[end - 1].text)) end += 1;
      while (end < sentence.length && isUnit(sentence[end].text) && !isStrongEnd(sentence[end - 1].text)) end += 1;
    } else if (isNumber(word)) {
      end = index + 1;
    } else if (isCapitalised(word) && (index > 0 || (sentence[index + 1] && startsNameChain(sentence, index + 1)))) {
      let cursor = index;
      while (cursor - index < 4 && !isStrongEnd(sentence[cursor].text)) {
        const next = chainNext(sentence, cursor + 1);
        if (next === -1) break;
        cursor = next;
      }
      end = cursor + 1;
    }
    atoms.push(sentence.slice(index, end));
    index = end;
  }
  return atoms.map((words) => {
    const text = words.map((entry) => entry.text).join(" ");
    const last = words[words.length - 1].text;
    return { words, text, chars: text.length, strongEnd: isStrongEnd(last), sentenceEnd: isSentenceEnd(last) };
  });
};

/** True when the word at `index` continues a name chain started just before it. */
const startsNameChain = (sentence: SubtitleWord[], index: number) => chainNext(sentence, index) !== -1;

/** Index of the capitalised word that extends a name at `index` (skipping "de", "des"…), or -1. */
const chainNext = (sentence: SubtitleWord[], index: number) => {
  for (let cursor = index; cursor < sentence.length && cursor < index + 3; cursor += 1) {
    const text = sentence[cursor].text;
    if (isCapitalised(text) && !isNumber(text)) return cursor;
    if (!NAME_CONNECTORS.has(core(text)) && !core(text).endsWith("'")) return -1;
  }
  return -1;
};

const endsBadly = (atom: Atom) => {
  const last = atom.words[atom.words.length - 1].text;
  // A bare numeral ("5 ravitos") belongs to the word that follows.
  return isFunctionWord(last) || (isNumber(last) && atom.words.length === 1);
};

const wordCount = (atoms: Atom[]) => atoms.reduce((sum, atom) => sum + atom.words.length, 0);

/** Gap between two consecutive words when both starts and ends are known. */
const gapBetween = (previous: SubtitleWord, next: SubtitleWord) =>
  previous.endMs !== null && next.startMs !== null ? next.startMs - previous.endMs : 0;

/** Cuts a run of atoms (no strong punctuation inside) into 2-5 word groups; null when impossible. */
const partition = (atoms: Atom[], minWords: number, maxWords: number): Atom[][] | null => {
  const count = atoms.length;
  const best: number[] = new Array(count + 1).fill(Infinity);
  const from: number[] = new Array(count + 1).fill(-1);
  best[0] = 0;
  for (let end = 1; end <= count; end += 1) {
    for (let start = end - 1; start >= 0; start -= 1) {
      const slice = atoms.slice(start, end);
      const words = wordCount(slice);
      if (words > maxWords && end - start > 1) break;
      if (words < minWords || best[start] === Infinity) continue;
      if (end < count && endsBadly(atoms[end - 1])) continue;
      const chars = slice.reduce((sum, atom) => sum + atom.chars, 0) + slice.length - 1;
      let cost = best[start] + 1.5 + Math.abs(words - 3.2) * 0.5 + Math.max(0, chars - SUBTITLE_LINE_CHARS);
      if (end < count) {
        const lastWord = atoms[end - 1].words[atoms[end - 1].words.length - 1];
        const nextWord = atoms[end].words[0];
        const pause = gapBetween(lastWord, nextWord) > SUBTITLE_PAUSE_MS;
        cost += pause ? 0 : PHRASE_STARTERS.has(core(nextWord.text)) ? 0.8 : 2.5;
      }
      if (cost < best[end]) {
        best[end] = cost;
        from[end] = start;
      }
    }
  }
  if (best[count] === Infinity) return null;
  const groups: Atom[][] = [];
  for (let end = count; end > 0; end = from[end]) groups.unshift(atoms.slice(from[end], end));
  return groups;
};

/** Groups the words of one sentence; punctuation and long pauses are the preferred cuts. */
const groupSentence = (sentence: SubtitleWord[]): SubtitleWord[][] => {
  if (sentence.length <= 1) return [sentence];
  const atoms = buildAtoms(sentence);

  // Segments end at punctuation or at a long pause, as long as both sides stay valid.
  const segments: Atom[][] = [[]];
  atoms.forEach((atom, atomIndex) => {
    segments[segments.length - 1].push(atom);
    const next = atoms[atomIndex + 1];
    if (!next) return;
    const lastWord = atom.words[atom.words.length - 1];
    if (atom.strongEnd || gapBetween(lastWord, next.words[0]) > SUBTITLE_PAUSE_MS) segments.push([]);
  });
  // A segment too short, or ending on a function word, joins the next one.
  for (let index = 0; index < segments.length - 1;) {
    const segment = segments[index];
    if (wordCount(segment) < SUBTITLE_MIN_WORDS || endsBadly(segment[segment.length - 1])) {
      segments.splice(index, 2, [...segment, ...segments[index + 1]]);
    } else {
      index += 1;
    }
  }
  // The last segment must not be a singleton: it joins the previous one.
  if (segments.length > 1 && wordCount(segments[segments.length - 1]) < SUBTITLE_MIN_WORDS) {
    const last = segments.pop()!;
    segments[segments.length - 1].push(...last);
  }

  return segments.flatMap((segment) => {
    // Strict limits first; a long name or number may force a 6 to 8 word group, never a singleton.
    for (const maximum of [SUBTITLE_MAX_WORDS, 6, 8, 12]) {
      const groups = partition(segment, SUBTITLE_MIN_WORDS, maximum);
      if (groups) return groups.map((group) => group.flatMap((atom) => atom.words));
    }
    return [segment.flatMap((atom) => atom.words)];
  });
};

/** Words cut into sentences (a word ending with . ! ? … closes one). */
const splitSentences = (words: SubtitleWord[]) => {
  const sentences: SubtitleWord[][] = [];
  let current: SubtitleWord[] = [];
  words.forEach((word) => {
    current.push(word);
    if (isSentenceEnd(word.text)) {
      sentences.push(current);
      current = [];
    }
  });
  if (current.length) sentences.push(current);
  return sentences;
};

/** Subtitle groups of 2 to 5 words (texts only, in order); a group never crosses a sentence end. */
export const groupSubtitleWords = (words: SubtitleWord[]): SubtitleWord[][] =>
  splitSentences(words).flatMap((sentence) => {
    const groups = groupSentence(sentence);
    // Last guard: a singleton in a multi-word sentence joins its neighbour.
    for (let index = groups.length - 1; index >= 0 && groups.length > 1; index -= 1) {
      if (groups[index].length < SUBTITLE_MIN_WORDS) {
        const neighbour = index > 0 ? index - 1 : index + 1;
        const merged = index > 0 ? [...groups[neighbour], ...groups[index]] : [...groups[index], ...groups[neighbour]];
        groups.splice(Math.min(index, neighbour), 2, merged);
      }
    }
    return groups;
  });

export type SubtitleGroupingInput = {
  /** Displayed narration (voice tags removed, whitespace collapsed). */
  shown: string;
  /** Raw index of each displayed character (`stripVoiceTags`). */
  rawIndex: number[];
  /** Number of leading spaces trimmed from the raw text before it was sent to the voice. */
  rawOffset: number;
  /** Length of the (trimmed) raw text the per-character arrays must match. */
  rawLength: number;
  durationMs: number;
  characterEndMs?: number[];
  characterStartMs?: number[];
};

/**
 * Subtitle groups with times relative to the narration start. Exact when the voice timing covers
 * the text; otherwise each group lasts in proportion to its length.
 */
export const buildSubtitleGroups = (input: SubtitleGroupingInput): SubtitleGroup[] => {
  const exact = Boolean(input.characterEndMs && input.characterEndMs.length === input.rawLength);
  const words = getWordTimings(
    input.shown,
    input.rawIndex,
    input.rawOffset,
    exact ? input.characterEndMs : undefined,
    exact && input.characterStartMs?.length === input.rawLength ? input.characterStartMs : undefined,
  );
  const groups = groupSubtitleWords(words);
  if (!groups.length) return [];

  const texts = groups.map((group) => group.map((word) => word.text).join(" "));
  const timed = exact && groups.every((group) => group[group.length - 1].endMs !== null);
  if (timed) {
    const entries: SubtitleGroup[] = [];
    let previousEnd = 0;
    groups.forEach((group, index) => {
      const first = group[0];
      const endMs = group[group.length - 1].endMs ?? previousEnd;
      // With start times the subtitle appears when its first word is spoken; without, it follows the previous one.
      const startMs = first.startMs !== null ? first.startMs : previousEnd;
      entries.push({ text: texts[index], startMs: Math.min(startMs, endMs), endMs });
      previousEnd = endMs;
    });
    // No blink during a short silence between two subtitles.
    for (let index = 0; index < entries.length - 1; index += 1) {
      const gap = entries[index + 1].startMs - entries[index].endMs;
      if (gap > 0 && gap <= SUBTITLE_BRIDGE_MS) entries[index].endMs = entries[index + 1].startMs;
    }
    return entries;
  }

  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
  let cursor = 0;
  return texts.map((text) => {
    const lengthMs = totalChars > 0 ? (input.durationMs * text.length) / totalChars : 0;
    const entry = { text, startMs: cursor, endMs: cursor + lengthMs };
    cursor += lengthMs;
    return entry;
  });
};
