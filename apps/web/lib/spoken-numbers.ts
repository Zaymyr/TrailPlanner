/**
 * French text-to-speech engines misread digits and symbols ("850 m D+", "14h30", "6,2 km"). The
 * narration keeps them for the subtitles, and the voice gets this spoken version instead. Each
 * converted token records where it came from so the voice timing can be mapped back onto the
 * original text, character by character.
 */

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

const belowHundred = (value: number, feminine: boolean): string => {
  const one = feminine ? "une" : "un";
  if (value === 1) return one;
  if (value < 20) return UNITS[value];
  if (value < 70) {
    const ten = Math.floor(value / 10);
    const unit = value % 10;
    if (unit === 0) return TENS[ten];
    if (unit === 1) return `${TENS[ten]} et ${one}`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }
  if (value < 80) {
    if (value === 71) return "soixante et onze";
    return `soixante-${UNITS[value - 60]}`;
  }
  if (value === 80) return "quatre-vingts";
  const rest = value - 80;
  return `quatre-vingt-${rest === 1 ? one : UNITS[rest]}`;
};

const belowThousand = (value: number, feminine: boolean, beforeMultiplier = false): string => {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const restWords = rest ? belowHundred(rest, feminine) : "";
  // "quatre-vingts" and "deux cents" lose their s before "mille".
  const tidy = (words: string) => (beforeMultiplier ? words.replace(/vingts$|cents$/, (match) => match.slice(0, -1)) : words);
  if (hundreds === 0) return tidy(restWords);
  const hundredWords = hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest ? "" : "s"}`;
  return tidy(rest ? `${hundredWords} ${restWords}` : hundredWords);
};

/** French words of a whole number (0 to 999 999 999). */
export const frenchNumberWords = (value: number, feminine = false): string => {
  if (!Number.isFinite(value) || value < 0 || value >= 1_000_000_000) return String(value);
  const whole = Math.floor(value);
  if (whole === 0) return "zéro";
  const millions = Math.floor(whole / 1_000_000);
  const thousands = Math.floor((whole % 1_000_000) / 1_000);
  const rest = whole % 1_000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? "un million" : `${belowThousand(millions, false)} millions`);
  if (thousands) parts.push(thousands === 1 ? "mille" : `${belowThousand(thousands, false, true)} mille`);
  if (rest) parts.push(belowThousand(rest, feminine));
  return parts.join(" ");
};

const decimalWords = (digits: string) =>
  // "6,25" reads "six virgule vingt-cinq"; "1,05" reads "un virgule zéro cinq".
  digits.length <= 2 && !digits.startsWith("0")
    ? frenchNumberWords(Number(digits))
    : [...digits].map((digit) => UNITS[Number(digit)]).join(" ");

const numberWords = (raw: string, feminine = false) => {
  const [whole, decimals] = raw.replace(/[\s  ]/g, "").split(/[,.]/);
  const wholeWords = frenchNumberWords(Number(whole), feminine);
  return decimals ? `${wholeWords} virgule ${decimalWords(decimals)}` : wholeWords;
};

const isPlural = (raw: string) => Number(raw.replace(/[\s  ]/g, "").replace(",", ".")) >= 2;

const NUMBER = String.raw`\d{1,3}(?:[   ]\d{3})+(?:[,.]\d+)?|\d+(?:[,.]\d+)?`;

type Rule = { pattern: RegExp; speak: (match: RegExpExecArray) => string };

// Order matters: the first rule matching at a position wins.
const RULES: Rule[] = [
  { pattern: /1er(?![\p{L}\d])/uy, speak: () => "premier" },
  { pattern: /1re(?![\p{L}\d])/uy, speak: () => "première" },
  // 14h30, 6h, 6 h 05
  {
    pattern: new RegExp(String.raw`(\d{1,2})\s?h\s?(\d{2})?(?![\p{L}\d])`, "uy"),
    speak: (match) => {
      const hours = Number(match[1]);
      const minutes = match[2] ? Number(match[2]) : 0;
      const hourWords = `${frenchNumberWords(hours, true)} heure${hours >= 2 ? "s" : ""}`;
      return minutes ? `${hourWords} ${frenchNumberWords(minutes, true)}` : hourWords;
    },
  },
  // km 12 (a kilometre mark)
  {
    pattern: new RegExp(String.raw`km\s?(${NUMBER})(?![\p{L}\d])`, "uy"),
    speak: (match) => `kilomètre ${numberWords(match[1])}`,
  },
  // 850 m D+, 12 km, 9 %, 2 000 m, 1 200 D+
  {
    // A number glued to letters ("3x", "10e") is left alone.
    pattern: new RegExp(String.raw`(${NUMBER})(?:\s?(km|m|%)(?![\p{L}\d]))?(?:\s?(?:de\s)?(D[+-]))?(?![\p{L}\d])`, "uy"),
    speak: (match) => {
      const [, raw, unit, elevation] = match;
      const plural = isPlural(raw);
      const words = numberWords(raw);
      const unitWords = unit === "km"
        ? ` kilomètre${plural ? "s" : ""}`
        : unit === "m"
          ? ` mètre${plural ? "s" : ""}`
          : unit === "%"
            ? " pour cent"
            : "";
      const elevationWords = elevation === "D+" ? " de dénivelé positif" : elevation === "D-" ? " de dénivelé négatif" : "";
      return `${words}${unitWords}${elevationWords}`;
    },
  },
  { pattern: /D\+(?![\p{L}\d])/uy, speak: () => "dénivelé positif" },
  { pattern: /D-(?![\p{L}\d])/uy, speak: () => "dénivelé négatif" },
];

export type SpokenText = {
  /** Text for the voice engine, numbers and symbols in words. */
  spoken: string;
  /** For each character of the original text, the index of its last character in `spoken`. */
  spokenIndexOf: number[];
};

const startsToken = (text: string, index: number) => index === 0 || !/[\p{L}\d]/u.test(text[index - 1]);

export const toSpokenText = (text: string): SpokenText => {
  let spoken = "";
  const spokenIndexOf: number[] = [];
  let index = 0;
  while (index < text.length) {
    let matched = false;
    if (startsToken(text, index) && /[\dkD1]/.test(text[index])) {
      for (const rule of RULES) {
        rule.pattern.lastIndex = index;
        const match = rule.pattern.exec(text);
        if (!match || match[0].length === 0) continue;
        const words = rule.speak(match);
        const start = spoken.length;
        spoken += words;
        // Spread the token's original characters over its spoken words, in order.
        for (let offset = 0; offset < match[0].length; offset += 1) {
          spokenIndexOf.push(start + Math.max(0, Math.ceil(((offset + 1) * words.length) / match[0].length) - 1));
        }
        index += match[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      spoken += text[index];
      spokenIndexOf.push(spoken.length - 1);
      index += 1;
    }
  }
  return { spoken, spokenIndexOf };
};

/** Maps per-character end times of the spoken text back onto the original text. */
export const mapSpokenTimingToText = (spokenText: SpokenText, spokenEndTimes: number[]) =>
  spokenText.spokenIndexOf.map((spokenIndex) => spokenEndTimes[Math.min(spokenIndex, spokenEndTimes.length - 1)] ?? 0);
