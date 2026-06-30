"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { GpxParseError, parseGpx } from "../../../lib/gpx/parseGpx";
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
  getModuleDescription,
  getModuleForTab,
  getModuleTitle,
  normalizeGpxPreview,
  normalizeOrganizerEventDetail,
  raceToForm,
  sortAidStationsByDistance,
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
  EventFormValues,
  GpxPreview,
  MembershipRow,
  OrganizerEventDetail,
  ProductFormValues,
  RaceFormat,
  RaceFormValues,
  StationProduct,
} from "./dashboard/types";

const MAX_RACE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const RACE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"] as const;
const MAX_UPDATE_MESSAGE_LENGTH = 280;

type OrganizerRaceEventUpdate = {
  id: string;
  event_id: string;
  message: string;
  created_at: string;
  created_by?: string | null;
};

export function OrganizerDashboard() {
  const { session, isLoading } = useVerifiedSession();
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [eventForm, setEventForm] = useState<EventFormValues>(() => createEmptyEventForm());
  const [activeTab, setActiveTab] = useState(EVENT_TAB_ID);
  const [activeModule, setActiveModule] = useState<OrganizerModuleId>("event");
  const [raceForm, setRaceForm] = useState<RaceFormValues>(() => createEmptyRaceForm());
  const [newRaceForm, setNewRaceForm] = useState<RaceFormValues>(() => createEmptyRaceForm());
  const [newRaceImageFile, setNewRaceImageFile] = useState<File | null>(null);
  const [newRaceGpxFile, setNewRaceGpxFile] = useState<File | null>(null);
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

  const accessToken = session?.accessToken ?? null;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const activeRace = eventDetail?.races.find((race) => race.id === activeTab) ?? null;
  const activeRaceForCompletion = activeRace ? { ...activeRace, organizerDetails: raceForm.organizerDetails } : null;
  const productPickerStation = productPickerStationId ? aidStations.find((station) => station.id === productPickerStationId) ?? null : null;
  const hasDirtyChanges = dirtyModules.size > 0;

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

  const loadOrganizerData = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/organizer/claims", { headers: authHeaders, cache: "no-store" });
      const data = (await response.json().catch(() => null)) as { claims?: ClaimRow[]; memberships?: MembershipRow[]; message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible de charger le compte organisateur.");
        return;
      }
      const nextMemberships = data?.memberships ?? [];
      setClaims(data?.claims ?? []);
      setMemberships(nextMemberships);
      setSelectedEventId((current) => current ?? nextMemberships[0]?.event_id ?? null);
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

  const loadEvent = async (eventId: string, preferredTab = activeTab) => {
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
      const preferredTabExists =
        preferredTab === EVENT_TAB_ID ||
        preferredTab === ADD_FORMAT_TAB_ID ||
        nextEvent.races.some((race) => race.id === preferredTab);
      setActiveTab(preferredTabExists ? preferredTab : EVENT_TAB_ID);
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

  const loadRaceSidecar = async (raceId: string) => {
    if (!accessToken) return;
    const [aidResponse, productsResponse, catalogResponse] = await Promise.all([
      fetch(`/api/organizer/races/${raceId}/aid-stations`, { headers: authHeaders, cache: "no-store" }),
      fetch(`/api/organizer/races/${raceId}/aid-station-products`, { headers: authHeaders, cache: "no-store" }),
      fetch("/api/products", { headers: authHeaders, cache: "no-store" }),
    ]);

    if (aidResponse.ok) {
      const data = (await aidResponse.json()) as { aidStations?: OrganizerAidStationRow[] };
      setAidStations(aidStationRowsToDrafts(data.aidStations ?? []));
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
      return;
    }
    setRaceForm(raceToForm(activeRace));
    setExpandedStationKey(null);
    void loadRaceSidecar(activeRace.id);
    if (activeRace.gpx_storage_path) {
      void loadRaceGpxPreview(activeRace.id);
    } else {
      setGpxPreview(null);
    }
  }, [activeRace?.id]);

  const saveEvent = async (override?: Partial<EventFormValues>) => {
    if (!accessToken || !selectedEventId) return false;
    const nextForm = { ...eventForm, ...override };
    const previousCommonEquipment = eventDetail?.organizerDetails?.mandatoryEquipment ?? eventForm.organizerDetails.mandatoryEquipment;
    const equipmentChanged = serializeEquipment(previousCommonEquipment) !== serializeEquipment(nextForm.organizerDetails.mandatoryEquipment);
    const raceEquipmentUpdates = equipmentChanged
      ? (eventDetail?.races ?? []).map((race) => {
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
    const nextForm = {
      ...raceForm,
      ...override,
      organizerDetails: sanitizeRaceDetailsForSave(override?.organizerDetails ?? raceForm.organizerDetails),
    };
    const nextRaces = (eventDetail?.races ?? []).map((race) => (race.id === activeRace.id ? { ...race, organizerDetails: nextForm.organizerDetails } : race));
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
          body: JSON.stringify({ organizerDetails: syncedEventDetails }),
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
      await loadEvent(selectedEventId, activeRace.id);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const createRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;
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
      setActiveTab(data.race.id);
      setActiveModule("formats");
      showToast("success", imageUploaded ? "Format ajouté." : "Format ajouté. Réessaie l'image si besoin.");
      await loadEvent(selectedEventId, data.race.id);
    } finally {
      setStatus("idle");
    }
  };

  const duplicateActiveRace = async () => {
    if (!accessToken || !selectedEventId || !activeRace) return;
    setStatus("saving");
    setError(null);
    try {
      const response = await fetch("/api/organizer/races", {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
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
      setActiveTab(data.race.id);
      setActiveModule("formats");
      showToast("success", "Format dupliqué en brouillon, sans GPX ni ravitos.");
      await loadEvent(selectedEventId, data.race.id);
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
      await loadEvent(selectedEventId, activeRace.id);
      await loadRaceSidecar(activeRace.id);
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
      const response = await fetch(`/api/organizer/events/${selectedEventId}/image`, { method: "PUT", headers: authHeaders, body: formData });
      const data = (await response.json().catch(() => null)) as { thumbnailUrl?: string; message?: string } | null;
      if (!response.ok || !data?.thumbnailUrl) {
        showToast("error", data?.message ?? "Impossible d'envoyer l'image.");
        return;
      }
      setEventForm((current) => ({ ...current, thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl }));
      showToast("success", "Image événement mise à jour.");
      await loadEvent(selectedEventId, activeTab);
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
      await loadEvent(selectedEventId, activeRace.id);
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
        elevationProfile: parsed.points.map((point) => ({
          distanceKm: point.distKmCum,
          elevationM: point.ele ?? 0,
          lat: point.lat,
          lon: point.lng,
        })),
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

  const saveAidStations = async () => {
    if (!accessToken || !activeRace) return false;
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
    setAidStations((current) => sortAidStationsByDistance(current.map((item, stationIndex) => (stationIndex === index ? station : item))));
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
    if (!(await saveBeforeNavigation())) return;
    if (!accessToken || !selectedEventId || !eventDetail) return;

    const targetRace = eventDetail.races.find((race) => race.id === raceId);
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
      await loadEvent(selectedEventId, activeTab);
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

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Vérification de session...</div>;
  if (!session) return <OrganizerSignedOutCard />;

  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const rejectedClaims = claims.filter((claim) => claim.status === "rejected");
  if (memberships.length === 0) return <OrganizerNoMembershipCard pendingClaims={pendingClaims} rejectedClaims={rejectedClaims} />;

  const tabs = [
    { id: EVENT_TAB_ID, label: "Événement" },
    ...(eventDetail?.races ?? []).map((race) => ({ id: race.id, label: race.name })),
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
        onSelectedEventChange={(eventId) => {
          void (async () => {
            if (!(await saveBeforeNavigation())) return;
            setSelectedEventId(eventId);
            setActiveTab(EVENT_TAB_ID);
            setActiveModule("event");
          })();
        }}
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
            <EventInfoEditor eventForm={eventForm} onChange={updateEventForm} onUploadImage={uploadEventImage} status={status} />
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
                      organizerDetails: cloneJson(defaultOrganizerAidStationDetails),
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
              onToggleProductForm={(stationId) => setProductStationId((current) => (current === stationId ? null : stationId))}
              onProductFormChange={setProductForm}
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
                setProductSearch("");
                setProductPickerStationId(stationId);
              }}
              onRemoveProduct={(stationId, productId) => void removeStationProduct(stationId, productId)}
              onToggleProductForm={(stationId) => setProductStationId((current) => (current === stationId ? null : stationId))}
              onProductFormChange={setProductForm}
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
