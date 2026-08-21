"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { buildCumulativeElevationTotals, GpxParseError, parseGpx } from "../../../lib/gpx/parseGpx";
import { type FuelType } from "../../../lib/fuel-types";
import { normalizeImportedWaypoints } from "../../../lib/gpx/normalizeImportedWaypoints";
import {
  applyCommonEquipmentToRace,
  deriveCommonEquipmentFromRaces,
  defaultOrganizerAidStationDetails,
  defaultOrganizerRaceDetails,
  type OrganizerEventDetails,
} from "../../../lib/organizer-dashboard-details";
import type { FuelProduct } from "../../../lib/product-types";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { buildOrganizerCompletion, type OrganizerCompletionSummary, type OrganizerModuleId } from "./completion";
import { AidStationsEditor } from "./dashboard/aid-stations-editor";
import { ADD_FORMAT_TAB_ID, emptyProductForm, EVENT_TAB_ID, MAX_EVENT_IMAGE_SIZE_BYTES } from "./dashboard/constants";
import { OrganizerToast } from "./dashboard/controls";
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
  sortAidStationsByDistance,
  syncAidStationWithGpxPreview,
  syncAidStationsWithGpxPreview,
  toNumberOrNull,
  type OrganizerAidStationRow,
} from "./dashboard/helpers";
import { ProductPickerModal, ProductsEditor } from "./dashboard/products-editor";
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
  StationProduct,
  WebsiteImportPreview,
  WebsiteImportRaceSelection,
} from "./dashboard/types";

const MAX_RACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const RACE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const MAX_UPDATE_MESSAGE_LENGTH = 280;
const WEBSITE_IMPORT_MINIMUM_SCORE = 70;
const EMPTY_DIRTY_MODULES = new Set<OrganizerModuleId>();

type OrganizerSaveOptions = {
  background?: boolean;
  reloadEvent?: boolean;
  scopeRevision?: number;
};

const websiteImportScoreTone = (score: number) =>
  score >= 80
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : score >= WEBSITE_IMPORT_MINIMUM_SCORE
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-red-300 bg-red-50 text-red-800";

