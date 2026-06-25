"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { fuelTypeValues, type FuelType } from "../../../lib/fuel-types";
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
import { AccessEditor, BibPickupEditor, EquipmentEditor, PreviewLauncher, ScheduleEditor, ServicesEditor } from "./dashboard/detail-editors";
import { EventInfoEditor, FormatsEditor } from "./dashboard/event-format-editors";
import {
  cloneJson,
  createEmptyEventForm,
  createEmptyRaceForm,
  createRaceFormFromEventDefaults,
  createRaceFormFromFormatDefaults,
  aidStationRowsToDrafts,
  buildEventDraft,
  buildProductsById,
  eventToForm,
  formatDate,
  getModuleDescription,
  getModuleForTab,
  getModuleTitle,
  normalizeGpxPreview,
  normalizeOrganizerEventDetail,
  raceToForm,
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

  const accessToken = session?.accessToken ?? null;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const activeRace = eventDetail?.races.find((race) => race.id === activeTab) ?? null;
  const activeRaceForCompletion = activeRace ? { ...activeRace, organizerDetails: raceForm.organizerDetails } : null;
  const productPickerStation = productPickerStationId
    ? aidStations.find((station) => station.id === productPickerStationId) ?? null
    : null;
  const hasDirtyChanges = dirtyModules.size > 0;

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ id: Date.now(), type, message });
  };

  const eventDraft = buildEventDraft(eventDetail, eventForm, activeRace, raceForm);

  const productsById = useMemo(() => buildProductsById(catalogProducts, stationProducts), [catalogProducts, stationProducts]);

  const authHeaders = useMemo(
    (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    [accessToken]
  );

  const serializeEquipment = (equipment: OrganizerEventDetails["mandatoryEquipment"]) =>
    JSON.stringify({
      items: equipment.items.map((item) => ({
        label: item.label,
        required: item.required,
      })),
    });

  const syncEventCommonEquipment = (details: OrganizerEventDetails, races: RaceFormat[]) => ({
    ...details,
    mandatoryEquipment: deriveCommonEquipmentFromRaces(
      races.map((race) => race.organizerDetails),
      details.mandatoryEquipment
    ),
  });

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

  const loadOrganizerData = async () => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/organizer/claims", {
        headers: authHeaders,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as {
        claims?: ClaimRow[];
        memberships?: MembershipRow[];
        message?: string;
      } | null;
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

  const loadEvent = async (eventId: string, preferredTab = activeTab) => {
    if (!accessToken) return;
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch(`/api/organizer/events/${eventId}`, {
        headers: authHeaders,
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as { event?: OrganizerEventDetail; message?: string } | null;
      if (!response.ok || !data?.event) {
        setError(data?.message ?? "Impossible de charger l'evenement.");
        return;
      }
      const nextEvent = normalizeOrganizerEventDetail(data.event);
      setEventDetail(nextEvent);
      const nextEventForm = eventToForm(nextEvent);
      setEventForm(nextEventForm);
      setNewRaceForm(createRaceFormFromEventDefaults(nextEventForm));
      const preferredTabExists =
        preferredTab === EVENT_TAB_ID ||
        preferredTab === ADD_FORMAT_TAB_ID ||
        nextEvent.races.some((race) => race.id === preferredTab);
      setActiveTab(preferredTabExists ? preferredTab : EVENT_TAB_ID);
      setDirtyModules(new Set());
    } catch (caught) {
      console.error("Unable to load organizer event", caught);
      setError("Impossible de charger l'evenement.");
    } finally {
      setStatus("idle");
    }
  };

  useEffect(() => {
    if (selectedEventId) void loadEvent(selectedEventId);
  }, [selectedEventId, accessToken]);

  const loadRaceSidecar = async (raceId: string) => {
    if (!accessToken) return;
    const [aidResponse, productsResponse, catalogResponse] = await Promise.all([
      fetch(`/api/organizer/races/${raceId}/aid-stations`, { headers: authHeaders, cache: "no-store" }),
      fetch(`/api/organizer/races/${raceId}/aid-station-products`, { headers: authHeaders, cache: "no-store" }),
      fetch("/api/products", { headers: authHeaders, cache: "no-store" }),
    ]);

    if (aidResponse.ok) {
      const data = (await aidResponse.json()) as {
        aidStations?: OrganizerAidStationRow[];
      };
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
      const response = await fetch(`/api/organizer/races/${raceId}/gpx`, {
        headers: authHeaders,
        cache: "no-store",
      });
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
    const equipmentChanged =
      serializeEquipment(previousCommonEquipment) !== serializeEquipment(nextForm.organizerDetails.mandatoryEquipment);
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
        showToast("error", data?.message ?? "Impossible d'enregistrer l'evenement.");
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
          showToast("error", failedRaceUpdate.message ?? "Impossible de reporter le materiel sur toutes les courses.");
          return false;
        }
      }
      showToast("success", "Evenement mis a jour.");
      clearDirty(["event", "equipment", "bibPickup", "access", "services"]);
      await loadEvent(selectedEventId);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const saveRace = async (override?: Partial<RaceFormValues>) => {
    if (!accessToken || !activeRace || !selectedEventId) return false;
    const nextForm = { ...raceForm, ...override };
    const nextRaces = (eventDetail?.races ?? []).map((race) =>
      race.id === activeRace.id
        ? {
            ...race,
            organizerDetails: nextForm.organizerDetails,
          }
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
          showToast("error", eventData?.message ?? "Impossible de mettre a jour le materiel partage.");
          return false;
        }
        setEventForm((current) => ({ ...current, organizerDetails: syncedEventDetails }));
      }
      showToast("success", "Format mis a jour.");
      clearDirty(["formats", "schedule"]);
      await loadEvent(selectedEventId, activeRace.id);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const createRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;
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
          organizerDetails: newRaceForm.organizerDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok || !data?.race) {
        showToast("error", data?.message ?? "Impossible d'ajouter le format.");
        return;
      }
      setNewRaceForm(createEmptyRaceForm());
      setActiveTab(data.race.id);
      setActiveModule("formats");
      showToast("success", "Format ajoute.");
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
          organizerDetails: activeRace.organizerDetails ?? defaultOrganizerRaceDetails,
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok || !data?.race) {
        showToast("error", data?.message ?? "Impossible de dupliquer le format.");
        return;
      }
      setActiveTab(data.race.id);
      setActiveModule("formats");
      showToast("success", "Format duplique en brouillon, sans GPX ni ravitos.");
      await loadEvent(selectedEventId, data.race.id);
    } finally {
      setStatus("idle");
    }
  };

  const uploadGpx = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !accessToken || !activeRace || !selectedEventId) return;
    setStatus("uploading");
    setError(null);
    try {
      const formData = new FormData();
      formData.append("gpx", file);
      const response = await fetch(`/api/organizer/races/${activeRace.id}/gpx`, {
        method: "PUT",
        headers: authHeaders,
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as (GpxPreview & { message?: string; appliedAidStationCount?: number }) | null;
      if (!response.ok) {
        showToast("error", data?.message ?? "GPX invalide ou impossible a importer.");
        return;
      }
      setGpxPreview(normalizeGpxPreview(data));
      const detectedCount = data?.detectedAidStations?.length ?? 0;
      const appliedCount = data?.appliedAidStationCount ?? 0;
      showToast(
        "success",
        appliedCount > 0
          ? `GPX importe. ${appliedCount} ravito${appliedCount > 1 ? "s" : ""} cree${appliedCount > 1 ? "s" : ""}.`
          : detectedCount > 0
            ? "GPX importe. Waypoints detectes, ravitos existants preserves."
            : "GPX importe. Les plans existants restent des snapshots."
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
      const response = await fetch(`/api/organizer/events/${selectedEventId}/image`, {
        method: "PUT",
        headers: authHeaders,
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { thumbnailUrl?: string; message?: string } | null;
      if (!response.ok || !data?.thumbnailUrl) {
        showToast("error", data?.message ?? "Impossible d'envoyer l'image.");
        return;
      }
      setEventForm((current) => ({ ...current, thumbnailUrl: data.thumbnailUrl ?? current.thumbnailUrl }));
      showToast("success", "Image evenement mise a jour.");
      await loadEvent(selectedEventId, activeTab);
    } finally {
      setStatus("idle");
      event.target.value = "";
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
      showToast("success", "Ravitos mis a jour.");
      clearDirty(["aidStations"]);
      await loadRaceSidecar(activeRace.id);
      return true;
    } finally {
      setStatus("idle");
    }
  };

  const replaceStationProducts = async (
    aidStationId: string,
    products: Array<{ productId: string; notes?: string | null }>
  ) => {
    if (!accessToken || !activeRace) return false;
    const response = await fetch(`/api/organizer/races/${activeRace.id}/aid-station-products`, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ aidStationId, products }),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      showToast("error", data?.message ?? "Impossible de mettre a jour les produits.");
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
    const current = stationProducts
      .filter((link) => link.aidStationId === aidStationId)
      .map((link) => ({ productId: link.productId, notes: link.notes ?? undefined }));
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
        showToast("error", data?.message ?? "Impossible de creer le produit.");
        return;
      }
      setProductForm(emptyProductForm);
      showToast("success", "Produit cree pour ce ravito.");
      await loadRaceSidecar(activeRace.id);
    } finally {
      setStatus("idle");
    }
  };

  const saveAllDirty = async () => {
    if (!hasDirtyChanges) return;
    const eventDirty = ["event", "equipment", "bibPickup", "access", "services"].some((moduleId) =>
      dirtyModules.has(moduleId as OrganizerModuleId)
    );
    const raceDirty = ["formats", "schedule"].some((moduleId) => dirtyModules.has(moduleId as OrganizerModuleId));
    if (eventDirty) {
      const ok = await saveEvent();
      if (!ok) return;
    }
    if (raceDirty && activeRace) {
      const ok = await saveRace();
      if (!ok) return;
    }
    if (dirtyModules.has("aidStations")) {
      await saveAidStations();
    }
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
    setAidStations((current) => current.map((item, stationIndex) => (stationIndex === index ? station : item)));
    markDirty("aidStations");
  };

  const handleTabChange = (nextTab: string) => {
    if (nextTab === activeTab) return;
    const raceDirtyModules: OrganizerModuleId[] = ["formats", "schedule", "aidStations"];
    const hasRaceDirtyChanges = raceDirtyModules.some((moduleId) => dirtyModules.has(moduleId));
    const isLeavingRaceTab = activeTab !== EVENT_TAB_ID;
    if (isLeavingRaceTab && hasRaceDirtyChanges) {
      const confirmed = window.confirm("Des modifications de format ne sont pas enregistrees. Changer de format les ignorera.");
      if (!confirmed) return;
      clearDirty(raceDirtyModules);
    }
    if (nextTab === ADD_FORMAT_TAB_ID) {
      setNewRaceForm(activeRace ? createRaceFormFromFormatDefaults(activeRace, raceForm) : createRaceFormFromEventDefaults(eventForm));
    }
    setActiveTab(nextTab);
    setActiveModule((currentModule) => getModuleForTab(nextTab, currentModule));
  };

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Verification de session...</div>;
  }

  if (!session) {
    return <OrganizerSignedOutCard />;
  }

  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const rejectedClaims = claims.filter((claim) => claim.status === "rejected");

  if (memberships.length === 0) {
    return <OrganizerNoMembershipCard pendingClaims={pendingClaims} rejectedClaims={rejectedClaims} />;
  }

  const tabs = [
    { id: EVENT_TAB_ID, label: "Evenement" },
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
        aidStationCount={aidStations.length}
        memberships={memberships}
        selectedEventId={selectedEventId}
        onSelectedEventChange={(eventId) => {
          if (hasDirtyChanges) {
            const confirmed = window.confirm("Des modifications ne sont pas enregistrees. Changer d'evenement les ignorera.");
            if (!confirmed) return;
          }
          setSelectedEventId(eventId);
          setActiveTab(EVENT_TAB_ID);
          setActiveModule("event");
        }}
        completion={completion}
        hasDirtyChanges={hasDirtyChanges}
        status={status}
        onSaveAll={saveAllDirty}
        onPreview={() => setPreviewOpen(true)}
        onTogglePublish={() => {
          void saveEvent({ isLive: !eventForm.isLive });
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
          onSelectModule={setActiveModule}
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
            <p className="text-sm text-muted-foreground">Chargement de l'evenement...</p>
          ) : activeModule === "event" ? (
            <EventInfoEditor
              eventForm={eventForm}
              onChange={updateEventForm}
              onSave={() => void saveEvent()}
              onUploadImage={uploadEventImage}
              status={status}
            />
          ) : activeModule === "formats" ? (
            <FormatsEditor
              activeTab={activeTab}
              activeRace={activeRace}
              raceForm={raceForm}
              newRaceForm={newRaceForm}
              showRaceDetails={showRaceDetails}
              onToggleRaceDetails={() => setShowRaceDetails((current) => !current)}
              onRaceFormChange={(next) => updateRaceForm(next, "formats")}
              onNewRaceFormChange={setNewRaceForm}
              onCreateRace={createRace}
              onSaveRace={() => void saveRace()}
              onUploadGpx={uploadGpx}
              onDuplicateRace={() => void duplicateActiveRace()}
              onPreviewRace={() => setPreviewOpen(true)}
              gpxPreview={gpxPreview}
              status={status}
            />
          ) : activeModule === "aidStations" ? (
            <AidStationsEditor
              activeRace={activeRace}
              aidStations={aidStations}
              expandedStationKey={expandedStationKey}
              onExpandedStationKeyChange={setExpandedStationKey}
              onAddStation={() => {
                const nextKey = `new-${aidStations.length}`;
                setAidStations((current) => [
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
                ]);
                setExpandedStationKey(nextKey);
                markDirty("aidStations");
              }}
              onSave={() => void saveAidStations()}
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
              onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "formats")}
              onSaveEvent={() => void saveEvent()}
              onSaveRace={() => void saveRace()}
              status={status}
            />
          ) : activeModule === "schedule" ? (
            <ScheduleEditor
              activeRace={activeRace}
              raceForm={raceForm}
              aidStations={aidStations}
              onChange={(next) => updateRaceForm(next, "schedule")}
              onSave={() => void saveRace()}
              status={status}
            />
          ) : activeModule === "bibPickup" ? (
            <BibPickupEditor
              scope={isEventTab ? "event" : "format"}
              activeRace={activeRace}
              eventDetails={eventForm.organizerDetails}
              raceDetails={raceForm.organizerDetails}
              onEventChange={(details) => updateEventDetails(details, "bibPickup")}
              onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "formats")}
              onSaveEvent={() => void saveEvent()}
              onSaveRace={() => void saveRace()}
              status={status}
            />
          ) : activeModule === "access" ? (
            <AccessEditor
              scope={isEventTab ? "event" : "format"}
              activeRace={activeRace}
              eventDetails={eventForm.organizerDetails}
              raceDetails={raceForm.organizerDetails}
              onEventChange={(details) => updateEventDetails(details, "access")}
              onRaceChange={(details) => updateRaceForm({ organizerDetails: details }, "formats")}
              onSaveEvent={() => void saveEvent()}
              onSaveRace={() => void saveRace()}
              status={status}
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
            <ServicesEditor
              details={eventForm.organizerDetails}
              onChange={(details) => updateEventDetails(details, "services")}
              onSave={() => void saveEvent()}
              status={status}
            />
          ) : (
            <PreviewLauncher onPreview={() => setPreviewOpen(true)} />
          )}
        </CardContent>
      </Card>

      <ProductPickerModal
        station={productPickerStation}
        products={catalogProducts}
        linkedProductIds={
          productPickerStationId
            ? new Set(
                stationProducts
                  .filter((link) => link.aidStationId === productPickerStationId)
                  .map((link) => link.productId)
              )
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
