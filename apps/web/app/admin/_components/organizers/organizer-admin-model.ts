import type { OrganizerFeatureKey } from "../../../../lib/organizer-features";

/**
 * Data and pure helpers of Organisateurs (`AdminOrganizerClaimsTab` and its domain components, lot 5).
 * Shapes are those of `GET /api/admin/organizer-claims`, `GET /api/admin/event-publication-requests`
 * and `GET /api/admin/organizer-feature-catalog` (unchanged contracts; `editionSlug` added in lot 5).
 */

export type OrganizerUserSummary = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  label: string;
};

type EventSummary = {
  name: string;
  location?: string | null;
  race_date?: string | null;
} | null;

export type OrganizerClaim = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  organization_name: string;
  role_title: string;
  contact_email: string;
  official_site_url?: string | null;
  message?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: EventSummary;
};

export type OrganizerMembership = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  role: string;
  revoked_at?: string | null;
  revoke_reason?: string | null;
  race_events?: EventSummary;
};

export type OrganizerEditionRequest = {
  id: string;
  created_at: string;
  user_id: string;
  user?: OrganizerUserSummary;
  event_id: string;
  source_year: number;
  requested_start_date: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: EventSummary;
};

export type OrganizerPublicationRequest = {
  id: string;
  created_at: string;
  user_id: string;
  event_id: string;
  race_id?: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: EventSummary;
  requested_race?: {
    name: string;
    race_date?: string | null;
  } | null;
};

export type RaceEventOption = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
};

export type AssignmentUserOption = {
  id: string;
  email: string;
};

export type AssignmentAutocompleteOption = {
  id: string;
  label: string;
  description?: string;
};

export type OrganizerTier = "visibility" | "essential" | "complete" | "signature";

export type RacebookPublicationEvent = RaceEventOption & {
  editionId: string | null;
  editionYear: number | null;
  /** Canonical slug of the edition (`/courses/evenements/<slug>`); absent from older responses. */
  editionSlug?: string | null;
  isCurrentEdition: boolean;
  entitlement: {
    edition_id: string;
    tier: OrganizerTier;
    source: "system" | "stripe" | "manual_payment" | "admin" | "complimentary" | "legacy_admin";
    status: "active" | "revoked";
  } | null;
  featureGrants: Array<{
    edition_id: string;
    capability_key: OrganizerFeatureKey;
    status: "active" | "revoked";
  }>;
  invoices: Array<{
    id: string; invoice_number: string; invoice_issued_at: string; document_status: "active" | "replaced";
    tier: "essential" | "complete" | "signature"; service_date: string; due_date: string;
    original_subtotal: number; discount_total: number; net_total: number; paid_at: string | null;
    replaces_invoice_id: string | null; invoice_storage_path: string | null;
    legal_snapshot: {
      customer: { legalName: string; billingAddress: string; siren?: string | null; vatNumber?: string | null; purchaseOrderNumber?: string | null };
      lines?: Array<{ featureKey?: OrganizerFeatureKey; description: string; offered: boolean }>;
    };
  }>;
  payments: Array<{
    id: string;
    to_tier: string;
    status: "pending" | "paid" | "failed" | "expired" | "refunded" | "disputed";
    payment_channel: "stripe" | "bank_transfer";
    amount_subtotal?: number | null;
    amount_tax?: number | null;
    amount_total?: number | null;
    currency?: string | null;
    paid_at?: string | null;
    invoice_storage_path?: string | null;
    invoice_original_name?: string | null;
    invoice_number?: string | null;
    invoice_source?: "generated" | "uploaded" | null;
    created_at: string;
  }>;
  races: Array<{
    id: string;
    name: string;
    race_date?: string | null;
    racebook_is_live: boolean;
    racebook_publication_approved_at?: string | null;
    data_status?: "draft" | "complete" | null;
    missing_required_fields?: string[] | null;
  }>;
};

export type FeatureCatalogItem = { feature_key: OrganizerFeatureKey; label: string; minimum_tier: "complete" | "signature"; is_active: boolean };

export type PublicationOrigin = "admin" | "stripe" | "manual_payment" | "complimentary";

export const organizerTierLabel: Record<OrganizerTier, string> = {
  visibility: "Visibilité",
  essential: "Essentiel",
  complete: "Complet",
  signature: "Signature",
};

export const publicationOriginLabel: Record<NonNullable<RacebookPublicationEvent["entitlement"]>["source"], string> = {
  system: "Aucune activation",
  admin: "Admin",
  stripe: "Paiement Stripe",
  manual_payment: "Paiement par virement",
  complimentary: "Offert",
  legacy_admin: "Admin (historique)",
};

export const claimStatusLabel: Record<OrganizerClaim["status"], string> = {
  pending: "En attente",
  approved: "Approuve",
  rejected: "Refuse",
};

