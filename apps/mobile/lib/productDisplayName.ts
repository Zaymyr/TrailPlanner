const PRESERVED_ACRONYMS = new Set(['UTMB', 'BCAA', 'GU', 'SIS', 'NAAK', 'NRGY']);

function titleCaseWord(word: string) {
  if (PRESERVED_ACRONYMS.has(word)) return word;
  if (/^\d/.test(word)) return word;
  return word.length > 1
    ? `${word.slice(0, 1)}${word.slice(1).toLocaleLowerCase()}`
    : word;
}

export function formatProductDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || !/[A-ZÀ-ÖØ-Þ]/.test(trimmed) || /[a-zà-öø-ÿ]/.test(trimmed)) return trimmed;

  return trimmed
    .split(/(\s+|-|\/)/)
    .map((part) => (/^(\s+|-|\/)$/.test(part) ? part : titleCaseWord(part)))
    .join('');
}