type OrganizerRaceEventUpdate = {
  id: string;
  event_id: string;
  race_id: string | null;
  message: string;
  created_at: string;
  created_by?: string | null;
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
  const [expandedStationKey, setExpandedStationKey] = useState<string | null>(null);
  const [stationProducts, setStationProducts] = useState<StationProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<FuelProduct[]>([]);
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
  const [eventUpdateMessage, setEventUpdateMessage] = useState("");
  const [eventUpdateRaceId, setEventUpdateRaceId] = useState<string | null>(null);
  const [eventUpdateError, setEventUpdateError] = useState<string | null>(null);
  const [eventUpdateSending, setEventUpdateSending] = useState(false);
  const [eventUpdateDeletingId, setEventUpdateDeletingId] = useState<string | null>(null);
  const [eventFavoriteCount, setEventFavoriteCount] = useState<number | null>(null);
  const [eventUpdates, setEventUpdates] = useState<OrganizerRaceEventUpdate[]>([]);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [websiteImportUrl, setWebsiteImportUrl] = useState("");
  const [websiteImportFormatUrls, setWebsiteImportFormatUrls] = useState<string[]>([""]);
  const [websiteImportPreview, setWebsiteImportPreview] = useState<WebsiteImportPreview | null>(null);
  const [websiteImportEventDate, setWebsiteImportEventDate] = useState("");
  const [websiteImportSelections, setWebsiteImportSelections] = useState<Record<string, WebsiteImportRaceSelection>>({});
  const [websiteImportError, setWebsiteImportError] = useState<string | null>(null);
  const [websiteImportLoading, setWebsiteImportLoading] = useState(false);
  const [websiteImportApplying, setWebsiteImportApplying] = useState(false);
  const handledWebsiteImport = useRef<string | null>(null);
  const selectedEventIdRef = useRef<string | null>(null);
  const activeRaceIdRef = useRef<string | null>(null);
  const dirtyRevisionByScopeRef = useRef<Record<string, number>>({});
  const backgroundSaveQueuesRef = useRef<Record<string, Promise<boolean>>>({});

  const accessToken = session?.accessToken ?? null;
  selectedEventIdRef.current = selectedEventId;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const raceSeriesGroups = useMemo(() => groupRacesBySeries(eventDetail?.races ?? []), [eventDetail?.races]);
  const activeEdition = getEventEdition(eventDetail, selectedEditionYear);
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
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ id: Date.now(), type, message });
  };

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
  const serializeEquipment = (equipment: OrganizerEventDetails["mandatoryEquipment"]) =>
    JSON.stringify({
      weatherPlan: equipment.weatherPlan,
      items: equipment.items.map((item) => ({
        label: item.label,
        required: item.required,
        cold: item.cold,
        heat: item.heat,
      })),
    });

  const syncEventCommonEquipment = (details: OrganizerEventDetails, races: RaceFormat[]) => ({
    ...details,
    mandatoryEquipment: deriveCommonEquipmentFromRaces(
      races.map((race) => race.organizerDetails),
      details.mandatoryEquipment
    ),
  });

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
    return buildOrganizerCompletion(eventDraft, activeRaceForCompletion, aidStations, stationProducts);
  }, [activeRaceForCompletion, aidStations, eventDraft, stationProducts]);

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
    setWebsiteImportPreview(null);
    setWebsiteImportEventDate("");
    setWebsiteImportSelections({});
    setWebsiteImportError(null);
    setWebsiteImportLoading(false);
    setWebsiteImportApplying(false);
  }, [websiteImportOpen]);

  const loadOrganizerData = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/organizer/claims", { headers: authHeaders, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as {
        claims?: ClaimRow[];
        memberships?: MembershipRow[];
        editionRequests?: EditionRequestRow[];
        publicationRequests?: PublicationRequestRow[];
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
      setSelectedEventId((current) => {
        if (requestedEventId && nextMemberships.some((membership) => membership.event_id === requestedEventId)) {
          return requestedEventId;
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

  const loadEventUpdates = async (eventId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`/api/organizer/events/${eventId}/updates`, { headers: authHeaders, cache: "no-store" });
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
      const nextEvent = normalizeOrganizerEventDetail(data.event);
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
    } catch (caught) {
      console.error("Unable to load organizer event", caught);
      setError("Impossible de charger l'événement.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (selectedEventId) void loadEvent(selectedEventId);
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
    if (!selectedEventId || !accessToken) return;
    void loadEventUpdates(selectedEventId);
  }, [selectedEventId, accessToken, authHeaders]);

  const loadRaceSidecar = async (raceId: string, previewOverride: GpxPreview | null = null) => {
    if (!accessToken) return;
    const [aidResponse, productsResponse, catalogResponse] = await Promise.all([
      fetch(`/api/organizer/races/${raceId}/aid-stations`, { headers: authHeaders, cache: "no-store" }),
      fetch(`/api/organizer/races/${raceId}/aid-station-products`, { headers: authHeaders, cache: "no-store" }),
      fetch("/api/products", { headers: authHeaders, cache: "no-store" }),
    ]);

    if (aidResponse.ok) {
      const data = (await aidResponse.json()) as { aidStations?: OrganizerAidStationRow[] };
      if (activeRaceIdRef.current === raceId) {
        setAidStations(syncAidStationsWithGpxPreview(aidStationRowsToDrafts(data.aidStations ?? []), previewOverride));
      }
    }
    if (productsResponse.ok) {
      const data = (await productsResponse.json()) as { products?: StationProduct[] };
      if (activeRaceIdRef.current === raceId) setStationProducts(data.products ?? []);
    }
    if (catalogResponse.ok) {
      const data = (await catalogResponse.json()) as { products?: FuelProduct[] };
      setCatalogProducts(data.products ?? []);
    }
  };

  const loadRaceGpxPreview = async (raceId: string) => {
    if (!accessToken) return;
    try {
      const response = await fetch(`/api/organizer/races/${raceId}/gpx`, { headers: authHeaders, cache: "no-store" });
      if (activeRaceIdRef.current !== raceId) return;
      if (!response.ok) {
        setGpxPreview(null);
        return;
      }
      const data = (await response.json().catch(() => null)) as GpxPreview | null;
      setGpxPreview(normalizeGpxPreview(data));
    } catch (caught) {
      console.error("Unable to load organizer GPX preview", caught);
      if (activeRaceIdRef.current === raceId) setGpxPreview(null);
    }
  };

  useEffect(() => {
    if (!activeRace) {
      setRaceForm(createEmptyRaceForm());
      setAidStations([]);
      setStationProducts([]);
      setGpxPreview(null);
      return;
    }
    setAidStations([]);
    setStationProducts([]);
    setGpxPreview(null);
    setRaceForm(raceToForm(activeRace));
    setExpandedStationKey(null);
    void loadRaceSidecar(activeRace.id);
    if (activeRace.gpx_storage_path) {
      void loadRaceGpxPreview(activeRace.id);
    } else {
      setGpxPreview(null);
    }
  }, [activeRace?.id]);

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
  }, [activeEdition?.id, activeEdition?.start_date, activeEdition?.end_date]);

  useEffect(() => {
    setAidStations((current) => syncAidStationsWithGpxPreview(current, gpxPreview));
  }, [gpxPreview]);

  const saveEvent = async (override?: Partial<EventFormValues>, options: OrganizerSaveOptions = {}) => {
    if (!accessToken || !selectedEventId) return false;
    const nextForm = { ...eventForm, ...override };
    const previousCommonEquipment = eventDetail?.organizerDetails?.mandatoryEquipment ?? eventForm.organizerDetails.mandatoryEquipment;
    const equipmentChanged = serializeEquipment(previousCommonEquipment) !== serializeEquipment(nextForm.organizerDetails.mandatoryEquipment);
    const raceEquipmentUpdates = equipmentChanged
      ? (eventDetail?.races ?? [])
          .map((race) => {
          const raceOrganizerDetails = race.organizerDetails ?? defaultOrganizerRaceDetails;
          return {
            raceId: race.id,
            organizerDetails: {
              ...raceOrganizerDetails,
              mandatoryEquipment: applyCommonEquipmentToRace(
                previousCommonEquipment,
                nextForm.organizerDetails.mandatoryEquipment,
                raceOrganizerDetails.mandatoryEquipment
              ),
            },
          };
        })
      : [];

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
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer l'événement.");
        return false;
      }

      if (raceEquipmentUpdates.length > 0) {
        const raceResponses = await Promise.all(
          raceEquipmentUpdates.map(async ({ raceId, organizerDetails }) => {
            const raceResponse = await fetch(`/api/organizer/races/${raceId}`, {
              method: "PATCH",
              headers: { ...authHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ organizerDetails }),
            });
            const raceData = (await raceResponse.json().catch(() => null)) as { message?: string } | null;
            return { ok: raceResponse.ok, message: raceData?.message };
          })
        );
        const failedRaceUpdate = raceResponses.find((result) => !result.ok);
        if (failedRaceUpdate) {
          showToast("error", failedRaceUpdate.message ?? "Impossible de reporter le matériel sur toutes les courses.");
          return false;
        }
      }

      const equipmentUpdatesByRaceId = new Map(raceEquipmentUpdates.map((update) => [update.raceId, update.organizerDetails]));
      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              name: nextForm.name,
              location: nextForm.location,
              race_date: activeEdition?.is_current ? nextForm.editionStartDate : current.race_date,
              thumbnail_url: nextForm.thumbnailUrl,
              organizerDetails: nextForm.organizerDetails,
              editions: (current.editions ?? []).map((edition) =>
                String(edition.edition_year) === selectedEditionYear
                  ? { ...edition, start_date: nextForm.editionStartDate, end_date: nextForm.editionEndDate }
                  : edition
              ),
              races: current.races.map((race) => {
                const organizerDetails = equipmentUpdatesByRaceId.get(race.id);
                return organizerDetails ? { ...race, organizerDetails } : race;
              }),
            }
          : current
      );
      if (!options.background) showToast("success", "Événement mis à jour.");
      clearDirty(["event", "equipment", "bibPickup", "access", "services"], options.scopeRevision);
      if (options.reloadEvent !== false) await loadEvent(selectedEventId, EVENT_TAB_ID);
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
    const nextRaces = (eventDetail?.races ?? []).map((race) =>
      race.id === activeRace.id
        ? { ...race, series_name: nextForm.seriesName, organizerDetails: nextForm.organizerDetails }
        : race
    );
    const syncedEventDetails = syncEventCommonEquipment(eventForm.organizerDetails, nextRaces);
    const shouldSyncEventCommon =
      serializeEquipment(eventForm.organizerDetails.mandatoryEquipment) !== serializeEquipment(syncedEventDetails.mandatoryEquipment);

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
          organizerDetails: nextForm.organizerDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer le format.");
        return false;
      }

      if (shouldSyncEventCommon) {
        const eventResponse = await fetch(`/api/organizer/events/${selectedEventId}`, {
          method: "PATCH",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ selectedEditionYear, organizerDetails: syncedEventDetails }),
        });
        const eventData = (await eventResponse.json().catch(() => null)) as { message?: string } | null;
        if (!eventResponse.ok) {
          showToast("error", eventData?.message ?? "Impossible de mettre à jour le matériel partagé.");
          return false;
        }
        if (selectedEventIdRef.current === selectedEventId) {
          setEventForm((current) => ({ ...current, organizerDetails: syncedEventDetails }));
        }
      }

      setEventDetail((current) =>
        current?.id === selectedEventId
          ? {
              ...current,
              organizerDetails: shouldSyncEventCommon ? syncedEventDetails : current.organizerDetails,
              races: current.races.map((race) =>
                race.id === activeRace.id
                  ? {
                      ...race,
                      series_name: nextForm.seriesName,
                      name: nextForm.name,
                      distance_km: nextForm.distanceKm,
                      elevation_gain_m: nextForm.elevationGainM,
                      elevation_loss_m: toNumberOrNull(nextForm.elevationLossM),
                      location_text: nextForm.locationText,
                      race_date: nextForm.raceDate,
                      thumbnail_url: nextForm.thumbnailUrl,
                      organizerDetails: nextForm.organizerDetails,
                    }
                  : race
              ),
            }
          : current
      );
      if (!options.background) showToast("success", "Format mis à jour.");
      clearDirty(["formats", "equipment", "access"], options.scopeRevision);
      if (options.reloadEvent !== false) {
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
      const data = (await response.json().catch(() => null)) as (GpxPreview & { message?: string; appliedAidStationCount?: number }) | null;
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
      setRaceForm((current) => applyGpxStatsToRaceForm(current, normalizedPreview?.stats));
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
      await loadEvent(selectedEventId, activeRace.edition_group_id, getRaceEditionYear(activeRace, eventDetail?.editions));
      setRaceForm((current) => applyGpxStatsToRaceForm(current, normalizedPreview?.stats));
      await loadRaceSidecar(activeRace.id, normalizedPreview);
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
      showToast("success", "Image événement mise à jour.");
      await loadEvent(selectedEventId, activeTab, websiteImportEventDate.slice(0, 4) || selectedEditionYear);
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const uploadRaceImageFile = async (raceId: string, file: File) => {
    if (!accessToken) return false;
    if (!validateRaceImage(file)) return false;

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
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const uploadRaceImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !activeRace || !selectedEventId) return;
    try {
      const uploaded = await uploadRaceImageFile(activeRace.id, file);
      if (!uploaded) return;
      showToast("success", "Image du format mise Ã  jour.");
      await loadEvent(selectedEventId, activeRace.edition_group_id, getRaceEditionYear(activeRace, eventDetail?.editions));
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
      setActiveTab(EVENT_TAB_ID);
      setActiveModule("event");
      showToast("success", "Course supprimée.");
      await loadEvent(selectedEventId, EVENT_TAB_ID);
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
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer les ravitos.");
        return false;
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
      clearDirty(["aidStations"], options.scopeRevision);
      if (!options.background) await loadRaceSidecar(activeRace.id);
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
    await loadRaceSidecar(activeRace.id);
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
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible de créer le produit.");
        return;
      }
      setProductForm(emptyProductForm);
      showToast("success", "Produit créé pour ce ravito.");
      await loadRaceSidecar(activeRace.id);
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
      const ok = await saveRace(undefined, {
        ...scopedOptions,
        reloadEvent: scopedOptions.reloadEvent ?? !savePlan.saveAidStations,
      });
      if (!ok) return false;
    }
    if (savePlan.saveAidStations) {
      const ok = await saveAidStations(scopedOptions);
      if (!ok) return false;
      if (scopedOptions.reloadEvent !== false) {
        await loadEvent(selectedEventId, activeRace.edition_group_id, getRaceEditionYear(activeRace, eventDetail?.editions));
      }
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
    markDirty(moduleId);
  };

  const updateAidStation = (index: number, station: AidStationDraft) => {
    setAidStations((current) =>
      sortAidStationsByDistance(current.map((item, stationIndex) => (stationIndex === index ? syncAidStationWithGpxPreview(station, gpxPreview) : item)))
    );
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

  const requestPublication = async (raceId: string) => {
    if (shouldSaveActiveRaceBeforeRacebookChange(activeRace?.id, raceId) && !(await saveBeforeNavigation())) return;
    if (!accessToken || !selectedEventId || !eventDetail) return;

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/organizer/publication-requests", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selectedEventId, raceId }),
      });
      const data = (await response.json().catch(() => null)) as {
        publicationRequest?: PublicationRequestRow;
        message?: string;
      } | null;
      if (!response.ok || !data?.publicationRequest) {
        showToast("error", data?.message ?? "Impossible d'envoyer la demande de publication.");
        return;
      }

      showToast("success", "Demande de publication envoyée à l'administrateur.");
      setPublicationRequests((current) => [data.publicationRequest!, ...current]);
    } finally {
      setStatus("idle");
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
    if (!selectedEventId || !accessToken) return;

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
        body: JSON.stringify({ message, raceId: eventUpdateRaceId }),
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
      await loadEventUpdates(selectedEventId);
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
        `/api/organizer/events/${selectedEventId}/updates?updateId=${encodeURIComponent(update.id)}`,
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
    setWebsiteImportPreview(null);
    setWebsiteImportEventDate(eventForm.editionStartDate);
    setWebsiteImportSelections({});
    setWebsiteImportUrl(eventForm.organizerDetails.officialWebsiteUrl ?? "");
    setWebsiteImportFormatUrls([""]);
    setWebsiteImportOpen(true);
  };

  const previewWebsiteImport = useCallback(async (urlOverride?: string) => {
    if (!selectedEventId || !accessToken) return;
    const url = (urlOverride ?? websiteImportUrl).trim();
    if (!url) {
      setWebsiteImportError("Ajoute l'URL du site officiel avant de lancer l'analyse.");
      return;
    }

    setWebsiteImportLoading(true);
    setWebsiteImportError(null);
    setWebsiteImportUrl(url);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", url, formatUrls: websiteImportFormatUrls.map((formatUrl) => formatUrl.trim()).filter(Boolean) }),
      });
      const data = (await response.json().catch(() => null)) as { preview?: WebsiteImportPreview; message?: string } | null;
      if (!response.ok || !data?.preview) {
        setWebsiteImportPreview(null);
        setWebsiteImportSelections({});
        setWebsiteImportError(data?.message ?? "Impossible d'analyser ce site.");
        return;
      }

      setWebsiteImportPreview(data.preview);
      setWebsiteImportEventDate(data.preview.event.raceDate ?? eventForm.editionStartDate);
      setWebsiteImportSelections(
        Object.fromEntries(
          data.preview.races.map((race) => [
            race.key,
            {
              mode:
                (race.assessment?.score ?? 0) >= WEBSITE_IMPORT_MINIMUM_SCORE
                  ? race.suggestedTargetRaceId
                    ? "update"
                    : race.canCreate
                      ? "create"
                      : "ignore"
                  : "ignore",
              targetRaceId: race.suggestedTargetRaceId,
            } satisfies WebsiteImportRaceSelection,
          ])
        )
      );
    } catch (caught) {
      console.error("Unable to preview organizer website import", caught);
      setWebsiteImportPreview(null);
      setWebsiteImportSelections({});
      setWebsiteImportError("Impossible d'analyser ce site.");
    } finally {
      setWebsiteImportLoading(false);
    }
  }, [accessToken, authHeaders, eventForm.editionStartDate, selectedEventId, websiteImportFormatUrls, websiteImportUrl]);

  useEffect(() => {
    if (!requestedImportUrl || !requestedEventId || eventDetail?.id !== requestedEventId || !accessToken) return;
    const bootstrapKey = `${requestedEventId}:${requestedImportUrl}`;
    if (handledWebsiteImport.current === bootstrapKey) return;
    handledWebsiteImport.current = bootstrapKey;
    setWebsiteImportOpen(true);
    setWebsiteImportEventDate(eventForm.editionStartDate);
    void previewWebsiteImport(requestedImportUrl);
    window.history.replaceState({}, "", "/organizer");
  }, [accessToken, eventDetail?.id, eventForm.editionStartDate, previewWebsiteImport, requestedEventId, requestedImportUrl]);

  const hasApplicableWebsiteImportSelection =
    websiteImportPreview &&
    Boolean(websiteImportEventDate) &&
    (Boolean(websiteImportPreview.event.name) ||
      Boolean(websiteImportPreview.event.location) ||
      Boolean(websiteImportPreview.event.officialWebsiteUrl) ||
      websiteImportPreview.races.some((race) => {
        const selection = websiteImportSelections[race.key];
        if (!selection || selection.mode === "ignore") return false;
        if (selection.mode === "create") return race.canCreate;
        return selection.mode === "update" && Boolean(selection.targetRaceId);
      }));

  const websiteImportUsefulRaces =
    websiteImportPreview?.races
      .filter((race) => (race.assessment?.score ?? 0) >= WEBSITE_IMPORT_MINIMUM_SCORE)
      .sort((left, right) => (left.distanceKm ?? Number.POSITIVE_INFINITY) - (right.distanceKm ?? Number.POSITIVE_INFINITY)) ?? [];
  const websiteImportDiscardedRaceCount = (websiteImportPreview?.races.length ?? 0) - websiteImportUsefulRaces.length;

  const applyWebsiteImport = async () => {
    if (!selectedEventId || !accessToken || !websiteImportPreview) return;
    if (!(await saveBeforeNavigation())) return;

    const raceSelections = websiteImportPreview.races.map((race) => ({
      previewRaceKey: race.key,
      mode: websiteImportSelections[race.key]?.mode ?? "ignore",
      targetRaceId: websiteImportSelections[race.key]?.targetRaceId ?? null,
    }));

    setWebsiteImportApplying(true);
    setWebsiteImportError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}/website-import`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply",
          url: websiteImportPreview.source.url,
          formatUrls: websiteImportFormatUrls.map((formatUrl) => formatUrl.trim()).filter(Boolean),
          previewHash: websiteImportPreview.previewHash,
          eventRaceDate: websiteImportEventDate || undefined,
          eventEditionEndDate: eventForm.editionEndDate || websiteImportEventDate || undefined,
          selectedEditionYear,
          raceSelections,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            applied?: {
              eventUpdated: boolean;
              createdRaces: number;
              updatedRaces: number;
              gpxUploads: number;
              hydratedAidStations: number;
            };
            message?: string;
          }
        | null;

      if (!response.ok || !data?.applied) {
        setWebsiteImportError(data?.message ?? "Impossible d'integrer les donnees detectees.");
        return;
      }

      const created = data.applied.createdRaces ?? 0;
      const updated = data.applied.updatedRaces ?? 0;
      const gpxUploads = data.applied.gpxUploads ?? 0;
      const aidStationsCount = data.applied.hydratedAidStations ?? 0;
      showToast(
        "success",
        `Import integre: ${created} format(s) cree(s), ${updated} mis a jour, ${gpxUploads} GPX ajoute(s), ${aidStationsCount} ravito(s) hydrates.`
      );
      setWebsiteImportOpen(false);
      await loadEvent(selectedEventId, activeTab, selectedEditionYear);
    } catch (caught) {
      console.error("Unable to apply organizer website import", caught);
      setWebsiteImportError("Impossible d'integrer les donnees detectees.");
    } finally {
      setWebsiteImportApplying(false);
    }
  };

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Vérification de session...</div>;
  if (!session) return <OrganizerSignedOutCard />;

  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const rejectedClaims = claims.filter((claim) => claim.status === "rejected");
  if (memberships.length === 0) return <OrganizerNoMembershipCard pendingClaims={pendingClaims} rejectedClaims={rejectedClaims} />;

  const tabs = [
    { id: EVENT_TAB_ID, label: "Événement" },
    ...raceSeriesGroups.map((group) => ({ id: group.id, label: group.seriesName })),
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
        onImportWebsite={openWebsiteImportDialog}
        completion={completion}
        hasDirtyChanges={hasDirtyChanges}
        status={status}
        onSaveAll={() => {
          void saveAllDirty();
        }}
        onNotifyFollowers={() => {
          setEventUpdateError(null);
          setEventUpdateRaceId(null);
          setEventUpdatesDialogOpen(true);
        }}
        onRequestPublication={(raceId) => {
          void requestPublication(raceId);
        }}
        onRacebookVisibilityChange={(raceId, isLive) => {
          void setRacebookVisibility(raceId, isLive);
        }}
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
        <CardHeader className={activeModule === "formats" && activeRace ? "flex flex-row items-center justify-between gap-4 space-y-0" : undefined}>
          <div>
            <CardTitle>{getModuleTitle(activeModule)}</CardTitle>
            {activeModule !== "formats" ? <CardDescription>{getModuleDescription(activeModule)}</CardDescription> : null}
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
          ) : activeModule === "aidStations" ? (
            <AidStationsEditor
              activeRace={activeRace}
              aidStations={aidStations}
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
                setAidStations((current) => current.filter((_, stationIndex) => stationIndex !== index));
                markDirty("aidStations");
              }}
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

      <Dialog open={websiteImportOpen} onOpenChange={setWebsiteImportOpen}>
        <DialogContent
          className={
            websiteImportPreview
              ? "!my-0 !flex h-[calc(100dvh-2rem)] min-h-0 w-[min(96vw,72rem)] !max-w-[72rem] flex-col overflow-hidden sm:h-[90dvh]"
              : "!flex max-h-[85dvh] min-h-0 w-[min(92vw,40rem)] !max-w-[40rem] flex-col overflow-hidden"
          }
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>Importer depuis le site officiel</DialogTitle>
            <DialogDescription>
              Colle l&apos;URL du site de la course pour recuperer un recap des informations detectees avant integration.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 touch-pan-y overflow-y-scroll overscroll-contain pr-2" tabIndex={0}>
            <div className="space-y-4 pb-2">
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
              <p className="text-xs text-muted-foreground">Cette page sert uniquement aux informations communes : materiel, navettes, parkings et lieu de depart.</p>
            </div>

            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">URLs des formats</p>
                  <p className="text-xs text-muted-foreground">Ajoute une page par format pour en identifier les donnees de parcours.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => setWebsiteImportFormatUrls((urls) => [...urls, ""])}
                  disabled={websiteImportFormatUrls.length >= 12}
                >
                  Ajouter un format
                </Button>
              </div>
              {websiteImportFormatUrls.map((formatUrl, index) => (
                <div key={`website-import-format-url-${index}`} className="flex gap-2">
                  <input
                    aria-label={`URL du format ${index + 1}`}
                    type="url"
                    className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formatUrl}
                    placeholder={`https://.../format-${index + 1}`}
                    onChange={(event) =>
                      setWebsiteImportFormatUrls((urls) => urls.map((currentUrl, currentIndex) => (currentIndex === index ? event.target.value : currentUrl)))
                    }
                  />
                  {websiteImportFormatUrls.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 px-3 text-xs"
                      onClick={() => setWebsiteImportFormatUrls((urls) => urls.filter((_, currentIndex) => currentIndex !== index))}
                      aria-label={`Retirer le format ${index + 1}`}
                    >
                      Retirer
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            {websiteImportError ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{websiteImportError}</p> : null}

            {websiteImportPreview ? (
              <div className="space-y-4 rounded-md border border-border/70 bg-background/70 p-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Evenement detecte</p>
                    <span className="text-xs text-muted-foreground">{websiteImportPreview.source.label}</span>
                  </div>
                  <div className="grid gap-2 text-sm text-foreground sm:grid-cols-2">
                    <div className="rounded-md border border-border/60 bg-card p-3">
                      <p className="font-medium">{websiteImportPreview.event.name ?? "Nom manquant"}</p>
                      <p className="text-muted-foreground">{websiteImportPreview.event.location ?? "Lieu manquant"}</p>
                      <div className="mt-3 space-y-1">
                        <label htmlFor="organizer-website-import-event-date" className="text-xs font-medium text-foreground">
                          Début de l&apos;édition importée
                        </label>
                        <input
                          id="organizer-website-import-event-date"
                          type="date"
                          required
                          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          value={websiteImportEventDate}
                          onChange={(event) => setWebsiteImportEventDate(event.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Date détectée : {websiteImportPreview.event.raceDate ?? "aucune"}. Modifiable avant intégration.
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-card p-3 text-muted-foreground">
                      <p>{websiteImportPreview.event.officialWebsiteUrl ?? "Site officiel manquant"}</p>
                      <p>{websiteImportUsefulRaces.length} format(s) exploitable(s)</p>
                    </div>
                  </div>
                  {websiteImportPreview.event.logistics.mandatoryEquipment.length > 0 ||
                  websiteImportPreview.event.logistics.startAddress ||
                  websiteImportPreview.event.logistics.shuttles ||
                  websiteImportPreview.event.logistics.officialParkings ? (
                    <div className="grid gap-2 text-xs text-foreground sm:grid-cols-2">
                      {websiteImportPreview.event.logistics.mandatoryEquipment.length > 0 ? (
                        <div className="rounded-md border border-border/60 bg-card p-3">
                          <p className="font-medium">Materiel detecte</p>
                          <p className="mt-1 text-muted-foreground">{websiteImportPreview.event.logistics.mandatoryEquipment.join(" · ")}</p>
                        </div>
                      ) : null}
                      {websiteImportPreview.event.logistics.startAddress ? (
                        <div className="rounded-md border border-border/60 bg-card p-3">
                          <p className="font-medium">Lieu de depart</p>
                          <p className="mt-1 text-muted-foreground">{websiteImportPreview.event.logistics.startAddress}</p>
                        </div>
                      ) : null}
                      {websiteImportPreview.event.logistics.shuttles ? (
                        <div className="rounded-md border border-border/60 bg-card p-3">
                          <p className="font-medium">Navettes</p>
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">{websiteImportPreview.event.logistics.shuttles}</p>
                        </div>
                      ) : null}
                      {websiteImportPreview.event.logistics.officialParkings ? (
                        <div className="rounded-md border border-border/60 bg-card p-3">
                          <p className="font-medium">Parkings</p>
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">{websiteImportPreview.event.logistics.officialParkings}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {websiteImportPreview.warnings.length > 0 ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                      {websiteImportPreview.warnings.join(" ")}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Formats regroupés par distance</p>
                      <p className="text-xs text-muted-foreground">Les informations trouvées sur plusieurs pages sont réunies dans le même format.</p>
                    </div>
                    {websiteImportDiscardedRaceCount > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {websiteImportDiscardedRaceCount} resultat(s) sous {WEBSITE_IMPORT_MINIMUM_SCORE}/100 masque(s)
                      </p>
                    ) : null}
                  </div>
                  {websiteImportUsefulRaces.map((race) => {
                    const selection = websiteImportSelections[race.key] ?? { mode: "ignore", targetRaceId: null };
                    const foundFindings = race.assessment?.findings.filter((finding) => finding.value && finding.key !== "gpx") ?? [];
                    const missingFindings = race.assessment?.findings.filter((finding) => !finding.value && finding.key !== "gpx") ?? [];
                    const hasImportableGpx = Boolean(race.assessment?.findings.find((finding) => finding.key === "gpx")?.value);
                    const importRaceDate = websiteImportEventDate
                      ? race.raceDate
                        ? `${websiteImportEventDate.slice(0, 4)}${race.raceDate.slice(4)}`
                        : websiteImportEventDate
                      : race.raceDate;
                    return (
                      <div key={race.key} className="space-y-3 rounded-md border border-border/60 bg-card p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                              {race.distanceKm !== null ? `Distance ${race.distanceKm} km` : "Distance à renseigner"}
                            </p>
                            <p className="mt-0.5 font-medium text-foreground">{race.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {[importRaceDate, race.locationText, race.elevationGainM !== null ? `D+ ${race.elevationGainM} m` : null, race.elevationLossM !== null ? `D− ${race.elevationLossM} m` : null]
                                .filter(Boolean)
                                .join(" · ") || "Informations partielles"}
                            </p>
                          </div>
                          <div className="flex items-start gap-2 text-right text-xs text-muted-foreground">
                            {race.assessment ? (
                              <div className={`rounded-md border px-2.5 py-1.5 ${websiteImportScoreTone(race.assessment.score)}`}>
                                <p className="text-base font-semibold leading-none">{race.assessment.score}/100</p>
                                <p className="mt-1">score global</p>
                              </div>
                            ) : null}
                            <div>
                              {race.detectedAidStationCount > 0 ? <p>{race.detectedAidStationCount} ravito(s)</p> : null}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`rounded-md border p-3 ${
                            hasImportableGpx
                              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                              : "border-amber-300 bg-amber-50 text-amber-900"
                          }`}
                        >
                          <p className="text-sm font-semibold">{hasImportableGpx ? "GPX récupéré" : "GPX manquant"}</p>
                          <p className="mt-1 text-xs">
                            {hasImportableGpx
                              ? "Le tracé est importable. La distance, le D+ et le D− sont calculés depuis ce GPX."
                              : race.hasReliableGpx
                                ? "Des métriques fiables ont été trouvées, mais aucun fichier GPX importable n’a pu être récupéré. Ajoute-le manuellement si tu l’obtiens."
                                : "Aucun fichier GPX ni aucune géométrie exploitable n’a été trouvé. Ajoute le GPX manuellement pour fiabiliser distance, D+ et D−."}
                          </p>
                        </div>
                        {race.assessment ? (
                          <div className="grid gap-3 lg:grid-cols-2">
                            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-semibold text-emerald-900">Données trouvées</p>
                                <p className="text-xs text-emerald-800">{foundFindings.length} champ(s)</p>
                              </div>
                              <div className="mt-3 space-y-2">
                                {foundFindings.map((finding) => (
                                  <div key={finding.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                                    <p className="font-medium text-foreground">{finding.label}</p>
                                    <div className="min-w-0 text-right text-muted-foreground">
                                      <span className="break-words">{finding.value}</span>
                                      {finding.sourceUrl && finding.sourceLabel ? (
                                        <a
                                          className="ml-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
                                          href={finding.sourceUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Source
                                        </a>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3">
                              <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-semibold text-amber-900">À renseigner manuellement</p>
                                <p className="text-xs text-amber-800">{missingFindings.length} champ(s)</p>
                              </div>
                              {missingFindings.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {missingFindings.map((finding) => (
                                    <div key={finding.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                      <p className="font-medium text-foreground">{finding.label}</p>
                                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${finding.required ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                                        {finding.required ? "Obligatoire" : "Facultatif"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-emerald-800">Aucune donnée complémentaire à saisir.</p>
                              )}
                            </div>
                          </div>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                          <select
                            className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                            value={selection.mode}
                            onChange={(event) =>
                              setWebsiteImportSelections((current) => ({
                                ...current,
                                [race.key]: {
                                  mode: event.target.value as WebsiteImportRaceSelection["mode"],
                                  targetRaceId:
                                    event.target.value === "update"
                                      ? current[race.key]?.targetRaceId ?? race.suggestedTargetRaceId
                                      : null,
                                },
                              }))
                            }
                          >
                            <option value="ignore">Ignorer</option>
                            <option value="create" disabled={!race.canCreate}>
                              Creer un format
                            </option>
                            <option value="update">Mettre a jour un format</option>
                          </select>
                          {selection.mode === "update" ? (
                            <select
                              className="h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                              value={selection.targetRaceId ?? ""}
                              onChange={(event) =>
                                setWebsiteImportSelections((current) => ({
                                  ...current,
                                  [race.key]: {
                                    mode: "update",
                                    targetRaceId: event.target.value || null,
                                  },
                                }))
                              }
                            >
                              <option value="">Choisir le format cible</option>
                              {(eventDetail?.races ?? []).map((eventRace) => (
                                <option key={eventRace.id} value={eventRace.id}>
                                  {eventRace.series_name} · {eventRace.race_date?.slice(0, 10) ?? "Sans date"}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground">
                              {selection.mode === "create"
                                ? "Le format sera cree en brouillon sous cet evenement."
                                : race.suggestedTargetRaceId
                                  ? "Suggestion detectee pour une mise a jour, a activer si besoin."
                                  : "Aucune cible selectionnee pour le moment."}
                            </div>
                          )}
                        </div>
                        {race.warnings.length > 0 ? <p className="text-xs text-amber-800">{race.warnings.join(" ")}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
            </div>
          </div>

          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={() => setWebsiteImportOpen(false)} disabled={websiteImportLoading || websiteImportApplying}>
              Annuler
            </Button>
            {websiteImportPreview ? (
              <Button type="button" onClick={() => void applyWebsiteImport()} disabled={websiteImportApplying || !hasApplicableWebsiteImportSelection}>
                {websiteImportApplying ? "Integration..." : "Valider l'integration"}
              </Button>
            ) : (
              <Button type="button" onClick={() => void previewWebsiteImport()} disabled={websiteImportLoading}>
                {websiteImportLoading ? "Analyse..." : "Lancer l'analyse"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

