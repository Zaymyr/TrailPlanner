/**
 * URL state of the /admin tabs (pure): `?onglet=` selects the tab, `?vue=` the sub-tab of Messagerie and
 * Organisateurs, `?course=` the race the catalog opens for editing. Unknown values fall back to the default.
 */

export const ADMIN_TABS = [
  { id: "produits", label: "Catalogue produits" },
  { id: "utilisateurs", label: "Utilisateurs" },
  { id: "messagerie", label: "Messagerie" },
  { id: "templates", label: "Templates sociaux" },
  { id: "courses", label: "Catalogue de courses" },
  { id: "organisateurs", label: "Organisateurs" },
  { id: "preuves", label: "Preuves sociales" },
  { id: "partenaires", label: "Liens partenaires" },
  { id: "croissance", label: "Croissance" },
] as const;
export type AdminTabId = (typeof ADMIN_TABS)[number]["id"];

export const MESSAGING_VIEWS = ["bugs", "feedback", "demandes", "demos", "questionnaires"] as const;
export type MessagingView = (typeof MESSAGING_VIEWS)[number];

export const ORGANIZER_VIEWS = ["publication", "acces"] as const;
export type OrganizerView = (typeof ORGANIZER_VIEWS)[number];

const pick = <T extends string>(allowed: readonly T[], value: string | null, fallback: T): T =>
  allowed.find((candidate) => candidate === value) ?? fallback;

export const readAdminTab = (search: string): AdminTabId =>
  pick(ADMIN_TABS.map((tab) => tab.id), new URLSearchParams(search).get("onglet"), "produits");

export const readMessagingView = (search: string): MessagingView => pick(MESSAGING_VIEWS, new URLSearchParams(search).get("vue"), "bugs");

export const readOrganizerView = (search: string): OrganizerView => pick(ORGANIZER_VIEWS, new URLSearchParams(search).get("vue"), "publication");

/** The race id of `?course=`, or null when absent or blank. */
export const readRaceParam = (search: string): string | null => new URLSearchParams(search).get("course")?.trim() || null;

/** Search string for a tab, dropping the sub-view and race of the previous tab. Other params are kept. */
export const searchForTab = (search: string, tab: AdminTabId): string => {
  const params = new URLSearchParams(search);
  params.set("onglet", tab);
  params.delete("vue");
  params.delete("course");
  return `?${params.toString()}`;
};

/** Search string with `?vue=` set (the default view is left out of the URL). */
export const searchForView = (search: string, view: string, defaultView: string): string => {
  const params = new URLSearchParams(search);
  if (view === defaultView) params.delete("vue");
  else params.set("vue", view);
  const next = params.toString();
  return next ? `?${next}` : "";
};

/** Link to the catalog editing one race (used by « GPX à traiter »). */
export const raceEditHref = (raceId: string) => `/admin?${new URLSearchParams({ onglet: "courses", course: raceId }).toString()}`;

/** Replaces the query string of the current URL without adding a history entry or reloading. */
export const replaceLocationSearch = (search: string) => {
  const url = new URL(window.location.href);
  url.search = search;
  window.history.replaceState(null, "", url.toString());
};
