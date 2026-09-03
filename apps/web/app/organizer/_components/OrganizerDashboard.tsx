"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { buildCumulativeElevationTotals, GpxParseError, parseGpx } from "../../../lib/gpx/parseGpx";
import { type FuelType } from "../../../lib/fuel-types";
import { normalizeImportedWaypoints } from "../../../lib/gpx/normalizeImportedWaypoints";
import {
  defaultOrganizerAidStationDetails,
  defaultOrganizerRaceDetails,
  expandRaceAccessWithEvent,
  expandRaceEquipmentWithCommon,
  hasRaceAccessOverride,
  type OrganizerEventDetails,
} from "../../../lib/organizer-dashboard-details";
import type { FuelProduct } from "../../../lib/product-types";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { supportEmail } from "../../support/copy";
import {
  trackOrganizerCheckoutStarted,
  trackOrganizerOfferViewed,
  trackOrganizerPurchaseVerified,
} from "../../../lib/product-analytics";
import { buildOrganizerCompletion, type OrganizerCompletionSummary, type OrganizerModuleId } from "./completion";
import { AidStationsEditor } from "./dashboard/aid-stations-editor";
import { ADD_FORMAT_TAB_ID, emptyProductForm, EVENT_TAB_ID, MAX_EVENT_IMAGE_SIZE_BYTES } from "./dashboard/constants";
import { OrganizerToast, ToggleChip } from "./dashboard/controls";
import {
  clearOrganizerDataCache,
  invalidateOrganizerGpxPreviewCache,
  invalidateOrganizerRaceDataCache,
  invalidateOrganizerRaceSidecarsCache,
  readOrganizerGpxPreviewCache,
  readOrganizerProductCatalogCache,
  readOrganizerRaceSidecarsCache,
  writeOrganizerGpxPreviewCache,
  writeOrganizerProductCatalogCache,
  writeOrganizerRaceSidecarsCache,
  type OrganizerRaceSidecars,
} from "./dashboard/data-cache";
import { AccessEditor, BibPickupEditor, EquipmentEditor, RaceBibPickupEditor, ServicesEditor } from "./dashboard/detail-editors";
import { EventInfoEditor, FormatsEditor } from "./dashboard/event-format-editors";
import {
  aidStationRowsToDrafts,
  applyGpxStatsToRaceForm,
  buildEventDraft,
  buildOrganizerFormatSavePlan,
  buildProductsById,
  cloneJson,
  createEmptyEventForm,
  createEmptyRaceForm,
  createRaceFormFromEventDefaults,
  createRaceFormFromFormatDefaults,
  eventToForm,
  getAvailableEditionYears,
  getEventEdition,
  getRaceEditionYear,
  getRaceEditionYearLabel,
  getRaceEditionYearValue,
  groupRacesBySeries,
  getModuleDescription,
  getModuleForTab,
  getModuleTitle,
  getOrganizerDirtyScopeKey,
  isOrganizerScopeSavePending,
  shouldSaveActiveRaceBeforeRacebookChange,
  normalizeGpxPreview,
  normalizeOrganizerEventDetail,
  raceToForm,
  RACE_DETAILS_MODULE_IDS,
  sortAidStationsByDistance,
  syncAidStationWithGpxPreview,
  syncAidStationsWithGpxPreview,
  toNumberOrNull,
  type OrganizerAidStationRow,
} from "./dashboard/helpers";
import { ProductPickerModal, ProductsEditor } from "./dashboard/products-editor";
import { SponsorsEditor } from "./dashboard/sponsors-editor";
import {
  buildInitialWebsiteImportFieldSelections,
  buildInitialWebsiteImportFormatDecisions,
  WebsiteImportFieldReview,
  WebsiteImportFormatDiscoveryReview,
} from "./dashboard/website-import-review-details";
import {
  CompletionTabsPanel,
  OrganizerNoMembershipCard,
  OrganizerSignedOutCard,
  OrganizerSummaryHeader,
} from "./dashboard/shell";
import type {
  AidStationDraft,
  ClaimRow,
  EditionRequestRow,
  EventFormValues,
  GpxPreview,
  MembershipRow,
  OrganizerEventDetail,
  PublicationRequestRow,
  ProductFormValues,
  RaceFormat,
  RaceFormValues,
  RelayPointDraft,
  StationProduct,
  WebsiteImportDiscoveryWorkflow,
  WebsiteImportFieldSelection,
  WebsiteImportFormatDecision,
  WebsiteImportReviewWorkflow,
  WebsiteImportWorkflow,
} from "./dashboard/types";

const MAX_RACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const RACE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const MAX_UPDATE_MESSAGE_LENGTH = 280;
const WEBSITE_IMPORT_MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const WEBSITE_IMPORT_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const WEBSITE_IMPORT_REQUIRED_FIELD_LABELS: Record<string, string> = {
  race_date: "date",
  distance_km: "distance",
  elevation_gain_m: "D+",
};
const EMPTY_DIRTY_MODULES = new Set<OrganizerModuleId>();

type OrganizerImportDocumentReference = {
  path: string;
  fileName: string;
  mediaType: (typeof WEBSITE_IMPORT_DOCUMENT_MIME_TYPES)[number];
  sizeBytes: number;
};

const isOrganizerImportDocumentMimeType = (
  value: string
): value is OrganizerImportDocumentReference["mediaType"] =>
  WEBSITE_IMPORT_DOCUMENT_MIME_TYPES.some((mediaType) => mediaType === value);

const getDocumentExtension = (document: File) => {
  const extension = document.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (extension) return extension;
  return document.type === "application/pdf" ? "pdf" : document.type.split("/")[1] ?? "bin";
};

const removeTemporaryOrganizerImportDocuments = async (
  documents: OrganizerImportDocumentReference[],
  accessToken: string
) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return;

  await Promise.all(
    documents.map((document) =>
      fetch(`${supabaseUrl}/storage/v1/object/organizer-imports/${document.path}`, {
        method: "DELETE",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null)
    )
  );
};

const uploadTemporaryOrganizerImportDocuments = async ({
  documents,
  userId,
  accessToken,
}: {
  documents: File[];
  userId: string;
  accessToken: string;
}): Promise<OrganizerImportDocumentReference[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Configuration Supabase manquante.");

  const uploaded: OrganizerImportDocumentReference[] = [];
  try {
    for (const document of documents) {
      if (!isOrganizerImportDocumentMimeType(document.type)) {
        throw new Error(`Le format du document ${document.name} n’est pas pris en charge.`);
      }
      const path = `${userId}/${crypto.randomUUID()}.${getDocumentExtension(document)}`;
      const response = await fetch(`${supabaseUrl}/storage/v1/object/organizer-imports/${path}`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": document.type,
        },
        body: document,
      });
      if (!response.ok) throw new Error(`Échec de l'envoi du document ${document.name}.`);
      uploaded.push({ path, fileName: document.name, mediaType: document.type, sizeBytes: document.size });
    }
    return uploaded;
  } catch (error) {
    await removeTemporaryOrganizerImportDocuments(uploaded, accessToken);
    throw error;
  }
};

type OrganizerSaveOptions = {
  background?: boolean;
  reloadEvent?: boolean;
  scopeRevision?: number;
};

type OrganizerRaceEventUpdate = {
  id: string;
  event_id: string;
  race_id: string | null;
  message: string;
  created_at: string;
  created_by?: string | null;
};

type OrganizerPricingContext = {
  eventId: string;
  eventName: string;
  editionId: string;
  editionYear: string;
  tier: "visibility" | "racebook" | "pro";
};

