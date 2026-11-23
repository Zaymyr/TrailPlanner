/**
 * Old admin URLs → console routes (pure). Lot 1 of the admin console moved every tab to its own page;
 * links shared before keep working through these redirects:
 * - `/admin?onglet=<id>[&vue=..][&course=..]` (tab ids of lot 0, `admin-tabs.ts`);
 * - `/admin/publications?onglet=<id>` (agenda, reels, carousels, flyovers, gpx, published, settings);
 * - `/admin/video-generator` → `/admin/content/studio`.
 * Returns null when the URL is already a console URL (no redirect).
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Next.js page `searchParams` → URLSearchParams (first value of a repeated key). */
export const toSearchParams = (record: SearchParamsRecord | undefined): URLSearchParams => {
  const params = new URLSearchParams();
  Object.entries(record ?? {}).forEach(([key, value]) => {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  });
  return params;
};

const withQuery = (path: string, query: Record<string, string | null | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const search = params.toString();
  return search ? `${path}?${search}` : path;
};

const INBOX_VIEWS = new Set(["bugs", "feedback", "demandes", "demos"]);
const ORGANIZER_VIEWS = new Set(["publication", "acces"]);

const legacyAdminTab = (params: URLSearchParams): string | null => {
  const tab = params.get("onglet");
  if (tab === null) return null;
  const view = params.get("vue");
  switch (tab) {
    case "produits":
      return "/admin/catalog/products";
    case "utilisateurs":
      return "/admin/runners";
    case "messagerie":
      if (view === "questionnaires") return "/admin/messaging/surveys";
      // The Messagerie sub-tabs live in the « Traiter » tab of À traiter (lot 2), which `?vue=` opens.
      return withQuery("/admin/inbox", { vue: view && INBOX_VIEWS.has(view) ? view : "bugs" });
    case "templates":
      return "/admin/content/posts?onglet=templates";
    case "courses":
      return withQuery("/admin/catalog/races", { course: params.get("course")?.trim() || null });
    case "organisateurs":
      return withQuery("/admin/organizers", { vue: view && ORGANIZER_VIEWS.has(view) && view !== "publication" ? view : null });
    case "preuves":
      return "/admin/organizers/social-proofs";
    case "partenaires":
      return "/admin/catalog/partners";
    case "croissance":
      return "/admin/analytics";
    default:
      // An unknown tab used to open the first tab; the console home replaces it.
      return "/admin";
  }
};

const legacyPublicationsTab = (params: URLSearchParams): string => {
  switch (params.get("onglet")) {
    case "reels":
      return "/admin/content/posts";
    case "carousels":
      return "/admin/content/posts?onglet=carousels";
    case "published":
      return "/admin/content/posts?onglet=published";
    case "flyovers":
      return "/admin/content/flyovers";
    case "gpx":
      return "/admin/catalog/races?vue=qualite";
    case "settings":
      return "/admin/system/automation";
    default:
      return "/admin/content";
  }
};

export const resolveLegacyAdminUrl = (pathname: string, params: URLSearchParams): string | null => {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/admin") return legacyAdminTab(params);
  if (path === "/admin/publications") return legacyPublicationsTab(params);
  if (path === "/admin/video-generator") return "/admin/content/studio";
  return null;
};
