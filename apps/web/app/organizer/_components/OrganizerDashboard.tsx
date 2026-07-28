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
import { AccessEditor, BibPickupEditor, EquipmentEditor, PreviewLauncher, ServicesEditor } from "./dashboard/detail-editors";
import { EventInfoEditor, FormatsEditor } from "./dashboard/event-format-editors";
import {
  aidStationRowsToDrafts,
  buildEventDraft,
  buildProductsById,
  cloneJson,
  createEmptyEventForm,
  createEmptyRaceForm,
  createRaceFormFromEventDefaults,
  createRaceFormFromFormatDefaults,
  eventToForm,
  getAvailableEditionYears,
  getRaceEditionYearLabel,
  getRaceEditionYearValue,
  groupRacesBySeries,
  getModuleDescription,
  getModuleForTab,
  getModuleTitle,
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
import { RunnerPreviewDialog } from "./dashboard/runner-preview-dialog";
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
  ProductFormValues,
  RaceFormat,
  RaceFormValues,
  StationProduct,
  WebsiteImportPreview,
  WebsiteImportConfidence,
  WebsiteImportRaceSelection,
} from "./dashboard/types";

const MAX_RACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const RACE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const MAX_UPDATE_MESSAGE_LENGTH = 280;
const EDITION_LOCK_GRACE_DAYS = 14;

const websiteImportScoreTone = (score: number) =>
  score >= 80
    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
    : score >= 55
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-red-300 bg-red-50 text-red-800";

const websiteImportConfidenceLabel: Record<WebsiteImportConfidence, string> = {
  high: "Fiable",
  medium: "À confirmer",
  low: "Faible",
};

const websiteImportConfidenceTone: Record<WebsiteImportConfidence, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

type OrganizerRaceEventUpdate = {
  id: string;
  event_id: string;
  message: string;
  created_at: string;
  created_by?: string | null;
};