export function OrganizerDashboard({
  requestedEventId = null,
  requestedImportUrl = null,
}: {
  requestedEventId?: string | null;
  requestedImportUrl?: string | null;
}) {
  const { session, isLoading } = useVerifiedSession();
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [editionRequests, setEditionRequests] = useState<EditionRequestRow[]>([]);
  const [publicationRequests, setPublicationRequests] = useState<PublicationRequestRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [eventForm, setEventForm] = useState<EventFormValues>(() => createEmptyEventForm());
  const [activeTab, setActiveTab] = useState(EVENT_TAB_ID);
  const [selectedEditionYear, setSelectedEditionYear] = useState("");
  const [activeModule, setActiveModule] = useState<OrganizerModuleId>("event");
  const [raceForm, setRaceForm] = useState<RaceFormValues>(() => createEmptyRaceForm());
  const [newRaceForm, setNewRaceForm] = useState<RaceFormValues>(() => createEmptyRaceForm());
  const [newRaceImageFile, setNewRaceImageFile] = useState<File | null>(null);
  const [newRaceGpxFile, setNewRaceGpxFile] = useState<File | null>(null);
  const [newEditionDate, setNewEditionDate] = useState("");
  const [newEditionEndDate, setNewEditionEndDate] = useState("");
  const [aidStations, setAidStations] = useState<AidStationDraft[]>([]);
  const [relayPoints, setRelayPoints] = useState<RelayPointDraft[]>([]);
  const [expandedStationKey, setExpandedStationKey] = useState<string | null>(null);
  const [stationProducts, setStationProducts] = useState<StationProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<FuelProduct[]>([]);
  const [sidecarLoadedRaceId, setSidecarLoadedRaceId] = useState<string | null>(null);
  const [gpxLoadedRaceKey, setGpxLoadedRaceKey] = useState<string | null>(null);
  const [productPickerStationId, setProductPickerStationId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productStationId, setProductStationId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormValues>(emptyProductForm);
  const [dirtyModulesByScope, setDirtyModulesByScope] = useState<Record<string, Set<OrganizerModuleId>>>({});
  const [pendingRevisionByScope, setPendingRevisionByScope] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; type: "success" | "error"; message: string } | null>(null);
  const [gpxPreview, setGpxPreview] = useState<GpxPreview | null>(null);
  const [eventUpdatesDialogOpen, setEventUpdatesDialogOpen] = useState(false);
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [pricingContext, setPricingContext] = useState<OrganizerPricingContext | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<"racebook" | "pro" | null>(null);
  const [complimentaryGrantTarget, setComplimentaryGrantTarget] = useState<"racebook" | "pro" | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [eventUpdateMessage, setEventUpdateMessage] = useState("");
  const [eventUpdateRaceId, setEventUpdateRaceId] = useState<string | null>(null);
  const [eventUpdateError, setEventUpdateError] = useState<string | null>(null);
  const [eventUpdateSending, setEventUpdateSending] = useState(false);
  const [eventUpdateDeletingId, setEventUpdateDeletingId] = useState<string | null>(null);
  const [eventFavoriteCount, setEventFavoriteCount] = useState<number | null>(null);
  const [eventUpdates, setEventUpdates] = useState<OrganizerRaceEventUpdate[]>([]);
  const [sponsorSummary, setSponsorSummary] = useState<{ editionId: string; sponsors: number; clicks: number } | null>(null);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [websiteImportUrl, setWebsiteImportUrl] = useState("");
  const [websiteImportFormatUrls, setWebsiteImportFormatUrls] = useState<string[]>([""]);
  const [websiteImportDocuments, setWebsiteImportDocuments] = useState<File[]>([]);
  const [websiteImportWorkflow, setWebsiteImportWorkflow] = useState<WebsiteImportWorkflow | null>(null);
  const [websiteImportFormatDecisions, setWebsiteImportFormatDecisions] = useState<WebsiteImportFormatDecision[]>([]);
  const [websiteImportFieldSelections, setWebsiteImportFieldSelections] = useState<Record<string, WebsiteImportFieldSelection>>({});
  const [websiteImportError, setWebsiteImportError] = useState<string | null>(null);
  const [websiteImportBusyAction, setWebsiteImportBusyAction] = useState<
    "discover" | "confirm" | "analyze" | "apply" | null
  >(null);
  const handledWebsiteImport = useRef<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);
  const activeRaceIdRef = useRef<string | null>(null);
  const dirtyRevisionByScopeRef = useRef<Record<string, number>>({});
  const backgroundSaveQueuesRef = useRef<Record<string, Promise<boolean>>>({});
  const sidecarRequestsRef = useRef(new Map<string, Promise<OrganizerRaceSidecars | null>>());
  const catalogProductsRequestRef = useRef<Promise<FuelProduct[] | null> | null>(null);
  const gpxRequestsRef = useRef(new Map<string, Promise<GpxPreview | null>>());
  const cacheOwnerIdRef = useRef<string | null>(null);
  const cacheGenerationRef = useRef(0);
  const previousActiveTierRef = useRef<"visibility" | "racebook" | "pro">("visibility");
  const requestedBootstrapEventIdRef = useRef(requestedEventId);
  const skipNextEventLoadRef = useRef<string | null>(null);

  const accessToken = session?.accessToken ?? null;
  const isAdmin = session?.role === "admin" || session?.roles?.includes("admin") === true;
  selectedEventIdRef.current = selectedEventId;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const raceSeriesGroups = useMemo(() => groupRacesBySeries(eventDetail?.races ?? []), [eventDetail?.races]);
  const activeEdition = getEventEdition(eventDetail, selectedEditionYear);
  const activeTier = activeEdition?.entitlement?.status === "active" ? activeEdition.entitlement.tier : "visibility";
  const websiteImportExistingRaces = useMemo(
    () => (eventDetail?.races ?? []).filter((race) =>
      activeEdition
        ? race.edition_id === activeEdition.id || (!race.edition_id && getRaceEditionYearValue(race.race_date) === selectedEditionYear)
        : false
    ),
    [activeEdition, eventDetail?.races, selectedEditionYear]
  );
  const eventUpdateRaceOptions = (eventDetail?.races ?? []).filter(
    (race) => race.is_live && (!activeEdition || race.edition_id === activeEdition.id)
  );
  const activeSeries =
    activeTab === EVENT_TAB_ID || activeTab === ADD_FORMAT_TAB_ID
      ? null
      : raceSeriesGroups.find((group) => group.id === activeTab) ?? null;
  const activeRace =
    activeSeries?.races.find((race) => race.edition_id === activeEdition?.id || getRaceEditionYearValue(race.race_date) === selectedEditionYear) ??
    activeSeries?.races[0] ??
    null;
  activeRaceIdRef.current = activeRace?.id ?? null;

  useEffect(() => {
    const ownerId = session?.id ?? null;
    if (cacheOwnerIdRef.current === ownerId) return;
    clearOrganizerDataCache();
    cacheGenerationRef.current += 1;
    sidecarRequestsRef.current.clear();
    gpxRequestsRef.current.clear();
    catalogProductsRequestRef.current = null;
    cacheOwnerIdRef.current = ownerId;
  }, [session?.id]);

  const activeDirtyScopeKey = getOrganizerDirtyScopeKey(selectedEventId, activeTab, activeRace?.id ?? null);
  const currentScopeDirtyModules = activeDirtyScopeKey
    ? dirtyModulesByScope[activeDirtyScopeKey] ?? EMPTY_DIRTY_MODULES
    : EMPTY_DIRTY_MODULES;
  const currentScopeRevision = activeDirtyScopeKey ? dirtyRevisionByScopeRef.current[activeDirtyScopeKey] ?? 0 : 0;
  const currentScopeIsSaving = activeDirtyScopeKey
    ? isOrganizerScopeSavePending(
        currentScopeDirtyModules.size,
        currentScopeRevision,
        pendingRevisionByScope[activeDirtyScopeKey]
      )
    : false;
  const dirtyModules = currentScopeIsSaving ? EMPTY_DIRTY_MODULES : currentScopeDirtyModules;
  const activeRaceForCompletion = activeRace ? { ...activeRace, organizerDetails: raceForm.organizerDetails } : null;
  const productPickerStation = productPickerStationId ? aidStations.find((station) => station.id === productPickerStationId) ?? null : null;
  const hasDirtyChanges = dirtyModules.size > 0;
  const hasAnyDirtyChanges = Object.values(dirtyModulesByScope).some((modules) => modules.size > 0);
  const currentPublicationRequests = publicationRequests.filter((request) => request.event_id === selectedEventId);
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ id: Date.now(), type, message });
  }, []);
  const handleSponsorSummaryChange = useCallback((summary: { sponsors: number; clicks: number }) => {
    if (!activeEdition?.id) return;
    setSponsorSummary({ editionId: activeEdition.id, ...summary });
  }, [activeEdition?.id]);

  const formatUpdateDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  const eventDraft = buildEventDraft(eventDetail, eventForm, activeRace, raceForm, selectedEditionYear);
  const productsById = useMemo(() => buildProductsById(catalogProducts, stationProducts), [catalogProducts, stationProducts]);
  const authHeaders = useMemo((): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);
  const sanitizeRaceDetailsForSave = (details: RaceFormValues["organizerDetails"]) => ({
    ...details,
    schedule: {
      ...details.schedule,
      shuttleSchedule: null,
    },
  });

  const validateRaceImage = (file: File) => {
    if (!RACE_IMAGE_MIME_TYPES.includes(file.type as (typeof RACE_IMAGE_MIME_TYPES)[number])) {
      showToast("error", "Ajoute une image JPEG, PNG, WebP ou AVIF.");
      return false;
    }
    if (file.size > MAX_RACE_IMAGE_SIZE_BYTES) {
      showToast("error", "Image trop lourde: 5 Mo maximum.");
      return false;
    }
    return true;
  };

  const completion: OrganizerCompletionSummary | null = useMemo(() => {
    if (!eventDraft) return null;
    return buildOrganizerCompletion(eventDraft, activeRaceForCompletion, aidStations, stationProducts, {
      aidStations: sidecarLoadedRaceId === activeRace?.id ? aidStations.length : activeRace?.aidStationCount ?? 0,
      stationProducts: sidecarLoadedRaceId === activeRace?.id ? stationProducts.length : undefined,
      sponsors:
        sponsorSummary !== null && sponsorSummary.editionId === activeEdition?.id
          ? sponsorSummary.sponsors
          : 0,
      sponsorClicks:
        sponsorSummary !== null && sponsorSummary.editionId === activeEdition?.id
          ? sponsorSummary.clicks
          : 0,
    });
  }, [activeEdition?.id, activeRace?.aidStationCount, activeRace?.id, activeRaceForCompletion, aidStations, eventDraft, sidecarLoadedRaceId, sponsorSummary, stationProducts]);

  const markDirty = (moduleId: OrganizerModuleId) => {
    if (!activeDirtyScopeKey) return;
    dirtyRevisionByScopeRef.current[activeDirtyScopeKey] = (dirtyRevisionByScopeRef.current[activeDirtyScopeKey] ?? 0) + 1;
    setDirtyModulesByScope((current) => {
      const nextModules = new Set(current[activeDirtyScopeKey] ?? EMPTY_DIRTY_MODULES);
      nextModules.add(moduleId);
      return { ...current, [activeDirtyScopeKey]: nextModules };
    });
  };

  const clearDirty = (moduleIds: OrganizerModuleId[], expectedRevision?: number) => {
    if (!activeDirtyScopeKey) return;
    setDirtyModulesByScope((current) => {
      if (
        expectedRevision !== undefined &&
        (dirtyRevisionByScopeRef.current[activeDirtyScopeKey] ?? 0) !== expectedRevision
      ) {
        return current;
      }
      const nextModules = new Set(current[activeDirtyScopeKey] ?? EMPTY_DIRTY_MODULES);
      moduleIds.forEach((moduleId) => nextModules.delete(moduleId));
      if (nextModules.size === 0) {
        const remaining = { ...current };
        delete remaining[activeDirtyScopeKey];
        delete dirtyRevisionByScopeRef.current[activeDirtyScopeKey];
        return remaining;
      }
      return { ...current, [activeDirtyScopeKey]: nextModules };
    });
  };

  useEffect(() => {
    if (!hasAnyDirtyChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasAnyDirtyChanges]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!eventUpdatesDialogOpen) {
      setEventUpdateError(null);
      return;
    }
    setEventUpdateError(null);
  }, [eventUpdatesDialogOpen]);

  useEffect(() => {
    if (websiteImportOpen) return;
    setWebsiteImportWorkflow(null);
    setWebsiteImportFormatDecisions([]);
    setWebsiteImportFieldSelections({});
    setWebsiteImportError(null);
    setWebsiteImportBusyAction(null);
  }, [websiteImportOpen]);

  const applyLoadedEvent = (
    event: OrganizerEventDetail,
    preferredTabId = activeTab,
    preferredEditionYear = selectedEditionYear
  ) => {
    const nextEvent = normalizeOrganizerEventDetail(event);
    setEventDetail(nextEvent);
    const groupedRaces = groupRacesBySeries(nextEvent.races);
    const nextEditionYears = getAvailableEditionYears(nextEvent.races, nextEvent.editions ?? []);
    const resolvedEditionYear =
      (preferredEditionYear && nextEditionYears.includes(preferredEditionYear) ? preferredEditionYear : null) ?? nextEditionYears[0] ?? "";
    const resolvedEdition = getEventEdition(nextEvent, resolvedEditionYear);
    const nextEventForm = eventToForm(nextEvent, resolvedEdition);
    setEventForm(nextEventForm);
    setNewRaceForm(createRaceFormFromEventDefaults(nextEventForm));
    setNewRaceImageFile(null);
    setNewRaceGpxFile(null);
    setSelectedEditionYear(resolvedEditionYear);
    if (preferredTabId === EVENT_TAB_ID || preferredTabId === ADD_FORMAT_TAB_ID) {
      setActiveTab(preferredTabId);
    } else {
      const preferredGroupId = groupedRaces.find((group) => group.id === preferredTabId)?.id ?? groupedRaces[0]?.id ?? null;
      setActiveTab(preferredGroupId ?? EVENT_TAB_ID);
    }
  };

  const loadOrganizerData = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const bootstrapEventId = requestedBootstrapEventIdRef.current;
      requestedBootstrapEventIdRef.current = null;
      const query = bootstrapEventId ? `?eventId=${encodeURIComponent(bootstrapEventId)}` : "";
      let response = await fetch(`/api/organizer/bootstrap${query}`, { headers: authHeaders, cache: "no-store" });
      if (bootstrapEventId && response.status === 403) {
        response = await fetch("/api/organizer/bootstrap", { headers: authHeaders, cache: "no-store" });
      }
      const data = (await response.json().catch(() => null)) as {
        claims?: ClaimRow[];
        memberships?: MembershipRow[];
        editionRequests?: EditionRequestRow[];
        publicationRequests?: PublicationRequestRow[];
        event?: OrganizerEventDetail | null;
        message?: string;
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de charger le compte organisateur.");
        return;
      }
      const nextMemberships = data?.memberships ?? [];
      setClaims(data?.claims ?? []);
      setEditionRequests(data?.editionRequests ?? []);
      setPublicationRequests(data?.publicationRequests ?? []);
      setMemberships(nextMemberships);
      if (data?.event) {
        skipNextEventLoadRef.current = selectedEventIdRef.current === data.event.id ? null : data.event.id;
        applyLoadedEvent(data.event, EVENT_TAB_ID);
      }
      setSelectedEventId((current) => {
        if (data?.event?.id) {
          return data.event.id;
        }
        return current ?? nextMemberships[0]?.event_id ?? null;
      });
    } catch (caught) {
      console.error("Unable to load organizer data", caught);
      setError("Impossible de charger le compte organisateur.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    void loadOrganizerData();
  }, [accessToken]);

  const loadEventUpdates = async (eventId: string, editionId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/updates?editionId=${encodeURIComponent(editionId)}`, { headers: authHeaders, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | {
            favoriteCount?: number;
            updates?: OrganizerRaceEventUpdate[];
            message?: string;
          }
        | null;

      if (!response.ok) {
        setEventFavoriteCount(null);
        setEventUpdates([]);
        showToast("error", data?.message ?? "Impossible de charger les mises à jour coureurs.");
        return;
      }

      setEventFavoriteCount(typeof data?.favoriteCount === "number" ? data.favoriteCount : 0);
      setEventUpdates(Array.isArray(data?.updates) ? data.updates : []);
    } catch (caught) {
      console.error("Unable to load organizer event updates", caught);
      setEventFavoriteCount(null);
      setEventUpdates([]);
      showToast("error", "Impossible de charger les mises à jour coureurs.");
    }
  };

  const loadEvent = async (
    eventId: string,
    preferredTabId = activeTab,
    preferredEditionYear = selectedEditionYear
  ) => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, { headers: authHeaders, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { event?: OrganizerEventDetail; message?: string } | null;
      if (!response.ok || !data?.event) {
        setError(data?.message ?? "Impossible de charger l'événement.");
        return;
      }
      applyLoadedEvent(data.event, preferredTabId, preferredEditionYear);
    } catch (caught) {
      console.error("Unable to load organizer event", caught);
      setError("Impossible de charger l'événement.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (!selectedEventId) return;
    if (skipNextEventLoadRef.current === selectedEventId) {
      skipNextEventLoadRef.current = null;
      return;
    }
    void loadEvent(selectedEventId);
  }, [selectedEventId, accessToken]);

  useEffect(() => {
    if (!selectedEventId || !accessToken || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("organizerPayment") !== "success") return;
    const returnedEditionId = params.get("editionId");
    const targetTier = params.get("targetTier");
    if (!returnedEditionId || (targetTier !== "racebook" && targetTier !== "pro")) return;

    let cancelled = false;
    let attempts = 0;
    const refreshEntitlement = async () => {
      attempts += 1;
      const response = await fetch(`/api/organizer/events/${selectedEventId}`, { headers: authHeaders, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { event?: OrganizerEventDetail } | null;
      if (cancelled || !response.ok || !data?.event) return;
      const returnedEdition = (data.event.editions ?? []).find((edition) => edition.id === returnedEditionId);
      if (returnedEdition?.entitlement?.status === "active" && returnedEdition.entitlement.tier === targetTier) {
        trackOrganizerPurchaseVerified({ targetTier, editionYear: selectedEditionYear });
        applyLoadedEvent(data.event, activeTab, selectedEditionYear);
        showToast("success", `L’offre ${targetTier === "pro" ? "RaceBook Pro" : "RaceBook"} est maintenant active.`);
        params.delete("organizerPayment");
        params.delete("targetTier");
        params.delete("session_id");
        window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
        return;
      }
      if (attempts < 10) window.setTimeout(() => void refreshEntitlement(), 1_500);
      else showToast("error", "Paiement reçu, activation encore en cours. Recharge la page dans quelques instants.");
    };
    void refreshEntitlement();
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, accessToken]);

  useEffect(() => {
    if (!eventDetail || !selectedEditionYear) return;
    const edition = getEventEdition(eventDetail, selectedEditionYear);
    if (!edition) return;
    setEventForm((current) => ({
      ...current,
      editionStartDate: edition.start_date,
      editionEndDate: edition.end_date,
    }));
    setNewRaceForm((current) => ({ ...current, raceDate: edition.start_date }));
  }, [eventDetail?.id, selectedEditionYear]);

  useEffect(() => {
    if (!eventUpdatesDialogOpen || !selectedEventId || !activeEdition?.id || !accessToken) return;
    setEventFavoriteCount(null);
    setEventUpdates([]);
    void loadEventUpdates(selectedEventId, activeEdition.id);
  }, [eventUpdatesDialogOpen, selectedEventId, activeEdition?.id, accessToken, authHeaders]);

  const applyRaceSidecars = (raceId: string, sidecars: OrganizerRaceSidecars, previewOverride: GpxPreview | null) => {
    if (activeRaceIdRef.current !== raceId) return;
    setAidStations(syncAidStationsWithGpxPreview(sidecars.aidStations, previewOverride));
    setRelayPoints(sidecars.relayPoints);
    setStationProducts(sidecars.stationProducts);
    setSidecarLoadedRaceId(raceId);
  };

  const loadRaceSidecar = async (raceId: string, previewOverride: GpxPreview | null = null) => {
    if (!accessToken) return;
    const cached = readOrganizerRaceSidecarsCache(raceId);
    if (cached) {
      applyRaceSidecars(raceId, cached, previewOverride);
      return;
    }

    let request = sidecarRequestsRef.current.get(raceId);
    if (!request) {
      const requestGeneration = cacheGenerationRef.current;
      request = fetch(`/api/organizer/races/${raceId}/aid-stations`, { headers: authHeaders, cache: "no-store" })
        .then(async (aidResponse) => {
          if (cacheGenerationRef.current !== requestGeneration) return null;
          if (!aidResponse.ok) return null;
          const aidData = (await aidResponse.json()) as { aidStations?: OrganizerAidStationRow[] };
          let relayPoints: RelayPointDraft[] = [];
          let products: StationProduct[] = [];
          if (activeTier === "pro") {
            const [relayResponse, productsResponse] = await Promise.all([
              fetch(`/api/organizer/races/${raceId}/relay-points`, { headers: authHeaders, cache: "no-store" }),
              fetch(`/api/organizer/races/${raceId}/aid-station-products`, { headers: authHeaders, cache: "no-store" }),
            ]);
            if (!relayResponse.ok || !productsResponse.ok) return null;
            const [relayData, productsData] = (await Promise.all([relayResponse.json(), productsResponse.json()])) as [
              { relayPoints?: RelayPointDraft[] },
              { products?: StationProduct[] },
            ];
            relayPoints = relayData.relayPoints ?? [];
            products = productsData.products ?? [];
          }
          const sidecars: OrganizerRaceSidecars = {
            aidStations: aidStationRowsToDrafts(aidData.aidStations ?? []),
            relayPoints,
            stationProducts: products,
          };
          if (cacheGenerationRef.current !== requestGeneration) return null;
          writeOrganizerRaceSidecarsCache(raceId, sidecars);
          return sidecars;
        })
        .finally(() => {
          if (sidecarRequestsRef.current.get(raceId) === request) sidecarRequestsRef.current.delete(raceId);
        });
      sidecarRequestsRef.current.set(raceId, request);
    }
    const sidecars = await request;
    if (sidecars) applyRaceSidecars(raceId, sidecars, previewOverride);
  };

  const loadCatalogProducts = async () => {
    if (!accessToken) return;
    const cached = readOrganizerProductCatalogCache();
    if (cached) {
      setCatalogProducts(cached);
      return;
    }
    if (!catalogProductsRequestRef.current) {
      const requestGeneration = cacheGenerationRef.current;
      const request = fetch("/api/products", { headers: authHeaders, cache: "no-store" })
        .then(async (response) => {
          if (cacheGenerationRef.current !== requestGeneration) return null;
          if (!response.ok) return null;
          const data = (await response.json()) as { products?: FuelProduct[] };
          const products = data.products ?? [];
          if (cacheGenerationRef.current !== requestGeneration) return null;
          writeOrganizerProductCatalogCache(products);
          return products;
        })
        .finally(() => {
          if (catalogProductsRequestRef.current === request) catalogProductsRequestRef.current = null;
        });
      catalogProductsRequestRef.current = request;
    }
    const products = await catalogProductsRequestRef.current;
    if (products) setCatalogProducts(products);
  };

  const loadRaceGpxPreview = async (raceId: string, gpxStoragePath: string) => {
    if (!accessToken) return;
    const cached = readOrganizerGpxPreviewCache(raceId, gpxStoragePath);
    if (cached) {
      if (activeRaceIdRef.current === raceId) {
        setGpxPreview(cached);
        setGpxLoadedRaceKey(`${raceId}:${gpxStoragePath}`);
      }
      return;
    }
    const requestKey = `${raceId}:${gpxStoragePath}`;
    let request = gpxRequestsRef.current.get(requestKey);
    if (!request) {
      const requestGeneration = cacheGenerationRef.current;
      request = fetch(`/api/organizer/races/${raceId}/gpx`, { headers: authHeaders, cache: "no-store" })
        .then(async (response) => {
          if (cacheGenerationRef.current !== requestGeneration) return null;
          if (!response.ok) return null;
          const data = (await response.json().catch(() => null)) as GpxPreview | null;
          const preview = normalizeGpxPreview(data);
          if (preview && cacheGenerationRef.current === requestGeneration) {
            writeOrganizerGpxPreviewCache(raceId, gpxStoragePath, preview);
          }
          return preview;
        })
        .finally(() => {
          if (gpxRequestsRef.current.get(requestKey) === request) gpxRequestsRef.current.delete(requestKey);
        });
      gpxRequestsRef.current.set(requestKey, request);
    }
    try {
      const preview = await request;
      if (activeRaceIdRef.current === raceId) {
        setGpxPreview(preview);
        if (preview) setGpxLoadedRaceKey(`${raceId}:${gpxStoragePath}`);
      }
    } catch (caught) {
      console.error("Unable to load organizer GPX preview", caught);
      if (activeRaceIdRef.current === raceId) setGpxPreview(null);
    }
  };

  useEffect(() => {
    if (!activeRace) {
      setRaceForm(createEmptyRaceForm());
      setAidStations([]);
      setRelayPoints([]);
      setStationProducts([]);
      setGpxPreview(null);
      setSidecarLoadedRaceId(null);
      setGpxLoadedRaceKey(null);
      return;
    }
    setAidStations([]);
    setRelayPoints([]);
    setStationProducts([]);
    setGpxPreview(null);
    setSidecarLoadedRaceId(null);
    setGpxLoadedRaceKey(null);
    setRaceForm(raceToForm(activeRace));
    setExpandedStationKey(null);
  }, [activeRace?.id]);

  useEffect(() => {
    const previousTier = previousActiveTierRef.current;
    previousActiveTierRef.current = activeTier;
    if (!activeRace || previousTier === activeTier || activeTier !== "pro") return;

    invalidateOrganizerRaceSidecarsCache(activeRace.id);
    sidecarRequestsRef.current.delete(activeRace.id);
    setSidecarLoadedRaceId(null);
  }, [activeRace?.id, activeTier]);

  useEffect(() => {
    if (!activeRace) return;
    const needsSidecar = activeModule === "aidStations" || activeModule === "products";
    if (needsSidecar && sidecarLoadedRaceId !== activeRace.id) {
      void loadRaceSidecar(activeRace.id);
    }
    if (needsSidecar && activeTier === "pro") void loadCatalogProducts();

    const needsGpx = activeModule === "formats" || activeModule === "aidStations";
    if (needsGpx && activeRace.gpx_storage_path && gpxLoadedRaceKey !== `${activeRace.id}:${activeRace.gpx_storage_path}`) {
      void loadRaceGpxPreview(activeRace.id, activeRace.gpx_storage_path);
    }
  }, [activeModule, activeRace?.id, activeRace?.gpx_storage_path, activeTier, sidecarLoadedRaceId, gpxLoadedRaceKey]);

  useEffect(() => {
    const shiftOneYear = (value?: string | null) => {
      if (!value) return "";
      const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return "";
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      return date.toISOString().slice(0, 10);
    };
    setNewEditionDate(shiftOneYear(activeEdition?.start_date));
    setNewEditionEndDate(shiftOneYear(activeEdition?.end_date));
    setSponsorSummary(null);
  }, [activeEdition?.id, activeEdition?.start_date, activeEdition?.end_date]);

  useEffect(() => {
    setAidStations((current) => syncAidStationsWithGpxPreview(current, gpxPreview));
  }, [gpxPreview]);

  const saveEvent = async (override?: Partial<EventFormValues>, options: OrganizerSaveOptions = {}) => {
    if (!accessToken || !selectedEventId) return false;
    const nextForm = { ...eventForm, ...override };
    if (!options.background) {
      setStatus("saving");
      setError(null);
    }
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedEditionYear,
          name: nextForm.name,
          location: nextForm.location,
          editionStartDate: nextForm.editionStartDate,
          editionEndDate: nextForm.editionEndDate,
          thumbnailUrl: nextForm.thumbnailUrl,
          organizerDetails: nextForm.organizerDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        event?: Partial<OrganizerEventDetail> & { id: string };
        edition?: NonNullable<OrganizerEventDetail["editions"]>[number];
        message?: string;
      } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer l'événement.");
        return false;
      }

      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              ...data?.event,
              organizerDetails: data?.event?.organizerDetails ?? nextForm.organizerDetails,
              editions: data?.edition
                ? (current.editions ?? []).map((edition) => (edition.id === data.edition?.id ? data.edition : edition))
                : current.editions,
              races: current.races,
            }
          : current
      );
      if (!options.background) showToast("success", "Événement mis à jour.");
      clearDirty(["event", "equipment", "bibPickup", "access", "services"], options.scopeRevision);
      if (options.reloadEvent === true) await loadEvent(selectedEventId, EVENT_TAB_ID);
      return true;
    } finally {
      if (!options.background) setStatus("idle");
    }
  };

  const saveRace = async (override?: Partial<RaceFormValues>, options: OrganizerSaveOptions = {}) => {
    if (!accessToken || !activeRace || !selectedEventId) return false;
    const mergedForm = {
      ...raceForm,
      ...override,
      organizerDetails: sanitizeRaceDetailsForSave(override?.organizerDetails ?? raceForm.organizerDetails),
    };
    const nextForm = { ...mergedForm, seriesName: mergedForm.name };
    if (!options.background) {
      setStatus("saving");
      setError(null);
    }
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesName: nextForm.seriesName,
          name: nextForm.name,
          distanceKm: nextForm.distanceKm,
          elevationGainM: nextForm.elevationGainM,
          elevationLossM: toNumberOrNull(nextForm.elevationLossM),
          locationText: nextForm.locationText,
          raceDate: nextForm.raceDate,
          thumbnailUrl: nextForm.thumbnailUrl,
          participationMode: nextForm.participationMode || undefined,
          organizerDetails: nextForm.organizerDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer le format.");
        return false;
      }

      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              organizerDetails: current.organizerDetails,
              races: current.races.map((race) =>
                race.id === activeRace.id
                  ? { ...race, ...data?.race, aidStationCount: race.aidStationCount, organizerDetails: data?.race?.organizerDetails ?? nextForm.organizerDetails }
                  : race
              ),
            }
          : current
      );
      if ((data?.race?.participation_mode ?? nextForm.participationMode) === "solo") {
        const cachedSidecars = readOrganizerRaceSidecarsCache(activeRace.id);
        if (cachedSidecars) writeOrganizerRaceSidecarsCache(activeRace.id, { ...cachedSidecars, relayPoints: [] });
        setRelayPoints([]);
      }
      if (!options.background) showToast("success", "Format mis à jour.");
      clearDirty(RACE_DETAILS_MODULE_IDS, options.scopeRevision);
      if (options.reloadEvent === true) {
        await loadEvent(selectedEventId, activeRace.edition_group_id, getRaceEditionYear(activeRace, eventDetail?.editions));
      }
      return true;
    } finally {
      if (!options.background) setStatus("idle");
    }
  };

  const createRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;
    if (!activeEdition) {
      showToast("error", "Sélectionne une édition avant de créer un format.");
      return;
    }
    if (!newRaceForm.raceDate.trim()) {
      showToast("error", "Ajoute la date de course avant de créer le format.");
      return;
    }
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/organizer/races", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          editionId: activeEdition?.id,
          seriesName: newRaceForm.name,
          name: newRaceForm.name,
          distanceKm: newRaceForm.distanceKm,
          elevationGainM: newRaceForm.elevationGainM,
          elevationLossM: toNumberOrNull(newRaceForm.elevationLossM),
          locationText: newRaceForm.locationText,
          raceDate: newRaceForm.raceDate,
          thumbnailUrl: newRaceForm.thumbnailUrl,
          participationMode: newRaceForm.participationMode || "solo",
          organizerDetails: sanitizeRaceDetailsForSave(newRaceForm.organizerDetails),
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok || !data?.race) {
        showToast("error", data?.message ?? "Impossible d'ajouter le format.");
        return;
      }
      const gpxUpload = newRaceGpxFile ? await uploadRaceGpxFile(data.race.id, newRaceGpxFile) : { ok: true };
      const imageUploaded = newRaceImageFile ? await uploadRaceImageFile(data.race.id, newRaceImageFile) : true;
      setNewRaceForm(createEmptyRaceForm());
      setNewRaceImageFile(null);
      setNewRaceGpxFile(null);
      const createdEditionYear = getRaceEditionYear(data.race, eventDetail?.editions);
      setSelectedEditionYear(createdEditionYear);
      setActiveTab(data.race.edition_group_id);
      setActiveModule("formats");
      showToast("success", imageUploaded ? "Format ajouté." : "Format ajouté. Réessaie l'image si besoin.");
      await loadEvent(selectedEventId, data.race.edition_group_id, createdEditionYear);
    } finally {
      setStatus("idle");
    }
  };

  const requestNewEdition = async (duplicatePreviousEdition: boolean) => {
    if (!accessToken || !selectedEventId || !selectedEditionYear) return false;
    if (!newEditionDate.trim() || !newEditionEndDate.trim() || newEditionEndDate < newEditionDate) {
      showToast("error", "Ajoute une plage de dates valide pour la nouvelle édition.");
      return false;
    }
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/organizer/edition-requests", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          sourceYear: Number(selectedEditionYear),
          requestedStartDate: newEditionDate,
          requestedEndDate: newEditionEndDate,
          duplicatePreviousEdition,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        edition?: { id: string; edition_year: number; start_date: string; end_date: string };
        races?: Array<{ id: string; edition_group_id: string; race_date?: string | null }>;
        message?: string;
      } | null;
      if (!response.ok || !data?.edition) {
        showToast("error", data?.message ?? "Impossible de creer la nouvelle edition.");
        return false;
      }
      const createdYear = String(data.edition.edition_year);
      const nextActiveTab = duplicatePreviousEdition ? activeTab : EVENT_TAB_ID;
      setSelectedEditionYear(createdYear);
      if (!duplicatePreviousEdition) {
        setActiveTab(EVENT_TAB_ID);
        setActiveModule("event");
      }
      showToast("success", "Nouvelle édition créée en brouillon.");
      await loadEvent(selectedEventId, nextActiveTab, createdYear);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const uploadRaceGpxFile = async (raceId: string, file: File) => {
    if (!accessToken) return { ok: false };
    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", file);
      const response = await fetch(`/api/organizer/races/${raceId}/gpx`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as
        | (GpxPreview & { race?: RaceFormat; message?: string; appliedAidStationCount?: number })
        | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "GPX invalide ou impossible Ã  importer.");
        return { ok: false };
      }
      if (activeRace?.id === raceId) {
        setGpxPreview(normalizeGpxPreview(data));
      }
      return { ok: true, data };
    } finally {
      setStatus("idle");
    }
  };

  const uploadGpx = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !activeRace || !selectedEventId) return;
    try {
      const result = await uploadRaceGpxFile(activeRace.id, file);
      if (!result.ok) return;
      const response = { ok: true } as const;
      const data = result.data ?? null;
      if (!response.ok) {
        showToast("error", data?.message ?? "GPX invalide ou impossible à importer.");
        return;
      }
      const normalizedPreview = normalizeGpxPreview(data);
      setGpxPreview(normalizedPreview);
      if (data?.race?.gpx_storage_path) setGpxLoadedRaceKey(`${activeRace.id}:${data.race.gpx_storage_path}`);
      setRaceForm((current) => applyGpxStatsToRaceForm(current, normalizedPreview?.stats));
      if (data?.race) {
        setEventDetail((current) =>
          current?.id === selectedEventId
            ? {
                ...current,
                races: current.races.map((race) =>
                  race.id === activeRace.id
                    ? { ...race, ...data.race, aidStationCount: race.aidStationCount, organizerDetails: race.organizerDetails }
                    : race
                ),
              }
            : current
        );
      }
      invalidateOrganizerGpxPreviewCache(activeRace.id);
      if (normalizedPreview && data?.race?.gpx_storage_path) {
        writeOrganizerGpxPreviewCache(activeRace.id, data.race.gpx_storage_path, normalizedPreview);
      }
      const detectedCount = data?.detectedAidStations?.length ?? 0;
      const appliedCount = data?.appliedAidStationCount ?? 0;
      showToast(
        "success",
        appliedCount > 0
          ? `GPX importé. ${appliedCount} ravito${appliedCount > 1 ? "s" : ""} créé${appliedCount > 1 ? "s" : ""}.`
          : detectedCount > 0
            ? "GPX importé. Waypoints détectés, ravitos existants préservés."
            : "GPX importé. Les plans existants restent des snapshots."
      );
      if (appliedCount > 0) {
        invalidateOrganizerRaceSidecarsCache(activeRace.id);
        await loadRaceSidecar(activeRace.id, normalizedPreview);
      }
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const uploadEventImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !accessToken || !selectedEventId) return;
    if (file.type !== "image/png") {
      showToast("error", "Ajoute une image PNG.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_EVENT_IMAGE_SIZE_BYTES) {
      showToast("error", "Image trop lourde: 5 Mo maximum.");
      event.target.value = "";
      return;
    }
    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      if (selectedEditionYear) formData.append("selectedEditionYear", selectedEditionYear);
      const response = await fetch(`/api/organizer/events/${selectedEventId}/image`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { thumbnailUrl?: string; message?: string } | null;
      if (!response.ok || !data?.thumbnailUrl) {
        showToast("error", data?.message ?? "Impossible d'envoyer l'image.");
        return;
      }
      setEventForm((current) => ({ ...current, thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl }));
      setEventDetail((current) =>
        current?.id === selectedEventId ? { ...current, thumbnail_url: data.thumbnailUrl ?? current.thumbnail_url } : current
      );
      showToast("success", "Image événement mise à jour.");
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const uploadRaceImageFile = async (raceId: string, file: File) => {
    if (!accessToken) return null;
    if (!validateRaceImage(file)) return null;

    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch(`/api/organizer/races/${raceId}/image`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { thumbnailUrl?: string; message?: string } | null;
      if (!response.ok || !data?.thumbnailUrl) {
        showToast("error", data?.message ?? "Impossible d'envoyer l'image du format.");
        return false;
      }
      if (activeRace?.id === raceId) {
        setRaceForm((current) => ({ ...current, thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl }));
      }
      return data.thumbnailUrl;
    } finally {
      setStatus("idle");
    }
  };

  const uploadRaceImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !activeRace || !selectedEventId) return;
    try {
      const thumbnailUrl = await uploadRaceImageFile(activeRace.id, file);
      if (!thumbnailUrl) return;
      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              races: current.races.map((race) => (race.id === activeRace.id ? { ...race, thumbnail_url: thumbnailUrl } : race)),
            }
          : current
      );
      showToast("success", "Image du format mise Ã  jour.");
    } finally {
      event.target.value = "";
    }
  };

  const selectNewRaceImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!validateRaceImage(file)) {
      event.target.value = "";
      return;
    }
    setNewRaceImageFile(file);
    event.target.value = "";
  };

  const selectNewRaceGpx = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const isGpxFile = file.name.toLowerCase().endsWith(".gpx") || file.type === "application/gpx+xml";
    if (!isGpxFile) {
      showToast("error", "Ajoute un fichier GPX valide.");
      event.target.value = "";
      return;
    }
    try {
      const parsed = parseGpx(await file.text());
      const cumulativeTotals = buildCumulativeElevationTotals(parsed.points);
      const detectedAidStations =
        parsed.pointSource !== "waypoint" && parsed.waypoints.length > 0
          ? normalizeImportedWaypoints(parsed.points, parsed.waypoints).aidStations.map((station) => ({
              name: station.name,
              distanceKm: station.distanceKm,
            }))
          : [];
      setNewRaceForm((current) => applyGpxStatsToRaceForm(current, parsed.stats));
      setGpxPreview({
        stats: parsed.stats,
        elevationProfile: parsed.points.map((point, index) => {
          const totals = cumulativeTotals[index];
          return {
            distanceKm: point.distKmCum,
            elevationM: point.ele ?? 0,
            lat: point.lat,
            lon: point.lng,
            cumulativeGainM: totals?.cumulativeGainM ?? 0,
            cumulativeLossM: totals?.cumulativeLossM ?? 0,
          };
        }),
        detectedAidStations,
      });
      setNewRaceGpxFile(file);
      showToast("success", "GPX analysé. Distance et dénivelés préremplis.");
    } catch (error) {
      const message =
        error instanceof GpxParseError ? error.message : error instanceof Error ? error.message : "Impossible de lire le GPX.";
      showToast("error", message);
    } finally {
      event.target.value = "";
    }
  };

  const deleteActiveRace = async () => {
    if (!accessToken || !activeRace || !selectedEventId) return;
    const confirmed = window.confirm(`Supprimer la course "${activeRace.name}" ? Cette action est définitive.`);
    if (!confirmed) return;

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible de supprimer la course.");
        return;
      }
      invalidateOrganizerRaceDataCache(activeRace.id);
      setEventDetail((current) =>
        current?.id === selectedEventId ? { ...current, races: current.races.filter((race) => race.id !== activeRace.id) } : current
      );
      setActiveTab(EVENT_TAB_ID);
      setActiveModule("event");
      showToast("success", "Course supprimée.");
    } finally {
      setStatus("idle");
    }
  };

  const deleteSelectedEvent = async () => {
    if (!accessToken || !selectedEventId) return false;

    const deletedEventId = selectedEventId;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/events/${deletedEventId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible de supprimer la course.");
        return false;
      }

      const nextMemberships = memberships.filter((membership) => membership.event_id !== deletedEventId);
      for (const race of eventDetail?.races ?? []) invalidateOrganizerRaceDataCache(race.id);
      setMemberships(nextMemberships);
      setSelectedEventId(nextMemberships[0]?.event_id ?? null);
      setEventDetail(null);
      setActiveTab(EVENT_TAB_ID);
      setActiveModule("event");
      setDirtyModulesByScope({});
      dirtyRevisionByScopeRef.current = {};
      showToast("success", "Course supprimée définitivement.");
      await loadOrganizerData();
      return true;
    } catch (caught) {
      console.error("Unable to delete organizer event", caught);
      showToast("error", "Impossible de supprimer la course.");
      return false;
    } finally {
      setStatus("idle");
    }
  };

  const saveAidStations = async (options: OrganizerSaveOptions = {}) => {
    if (!accessToken || !activeRace) return false;
    if (!options.background) {
      setStatus("saving");
      setError(null);
    }
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}/aid-stations`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ aidStations }),
      });
      const data = (await response.json().catch(() => null)) as { aidStations?: OrganizerAidStationRow[]; message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer les ravitos.");
        return false;
      }
      let savedRelayPoints: RelayPointDraft[] = [];
      if (activeTier === "pro") {
        const relayResponse = await fetch(`/api/organizer/races/${activeRace.id}/relay-points`, {
          method: "PUT",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ relayPoints }),
        });
        const relayData = (await relayResponse.json().catch(() => null)) as { relayPoints?: RelayPointDraft[]; message?: string } | null;
        if (!relayResponse.ok) {
          showToast("error", relayData?.message ?? "Impossible d'enregistrer les points de relais.");
          return false;
        }
        savedRelayPoints = relayData?.relayPoints ?? [];
      }
      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              races: current.races.map((race) =>
                race.id === activeRace.id ? { ...race, aidStationCount: aidStations.length } : race
              ),
            }
          : current
      );
      if (!options.background) showToast("success", "Ravitos mis à jour.");
      const savedAidStations = aidStationRowsToDrafts(data?.aidStations ?? []);
      const savedStationIds = new Set(savedAidStations.map((station) => station.id).filter(Boolean));
      const sidecars: OrganizerRaceSidecars = {
        aidStations: savedAidStations,
        relayPoints: savedRelayPoints,
        stationProducts: stationProducts.filter((link) => savedStationIds.has(link.aidStationId)),
      };
      writeOrganizerRaceSidecarsCache(activeRace.id, sidecars);
      applyRaceSidecars(activeRace.id, sidecars, gpxPreview);
      clearDirty(["aidStations"], options.scopeRevision);
      return true;
    } finally {
      if (!options.background) setStatus("idle");
    }
  };

  const replaceStationProducts = async (aidStationId: string, products: Array<{ productId: string; notes?: string | null }>) => {
    if (!accessToken || !activeRace) return false;
    const response = await fetch(`/api/organizer/races/${activeRace.id}/aid-station-products`, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ aidStationId, products }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      showToast("error", data?.message ?? "Impossible de mettre à jour les produits.");
      return false;
    }
    const data = (await response.json().catch(() => null)) as { products?: StationProduct[] } | null;
    const currentSidecars = readOrganizerRaceSidecarsCache(activeRace.id) ?? { aidStations, relayPoints, stationProducts };
    const productsById = new Map([
      ...catalogProducts.map((product) => [product.id, product] as const),
      ...currentSidecars.stationProducts.flatMap((link) => (link.product ? [[link.productId, link.product] as const] : [])),
    ]);
    const replacement = (data?.products ?? []).map((link) => ({ ...link, product: productsById.get(link.productId) ?? null }));
    const sidecars = {
      ...currentSidecars,
      stationProducts: [
        ...currentSidecars.stationProducts.filter((link) => link.aidStationId !== aidStationId),
        ...replacement,
      ],
    };
    writeOrganizerRaceSidecarsCache(activeRace.id, sidecars);
    applyRaceSidecars(activeRace.id, sidecars, gpxPreview);
    return true;
  };

  const attachCatalogProduct = async (aidStationId: string, productId: string) => {
    if (!productId) return;
    const selectedProduct = catalogProducts.find((product) => product.id === productId);
    if (!selectedProduct) {
      showToast("error", "Produit introuvable dans le catalogue.");
      return;
    }
    const current = stationProducts.filter((link) => link.aidStationId === aidStationId).map((link) => ({ productId: link.productId, notes: link.notes ?? undefined }));
    if (current.some((link) => link.productId === productId)) return;
    const updated = await replaceStationProducts(aidStationId, [...current, { productId }]);
    if (updated) {
      setProductPickerStationId(null);
      setProductSearch("");
    }
  };

  const removeStationProduct = async (aidStationId: string, productId: string) => {
    const next = stationProducts
      .filter((link) => link.aidStationId === aidStationId && link.productId !== productId)
      .map((link) => ({ productId: link.productId, notes: link.notes ?? undefined }));
    await replaceStationProducts(aidStationId, next);
  };

  const createStationProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !activeRace || !productStationId) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}/aid-station-products`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          aidStationId: productStationId,
          notes: productForm.notes,
          product: productForm,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        product?: FuelProduct;
        stationProduct?: StationProduct;
        message?: string;
      } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible de créer le produit.");
        return;
      }
      if (data?.product && data.stationProduct) {
        const currentSidecars = readOrganizerRaceSidecarsCache(activeRace.id) ?? { aidStations, relayPoints, stationProducts };
        const sidecars = {
          ...currentSidecars,
          stationProducts: [...currentSidecars.stationProducts, { ...data.stationProduct, product: data.product }],
        };
        writeOrganizerRaceSidecarsCache(activeRace.id, sidecars);
        applyRaceSidecars(activeRace.id, sidecars, gpxPreview);
      } else {
        invalidateOrganizerRaceSidecarsCache(activeRace.id);
      }
      setProductForm(emptyProductForm);
      showToast("success", "Produit créé pour ce ravito.");
    } finally {
      setStatus("idle");
    }
  };

  const saveAllDirty = async (options: OrganizerSaveOptions = {}) => {
    if (currentScopeDirtyModules.size === 0) return true;
    const scopedOptions = {
      ...options,
      scopeRevision:
        options.scopeRevision ?? (activeDirtyScopeKey ? dirtyRevisionByScopeRef.current[activeDirtyScopeKey] ?? 0 : undefined),
    };
    if (activeTab === EVENT_TAB_ID || !activeRace) {
      const eventDirty = ["event", "equipment", "bibPickup", "access", "services"].some((moduleId) =>
        currentScopeDirtyModules.has(moduleId as OrganizerModuleId)
      );
      if (!eventDirty) return true;
      return await saveEvent(undefined, scopedOptions);
    }
    if (!selectedEventId) return false;
    const savePlan = buildOrganizerFormatSavePlan(currentScopeDirtyModules);
    if (savePlan.saveRaceDetails) {
      const ok = await saveRace(undefined, scopedOptions);
      if (!ok) return false;
    }
    if (savePlan.saveAidStations) {
      const ok = await saveAidStations(scopedOptions);
      if (!ok) return false;
      return true;
    }
    return true;
  };

  const saveBeforeNavigation = async () => {
    const saved = await saveAllDirty();
    if (!saved) {
      showToast("error", "Impossible d'enregistrer les modifications en cours.");
      return false;
    }
    return true;
  };

  const saveCurrentScopeInBackground = () => {
    if (!activeDirtyScopeKey || currentScopeDirtyModules.size === 0) return;
    const scopeKey = activeDirtyScopeKey;
    const scopeRevision = dirtyRevisionByScopeRef.current[scopeKey] ?? 0;
    const previousSave = backgroundSaveQueuesRef.current[scopeKey] ?? Promise.resolve(true);
    const pendingSave = previousSave
      .catch(() => false)
      .then(() => saveAllDirty({ background: true, reloadEvent: false, scopeRevision }));
    backgroundSaveQueuesRef.current[scopeKey] = pendingSave;
    setPendingRevisionByScope((current) => ({ ...current, [scopeKey]: scopeRevision }));

    void pendingSave
      .then((saved) => {
        if (!saved) showToast("error", "La sauvegarde en arrière-plan a échoué.");
      })
      .catch((caught) => {
        console.error("Unable to autosave organizer scope in background", caught);
        showToast("error", "La sauvegarde en arrière-plan a échoué.");
      })
      .finally(() => {
        if (backgroundSaveQueuesRef.current[scopeKey] === pendingSave) {
          delete backgroundSaveQueuesRef.current[scopeKey];
          setPendingRevisionByScope((current) => {
            if (current[scopeKey] !== scopeRevision) return current;
            const remaining = { ...current };
            delete remaining[scopeKey];
            return remaining;
          });
        }
      });
  };

  const updateEventForm = (next: Partial<EventFormValues>, moduleId: OrganizerModuleId = "event") => {
    setEventForm((current) => ({ ...current, ...next }));
    markDirty(moduleId);
  };

  const updateEventDetails = (nextDetails: OrganizerEventDetails, moduleId: OrganizerModuleId) => {
    setEventForm((current) => ({ ...current, organizerDetails: nextDetails }));
    markDirty(moduleId);
  };

  const updateRaceForm = (next: Partial<RaceFormValues>, moduleId: OrganizerModuleId = "formats") => {
    setRaceForm((current) => ({ ...current, ...next }));
    if (next.participationMode === "solo") setRelayPoints([]);
    markDirty(moduleId);
  };

  const setEditionVisibility = async (isVisible: boolean) => {
    if (!accessToken || !selectedEventId || !activeEdition) return false;
    if (!(await saveBeforeNavigation())) return false;

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/editions/${activeEdition.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible }),
      });
      const data = (await response.json().catch(() => null)) as {
        edition?: { id: string; is_visible: boolean };
        message?: string;
      } | null;
      if (!response.ok || !data?.edition) {
        showToast("error", data?.message ?? "Impossible de modifier la visibilité de l’édition.");
        return false;
      }

      const editionId = activeEdition.id;
      setEventDetail((current) => current?.id === selectedEventId
        ? {
            ...current,
            editions: (current.editions ?? []).map((edition) =>
              edition.id === editionId ? { ...edition, is_visible: isVisible } : edition
            ),
            races: current.races.map((race) =>
              race.edition_id === editionId
                ? {
                    ...race,
                    is_live: isVisible && race.data_status !== "draft",
                    racebook_is_live: isVisible ? race.racebook_is_live : false,
                  }
                : race
            ),
          }
        : current
      );
      showToast(
        "success",
        isVisible
          ? "Édition visible. Les Racebooks restent masqués jusqu’à leur republication."
          : "Édition et Racebooks associés masqués."
      );
      return true;
    } catch (caught) {
      console.error("Unable to update organizer edition visibility", caught);
      showToast("error", "Impossible de modifier la visibilité de l’édition.");
      return false;
    } finally {
      setStatus("idle");
    }
  };

  const deleteSelectedEdition = async () => {
    if (!accessToken || !selectedEventId || !activeEdition) return false;

    const deletedEditionId = activeEdition.id;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/editions/${deletedEditionId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = (await response.json().catch(() => null)) as {
        selectedEditionYear?: number;
        message?: string;
      } | null;
      if (!response.ok || !data?.selectedEditionYear) {
        showToast("error", data?.message ?? "Impossible de supprimer l’édition.");
        return false;
      }

      const deletedRaceIds = (eventDetail?.races ?? [])
        .filter((race) => race.edition_id === deletedEditionId)
        .map((race) => race.id);
      for (const raceId of deletedRaceIds) invalidateOrganizerRaceDataCache(raceId);
      const nextYear = String(data.selectedEditionYear);
      setSelectedEditionYear(nextYear);
      setActiveTab(EVENT_TAB_ID);
      setActiveModule("event");
      setDirtyModulesByScope({});
      dirtyRevisionByScopeRef.current = {};
      showToast("success", "Édition et formats associés supprimés définitivement.");
      await loadEvent(selectedEventId, EVENT_TAB_ID, nextYear);
      return true;
    } catch (caught) {
      console.error("Unable to delete organizer edition", caught);
      showToast("error", "Impossible de supprimer l’édition.");
      return false;
    } finally {
      setStatus("idle");
    }
  };

  const updateAidStation = (index: number, station: AidStationDraft) => {
    const syncedStation = syncAidStationWithGpxPreview(station, gpxPreview);
    setAidStations((current) =>
      sortAidStationsByDistance(current.map((item, stationIndex) => (stationIndex === index ? syncedStation : item)))
    );
    if (syncedStation.id) {
      setRelayPoints((current) => current.map((point) =>
        point.raceAidStationId === syncedStation.id
          ? { ...point, name: syncedStation.name, distanceKm: syncedStation.distanceKm }
          : point
      ));
    }
    markDirty("aidStations");
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === activeTab) return;
    saveCurrentScopeInBackground();
    if (nextTab === ADD_FORMAT_TAB_ID) {
      setNewRaceForm(activeRace ? createRaceFormFromFormatDefaults(activeRace, raceForm) : createRaceFormFromEventDefaults(eventForm));
    }
    setActiveTab(nextTab);
    setActiveModule((currentModule) => getModuleForTab(nextTab, currentModule));
  };

  const requestPublication = () => {
    if (activeTier === "pro") {
      showToast("success", "L’offre RaceBook Pro est active pour cette édition.");
      return;
    }
    openPricingDialog();
  };

  const openPricingDialog = () => {
    const editionId =
      activeEdition?.id ??
      activeRace?.edition_id ??
      eventDetail?.races.find((race) =>
        getRaceEditionYear(race, eventDetail.editions ?? []) === selectedEditionYear
      )?.edition_id ??
      null;
    const context = selectedEventId && editionId
      ? {
          eventId: selectedEventId,
          eventName: eventForm.name || eventDetail?.name || "Événement",
          editionId,
          editionYear: selectedEditionYear,
          tier: activeTier,
        }
      : null;

    setPricingContext(context);
    setCheckoutError(
      context
        ? null
        : "Impossible d’identifier l’édition sélectionnée. Recharge la page puis réessaie."
    );
    setPricingDialogOpen(true);
    if (context) {
      trackOrganizerOfferViewed({ currentTier: context.tier, editionYear: context.editionYear });
    }
  };

  const startCheckout = async (targetTier: "racebook" | "pro") => {
    if (checkoutTarget !== null) return;
    setCheckoutTarget(targetTier);
    setCheckoutError(null);
    setError(null);
    try {
      if (!accessToken) {
        const message = "Ta session a expiré. Reconnecte-toi avant de lancer le paiement.";
        setCheckoutError(message);
        showToast("error", message);
        return;
      }
      if (!pricingContext) {
        const message = "Impossible d’identifier l’événement et l’édition à facturer. Recharge la page puis réessaie.";
        setCheckoutError(message);
        showToast("error", message);
        return;
      }
      if (!(await saveBeforeNavigation())) {
        setCheckoutError("Le paiement n’a pas été lancé car les modifications en cours n’ont pas pu être enregistrées.");
        return;
      }
      const response = await fetch("/api/organizer/publication-checkout", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: pricingContext.eventId,
          editionId: pricingContext.editionId,
          targetTier,
        }),
      });
      const data = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
      if (!response.ok || !data?.url) {
        const message = data?.message ?? "Impossible d’ouvrir le paiement Stripe.";
        setCheckoutError(message);
        showToast("error", message);
        return;
      }
      trackOrganizerCheckoutStarted({
        currentTier: pricingContext.tier,
        targetTier,
        editionYear: pricingContext.editionYear,
      });
      window.location.assign(data.url);
    } catch (caught) {
      console.error("Unable to start organizer checkout", caught);
      const message = caught instanceof Error && caught.message
        ? caught.message
        : "Impossible de joindre le service de paiement. Vérifie ta connexion puis réessaie.";
      setCheckoutError(message);
      showToast("error", message);
    } finally {
      setCheckoutTarget(null);
    }
  };

  const grantComplimentaryOffer = async (targetTier: "racebook" | "pro") => {
    if (!isAdmin || complimentaryGrantTarget !== null || checkoutTarget !== null) return;
    setComplimentaryGrantTarget(targetTier);
    setCheckoutError(null);
    setError(null);
    try {
      if (!accessToken) {
        const message = "Ta session admin a expiré. Reconnecte-toi puis réessaie.";
        setCheckoutError(message);
        showToast("error", message);
        return;
      }
      if (!pricingContext) {
        const message = "Impossible d’identifier l’édition à laquelle offrir la publication.";
        setCheckoutError(message);
        showToast("error", message);
        return;
      }
      if (!(await saveBeforeNavigation())) {
        setCheckoutError("La publication offerte n’a pas été activée car les modifications en cours n’ont pas pu être enregistrées.");
        return;
      }

      const response = await fetch("/api/admin/event-publication-requests", {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setEditionTier",
          editionId: pricingContext.editionId,
          tier: targetTier,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        const message = data?.message ?? `Impossible d’offrir l’offre ${targetTier === "pro" ? "RaceBook Pro" : "RaceBook"}.`;
        setCheckoutError(message);
        showToast("error", message);
        return;
      }

      const grantedContext = pricingContext;
      setPricingDialogOpen(false);
      setPricingContext(null);
      await loadEvent(grantedContext.eventId, activeTab, grantedContext.editionYear);
      showToast(
        "success",
        targetTier === "pro"
          ? "Offre RaceBook Pro offerte — valeur : 299 € HT."
          : "Offre RaceBook offerte — valeur : 99 € HT."
      );
    } catch (caught) {
      console.error("Unable to grant complimentary organizer offer", caught);
      const message = "Impossible d’offrir la publication pour le moment. Vérifie ta connexion puis réessaie.";
      setCheckoutError(message);
      showToast("error", message);
    } finally {
      setComplimentaryGrantTarget(null);
    }
  };

  const setRacebookVisibility = async (raceId: string, isLive: boolean) => {
    if (shouldSaveActiveRaceBeforeRacebookChange(activeRace?.id, raceId) && !(await saveBeforeNavigation())) return;
    if (!accessToken || !selectedEventId) return;

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/races/${raceId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ racebookIsLive: isLive }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible de modifier la publication du Racebook.");
        return;
      }

      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              races: current.races.map((race) =>
                race.id === raceId ? { ...race, racebook_is_live: isLive } : race
              ),
            }
          : current
      );
      showToast("success", isLive ? "Racebook publié dans l'application." : "Racebook masqué dans l'application.");
    } finally {
      setStatus("idle");
    }
  };

  const submitEventUpdate = async () => {
    if (!selectedEventId || !activeEdition?.id || !accessToken) return;

    const message = eventUpdateMessage.trim();
    if (!message) {
      setEventUpdateError("Ajoute un message avant l'envoi.");
      return;
    }
    if (message.length > MAX_UPDATE_MESSAGE_LENGTH) {
      setEventUpdateError(`Le message doit rester sous ${MAX_UPDATE_MESSAGE_LENGTH} caractères.`);
      return;
    }

    setEventUpdateSending(true);
    setEventUpdateError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/updates`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ message, raceId: eventUpdateRaceId, editionId: activeEdition?.id }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            update?: OrganizerRaceEventUpdate;
            delivery?: { totalCandidateCount?: number; sentCount?: number; skippedDuplicateCount?: number };
            message?: string;
          }
        | null;

      if (!response.ok) {
        setEventUpdateError(data?.message ?? "Impossible d'envoyer la notification.");
        return;
      }

      const sentCount = data?.delivery?.sentCount ?? 0;
      showToast("success", sentCount > 0 ? `Notification envoyée à ${sentCount} coureur(s).` : "Mise à jour publiée.");
      setEventUpdateMessage("");
      setEventUpdateRaceId(null);
      setEventUpdatesDialogOpen(false);
      if (activeEdition?.id) await loadEventUpdates(selectedEventId, activeEdition.id);
    } catch (caught) {
      console.error("Unable to create organizer event update", caught);
      setEventUpdateError("Impossible d'envoyer la notification.");
    } finally {
      setEventUpdateSending(false);
    }
  };

  const deleteEventUpdate = async (update: OrganizerRaceEventUpdate) => {
    if (!selectedEventId || !accessToken || eventUpdateDeletingId) return;
    if (!window.confirm("Supprimer ce message de l'historique visible par les coureurs ?")) return;

    setEventUpdateDeletingId(update.id);
    setEventUpdateError(null);
    try {
      const response = await fetch(
        `/api/organizer/events/${selectedEventId}/updates?updateId=${encodeURIComponent(update.id)}&editionId=${encodeURIComponent(activeEdition?.id ?? "")}`,
        {
          method: "DELETE",
          headers: authHeaders,
        }
      );
      const data = (await response.json().catch(() => null)) as { deletedUpdateId?: string; message?: string } | null;
      if (!response.ok) {
        setEventUpdateError(data?.message ?? "Impossible de supprimer le message.");
        return;
      }

      setEventUpdates((current) => current.filter((item) => item.id !== update.id));
      showToast("success", "Message supprimé.");
    } catch (caught) {
      console.error("Unable to delete organizer event update", caught);
      setEventUpdateError("Impossible de supprimer le message.");
    } finally {
      setEventUpdateDeletingId(null);
    }
  };

  const openWebsiteImportDialog = () => {
    setWebsiteImportError(null);
    setWebsiteImportWorkflow(null);
    setWebsiteImportFormatDecisions([]);
    setWebsiteImportFieldSelections({});
    setWebsiteImportUrl(eventForm.organizerDetails.officialWebsiteUrl ?? "");
    setWebsiteImportFormatUrls([""]);
    setWebsiteImportDocuments([]);
    setWebsiteImportOpen(true);
  };

  const discoverWebsiteImport = useCallback(async (urlOverride?: string) => {
    if (!selectedEventId || !accessToken) return;
    if (!activeEdition?.id) {
      setWebsiteImportError("Sélectionne une édition avant de lancer l’import.");
      return;
    }
    const url = (urlOverride ?? websiteImportUrl).trim();
    const additionalUrls = websiteImportFormatUrls.map((additionalUrl) => additionalUrl.trim()).filter(Boolean);
    if (!url && additionalUrls.length === 0 && websiteImportDocuments.length === 0) {
      setWebsiteImportError("Ajoute un site, une URL officielle supplémentaire ou un document avant de lancer l'analyse.");
      return;
    }

    setWebsiteImportBusyAction("discover");
    setWebsiteImportError(null);
    setWebsiteImportUrl(url);
    let uploadedDocuments: OrganizerImportDocumentReference[] = [];
    let discoverySucceeded = false;
    try {
      if (websiteImportDocuments.length > 0) {
        if (!session?.id) throw new Error("Session organisateur introuvable.");
        uploadedDocuments = await uploadTemporaryOrganizerImportDocuments({
          documents: websiteImportDocuments,
          userId: session.id,
          accessToken,
        });
      }
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "discover-formats",
          url,
          additionalUrls,
          documents: uploadedDocuments,
          editionId: activeEdition.id,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { workflow?: WebsiteImportDiscoveryWorkflow; message?: string }
        | null;
      if (!response.ok || data?.workflow?.step !== "formats") {
        setWebsiteImportWorkflow(null);
        setWebsiteImportFormatDecisions([]);
        setWebsiteImportFieldSelections({});
        setWebsiteImportError(
          data?.message ??
            (response.status === 413
              ? "Le serveur a refusé l'analyse du document. Vérifie qu'il ne dépasse pas 25 Mo puis réessaie."
              : `L'analyse a échoué côté serveur (HTTP ${response.status}). Réessaie dans quelques instants.`)
        );
        return;
      }

      discoverySucceeded = true;
      setWebsiteImportWorkflow(data.workflow);
      setWebsiteImportFormatDecisions(
        buildInitialWebsiteImportFormatDecisions(data.workflow.candidates, websiteImportExistingRaces)
      );
      setWebsiteImportFieldSelections({});
    } catch (caught) {
      console.error("Unable to preview organizer website import", caught);
      setWebsiteImportWorkflow(null);
      setWebsiteImportFormatDecisions([]);
      setWebsiteImportFieldSelections({});
      setWebsiteImportError("La connexion au serveur a été interrompue pendant l'analyse. Réessaie dans quelques instants.");
    } finally {
      if (!discoverySucceeded) await removeTemporaryOrganizerImportDocuments(uploadedDocuments, accessToken);
      setWebsiteImportBusyAction(null);
    }
  }, [accessToken, activeEdition?.id, authHeaders, selectedEventId, session?.id, websiteImportDocuments, websiteImportExistingRaces, websiteImportFormatUrls, websiteImportUrl]);

  useEffect(() => {
    if (!requestedImportUrl || !requestedEventId || eventDetail?.id !== requestedEventId || !accessToken) return;
    const bootstrapKey = `${requestedEventId}:${requestedImportUrl}`;
    if (handledWebsiteImport.current === bootstrapKey) return;
    handledWebsiteImport.current = bootstrapKey;
    setWebsiteImportOpen(true);
    void discoverWebsiteImport(requestedImportUrl);
    window.history.replaceState({}, "", "/organizer");
  }, [accessToken, discoverWebsiteImport, eventDetail?.id, requestedEventId, requestedImportUrl]);

  const analyzeWebsiteImportFields = async (sessionId: string) => {
    if (!selectedEventId || !accessToken) return;
    setWebsiteImportBusyAction("analyze");
    setWebsiteImportError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze-fields", sessionId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { workflow?: WebsiteImportReviewWorkflow; message?: string }
        | null;
      if (!response.ok || data?.workflow?.step !== "review") {
        setWebsiteImportError(data?.message ?? "Les formats ont été confirmés, mais l’analyse des champs a échoué. Relance l’analyse.");
        return;
      }
      setWebsiteImportWorkflow(data.workflow);
      setWebsiteImportFieldSelections(buildInitialWebsiteImportFieldSelections(data.workflow));
    } catch (caught) {
      console.error("Unable to analyze organizer import fields", caught);
      setWebsiteImportError("Les formats ont été confirmés, mais l’analyse des champs a été interrompue.");
    } finally {
      setWebsiteImportBusyAction(null);
    }
  };

  const confirmWebsiteImportFormats = async () => {
    if (!selectedEventId || !accessToken || websiteImportWorkflow?.step !== "formats") return;
    const invalidDecision = websiteImportFormatDecisions.find(
      (decision) =>
        decision.mode !== "ignore" &&
        (!decision.name.trim() || (decision.mode === "bind-existing" && !decision.targetRaceId))
    );
    if (invalidDecision) {
      setWebsiteImportError("Chaque format conservé doit avoir un nom et, pour un rattachement, une cible existante.");
      return;
    }
    if (!websiteImportFormatDecisions.some((decision) => decision.mode !== "ignore")) {
      setWebsiteImportError("Confirme au moins un format, ou ajoute manuellement le format manquant.");
      return;
    }

    setWebsiteImportBusyAction("confirm");
    setWebsiteImportError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm-formats",
          sessionId: websiteImportWorkflow.sessionId,
          discoverySnapshot: websiteImportWorkflow.discoverySnapshot,
          discoverySignature: websiteImportWorkflow.discoverySignature,
          confirmedFormats: websiteImportFormatDecisions.map((decision) => ({
            candidateKeys: decision.candidateKeys,
            mode: decision.mode,
            targetRaceId: decision.targetRaceId,
            name: decision.name.trim() || "Format ignoré",
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { workflow?: WebsiteImportWorkflow; message?: string }
        | null;
      if (!response.ok || data?.workflow?.step !== "fields") {
        setWebsiteImportError(data?.message ?? "Impossible de confirmer les formats détectés.");
        return;
      }
      setWebsiteImportWorkflow(data.workflow);
      for (const race of eventDetail?.races ?? []) invalidateOrganizerRaceDataCache(race.id);
      await loadEvent(selectedEventId, activeTab, selectedEditionYear);
      await analyzeWebsiteImportFields(data.workflow.sessionId);
    } catch (caught) {
      console.error("Unable to confirm organizer import formats", caught);
      setWebsiteImportError("La confirmation des formats a été interrompue.");
    } finally {
      setWebsiteImportBusyAction((current) => current === "confirm" ? null : current);
    }
  };

  const updateWebsiteImportFormatDecision = (
    groupId: string,
    change: Partial<WebsiteImportFormatDecision>
  ) => {
    setWebsiteImportFormatDecisions((current) =>
      current.map((decision) => decision.groupId === groupId ? { ...decision, ...change } : decision)
    );
    setWebsiteImportError(null);
  };

  const addManualWebsiteImportFormat = () => {
    setWebsiteImportFormatDecisions((current) => [
      ...current,
      {
        groupId: `manual-${crypto.randomUUID()}`,
        candidateKeys: [],
        mode: "create",
        targetRaceId: null,
        name: `Format ${current.filter((decision) => decision.mode !== "ignore").length + 1}`,
        manual: true,
      },
    ]);
  };

  const removeWebsiteImportFormatDecision = (groupId: string) => {
    setWebsiteImportFormatDecisions((current) => current.filter((decision) => decision.groupId !== groupId));
  };

  const mergeWebsiteImportFormatDecision = (groupId: string, targetGroupId: string) => {
    setWebsiteImportFormatDecisions((current) => {
      const source = current.find((decision) => decision.groupId === groupId);
      if (!source || groupId === targetGroupId) return current;
      return current
        .filter((decision) => decision.groupId !== groupId)
        .map((decision) =>
          decision.groupId === targetGroupId
            ? { ...decision, candidateKeys: Array.from(new Set([...decision.candidateKeys, ...source.candidateKeys])) }
            : decision
        );
    });
  };

  const separateWebsiteImportCandidate = (groupId: string, candidateKey: string) => {
    if (websiteImportWorkflow?.step !== "formats") return;
    const candidate = websiteImportWorkflow.candidates.find(
      (item) => item.candidateKey === candidateKey
    );
    setWebsiteImportFormatDecisions((current) => {
      const source = current.find((decision) => decision.groupId === groupId);
      if (!source || source.candidateKeys.length < 2) return current;
      return [
        ...current.map((decision) =>
          decision.groupId === groupId
            ? { ...decision, candidateKeys: decision.candidateKeys.filter((key) => key !== candidateKey) }
            : decision
        ),
        {
          groupId: `candidate-${candidateKey}-${crypto.randomUUID()}`,
          candidateKeys: [candidateKey],
          mode: "create" as const,
          targetRaceId: null,
          name: candidate?.names[0] ?? "Format séparé",
        },
      ];
    });
  };

  const closeWebsiteImportDialog = async () => {
    if (websiteImportBusyAction !== null) return;
    const sessionId = websiteImportWorkflow?.sessionId;
    setWebsiteImportOpen(false);
    if (!sessionId || !selectedEventId || !accessToken) return;
    try {
      await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", sessionId }),
      });
    } catch (caught) {
      console.error("Unable to cancel organizer import session", caught);
    }
  };

  const applyWebsiteImport = async () => {
    if (!selectedEventId || !accessToken || websiteImportWorkflow?.step !== "review") return;
    if (!(await saveBeforeNavigation())) return;

    setWebsiteImportBusyAction("apply");
    setWebsiteImportError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply-fields",
          sessionId: websiteImportWorkflow.sessionId,
          fieldSnapshot: websiteImportWorkflow.fieldSnapshot,
          fieldSignature: websiteImportWorkflow.fieldSignature,
          selections: Object.values(websiteImportFieldSelections),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            applied?: {
              eventUpdated: boolean;
              formatsUpdated: number;
              draftsRemaining: number;
              formatsCompleted: number;
            };
            message?: string;
          }
        | null;

      if (!response.ok || !data?.applied) {
        setWebsiteImportError(data?.message ?? "Impossible d’intégrer les informations sélectionnées.");
        return;
      }

      showToast(
        "success",
        `Import appliqué : ${data.applied.formatsUpdated} format(s) enrichi(s), ${data.applied.formatsCompleted} complet(s), ${data.applied.draftsRemaining} brouillon(s) restant(s).`
      );
      setWebsiteImportOpen(false);
      for (const race of eventDetail?.races ?? []) invalidateOrganizerRaceDataCache(race.id);
      await loadEvent(selectedEventId, activeTab, selectedEditionYear);
    } catch (caught) {
      console.error("Unable to apply organizer website import", caught);
      setWebsiteImportError("Impossible d’intégrer les informations sélectionnées.");
    } finally {
      setWebsiteImportBusyAction(null);
    }
  };

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Vérification de session...</div>;
  if (!session) return <OrganizerSignedOutCard />;

  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const rejectedClaims = claims.filter((claim) => claim.status === "rejected");
  if (memberships.length === 0) return <OrganizerNoMembershipCard pendingClaims={pendingClaims} rejectedClaims={rejectedClaims} />;

  const tabs = [
    { id: EVENT_TAB_ID, label: "Événement" },
    ...raceSeriesGroups.map((group) => ({
      id: group.id,
      label: `${group.seriesName}${group.races.some((race) => race.data_status === "draft") ? " · brouillon" : ""}`,
    })),
    { id: ADD_FORMAT_TAB_ID, label: "+" },
  ];
  const isEventTab = activeTab === EVENT_TAB_ID;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6">
      <OrganizerToast toast={toast} />
      <OrganizerSummaryHeader
        selectedMembership={selectedMembership}
        event={eventDraft}
        memberships={memberships}
        selectedEventId={selectedEventId}
        editionRequests={editionRequests}
        selectedEditionYear={selectedEditionYear}
        newEditionDate={newEditionDate}
        newEditionEndDate={newEditionEndDate}
        publicationRequestStates={currentPublicationRequests}
        onSelectedEventChange={(eventId) => {
          saveCurrentScopeInBackground();
          setSelectedEventId(eventId);
          setActiveTab(EVENT_TAB_ID);
          setActiveModule("event");
        }}
        onSelectedEditionYearChange={(year) => {
          if (year === selectedEditionYear) return;
          saveCurrentScopeInBackground();
          setSelectedEditionYear(year);
        }}
        onEditionDateChange={setNewEditionDate}
        onEditionEndDateChange={setNewEditionEndDate}
        onRequestEdition={requestNewEdition}
        onImportWebsite={
          isAdmin
            ? openWebsiteImportDialog
            : activeTier === "pro"
              ? () => {
                  const subject = `Import assisté — ${eventDetail?.name ?? "événement"} — édition ${selectedEditionYear}`;
                  window.location.assign(`mailto:${supportEmail}?subject=${encodeURIComponent(subject)}`);
                }
              : undefined
        }
        importWebsiteLabel={isAdmin ? "Importer les informations" : "Demander un import assisté"}
        completion={completion}
        hasDirtyChanges={hasDirtyChanges}
        status={status}
        activeRaceId={activeRace?.id ?? null}
        onSaveAll={() => {
          void saveAllDirty();
        }}
        onNotifyFollowers={(raceId) => {
          if (activeTier !== "pro") {
            openPricingDialog();
            return;
          }
          setEventUpdateError(null);
          setEventUpdateRaceId(raceId ?? null);
          setEventUpdatesDialogOpen(true);
        }}
        onRequestPublication={() => {
          requestPublication();
        }}
        onRacebookVisibilityChange={(raceId, isLive) => {
          void setRacebookVisibility(raceId, isLive);
        }}
        onEditionVisibilityChange={setEditionVisibility}
        onDeleteEdition={deleteSelectedEdition}
        onDeleteEvent={deleteSelectedEvent}
      />

      {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {completion ? (
        <CompletionTabsPanel
          tabs={tabs}
          activeTab={activeTab}
          activeRace={activeRace}
          completion={completion}
          dirtyModules={dirtyModules}
          onTabChange={handleTabChange}
          onSelectModule={(moduleId) => {
            if (moduleId === activeModule) return;
            saveCurrentScopeInBackground();
            setActiveModule(moduleId);
          }}
          activeModule={activeModule}
        />
      ) : null}

      <Card className="rounded-lg">
        <CardHeader
          className={
            (activeModule === "formats" || activeModule === "equipment" || activeModule === "bibPickup" || activeModule === "access") && activeRace
              ? "flex flex-row items-center justify-between gap-4 space-y-0"
              : undefined
          }
        >
          <div>
            <CardTitle>
              {activeRace && activeModule === "bibPickup"
                ? `Retrait dossard - ${activeRace.name}`
                : activeRace && activeModule === "equipment"
                  ? `Matériel - ${activeRace.name}`
                : activeRace && activeModule === "access"
                  ? `Accès - ${activeRace.name}`
                  : getModuleTitle(activeModule)}
            </CardTitle>
            {activeModule !== "formats" ? (
              <CardDescription>
                {activeRace && activeModule === "bibPickup"
                  ? "Par défaut, ce format utilise le retrait commun de l'événement."
                  : activeRace && activeModule === "equipment"
                    ? "Par défaut, ce format utilise le matériel commun de l'événement."
                  : activeRace && activeModule === "access"
                    ? "Par défaut, ce format utilise les accès communs de l'événement."
                    : getModuleDescription(activeModule)}
              </CardDescription>
            ) : null}
          </div>
          {activeModule === "formats" && activeRace ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void deleteActiveRace()}
              disabled={status === "saving" || status === "uploading"}
              className="shrink-0 border-red-300 text-red-700 hover:border-red-400 hover:bg-red-50 hover:text-red-800"
            >
              Supprimer ce format
            </Button>
          ) : activeModule === "bibPickup" && activeRace ? (
            <ToggleChip
              checked={raceForm.organizerDetails.bibPickup.overrideEnabled}
              label="Retrait différent pour ce format"
              onChange={(overrideEnabled) =>
                updateRaceForm(
                  {
                    organizerDetails: {
                      ...raceForm.organizerDetails,
                      bibPickup: { ...raceForm.organizerDetails.bibPickup, overrideEnabled },
                    },
                  },
                  "bibPickup"
                )
              }
            />
          ) : activeModule === "equipment" && activeRace ? (
            <ToggleChip
              checked={raceForm.organizerDetails.mandatoryEquipment.overrideEnabled === true}
              label="Matériel différent pour ce format"
              onChange={(overrideEnabled) =>
                updateRaceForm(
                  {
                    organizerDetails: {
                      ...raceForm.organizerDetails,
                      mandatoryEquipment: {
                        ...(overrideEnabled
                          ? expandRaceEquipmentWithCommon(
                              eventForm.organizerDetails.mandatoryEquipment,
                              raceForm.organizerDetails.mandatoryEquipment
                            )
                          : raceForm.organizerDetails.mandatoryEquipment),
                        overrideEnabled,
                      },
                    },
                  },
                  "equipment"
                )
              }
            />
          ) : activeModule === "access" && activeRace ? (
            <ToggleChip
              checked={hasRaceAccessOverride(raceForm.organizerDetails.access)}
              label="Accès différents pour ce format"
              onChange={(overrideEnabled) =>
                updateRaceForm(
                  {
                    organizerDetails: {
                      ...raceForm.organizerDetails,
                      access: {
                        ...(overrideEnabled
                          ? expandRaceAccessWithEvent(
                              eventForm.organizerDetails.access,
                              raceForm.organizerDetails.access
                            )
                          : raceForm.organizerDetails.access),
                        overrideEnabled,
                      },
                    },
                  },
                  "access"
                )
              }
            />
          ) : null}
        </CardHeader>
        <CardContent>
          {!eventDetail || !eventDraft ? (
            <p className="text-sm text-muted-foreground">Chargement de l&apos;événement...</p>
          ) : activeModule === "event" ? (
            <EventInfoEditor
              eventForm={eventForm}
              onChange={updateEventForm}
              onUploadImage={uploadEventImage}
              status={status}
            />
          ) : activeModule === "formats" ? (
            <div className="space-y-4">
              {activeRace?.data_status === "draft" ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Brouillon masqué du catalogue. À compléter : {(activeRace.missing_required_fields ?? []).map(
                    (field) => WEBSITE_IMPORT_REQUIRED_FIELD_LABELS[field] ?? field
                  ).join(", ") || "informations minimales"}.
                </p>
              ) : null}
              <FormatsEditor
                activeTab={activeTab}
                activeRace={activeRace}
                raceForm={raceForm}
                newRaceForm={newRaceForm}
                newRaceImageName={newRaceImageFile?.name ?? null}
                newRaceGpxName={newRaceGpxFile?.name ?? null}
                onRaceFormChange={(next) => updateRaceForm(next, "formats")}
                onNewRaceFormChange={setNewRaceForm}
                onCreateRace={createRace}
                onUploadRaceImage={(event) => {
                  void uploadRaceImage(event);
                }}
                onSelectNewRaceImage={selectNewRaceImage}
                onSelectNewRaceGpx={selectNewRaceGpx}
                onUploadGpx={uploadGpx}
                gpxPreview={gpxPreview}
                status={status}
                editionStartDate={eventForm.editionStartDate}
                eventLocationText={eventForm.location}
                eventLocation={eventForm.organizerDetails.eventLocation}
              />
            </div>
          ) : activeModule === "aidStations" ? (
            <AidStationsEditor
              activeRace={activeRace}
              aidStations={aidStations}
              participationMode={raceForm.participationMode}
              relayPoints={activeTier === "pro" ? relayPoints : []}
              startTime={raceForm.organizerDetails.schedule.startTime ?? ""}
              finishCutoffTime={raceForm.organizerDetails.schedule.finishCutoffTime ?? ""}
              expandedStationKey={expandedStationKey}
              onExpandedStationKeyChange={setExpandedStationKey}
              onAddStation={() => {
                const nextKey = `new-${aidStations.length}`;
                setAidStations((current) =>
                  sortAidStationsByDistance([
                    ...current,
                    {
                      name: "Nouveau ravito",
                      distanceKm: 0,
                      waterRefill: true,
                      solidRefill: true,
                      assistanceAllowed: true,
                      notes: "",
                      organizerDetails: syncAidStationWithGpxPreview(
                        {
                          name: "Nouveau ravito",
                          distanceKm: 0,
                          waterRefill: true,
                          solidRefill: true,
                          assistanceAllowed: true,
                          notes: "",
                          organizerDetails: cloneJson(defaultOrganizerAidStationDetails),
                        },
                        gpxPreview
                      ).organizerDetails,
                    },
                  ])
                );
                setExpandedStationKey(nextKey);
                markDirty("aidStations");
              }}
              onAddRelayPoint={() => {
                if (activeTier !== "pro") {
                  openPricingDialog();
                  return;
                }
                const finishDistance = Math.max(0.2, raceForm.distanceKm);
                const lastDistance = Math.max(0, ...relayPoints.map((point) => point.distanceKm));
                const suggestedDistance = lastDistance > 0
                  ? lastDistance + Math.max(0.1, (finishDistance - lastDistance) / 2)
                  : finishDistance / 2;
                const distanceKm = Math.min(finishDistance - 0.1, Math.max(0.1, suggestedDistance));
                setRelayPoints((current) => [
                  ...current,
                  {
                    name: `Point de relais ${current.length + 1}`,
                    distanceKm,
                    raceAidStationId: null,
                    handoverTime: "",
                    cutoffTime: "",
                    notes: "",
                  },
                ]);
                markDirty("aidStations");
              }}
              onUpdateRelayPoint={(index, point) => {
                setRelayPoints((current) => current.map((item, pointIndex) => pointIndex === index ? point : item));
                markDirty("aidStations");
              }}
              onRemoveRelayPoint={(index) => {
                setRelayPoints((current) => current.filter((_, pointIndex) => pointIndex !== index));
                markDirty("aidStations");
              }}
              onToggleStationRelayPoint={(station, checked) => {
                if (activeTier !== "pro") {
                  openPricingDialog();
                  return;
                }
                if (!station.id) return;
                setRelayPoints((current) => checked
                  ? [
                      ...current,
                      {
                        name: station.name,
                        distanceKm: station.distanceKm,
                        raceAidStationId: station.id,
                        handoverTime: "",
                        cutoffTime: station.organizerDetails.cutoffTime ?? "",
                        notes: "",
                      },
                    ]
                  : current.filter((point) => point.raceAidStationId !== station.id));
                markDirty("aidStations");
              }}
              onStartTimeChange={(value) =>
                updateRaceForm(
                  {
                    organizerDetails: {
                      ...raceForm.organizerDetails,
                      schedule: { ...raceForm.organizerDetails.schedule, startTime: value || null },
                    },
                  },
                  "aidStations"
                )
              }
              onFinishCutoffTimeChange={(value) =>
                updateRaceForm(
                  {
                    organizerDetails: {
                      ...raceForm.organizerDetails,
                      schedule: { ...raceForm.organizerDetails.schedule, finishCutoffTime: value || null },
                    },
                  },
                  "aidStations"
                )
              }
              onUpdateStation={updateAidStation}
              onRemoveStation={(index) => {
                const stationId = aidStations[index]?.id;
                if (stationId) {
                  setRelayPoints((current) => current.map((point) => point.raceAidStationId === stationId ? { ...point, raceAidStationId: null } : point));
                }
                setAidStations((current) => current.filter((_, stationIndex) => stationIndex !== index));
                markDirty("aidStations");
              }}
              stationProducts={activeTier === "pro" ? stationProducts : []}
              productsById={productsById}
              productForm={productForm}
              productStationId={productStationId}
              onOpenProductPicker={(stationId) => {
                if (activeTier !== "pro") {
                  openPricingDialog();
                  return;
                }
                setProductSearch("");
                setProductPickerStationId(stationId);
              }}
              onRemoveProduct={(stationId, productId) => void removeStationProduct(stationId, productId)}
              onToggleProductForm={(stationId) => {
                setProductStationId((current) => (current === stationId ? null : stationId));
              }}
              onProductFormChange={(next) => {
                setProductForm(next);
              }}
              onCreateProduct={createStationProduct}
              status={status}
            />
          ) : activeModule === "equipment" ? (
            <EquipmentEditor
              scope={isEventTab ? "event" : "format"}
              activeRace={activeRace}
              eventDetails={eventForm.organizerDetails}
              raceDetails={raceForm.organizerDetails}
              onEventChange={(details) => updateEventDetails(details, "equipment")}
              onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "equipment")}
            />
          ) : activeModule === "bibPickup" ? (
            isEventTab ? (
              <BibPickupEditor eventDetails={eventForm.organizerDetails} onEventChange={(details) => updateEventDetails(details, "bibPickup")} />
            ) : (
              <RaceBibPickupEditor
                activeRace={activeRace}
                raceDetails={raceForm.organizerDetails}
                onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "bibPickup")}
              />
            )
          ) : activeModule === "access" ? (
            <AccessEditor
              scope={isEventTab ? "event" : "format"}
              activeRace={activeRace}
              eventDetails={eventForm.organizerDetails}
              raceDetails={raceForm.organizerDetails}
              onEventChange={(details) => updateEventDetails(details, "access")}
              onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "access")}
            />
          ) : activeModule === "products" && activeTier !== "pro" ? (
            <div className="rounded-md border border-brand/40 bg-brand/5 p-5">
              <p className="font-semibold text-foreground">Produits officiels aux ravitaillements — RaceBook Pro</p>
              <p className="mt-2 text-sm text-muted-foreground">Passe à Pro pour gérer les produits disponibles et les intégrer au plan nutritionnel des coureurs.</p>
              <Button type="button" className="mt-4" onClick={openPricingDialog}>
                Découvrir RaceBook Pro
              </Button>
            </div>
          ) : activeModule === "products" ? (
            <ProductsEditor
              aidStations={aidStations}
              stationProducts={stationProducts}
              productsById={productsById}
              productForm={productForm}
              productStationId={productStationId}
              onOpenProductPicker={(stationId) => {
                setProductSearch("");
                setProductPickerStationId(stationId);
              }}
              onRemoveProduct={(stationId, productId) => void removeStationProduct(stationId, productId)}
              onToggleProductForm={(stationId) => {
                setProductStationId((current) => (current === stationId ? null : stationId));
              }}
              onProductFormChange={(next) => {
                setProductForm(next);
              }}
              onCreateProduct={createStationProduct}
              status={status}
            />
          ) : activeModule === "services" ? (
            <ServicesEditor details={eventForm.organizerDetails} onChange={(details) => updateEventDetails(details, "services")} />
          ) : activeModule === "sponsors" && isEventTab && activeTier !== "pro" ? (
            <div className="rounded-md border border-brand/40 bg-brand/5 p-5">
              <p className="font-semibold text-foreground">Gestion des sponsors — RaceBook Pro</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Passe à Pro pour ajouter les logos de tes sponsors, choisir leurs emplacements et suivre leurs clics.
              </p>
              <Button type="button" className="mt-4" onClick={openPricingDialog}>
                Découvrir RaceBook Pro
              </Button>
            </div>
          ) : activeModule === "sponsors" && isEventTab && activeEdition?.id ? (
            <SponsorsEditor
              key={activeEdition.id}
              editionId={activeEdition.id}
              authHeaders={authHeaders}
              onSummaryChange={handleSponsorSummaryChange}
              onToast={showToast}
            />
          ) : null}
        </CardContent>
      </Card>

      <ProductPickerModal
        station={productPickerStation}
        products={catalogProducts}
        linkedProductIds={
          productPickerStationId
            ? new Set(stationProducts.filter((link) => link.aidStationId === productPickerStationId).map((link) => link.productId))
            : new Set<string>()
        }
        search={productSearch}
        onSearchChange={setProductSearch}
        onAddProduct={(productId) => {
          if (productPickerStationId) void attachCatalogProduct(productPickerStationId, productId);
        }}
        onClose={() => {
          setProductPickerStationId(null);
          setProductSearch("");
        }}
        disabled={status === "saving"}
      />

      <Dialog
        open={pricingDialogOpen}
        onOpenChange={(open) => {
          setPricingDialogOpen(open);
          if (!open) {
            setCheckoutError(null);
            setPricingContext(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl gap-7 p-8 sm:p-10">
          <DialogHeader className="space-y-3">
            <DialogTitle>{pricingContext?.tier === "racebook" ? "Passer à RaceBook Pro" : "Publier cette édition"}</DialogTitle>
            <DialogDescription>
              Le droit est permanent pour cette édition et couvre tous ses formats présents et futurs. Prix hors taxes, TVA calculée par Stripe.
            </DialogDescription>
          </DialogHeader>
          {pricingContext ? (
            <div className="rounded-lg border bg-muted/40 px-5 py-4">
              <p className="font-medium text-foreground">{pricingContext.eventName}</p>
              <p className="text-sm text-muted-foreground">Édition {pricingContext.editionYear}</p>
            </div>
          ) : null}
          {checkoutError ? (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {checkoutError}
            </p>
          ) : null}
          {pricingContext?.tier === "racebook" ? (
            <Card className="border-brand p-2">
              <CardHeader className="pb-5">
                <CardTitle>RaceBook Pro — complément de 200 € HT</CardTitle>
              </CardHeader>
              <CardContent className="space-y-7">
                <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                  <li>Notifications aux coureurs</li>
                  <li>Duplication d’une édition</li>
                  <li>Gestion des relais</li>
                  <li>Produits officiels aux ravitaillements</li>
                  <li>Gestion et suivi des sponsors</li>
                  <li>Import assisté</li>
                </ul>
                <Button type="button" onClick={() => void startCheckout("pro")} disabled={checkoutTarget !== null || complimentaryGrantTarget !== null}>
                  {checkoutTarget === "pro" ? "Ouverture de Stripe…" : "Passer à Pro pour 200 € HT"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="flex h-full flex-col p-2">
                <CardHeader className="pb-5">
                  <CardTitle>RaceBook — 99 € HT</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-7">
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                    <li>Publication du RaceBook dans l’application mobile</li>
                    <li>Parcours, horaires et ravitaillements</li>
                    <li>Matériel, dossards et accès</li>
                    <li>Informations pratiques pour les coureurs</li>
                  </ul>
                  <Button type="button" variant="outline" className="mt-auto w-full" onClick={() => void startCheckout("racebook")} disabled={checkoutTarget !== null || complimentaryGrantTarget !== null}>
                    {checkoutTarget === "racebook" ? "Ouverture de Stripe…" : "Choisir RaceBook"}
                  </Button>
                </CardContent>
              </Card>
              <Card className="flex h-full flex-col border-brand p-2 shadow-sm">
                <CardHeader className="pb-5">
                  <CardTitle>RaceBook Pro — 299 € HT</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-7">
                  <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                    <li>Tout ce qui est inclus dans RaceBook</li>
                    <li>Notifications aux coureurs</li>
                    <li>Duplication d’une édition</li>
                    <li>Gestion des relais</li>
                    <li>Produits officiels aux ravitaillements</li>
                    <li>Gestion et suivi des sponsors</li>
                    <li>Import assisté</li>
                  </ul>
                  <Button type="button" className="mt-auto w-full" onClick={() => void startCheckout("pro")} disabled={checkoutTarget !== null || complimentaryGrantTarget !== null}>
                    {checkoutTarget === "pro" ? "Ouverture de Stripe…" : "Choisir RaceBook Pro"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          {isAdmin && pricingContext ? (
            <section className="space-y-5 rounded-xl border border-emerald-400 bg-emerald-50/50 p-6 dark:bg-emerald-950/20">
              <div className="space-y-1.5">
                <h3 className="text-lg font-semibold text-foreground">Offrir une offre partenaire</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Ces activations ne passent pas par Stripe. Le bouton de publication indiquera ensuite clairement que l’offre a été offerte.
                </p>
              </div>
              <div className={pricingContext.tier === "visibility" ? "grid gap-4 md:grid-cols-2" : "grid gap-4"}>
                {pricingContext.tier === "visibility" ? (
                  <div className="space-y-4 rounded-lg border border-emerald-300 bg-background/80 p-5">
                    <div className="space-y-1.5">
                      <p className="font-semibold text-foreground">Offrir RaceBook</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Active la publication mobile pour tous les formats de cette édition, sans paiement.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => void grantComplimentaryOffer("racebook")}
                      disabled={complimentaryGrantTarget !== null || checkoutTarget !== null}
                    >
                      {complimentaryGrantTarget === "racebook" ? "Activation…" : "Offrir RaceBook — valeur 99 € HT"}
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-4 rounded-lg border border-emerald-300 bg-background/80 p-5">
                  <div className="space-y-1.5">
                    <p className="font-semibold text-foreground">Offrir RaceBook Pro</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Active la publication et toutes les fonctionnalités Pro de cette édition, y compris les sponsors.
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void grantComplimentaryOffer("pro")}
                    disabled={complimentaryGrantTarget !== null || checkoutTarget !== null}
                  >
                    {complimentaryGrantTarget === "pro" ? "Activation…" : "Offrir RaceBook Pro — valeur 299 € HT"}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={eventUpdatesDialogOpen} onOpenChange={setEventUpdatesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notifier les coureurs</DialogTitle>
            <DialogDescription>
              {eventFavoriteCount === null
                ? "Charge le nombre de favoris et publie une mise à jour visible côté coureur."
                : `${eventFavoriteCount} coureur(s) suivent cette course. Le message sera aussi ajouté à l'historique public de l'événement.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="organizer-update-audience" className="text-sm font-medium text-foreground">
                Notification concernée
              </label>
              <select
                id="organizer-update-audience"
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={eventUpdateRaceId ?? ""}
                onChange={(event) => setEventUpdateRaceId(event.target.value || null)}
              >
                <option value="">Tout l’événement — {eventDetail?.name ?? "Événement"}</option>
                {eventUpdateRaceOptions.map((race) => (
                  <option key={race.id} value={race.id}>
                    Format — {race.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Le titre de la notification affichera le nom de l’événement ou celui du format choisi.
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="organizer-update-message" className="text-sm font-medium text-foreground">
                Message
              </label>
              <textarea
                id="organizer-update-message"
                className="min-h-28 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={eventUpdateMessage}
                maxLength={MAX_UPDATE_MESSAGE_LENGTH}
                placeholder="Nouvelle information sur les retraits de dossard !"
                onChange={(event) => {
                  setEventUpdateMessage(event.target.value);
                  if (eventUpdateError) setEventUpdateError(null);
                }}
              />
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className={eventUpdateError ? "font-medium text-red-700" : "text-muted-foreground"}>
                  {eventUpdateError ?? "Conseil: garde un message court et actionnable."}
                </span>
                <span className="text-muted-foreground">
                  {eventUpdateMessage.trim().length}/{MAX_UPDATE_MESSAGE_LENGTH}
                </span>
              </div>
            </div>

            {eventUpdates.length > 0 ? (
              <div className="space-y-2 rounded-md border border-border/70 bg-background/70 p-3">
                <p className="text-sm font-semibold text-foreground">Dernières mises à jour publiées</p>
                <div className="space-y-2">
                  {eventUpdates.slice(0, 3).map((update) => (
                    <div key={update.id} className="relative rounded-md border border-border/60 bg-card p-3 pr-10">
                      <button
                        type="button"
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Supprimer ce message"
                        title="Supprimer ce message"
                        disabled={eventUpdateDeletingId !== null}
                        onClick={() => void deleteEventUpdate(update)}
                      >
                        {eventUpdateDeletingId === update.id ? "…" : "×"}
                      </button>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {update.race_id
                          ? eventDetail?.races.find((race) => race.id === update.race_id)?.name ?? "Format"
                          : eventDetail?.name ?? "Événement"}
                      </p>
                      <p className="text-sm text-foreground">{update.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatUpdateDate(update.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEventUpdatesDialogOpen(false)}
              disabled={eventUpdateSending || eventUpdateDeletingId !== null}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={() => void submitEventUpdate()}
              disabled={eventUpdateSending || eventUpdateDeletingId !== null || !selectedEventId}
            >
              {eventUpdateSending ? "Envoi..." : "Envoyer la notification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={websiteImportOpen && isAdmin}
        onOpenChange={(open) => {
          if (!open) void closeWebsiteImportDialog();
          else setWebsiteImportOpen(true);
        }}
      >
        <DialogContent
          className={
            websiteImportWorkflow
              ? "!my-0 !flex h-[calc(100dvh-2rem)] min-h-0 w-[min(96vw,72rem)] !max-w-[72rem] flex-col overflow-hidden sm:h-[90dvh]"
              : "!flex max-h-[85dvh] min-h-0 w-[min(92vw,40rem)] !max-w-[40rem] flex-col overflow-hidden"
          }
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Importer les informations officielles</DialogTitle>
            <DialogDescription>
              {!websiteImportWorkflow
                ? "Explore les pages et documents officiels. Tu confirmeras d’abord les formats, puis chaque information."
                : websiteImportWorkflow.step === "formats"
                  ? "Confirme le nombre de formats avant de créer les brouillons et d’analyser leurs informations."
                  : "Valide les informations champ par champ à partir de leurs sources et preuves."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain pr-2" tabIndex={0}>
            <div className="space-y-4 pb-2">
              {!websiteImportWorkflow ? (
                <>
                  <div className="space-y-1">
                    <label htmlFor="organizer-website-import-url" className="text-sm font-medium text-foreground">
                      URL générale de l’événement
                    </label>
                    <input
                      id="organizer-website-import-url"
                      type="url"
                      className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={websiteImportUrl}
                      placeholder="https://..."
                      onChange={(event) => setWebsiteImportUrl(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Le site général aide à découvrir les formats et les informations communes.
                    </p>
                  </div>

                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">URLs officielles supplémentaires</p>
                        <p className="text-xs text-muted-foreground">
                          Optionnel : ajoute une page événement, règlement, programme, logistique, inscription, archive ou format.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => setWebsiteImportFormatUrls((urls) => [...urls, ""])}
                        disabled={websiteImportFormatUrls.length >= 12}
                      >
                        Ajouter une URL
                      </Button>
                    </div>
                    {websiteImportFormatUrls.map((formatUrl, index) => (
                      <div key={`website-import-format-url-${index}`} className="flex gap-2">
                        <input
                          aria-label={`URL officielle supplémentaire ${index + 1}`}
                          type="url"
                          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={formatUrl}
                          placeholder={`https://.../page-officielle-${index + 1}`}
                          onChange={(event) =>
                            setWebsiteImportFormatUrls((urls) =>
                              urls.map((currentUrl, currentIndex) => currentIndex === index ? event.target.value : currentUrl)
                            )
                          }
                        />
                        {websiteImportFormatUrls.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 px-3 text-xs"
                            onClick={() => setWebsiteImportFormatUrls((urls) => urls.filter((_, currentIndex) => currentIndex !== index))}
                            aria-label={`Retirer l’URL officielle supplémentaire ${index + 1}`}
                          >
                            Retirer
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Documents officiels</p>
                      <p className="text-xs text-muted-foreground">Règlement, roadbook, programme, PDF ou images · 25 Mo maximum par document.</p>
                    </div>
                    <input
                      id="organizer-website-import-documents"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      multiple
                      className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                      onChange={(event) => {
                        const files = Array.from(event.target.files ?? []);
                        const unsupportedFile = files.find((file) => !isOrganizerImportDocumentMimeType(file.type));
                        if (unsupportedFile) {
                          setWebsiteImportError(`Le format du document ${unsupportedFile.name} n’est pas pris en charge.`);
                          return;
                        }
                        const invalidFile = files.find((file) => file.size > WEBSITE_IMPORT_MAX_DOCUMENT_BYTES);
                        if (invalidFile) {
                          setWebsiteImportError(`Le document ${invalidFile.name} dépasse la limite de 25 Mo.`);
                          return;
                        }
                        if (files.length > 8) {
                          setWebsiteImportError("Ajoute au maximum 8 documents.");
                          return;
                        }
                        setWebsiteImportDocuments(files);
                        setWebsiteImportError(null);
                      }}
                    />
                    {websiteImportDocuments.length > 0 ? (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {websiteImportDocuments.map((document) => (
                          <li key={`${document.name}-${document.size}`}>{document.name}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </>
              ) : null}

              {websiteImportError ? (
                <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{websiteImportError}</p>
              ) : null}

              {websiteImportWorkflow?.step === "formats" && websiteImportWorkflow.sourceAudit?.length ? (
                <details className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-foreground" open>
                  <summary className="cursor-pointer font-medium">
                    Sources analysées ({websiteImportWorkflow.sourceAudit.length})
                  </summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {websiteImportWorkflow.sourceAudit.map((source, index) => (
                      <div key={`${source.sourceUrl ?? source.title ?? "source"}-${index}`} className="rounded-md border border-border/60 bg-muted/20 p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            {source.sourceUrl ? (
                              <a className="break-all font-medium text-primary underline-offset-2 hover:underline" href={source.sourceUrl} target="_blank" rel="noreferrer">
                                {source.title || source.sourceUrl}
                              </a>
                            ) : (
                              <p className="font-medium">{source.title || "Document officiel"}</p>
                            )}
                            <p className="text-muted-foreground">{source.roleLabel}</p>
                          </div>
                          <span className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-[11px]">
                            Confiance {source.confidence === "high" ? "forte" : source.confidence === "medium" ? "moyenne" : "faible"}
                          </span>
                        </div>
                        <p className="mt-1 text-muted-foreground">
                          {source.assertionCount} information{source.assertionCount > 1 ? "s" : ""} étayée{source.assertionCount > 1 ? "s" : ""}
                        </p>
                        {source.evidence[0] ? <p className="mt-1 line-clamp-2 text-foreground/80">« {source.evidence[0]} »</p> : null}
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}

              {websiteImportWorkflow && "warnings" in websiteImportWorkflow && websiteImportWorkflow.warnings?.length ? (
                <details className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <summary className="cursor-pointer font-medium">
                    Points à vérifier ({websiteImportWorkflow.warnings.length})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {websiteImportWorkflow.warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}
                  </div>
                </details>
              ) : null}

              {websiteImportWorkflow?.step === "formats" ? (
                <WebsiteImportFormatDiscoveryReview
                  workflow={websiteImportWorkflow}
                  decisions={websiteImportFormatDecisions}
                  existingRaces={websiteImportExistingRaces}
                  onChange={updateWebsiteImportFormatDecision}
                  onAddManual={addManualWebsiteImportFormat}
                  onMerge={mergeWebsiteImportFormatDecision}
                  onSeparate={separateWebsiteImportCandidate}
                  onRemove={removeWebsiteImportFormatDecision}
                />
              ) : null}

              {websiteImportWorkflow?.step === "fields" ? (
                <div className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Formats confirmés</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Les nouveaux formats existent maintenant comme brouillons masqués. L’analyse des champs peut être relancée sans les recréer.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {websiteImportWorkflow.confirmedFormats.map((format) => (
                      <div key={format.raceId} className="rounded-md border border-border/60 bg-background p-3">
                        <p className="text-sm font-medium text-foreground">{format.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format.missingRequiredFields.length > 0
                            ? `Brouillon · ${format.missingRequiredFields.map((field) => WEBSITE_IMPORT_REQUIRED_FIELD_LABELS[field] ?? field).join(", ")} à compléter`
                            : "Informations minimales complètes"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {websiteImportWorkflow?.step === "review" ? (
                <WebsiteImportFieldReview
                  workflow={websiteImportWorkflow}
                  selections={websiteImportFieldSelections}
                  onSelectionChange={(key, selection) =>
                    setWebsiteImportFieldSelections((current) => ({ ...current, [key]: selection }))
                  }
                />
              ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => void closeWebsiteImportDialog()}
              disabled={websiteImportBusyAction !== null}
            >
              Annuler
            </Button>
            {!websiteImportWorkflow ? (
              <Button type="button" onClick={() => void discoverWebsiteImport()} disabled={websiteImportBusyAction !== null}>
                {websiteImportBusyAction === "discover" ? "Exploration..." : "Découvrir les formats"}
              </Button>
            ) : websiteImportWorkflow.step === "formats" ? (
              <Button
                type="button"
                onClick={() => void confirmWebsiteImportFormats()}
                disabled={websiteImportBusyAction !== null || !websiteImportFormatDecisions.some((decision) => decision.mode !== "ignore")}
              >
                {websiteImportBusyAction === "confirm" ? "Création des brouillons..." : "Confirmer les formats"}
              </Button>
            ) : websiteImportWorkflow.step === "fields" ? (
              <Button
                type="button"
                onClick={() => void analyzeWebsiteImportFields(websiteImportWorkflow.sessionId)}
                disabled={websiteImportBusyAction !== null}
              >
                {websiteImportBusyAction === "analyze" ? "Analyse..." : "Relancer l’analyse des champs"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void applyWebsiteImport()} disabled={websiteImportBusyAction !== null}>
                {websiteImportBusyAction === "apply" ? "Application..." : "Appliquer les choix"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

