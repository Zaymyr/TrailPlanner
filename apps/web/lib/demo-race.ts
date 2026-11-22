/**
 * Trail TST, the fixed demonstration event (printed brochure and business card
 * QR codes, /organisateurs demo, in-app search). Its current edition is moved to
 * today every day by the demo-race-refresh job (see demo-race-refresh.ts).
 *
 * Dependency-free so client components and pure catalog helpers can import it.
 */
export const DEMO_EVENT_ID = "7a110000-0000-4000-8000-000000000001";
export const DEMO_EDITION_ID = "41b2143c-cd5c-4e84-9106-398ef9e8ebf0";

/**
 * True for the Trail TST demonstration event. Its public pages stay reachable
 * (printed QR codes) but are labelled as a demo, have no registration CTA, are
 * noindex and stay out of the sitemap and of cross-race suggestions.
 */
export function isDemoRaceEventId(eventId: string | null | undefined): boolean {
  return eventId === DEMO_EVENT_ID;
}
