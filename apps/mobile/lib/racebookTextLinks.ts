/**
 * Runner-facing helpers that turn raw organizer text into actionable RaceBook
 * links: maps searches for plain addresses and labelled buttons for URLs that
 * organizers paste inside free-text notes.
 */

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** Google Maps search URL for an address that has no organizer maps link. */
export function buildMapsSearchUrl(address: string | null | undefined): string | null {
  const query = address?.trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return url;
  }
}

export type RacebookTextLink = { url: string; host: string };

/**
 * Replaces each URL of a free-text note with its short host name, so the note
 * stays readable, and returns the URLs to render as buttons.
 */
export function extractTextLinks(text: string): { text: string; links: RacebookTextLink[] } {
  const links: RacebookTextLink[] = [];
  const cleaned = text.replace(URL_PATTERN, (match) => {
    const url = match.replace(TRAILING_PUNCTUATION, '');
    const trailing = match.slice(url.length);
    const host = hostnameOf(url);
    if (!links.some((link) => link.url === url)) links.push({ url, host });
    return `${host}${trailing}`;
  });
  return { text: cleaned, links };
}