export const PUBLICATION_EVENTS_PER_PAGE = 10;

export const normalizeSearchValue = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("fr");

/** Active pack of an edition (a revoked or missing right is « Visibilité »). */
export const activeTier = (event: Pick<RacebookPublicationEvent, "entitlement">): OrganizerTier =>
  event.entitlement?.status === "active" ? event.entitlement.tier : "visibility";

/** Search, pack and `?edition=` filters of « Droits de publication organisateurs ». */
export const filterPublicationEvents = (
  events: RacebookPublicationEvent[],
  { editionId, tier, search }: { editionId: string | null; tier: "all" | OrganizerTier; search: string },
) => {
  const normalizedSearch = normalizeSearchValue(search.trim());
  return events.filter((event) => {
    if (editionId && event.editionId !== editionId) return false;
    if (tier !== "all" && activeTier(event) !== tier) return false;
    if (!normalizedSearch) return true;
    return normalizeSearchValue([
      event.name,
      event.editionYear ? String(event.editionYear) : "",
      event.location ?? "",
      ...event.races.map((race) => race.name),
    ].join(" ")).includes(normalizedSearch);
  });
};

/** A pending publication request concerns an edition when it names one of its formats, or the event's current edition. */
export const publicationRequestMatches = (request: OrganizerPublicationRequest, event: Pick<RacebookPublicationEvent, "id" | "races" | "isCurrentEdition">) =>
  request.event_id === event.id
  && (request.race_id ? event.races.some((race) => race.id === request.race_id) : event.isCurrentEdition);

/** Racebook state of an edition's formats. */
export const editionRacebookCounts = (event: Pick<RacebookPublicationEvent, "races">) => ({
  formats: event.races.length,
  published: event.races.filter((race) => race.racebook_is_live).length,
  approved: event.races.filter((race) => race.racebook_publication_approved_at).length,
  complete: event.races.filter((race) => race.data_status !== "draft").length,
});

/** Everything pending about one edition: access claims and new-edition requests of its event, publication requests of the edition. */
export const editionPendingRequests = (
  event: Pick<RacebookPublicationEvent, "id" | "races" | "isCurrentEdition">,
  lists: { claims: OrganizerClaim[]; publicationRequests: OrganizerPublicationRequest[]; editionRequests: OrganizerEditionRequest[] },
) => ({
  claims: lists.claims.filter((claim) => claim.event_id === event.id),
  publicationRequests: lists.publicationRequests.filter((request) => publicationRequestMatches(request, event)),
  editionRequests: lists.editionRequests.filter((request) => request.event_id === event.id),
});

/** Active organizer accounts of an event (memberships are per event, shared by its editions). */
export const eventMembers = (eventId: string, memberships: OrganizerMembership[]) =>
  memberships.filter((membership) => membership.event_id === eventId && !membership.revoked_at);

/** Page buttons around the current page (first, previous, current, next, last). */
export const pageNumbersAround = (page: number, totalPages: number) =>
  Array.from(new Set([1, page - 1, page, page + 1, totalPages]))
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= totalPages)
    .sort((left, right) => left - right);

// ---------------------------------------------------------------------------------------------
// URL of the edition drawer: `?edition=<id>` (lot 4 links from Ventes & facturation and /organizer) and `?fiche=`

export const EDITION_DRAWER_TABS = ["resume", "pack", "facturation", "demandes", "activite"] as const;
export type EditionDrawerTab = (typeof EDITION_DRAWER_TABS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const readEditionDrawer = (search: string): { editionId: string | null; tab: EditionDrawerTab } => {
  const params = new URLSearchParams(search);
  const edition = params.get("edition")?.trim() ?? "";
  const tab = EDITION_DRAWER_TABS.find((candidate) => candidate === params.get("fiche")) ?? "resume";
  return { editionId: UUID.test(edition) ? edition.toLowerCase() : null, tab };
};

/** Same search with the drawer opened on (or closed from) an edition; other parameters (`?vue=`) are kept. */
export const writeEditionDrawer = (search: string, editionId: string | null, tab: EditionDrawerTab = "resume") => {
  const params = new URLSearchParams(search);
  params.delete("edition");
  params.delete("fiche");
  if (editionId) {
    params.set("edition", editionId);
    if (tab !== "resume") params.set("fiche", tab);
  }
  const next = params.toString();
  return next ? `?${next}` : "";
};

/** Links of an edition: organizer space (`/organizer?eventId=`) and public page when the slug is known. */
export const editionLinks = (event: Pick<RacebookPublicationEvent, "id" | "editionSlug">) => ({
  organizerHref: `/organizer?${new URLSearchParams({ eventId: event.id }).toString()}`,
  publicHref: event.editionSlug ? `/courses/evenements/${encodeURIComponent(event.editionSlug)}` : null,
});
