/**
 * Admin console navigation (pure): the sidebar groups of the ADR « Console d'administration » §4, the
 * active entry for a path, and the breadcrumb of a page. The shell, the ⌘K palette and the tests read
 * the same table, so a route exists in exactly one place.
 */

export type AdminCountKey = "inbox" | "organizers";

export type AdminNavIcon =
  | "overview"
  | "inbox"
  | "analytics"
  | "billing"
  | "runners"
  | "organizers"
  | "races"
  | "products"
  | "partners"
  | "calendar"
  | "studio"
  | "posts"
  | "renders"
  | "flyovers"
  | "messages"
  | "surveys"
  | "automation"
  | "integrations"
  | "maintenance"
  | "audit";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminNavIcon;
  /** Pending count shown next to the entry (from `/api/admin/inbox-counts`). */
  count?: AdminCountKey;
  /** Extra words the ⌘K palette matches (old tab names, synonyms). */
  keywords?: string[];
};

export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: null,
    items: [
      { href: "/admin", label: "Vue d’ensemble", icon: "overview", keywords: ["accueil", "dashboard", "tableau de bord"] },
      { href: "/admin/inbox", label: "À traiter", icon: "inbox", count: "inbox", keywords: ["messagerie", "bugs", "feedback", "demandes", "démos"] },
    ],
  },
  {
    label: "Pilotage",
    items: [
      { href: "/admin/analytics", label: "Analytique", icon: "analytics", keywords: ["croissance", "funnel", "kpi"] },
      { href: "/admin/billing", label: "Ventes & facturation", icon: "billing", keywords: ["factures", "virements", "paiements", "stripe"] },
    ],
  },
  {
    label: "Clients",
    items: [
      { href: "/admin/runners", label: "Coureurs", icon: "runners", keywords: ["utilisateurs", "premium", "comptes"] },
      { href: "/admin/organizers", label: "Organisateurs", icon: "organizers", count: "organizers", keywords: ["claims", "accès", "livret", "packs"] },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/admin/catalog/races", label: "Courses & événements", icon: "races", keywords: ["catalogue de courses", "gpx", "ravitaillements", "qualité"] },
      { href: "/admin/catalog/products", label: "Produits nutrition", icon: "products", keywords: ["catalogue produits"] },
      { href: "/admin/catalog/partners", label: "Liens partenaires", icon: "partners", keywords: ["booking", "decathlon"] },
    ],
  },
  {
    label: "Contenus",
    items: [
      { href: "/admin/content", label: "Calendrier", icon: "calendar", keywords: ["agenda", "à surveiller"] },
      { href: "/admin/content/studio", label: "Studio vidéo", icon: "studio", keywords: ["générateur vidéo", "3d", "reel"] },
      { href: "/admin/content/posts", label: "Publications", icon: "posts", keywords: ["reels", "carrousels", "instagram", "templates sociaux"] },
      { href: "/admin/content/renders", label: "Rendus", icon: "renders", keywords: ["cloud run", "rendus en cours"] },
      { href: "/admin/content/flyovers", label: "Vidéos de survol", icon: "flyovers", keywords: ["survols", "commandes"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/messaging", label: "Messages", icon: "messages", keywords: ["notifications", "envoyer un message"] },
      { href: "/admin/messaging/surveys", label: "Questionnaires", icon: "surveys", keywords: ["sondages"] },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/admin/system/automation", label: "Automatisations", icon: "automation", keywords: ["paramètres", "interrupteurs", "reels automatiques"] },
      { href: "/admin/system/integrations", label: "Intégrations", icon: "integrations", keywords: ["instagram", "compte"] },
      { href: "/admin/system/maintenance", label: "Maintenance", icon: "maintenance", keywords: ["backfill", "nettoyage"] },
      { href: "/admin/system/audit", label: "Journal", icon: "audit", keywords: ["audit", "historique"] },
    ],
  },
];

/** Pages reached from an entry but not listed in the sidebar (their parent stays active). */
export const ADMIN_SUBPAGES: Array<{ href: string; label: string; parent: string; keywords?: string[] }> = [
  { href: "/admin/organizers/social-proofs", label: "Preuves sociales", parent: "/admin/organizers", keywords: ["témoignages"] },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((group) => group.items);

const normalizePath = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

const matches = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

/** The sidebar entry for a path: the longest matching href (`/admin` only matches itself). */
export const findActiveNavItem = (pathname: string): AdminNavItem | null => {
  const path = normalizePath(pathname);
  return ADMIN_NAV_ITEMS.filter((item) => matches(path, item.href)).sort((left, right) => right.href.length - left.href.length)[0] ?? null;
};

export type AdminCrumb = { label: string; href?: string };

/** « Admin › Contenus › Studio vidéo »: the group is plain text, the entry and its sub-page are links. */
export const breadcrumbFor = (pathname: string): AdminCrumb[] => {
  const path = normalizePath(pathname);
  const crumbs: AdminCrumb[] = [{ label: "Admin", href: "/admin" }];
  const item = findActiveNavItem(path);
  if (!item || item.href === "/admin") {
    crumbs.push({ label: ADMIN_NAV_ITEMS[0].label });
    return crumbs;
  }
  const group = ADMIN_NAV.find((candidate) => candidate.items.includes(item));
  if (group?.label) crumbs.push({ label: group.label });
  const subpage = ADMIN_SUBPAGES.find((candidate) => matches(path, candidate.href));
  if (subpage) {
    crumbs.push({ label: item.label, href: item.href }, { label: subpage.label });
  } else {
    crumbs.push({ label: item.label });
  }
  return crumbs;
};