const getEditionLockState = (raceDate: string | null | undefined, now = new Date()) => {
  if (!raceDate?.trim()) return { locked: false, lockDateLabel: null as string | null };
  const parsed = new Date(`${raceDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return { locked: false, lockDateLabel: null as string | null };
  const lockDate = new Date(parsed.getTime() + EDITION_LOCK_GRACE_DAYS * 24 * 60 * 60 * 1000);
  return {
    locked: now.getTime() >= lockDate.getTime(),
    lockDateLabel: lockDate.toISOString().slice(0, 10),
  };
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
  const [showRaceDetails, setShowRaceDetails] = useState(true);
  const [aidStations, setAidStations] = useState<AidStationDraft[]>([]);
  const [expandedStationKey, setExpandedStationKey] = useState<string | null>(null);
  const [stationProducts, setStationProducts] = useState<StationProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<FuelProduct[]>([]);
  const [productPickerStationId, setProductPickerStationId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productStationId, setProductStationId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormValues>(emptyProductForm);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dirtyModules, setDirtyModules] = useState<Set<OrganizerModuleId>>(() => new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "uploading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; type: "success" | "error"; message: string } | null>(null);
  const [gpxPreview, setGpxPreview] = useState<GpxPreview | null>(null);
  const [eventUpdatesDialogOpen, setEventUpdatesDialogOpen] = useState(false);
  const [eventUpdateMessage, setEventUpdateMessage] = useState("");
  const [eventUpdateError, setEventUpdateError] = useState<string | null>(null);
  const [eventUpdateSending, setEventUpdateSending] = useState(false);
  const [eventFavoriteCount, setEventFavoriteCount] = useState<number | null>(null);
  const [eventUpdates, setEventUpdates] = useState<OrganizerRaceEventUpdate[]>([]);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [websiteImportUrl, setWebsiteImportUrl] = useState("");
  const [websiteImportPreview, setWebsiteImportPreview] = useState<WebsiteImportPreview | null>(null);
  const [websiteImportEventDate, setWebsiteImportEventDate] = useState("");
  const [websiteImportSelections, setWebsiteImportSelections] = useState<Record<string, WebsiteImportRaceSelection>>({});
  const [websiteImportError, setWebsiteImportError] = useState<string | null>(null);
  const [websiteImportLoading, setWebsiteImportLoading] = useState(false);
  const [websiteImportApplying, setWebsiteImportApplying] = useState(false);
  const handledWebsiteImport = useRef<string | null>(null);

  const accessToken = session?.accessToken ?? null;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const raceSeriesGroups = useMemo(() => groupRacesBySeries(eventDetail?.races ?? []), [eventDetail?.races]);
  const activeSeries =
    activeTab === EVENT_TAB_ID || activeTab === ADD_FORMAT_TAB_ID
      ? null
      : raceSeriesGroups.find((group) => group.id === activeTab) ?? null;
  const activeRace =
    activeSeries?.races.find((race) => getRaceEditionYearValue(race.race_date) === selectedEditionYear) ??
    activeSeries?.races[0] ??
    null;
  const activeRaceForCompletion = activeRace ? { ...activeRace, organizerDetails: raceForm.organizerDetails } : null;
  const productPickerStation = productPickerStationId ? aidStations.find((station) => station.id === productPickerStationId) ?? null : null;
  const hasDirtyChanges = dirtyModules.size > 0;
  const currentEditionRequest =
    editionRequests.find(
      (request) => request.event_id === selectedEventId && request.requested_start_date === newEditionDate && request.status !== "rejected"
    ) ?? null;
  const selectedEditionReferenceDate = useMemo(() => {
    if (!selectedEditionYear || !eventDetail) return null;
    const matchingDates = eventDetail.races
      .map((race) => race.race_date ?? null)
      .filter((raceDate): raceDate is string => Boolean(raceDate?.startsWith(selectedEditionYear)))
      .sort();
    return matchingDates[0] ?? (eventDetail.race_date?.startsWith(selectedEditionYear) ? eventDetail.race_date : null) ?? null;
  }, [eventDetail, selectedEditionYear]);
  const selectedEditionLock = useMemo(() => getEditionLockState(selectedEditionReferenceDate), [selectedEditionReferenceDate]);
  const editLocked = selectedEditionLock.locked;
  const editLockMessage =
    editLocked && selectedEditionYear
      ? `Edition ${selectedEditionYear} verrouillee depuis le ${selectedEditionLock.lockDateLabel}. Seules les editions futures restent modifiables.`
      : null;

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

  const eventDraft = buildEventDraft(eventDetail, eventForm, activeRace, raceForm);
  const productsById = useMemo(() => buildProductsById(catalogProducts, stationProducts), [catalogProducts, stationProducts]);
  const authHeaders = useMemo((): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), [accessToken]);
  const rejectLockedEdition = () => {
    if (!editLocked) return false;
    showToast("error", editLockMessage ?? "Cette edition n'est plus modifiable.");
    return true;
  };

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
    setDirtyModules((current) => {
      const next = new Set(current);
      next.add(moduleId);
      return next;
    });
  };

  const clearDirty = (moduleIds: OrganizerModuleId[]) => {
    setDirtyModules((current) => {
      const next = new Set(current);
      moduleIds.forEach((moduleId) => next.delete(moduleId));
      return next;
    });
  };

  useEffect(() => {
    if (!hasDirtyChanges) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasDirtyChanges]);

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
        message?: string;
      } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de charger le compte organisateur.");
        return;
      }
      const nextMemberships = data?.memberships ?? [];
      setClaims(data?.claims ?? []);
      setEditionRequests(data?.editionRequests ?? []);
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
      const nextEventForm = eventToForm(nextEvent);
      setEventForm(nextEventForm);
      setNewRaceForm(createRaceFormFromEventDefaults(nextEventForm));
      setNewRaceImageFile(null);
      setNewRaceGpxFile(null);
      const groupedRaces = groupRacesBySeries(nextEvent.races);
      const nextEditionYears = getAvailableEditionYears(nextEvent.races);
      const resolvedEditionYear =
        (preferredEditionYear && nextEditionYears.includes(preferredEditionYear) ? preferredEditionYear : null) ?? nextEditionYears[0] ?? "";
      setSelectedEditionYear(resolvedEditionYear);
      if (preferredTabId === EVENT_TAB_ID || preferredTabId === ADD_FORMAT_TAB_ID) {
        setActiveTab(preferredTabId);
      } else {
        const preferredGroupId = groupedRaces.find((group) => group.id === preferredTabId)?.id ?? groupedRaces[0]?.id ?? null;
        setActiveTab(preferredGroupId ?? EVENT_TAB_ID);
      }
      setDirtyModules(new Set());
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
      setAidStations(syncAidStationsWithGpxPreview(aidStationRowsToDrafts(data.aidStations ?? []), previewOverride));
    }
    if (productsResponse.ok) {
      const data = (await productsResponse.json()) as { products?: StationProduct[] };
      setStationProducts(data.products ?? []);
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
      if (!response.ok) {
        setGpxPreview(null);
        return;
      }
      const data = (await response.json().catch(() => null)) as GpxPreview | null;
      setGpxPreview(normalizeGpxPreview(data));
    } catch (caught) {
      console.error("Unable to load organizer GPX preview", caught);
      setGpxPreview(null);
    }
  };

  useEffect(() => {
    if (!activeRace) {
      setRaceForm(createEmptyRaceForm());
      setAidStations([]);
      setStationProducts([]);
      setGpxPreview(null);
      setNewEditionDate("");
      return;
    }
    setRaceForm(raceToForm(activeRace));
    if (activeRace.race_date) {
      const nextDate = new Date(activeRace.race_date);
      if (!Number.isNaN(nextDate.getTime())) {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        setNewEditionDate(nextDate.toISOString().slice(0, 10));
      } else {
        setNewEditionDate("");
      }
    } else {
      setNewEditionDate("");
    }
    setExpandedStationKey(null);
    void loadRaceSidecar(activeRace.id);
    if (activeRace.gpx_storage_path) {
      void loadRaceGpxPreview(activeRace.id);
    } else {
      setGpxPreview(null);
    }
  }, [activeRace?.id]);

  useEffect(() => {
    setAidStations((current) => syncAidStationsWithGpxPreview(current, gpxPreview));
  }, [gpxPreview]);

  const saveEvent = async (override?: Partial<EventFormValues>) => {
    if (!accessToken || !selectedEventId) return false;
    if (rejectLockedEdition()) return false;
    const nextForm = { ...eventForm, ...override };
    const previousCommonEquipment = eventDetail?.organizerDetails?.mandatoryEquipment ?? eventForm.organizerDetails.mandatoryEquipment;
    const equipmentChanged = serializeEquipment(previousCommonEquipment) !== serializeEquipment(nextForm.organizerDetails.mandatoryEquipment);
    const raceEquipmentUpdates = equipmentChanged
      ? (eventDetail?.races ?? [])
          .filter((race) => !getEditionLockState(race.race_date).locked)
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

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedEditionYear,
          name: nextForm.name,
          location: nextForm.location,
          raceDate: nextForm.raceDate,
          thumbnailUrl: nextForm.thumbnailUrl,
          isLive: nextForm.isLive,
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

      showToast("success", "Événement mis à jour.");
      clearDirty(["event", "equipment", "bibPickup", "access", "services"]);
      await loadEvent(selectedEventId, EVENT_TAB_ID);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const saveRace = async (override?: Partial<RaceFormValues>) => {
    if (!accessToken || !activeRace || !selectedEventId) return false;
    if (rejectLockedEdition()) return false;
    const nextForm = {
      ...raceForm,
      ...override,
      organizerDetails: sanitizeRaceDetailsForSave(override?.organizerDetails ?? raceForm.organizerDetails),
    };
    const nextRaces = (eventDetail?.races ?? []).map((race) =>
      race.id === activeRace.id
        ? { ...race, series_name: nextForm.seriesName, organizerDetails: nextForm.organizerDetails }
        : race
    );
    const syncedEventDetails = syncEventCommonEquipment(eventForm.organizerDetails, nextRaces);
    const shouldSyncEventCommon =
      serializeEquipment(eventForm.organizerDetails.mandatoryEquipment) !== serializeEquipment(syncedEventDetails.mandatoryEquipment);

    setStatus("saving");
    setError(null);
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
          isLive: nextForm.isLive,
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
        setEventForm((current) => ({ ...current, organizerDetails: syncedEventDetails }));
      }

      showToast("success", "Format mis à jour.");
      clearDirty(["formats", "equipment", "access"]);
      await loadEvent(selectedEventId, activeRace.edition_group_id, activeRace.id);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const createRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;
    if (rejectLockedEdition()) return;
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
          seriesName: newRaceForm.seriesName.trim() || newRaceForm.name,
          name: newRaceForm.name,
          distanceKm: newRaceForm.distanceKm,
          elevationGainM: newRaceForm.elevationGainM,
          elevationLossM: toNumberOrNull(newRaceForm.elevationLossM),
          locationText: newRaceForm.locationText,
          raceDate: newRaceForm.raceDate,
          thumbnailUrl: newRaceForm.thumbnailUrl,
          isLive: newRaceForm.isLive,
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
      setSelectedEditionYear(getRaceEditionYearValue(data.race.race_date));
      setActiveTab(data.race.edition_group_id);
      setActiveModule("formats");
      showToast("success", imageUploaded ? "Format ajouté." : "Format ajouté. Réessaie l'image si besoin.");
      await loadEvent(selectedEventId, data.race.edition_group_id, getRaceEditionYearValue(data.race.race_date));
    } finally {
      setStatus("idle");
    }
  };

  const duplicateActiveRace = async () => {
    if (!accessToken || !selectedEventId || !activeRace) return;
    if (rejectLockedEdition()) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/organizer/races", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          seriesName: `${activeRace.series_name} copie`,
          name: `${activeRace.name} copie`,
          distanceKm: activeRace.distance_km,
          elevationGainM: activeRace.elevation_gain_m,
          elevationLossM: activeRace.elevation_loss_m ?? null,
          locationText: activeRace.location_text ?? "",
          raceDate: activeRace.race_date ?? "",
          thumbnailUrl: activeRace.thumbnail_url ?? "",
          isLive: false,
          organizerDetails: sanitizeRaceDetailsForSave(activeRace.organizerDetails ?? defaultOrganizerRaceDetails),
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok || !data?.race) {
        showToast("error", data?.message ?? "Impossible de dupliquer le format.");
        return;
      }
      setSelectedEditionYear(getRaceEditionYearValue(data.race.race_date));
      setActiveTab(data.race.edition_group_id);
      setActiveModule("formats");
      showToast("success", "Format dupliqué en brouillon, sans GPX ni ravitos.");
      await loadEvent(selectedEventId, data.race.edition_group_id, getRaceEditionYearValue(data.race.race_date));
    } finally {
      setStatus("idle");
    }
  };

  const requestNewEdition = async () => {
    if (!accessToken || !selectedEventId || !selectedEditionYear) return;
    if (!newEditionDate.trim()) {
      showToast("error", "Ajoute la date de la nouvelle edition.");
      return;
    }
    if (currentEditionRequest) {
      showToast("error", "Une demande existe deja pour cette date.");
      return;
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
        }),
      });
      const data = (await response.json().catch(() => null)) as { editionRequest?: EditionRequestRow; message?: string } | null;
      if (!response.ok || !data?.editionRequest) {
        showToast("error", data?.message ?? "Impossible de demander la nouvelle edition.");
        return;
      }
      setEditionRequests((current) => [data.editionRequest!, ...current]);
      showToast("success", "Demande de nouvelle edition envoyee pour validation.");
    } finally {
      setStatus("idle");
    }
  };

  const uploadRaceGpxFile = async (raceId: string, file: File) => {
    if (!accessToken) return { ok: false };
    if (rejectLockedEdition()) return { ok: false };
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
      setGpxPreview(normalizeGpxPreview(data));
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
      await loadEvent(selectedEventId, activeRace.edition_group_id, activeRace.id);
      await loadRaceSidecar(activeRace.id, normalizeGpxPreview(data));
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const uploadEventImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !accessToken || !selectedEventId) return;
    if (rejectLockedEdition()) {
      event.target.value = "";
      return;
    }
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
      await loadEvent(selectedEventId, activeTab, selectedEditionYear);
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const uploadRaceImageFile = async (raceId: string, file: File) => {
    if (!accessToken) return false;
    if (rejectLockedEdition()) return false;
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
      await loadEvent(selectedEventId, activeRace.edition_group_id, activeRace.id);
    } finally {
      event.target.value = "";
    }
  };

  const selectNewRaceImage = (event: ChangeEvent<HTMLInputElement>) => {
    if (rejectLockedEdition()) {
      event.target.value = "";
      return;
    }
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
    if (rejectLockedEdition()) {
      event.target.value = "";
      return;
    }
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
      setNewRaceForm((current) => ({
        ...current,
        distanceKm: parsed.stats.distanceKm,
        elevationGainM: Math.round(parsed.stats.gainM),
        elevationLossM: Math.round(parsed.stats.lossM).toString(),
      }));
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
    if (rejectLockedEdition()) return;
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

  const saveAidStations = async () => {
    if (!accessToken || !activeRace) return false;
    if (rejectLockedEdition()) return false;
    setStatus("saving");
    setError(null);
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
      showToast("success", "Ravitos mis à jour.");
      clearDirty(["aidStations"]);
      await loadRaceSidecar(activeRace.id);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const replaceStationProducts = async (aidStationId: string, products: Array<{ productId: string; notes?: string | null }>) => {
    if (!accessToken || !activeRace) return false;
    if (rejectLockedEdition()) return false;
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
    if (rejectLockedEdition()) return;
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

  const saveAllDirty = async () => {
    if (!hasDirtyChanges) return true;
    if (activeTab === EVENT_TAB_ID || !activeRace) {
      const eventDirty = ["event", "equipment", "bibPickup", "access", "services"].some((moduleId) => dirtyModules.has(moduleId as OrganizerModuleId));
      if (!eventDirty) return true;
      return await saveEvent();
    }
    const raceDirty = ["formats", "equipment", "access"].some((moduleId) => dirtyModules.has(moduleId as OrganizerModuleId));
    if (raceDirty) {
      const ok = await saveRace();
      if (!ok) return false;
    }
    if (dirtyModules.has("aidStations")) {
      return await saveAidStations();
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

  const updateEventForm = (next: Partial<EventFormValues>, moduleId: OrganizerModuleId = "event") => {
    if (editLocked) return;
    setEventForm((current) => ({ ...current, ...next }));
    markDirty(moduleId);
  };

  const updateEventDetails = (nextDetails: OrganizerEventDetails, moduleId: OrganizerModuleId) => {
    if (editLocked) return;
    setEventForm((current) => ({ ...current, organizerDetails: nextDetails }));
    markDirty(moduleId);
  };

  const updateRaceForm = (next: Partial<RaceFormValues>, moduleId: OrganizerModuleId = "formats") => {
    if (editLocked) return;
    setRaceForm((current) => ({ ...current, ...next }));
    markDirty(moduleId);
  };

  const updateAidStation = (index: number, station: AidStationDraft) => {
    if (editLocked) return;
    setAidStations((current) =>
      sortAidStationsByDistance(current.map((item, stationIndex) => (stationIndex === index ? syncAidStationWithGpxPreview(station, gpxPreview) : item)))
    );
    markDirty("aidStations");
  };

  const handleTabChange = async (nextTab: string) => {
    if (nextTab === activeTab) return;
    if (!(await saveBeforeNavigation())) return;
    if (nextTab === ADD_FORMAT_TAB_ID) {
      setNewRaceForm(activeRace ? createRaceFormFromFormatDefaults(activeRace, raceForm) : createRaceFormFromEventDefaults(eventForm));
    }
    setActiveTab(nextTab);
    setActiveModule((currentModule) => getModuleForTab(nextTab, currentModule));
  };

  const handleRacePublishToggle = async (raceId: string, nextIsLive: boolean) => {
    const targetRace = eventDetail?.races.find((race) => race.id === raceId) ?? null;
    if (getEditionLockState(targetRace?.race_date ?? null).locked) {
      showToast("error", `Edition ${getRaceEditionYearLabel(targetRace?.race_date)} verrouillee. Modifie une edition future.`);
      return;
    }
    if (!(await saveBeforeNavigation())) return;
    if (!accessToken || !selectedEventId || !eventDetail) return;

    if (!targetRace) return;

    if (activeRace?.id === raceId) {
      await saveRace({ isLive: nextIsLive });
      return;
    }

    setStatus("saving");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/races/${raceId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesName: targetRace.series_name,
          name: targetRace.name,
          distanceKm: targetRace.distance_km,
          elevationGainM: targetRace.elevation_gain_m,
          elevationLossM: targetRace.elevation_loss_m,
          locationText: targetRace.location_text ?? "",
          raceDate: targetRace.race_date ?? "",
          thumbnailUrl: targetRace.thumbnail_url ?? "",
          isLive: nextIsLive,
          organizerDetails: targetRace.organizerDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "Impossible d'enregistrer le format.");
        return;
      }

      showToast("success", "Format mis à jour.");
      await loadEvent(selectedEventId, activeTab, selectedEditionYear);
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
        body: JSON.stringify({ message }),
      });
      const data = (await response.json().catch(() => null)) as
        | {
            update?: OrganizerRaceEventUpdate;
            delivery?: { attempted?: number; sent?: number; failed?: number; skipped?: number };
            message?: string;
          }
        | null;

      if (!response.ok) {
        setEventUpdateError(data?.message ?? "Impossible d'envoyer la notification.");
        return;
      }

      const sentCount = data?.delivery?.sent ?? 0;
      showToast("success", sentCount > 0 ? `Notification envoyée à ${sentCount} coureur(s).` : "Mise à jour publiée.");
      setEventUpdateMessage("");
      setEventUpdatesDialogOpen(false);
      await loadEventUpdates(selectedEventId);
    } catch (caught) {
      console.error("Unable to create organizer event update", caught);
      setEventUpdateError("Impossible d'envoyer la notification.");
    } finally {
      setEventUpdateSending(false);
    }
  };

  const openWebsiteImportDialog = () => {
    setWebsiteImportError(null);
    setWebsiteImportPreview(null);
    setWebsiteImportEventDate(eventForm.raceDate);
    setWebsiteImportSelections({});
    setWebsiteImportUrl(eventForm.organizerDetails.officialWebsiteUrl ?? "");
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
        body: JSON.stringify({ action: "preview", url }),
      });
      const data = (await response.json().catch(() => null)) as { preview?: WebsiteImportPreview; message?: string } | null;
      if (!response.ok || !data?.preview) {
        setWebsiteImportPreview(null);
        setWebsiteImportSelections({});
        setWebsiteImportError(data?.message ?? "Impossible d'analyser ce site.");
        return;
      }

      setWebsiteImportPreview(data.preview);
      setWebsiteImportEventDate(data.preview.event.raceDate ?? eventForm.raceDate);
      setWebsiteImportSelections(
        Object.fromEntries(
          data.preview.races.map((race) => [
            race.key,
            {
              mode: race.suggestedTargetRaceId ? "update" : race.canCreate ? "create" : "ignore",
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
  }, [accessToken, authHeaders, eventForm.raceDate, selectedEventId, websiteImportUrl]);

  useEffect(() => {
    if (!requestedImportUrl || !requestedEventId || eventDetail?.id !== requestedEventId || !accessToken) return;
    const bootstrapKey = `${requestedEventId}:${requestedImportUrl}`;
    if (handledWebsiteImport.current === bootstrapKey) return;
    handledWebsiteImport.current = bootstrapKey;
    setWebsiteImportOpen(true);
    setWebsiteImportEventDate(eventForm.raceDate);
    void previewWebsiteImport(requestedImportUrl);
    window.history.replaceState({}, "", "/organizer");
  }, [accessToken, eventDetail?.id, eventForm.raceDate, previewWebsiteImport, requestedEventId, requestedImportUrl]);

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
          previewHash: websiteImportPreview.previewHash,
          eventRaceDate: websiteImportEventDate || undefined,
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
        editionRequestState={currentEditionRequest}
        editionLocked={editLocked}
        editionLockMessage={editLockMessage}
        onSelectedEventChange={(eventId) => {
          void (async () => {
            if (!(await saveBeforeNavigation())) return;
            setSelectedEventId(eventId);
            setActiveTab(EVENT_TAB_ID);
            setActiveModule("event");
          })();
        }}
        onSelectedEditionYearChange={(year) => {
          void (async () => {
            if (year === selectedEditionYear) return;
            if (!(await saveBeforeNavigation())) return;
            setSelectedEditionYear(year);
          })();
        }}
        onEditionDateChange={setNewEditionDate}
        onRequestEdition={() => {
          void requestNewEdition();
        }}
        onImportWebsite={openWebsiteImportDialog}
        completion={completion}
        hasDirtyChanges={hasDirtyChanges}
        status={status}
        onSaveAll={() => {
          void saveAllDirty();
        }}
        onPreview={() => {
          void (async () => {
            if (await saveBeforeNavigation()) setPreviewOpen(true);
          })();
        }}
        onNotifyFollowers={() => {
          setEventUpdateError(null);
          setEventUpdatesDialogOpen(true);
        }}
        onTogglePublish={() => {
          void (async () => {
            if (!(await saveBeforeNavigation())) return;
            await saveEvent({ isLive: !eventForm.isLive });
          })();
        }}
        onToggleRacePublish={(raceId, nextIsLive) => {
          void handleRacePublishToggle(raceId, nextIsLive);
        }}
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
            void (async () => {
              if (moduleId === activeModule) return;
              if (!(await saveBeforeNavigation())) return;
              setActiveModule(moduleId);
            })();
          }}
          activeModule={activeModule}
        />
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{getModuleTitle(activeModule)}</CardTitle>
          <CardDescription>{getModuleDescription(activeModule)}</CardDescription>
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
              editLocked={editLocked}
              editLockMessage={editLockMessage}
            />
          ) : activeModule === "formats" ? (
            <FormatsEditor
              activeTab={activeTab}
              activeRace={activeRace}
              raceForm={raceForm}
              newRaceForm={newRaceForm}
              newRaceImageName={newRaceImageFile?.name ?? null}
              newRaceGpxName={newRaceGpxFile?.name ?? null}
              showRaceDetails={showRaceDetails}
              onToggleRaceDetails={() => setShowRaceDetails((current) => !current)}
              onRaceFormChange={(next) => updateRaceForm(next, "formats")}
              onNewRaceFormChange={setNewRaceForm}
              onCreateRace={createRace}
              onUploadRaceImage={(event) => {
                void uploadRaceImage(event);
              }}
              onSelectNewRaceImage={selectNewRaceImage}
              onSelectNewRaceGpx={selectNewRaceGpx}
              onUploadGpx={uploadGpx}
              onDuplicateRace={() => void duplicateActiveRace()}
              onDeleteRace={() => {
                void deleteActiveRace();
              }}
              onPreviewRace={() => {
                void (async () => {
                  if (await saveBeforeNavigation()) setPreviewOpen(true);
                })();
              }}
              gpxPreview={gpxPreview}
              status={status}
              editLocked={editLocked}
              editLockMessage={editLockMessage}
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
                if (editLocked) return;
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
                if (editLocked) return;
                setAidStations((current) => current.filter((_, stationIndex) => stationIndex !== index));
                markDirty("aidStations");
              }}
              stationProducts={stationProducts}
              productsById={productsById}
              productForm={productForm}
              productStationId={productStationId}
              onOpenProductPicker={(stationId) => {
                if (editLocked) return;
                setProductSearch("");
                setProductPickerStationId(stationId);
              }}
              onRemoveProduct={(stationId, productId) => void removeStationProduct(stationId, productId)}
              onToggleProductForm={(stationId) => {
                if (editLocked) return;
                setProductStationId((current) => (current === stationId ? null : stationId));
              }}
              onProductFormChange={(next) => {
                if (editLocked) return;
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
            <BibPickupEditor eventDetails={eventForm.organizerDetails} onEventChange={(details) => updateEventDetails(details, "bibPickup")} />
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
                if (editLocked) return;
                setProductSearch("");
                setProductPickerStationId(stationId);
              }}
              onRemoveProduct={(stationId, productId) => void removeStationProduct(stationId, productId)}
              onToggleProductForm={(stationId) => {
                if (editLocked) return;
                setProductStationId((current) => (current === stationId ? null : stationId));
              }}
              onProductFormChange={(next) => {
                if (editLocked) return;
                setProductForm(next);
              }}
              onCreateProduct={createStationProduct}
              status={status}
            />
          ) : activeModule === "services" ? (
            <ServicesEditor details={eventForm.organizerDetails} onChange={(details) => updateEventDetails(details, "services")} />
          ) : (
            <PreviewLauncher
              onPreview={() => {
                void (async () => {
                  if (await saveBeforeNavigation()) setPreviewOpen(true);
                })();
              }}
            />
          )}
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
                    <div key={update.id} className="rounded-md border border-border/60 bg-card p-3">
                      <p className="text-sm text-foreground">{update.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatUpdateDate(update.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEventUpdatesDialogOpen(false)} disabled={eventUpdateSending}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void submitEventUpdate()} disabled={eventUpdateSending || !selectedEventId}>
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
                URL du site
              </label>
              <input
                id="organizer-website-import-url"
                type="url"
                className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={websiteImportUrl}
                placeholder="https://..."
                onChange={(event) => setWebsiteImportUrl(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">UTMB et Trace de Trail sont optimises. Les autres sites passent par une extraction heuristique.</p>
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
                          Date de l&apos;événement
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
                      <p>{websiteImportPreview.races.length} format(s) detecte(s)</p>
                    </div>
                  </div>
                  {websiteImportPreview.warnings.length > 0 ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                      {websiteImportPreview.warnings.join(" ")}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Formats detectes</p>
                  {websiteImportPreview.races.map((race) => {
                    const selection = websiteImportSelections[race.key] ?? { mode: "ignore", targetRaceId: null };
                    return (
                      <div key={race.key} className="space-y-3 rounded-md border border-border/60 bg-card p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-foreground">{race.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {[race.raceDate, race.locationText, race.distanceKm ? `${race.distanceKm} km` : null, race.elevationGainM !== null ? `D+ ${race.elevationGainM} m` : null]
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
                              {race.hasReliableGpx ? <p>GPX fiable détecté</p> : null}
                              {race.detectedAidStationCount > 0 ? <p>{race.detectedAidStationCount} ravito(s)</p> : null}
                            </div>
                          </div>
                        </div>
                        {race.assessment ? (
                          <details className="group rounded-md border border-border/60 bg-background/60">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium text-foreground marker:content-none">
                              <span>Voir les informations trouvées</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {race.assessment.foundCount}/{race.assessment.totalCount} champs
                              </span>
                            </summary>
                            <div className="space-y-3 border-t border-border/60 p-3">
                              <div className="grid gap-2 sm:grid-cols-3">
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">Score global</p>
                                  <p className="font-semibold text-foreground">{race.assessment.score}/100</p>
                                </div>
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">Informations trouvées</p>
                                  <p className="font-semibold text-foreground">{race.assessment.coverageScore}%</p>
                                </div>
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">Fiabilité des sources</p>
                                  <p className="font-semibold text-foreground">{race.assessment.reliabilityScore}%</p>
                                </div>
                              </div>
                              <div className="grid gap-2 md:grid-cols-2">
                                {race.assessment.findings.map((finding) => (
                                  <div key={finding.key} className="rounded-md border border-border/60 bg-card p-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        {finding.label}
                                        {finding.required ? " · requis" : ""}
                                      </p>
                                      {finding.confidence ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${websiteImportConfidenceTone[finding.confidence]}`}>
                                          {websiteImportConfidenceLabel[finding.confidence]}
                                        </span>
                                      ) : (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Manquant</span>
                                      )}
                                    </div>
                                    <p className={`mt-2 break-words text-sm ${finding.value ? "text-foreground" : "italic text-muted-foreground"}`}>
                                      {finding.value ?? "Aucune information trouvée"}
                                    </p>
                                    {finding.sourceUrl && finding.sourceLabel ? (
                                      <a
                                        className="mt-2 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                                        href={finding.sourceUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        Source : {finding.sourceLabel}
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Le score combine la couverture des champs (65 %) et la fiabilité estimée des sources (35 %). Une vérification humaine reste recommandée.
                              </p>
                            </div>
                          </details>
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
                        {race.missingFields.length > 0 ? (
                          <p className="text-xs font-medium text-amber-700">Champs manquants: {race.missingFields.join(", ")}</p>
                        ) : null}
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

      <RunnerPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        event={eventDraft}
        activeRaceId={activeRace?.id ?? null}
        aidStations={aidStations}
        stationProducts={stationProducts}
        productsById={productsById}
      />
    </div>
  );
}

