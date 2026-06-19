"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { TabsList } from "../../../components/ui/tabs";
import { cn } from "../../../components/utils";
import { fuelTypeValues, type FuelType } from "../../../lib/fuel-types";
import {
  defaultOrganizerAidStationDetails,
  defaultOrganizerEventDetails,
  defaultOrganizerRaceDetails,
  buildRunnerOrganizerDetails,
  parseOrganizerAidStationDetails,
  parseOrganizerEventDetails,
  parseOrganizerRaceDetails,
  type AidStationType,
  type OrganizerAidStationDetails,
  type OrganizerEventDetails,
  type OrganizerRaceDetails,
} from "../../../lib/organizer-dashboard-details";
import type { FuelProduct } from "../../../lib/product-types";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import {
  buildOrganizerCompletion,
  type OrganizerCompletionSummary,
  type OrganizerModuleId,
  type OrganizerModuleLevel,
  type OrganizerModuleStatus,
} from "./completion";

type MembershipRow = {
  id: string;
  event_id: string;
  role: string;
  race_events?: {
    id: string;
    name: string;
    location?: string | null;
    race_date?: string | null;
    thumbnail_url?: string | null;
    is_live?: boolean | null;
  } | null;
};

type ClaimRow = {
  id: string;
  event_id: string;
  organization_name: string;
  status: "pending" | "approved" | "rejected";
  reviewer_notes?: string | null;
  race_events?: {
    id: string;
    name: string;
    location?: string | null;
    race_date?: string | null;
  } | null;
};

type RaceFormat = {
  id: string;
  name: string;
  slug?: string | null;
  location_text?: string | null;
  race_date?: string | null;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  gpx_storage_path?: string | null;
  thumbnail_url?: string | null;
  is_live: boolean;
  organizerDetails?: OrganizerRaceDetails;
};

type OrganizerEventDetail = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  thumbnail_url?: string | null;
  is_live?: boolean | null;
  organizerDetails?: OrganizerEventDetails;
  races: RaceFormat[];
};

type AidStationDraft = {
  id?: string;
  name: string;
  distanceKm: number;
  waterRefill: boolean;
  solidRefill: boolean;
  assistanceAllowed: boolean;
  notes?: string | null;
  organizerDetails: OrganizerAidStationDetails;
};

type StationProduct = {
  id: string;
  aidStationId: string;
  productId: string;
  notes?: string | null;
  orderIndex: number;
  product?: FuelProduct | null;
};

type RaceFormValues = {
  name: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM: string;
  locationText: string;
  raceDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  organizerDetails: OrganizerRaceDetails;
};

type EventFormValues = {
  name: string;
  location: string;
  raceDate: string;
  thumbnailUrl: string;
  isLive: boolean;
  organizerDetails: OrganizerEventDetails;
};

type ProductFormValues = {
  name: string;
  brand: string;
  sku: string;
  fuelType: FuelType;
  productUrl: string;
  caloriesKcal: number;
  carbsGrams: number;
  sodiumMg: number;
  proteinGrams: number;
  fatGrams: number;
  notes: string;
};

const equipmentSuggestions = [
  "Couverture de survie",
  "Telephone charge",
  "Reserve d'eau",
  "Reserve alimentaire",
  "Veste impermeable",
  "Gobelet personnel",
  "Lampe frontale",
  "Sifflet",
  "Piece d'identite",
];

const aidStationTypeLabels: Record<AidStationType, string> = {
  water: "Eau",
  solid: "Solide",
  assistance: "Assistance",
  life_base: "Base vie",
  other: "Autre",
};

const fuelTypeLabels: Record<FuelType, string> = {
  gel: "Gel",
  drink_mix: "Boisson",
  electrolyte: "Electrolytes",
  capsule: "Capsule",
  bar: "Barre",
  real_food: "Aliment",
  other: "Autre",
};

const productPickerQuickFilters: Array<{
  id: "all" | "gel" | "bar" | "liquid" | "capsule" | "real_food" | "other";
  label: string;
  fuelTypes?: FuelType[];
}> = [
  { id: "all", label: "Tous" },
  { id: "gel", label: "Gels", fuelTypes: ["gel"] },
  { id: "bar", label: "Barres", fuelTypes: ["bar"] },
  { id: "liquid", label: "Liquides", fuelTypes: ["drink_mix", "electrolyte"] },
  { id: "capsule", label: "Capsules", fuelTypes: ["capsule"] },
  { id: "real_food", label: "Aliments", fuelTypes: ["real_food"] },
  { id: "other", label: "Autres", fuelTypes: ["other"] },
];

const emptyProductForm: ProductFormValues = {
  name: "",
  brand: "",
  sku: "",
  fuelType: "other",
  productUrl: "",
  caloriesKcal: 0,
  carbsGrams: 0,
  sodiumMg: 0,
  proteinGrams: 0,
  fatGrams: 0,
  notes: "",
};

const EVENT_TAB_ID = "__event";
const ADD_FORMAT_TAB_ID = "__add";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const createEmptyEventForm = (): EventFormValues => ({
  name: "",
  location: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
  organizerDetails: cloneJson(defaultOrganizerEventDetails),
});

const createEmptyRaceForm = (): RaceFormValues => ({
  name: "",
  distanceKm: 0,
  elevationGainM: 0,
  elevationLossM: "",
  locationText: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
  organizerDetails: cloneJson(defaultOrganizerRaceDetails),
});

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatKm = (value: number) => `${Number(value || 0).toFixed(1)} km`;
const formatProductAmount = (value: number | undefined, unit: string) => `${Number(value ?? 0)} ${unit}`;

const getProductBrandLabel = (product: FuelProduct) => {
  const brand = product.brand?.trim();
  return brand && brand.length > 0 ? brand : "Sans marque";
};

const groupProductsByBrand = (products: FuelProduct[]) => {
  const groups = products.reduce((map, product) => {
    const brand = getProductBrandLabel(product);
    const items = map.get(brand) ?? [];
    items.push(product);
    map.set(brand, items);
    return map;
  }, new Map<string, FuelProduct[]>());

  return Array.from(groups.entries())
    .map(([brand, items]) => ({
      brand,
      items: items.sort((left, right) => left.name.localeCompare(right.name, "fr", { sensitivity: "base" })),
    }))
    .sort((left, right) => {
      if (left.brand === "Sans marque") return 1;
      if (right.brand === "Sans marque") return -1;
      return left.brand.localeCompare(right.brand, "fr", { sensitivity: "base" });
    });
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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.accessToken ?? null;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const activeRace = eventDetail?.races.find((race) => race.id === activeTab) ?? null;
  const activeRaceForCompletion = activeRace ? { ...activeRace, organizerDetails: raceForm.organizerDetails } : null;
  const productPickerStation = productPickerStationId
    ? aidStations.find((station) => station.id === productPickerStationId) ?? null
    : null;
  const hasDirtyChanges = dirtyModules.size > 0;

  const eventDraft: OrganizerEventDetail | null = eventDetail
    ? {
        ...eventDetail,
        name: eventForm.name,
        location: eventForm.location,
        race_date: eventForm.raceDate,
        thumbnail_url: eventForm.thumbnailUrl,
        is_live: eventForm.isLive,
        organizerDetails: eventForm.organizerDetails,
        races: eventDetail.races.map((race) =>
          race.id === activeRace?.id
            ? {
                ...race,
                name: raceForm.name,
                distance_km: raceForm.distanceKm,
                elevation_gain_m: raceForm.elevationGainM,
                elevation_loss_m: toNumberOrNull(raceForm.elevationLossM),
                location_text: raceForm.locationText,
                race_date: raceForm.raceDate,
                thumbnail_url: raceForm.thumbnailUrl,
                is_live: raceForm.isLive,
                organizerDetails: raceForm.organizerDetails,
              }
            : race
        ),
      }
    : null;

  const productsById = useMemo(() => {
    const map = new Map<string, FuelProduct>();
    catalogProducts.forEach((product) => map.set(product.id, product));
    stationProducts.forEach((link) => {
      if (link.product) map.set(link.product.id, link.product);
    });
    return map;
  }, [catalogProducts, stationProducts]);

  const authHeaders = useMemo(
    (): Record<string, string> => (accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    [accessToken]
  );

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
      const sortedRaces = [...data.event.races].sort((left, right) => left.distance_km - right.distance_km);
      const nextEvent = {
        ...data.event,
        organizerDetails: parseOrganizerEventDetails(data.event.organizerDetails),
        races: sortedRaces.map((race) => ({
          ...race,
          organizerDetails: parseOrganizerRaceDetails(race.organizerDetails),
        })),
      };
      setEventDetail(nextEvent);
      setEventForm({
        name: nextEvent.name,
        location: nextEvent.location ?? "",
        raceDate: formatDate(nextEvent.race_date),
        thumbnailUrl: nextEvent.thumbnail_url ?? "",
        isLive: nextEvent.is_live !== false,
        organizerDetails: cloneJson(nextEvent.organizerDetails ?? defaultOrganizerEventDetails),
      });
      const preferredTabExists =
        preferredTab === EVENT_TAB_ID ||
        preferredTab === ADD_FORMAT_TAB_ID ||
        sortedRaces.some((race) => race.id === preferredTab);
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
        aidStations?: Array<{
          id: string;
          name: string;
          km: number;
          water_available: boolean;
          solid_available?: boolean | null;
          assistance_allowed?: boolean | null;
          notes?: string | null;
          organizerDetails?: OrganizerAidStationDetails;
        }>;
      };
      setAidStations(
        (data.aidStations ?? []).map((station) => ({
          id: station.id,
          name: station.name,
          distanceKm: station.km,
          waterRefill: station.water_available !== false,
          solidRefill: station.solid_available !== false,
          assistanceAllowed: station.assistance_allowed !== false,
          notes: station.notes ?? "",
          organizerDetails: parseOrganizerAidStationDetails(station.organizerDetails),
        }))
      );
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

  useEffect(() => {
    if (!activeRace) {
      setRaceForm(createEmptyRaceForm());
      setAidStations([]);
      setStationProducts([]);
      return;
    }
    setRaceForm({
      name: activeRace.name,
      distanceKm: activeRace.distance_km,
      elevationGainM: activeRace.elevation_gain_m,
      elevationLossM: activeRace.elevation_loss_m?.toString() ?? "",
      locationText: activeRace.location_text ?? "",
      raceDate: formatDate(activeRace.race_date),
      thumbnailUrl: activeRace.thumbnail_url ?? "",
      isLive: activeRace.is_live,
      organizerDetails: cloneJson(activeRace.organizerDetails ?? defaultOrganizerRaceDetails),
    });
    setExpandedStationKey(null);
    void loadRaceSidecar(activeRace.id);
  }, [activeRace?.id]);

  const saveEvent = async (override?: Partial<EventFormValues>) => {
    if (!accessToken || !selectedEventId) return false;
    const nextForm = { ...eventForm, ...override };
    setStatus("saving");
    setError(null);
    setMessage(null);
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
        setError(data?.message ?? "Impossible d'enregistrer l'evenement.");
        return false;
      }
      setMessage("Evenement mis a jour.");
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
    setStatus("saving");
    setError(null);
    setMessage(null);
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
        setError(data?.message ?? "Impossible d'enregistrer le format.");
        return false;
      }
      setMessage("Format mis a jour.");
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
    setMessage(null);
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
        setError(data?.message ?? "Impossible d'ajouter le format.");
        return;
      }
      setNewRaceForm(createEmptyRaceForm());
      setActiveTab(data.race.id);
      setActiveModule("formats");
      setMessage("Format ajoute.");
      await loadEvent(selectedEventId, data.race.id);
    } finally {
      setStatus("idle");
    }
  };

  const duplicateActiveRace = async () => {
    if (!accessToken || !selectedEventId || !activeRace) return;
    setStatus("saving");
    setError(null);
    setMessage(null);
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
        setError(data?.message ?? "Impossible de dupliquer le format.");
        return;
      }
      setActiveTab(data.race.id);
      setActiveModule("formats");
      setMessage("Format duplique en brouillon, sans GPX ni ravitos.");
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
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("gpx", file);
      const response = await fetch(`/api/organizer/races/${activeRace.id}/gpx`, {
        method: "PUT",
        headers: authHeaders,
        body: formData,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "GPX invalide ou impossible a importer.");
        return;
      }
      setMessage("GPX remplace. Les plans existants restent des snapshots.");
      await loadEvent(selectedEventId, activeRace.id);
      await loadRaceSidecar(activeRace.id);
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const saveAidStations = async () => {
    if (!accessToken || !activeRace) return false;
    setStatus("saving");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}/aid-stations`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ aidStations }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setError(data?.message ?? "Impossible d'enregistrer les ravitos.");
        return false;
      }
      setMessage("Ravitos mis a jour.");
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
      setError(data?.message ?? "Impossible de mettre a jour les produits.");
      return false;
    }
    await loadRaceSidecar(activeRace.id);
    return true;
  };

  const attachCatalogProduct = async (aidStationId: string, productId: string) => {
    if (!productId) return;
    const selectedProduct = catalogProducts.find((product) => product.id === productId);
    if (!selectedProduct) {
      setError("Produit introuvable dans le catalogue.");
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
    setMessage(null);
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
        setError(data?.message ?? "Impossible de creer le produit.");
        return;
      }
      setProductForm(emptyProductForm);
      setMessage("Produit cree pour ce ravito.");
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
    setActiveTab(nextTab);
    setActiveModule(nextTab === EVENT_TAB_ID ? "event" : "formats");
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6">
      <OrganizerSummaryHeader
        selectedMembership={selectedMembership}
        event={eventDraft}
        activeRace={activeRace}
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
      {message ? <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

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
            <EventInfoEditor eventForm={eventForm} onChange={updateEventForm} onSave={() => void saveEvent()} status={status} />
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
              status={status}
            />
          ) : activeModule === "aidStations" ? (
            <AidStationsEditor
              activeRace={activeRace}
              aidStations={aidStations}
              expandedStationKey={expandedStationKey}
              onExpandedStationKeyChange={setExpandedStationKey}
              onAddStation={() => {
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

function OrganizerSignedOutCard() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Dashboard organisateur</CardTitle>
          <CardDescription>Connecte-toi pour acceder aux courses claimees.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/sign-in">
            <Button>Se connecter</Button>
          </Link>
          <Link href="/organizers">
            <Button variant="outline">Demander un claim</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function OrganizerNoMembershipCard({ pendingClaims, rejectedClaims }: { pendingClaims: ClaimRow[]; rejectedClaims: ClaimRow[] }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Dashboard organisateur</CardTitle>
          <CardDescription>Aucune course approuvee pour ce compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingClaims.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Demandes en attente</p>
              {pendingClaims.map((claim) => (
                <div key={claim.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  {claim.race_events?.name ?? claim.organization_name}
                </div>
              ))}
            </div>
          ) : null}
          {rejectedClaims.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Demandes refusees</p>
              {rejectedClaims.map((claim) => (
                <div key={claim.id} className="rounded-md border border-border bg-background p-3 text-sm">
                  <p className="font-medium">{claim.race_events?.name ?? claim.organization_name}</p>
                  {claim.reviewer_notes ? <p className="text-muted-foreground">{claim.reviewer_notes}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          {pendingClaims.length === 0 && rejectedClaims.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tu n'as pas encore de demande.</p>
          ) : null}
          <Link href="/organizers">
            <Button>Demander un claim</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function OrganizerSummaryHeader({
  selectedMembership,
  event,
  activeRace,
  aidStationCount,
  memberships,
  selectedEventId,
  onSelectedEventChange,
  completion,
  hasDirtyChanges,
  status,
  onSaveAll,
  onPreview,
  onTogglePublish,
}: {
  selectedMembership: MembershipRow | null;
  event: OrganizerEventDetail | null;
  activeRace: RaceFormat | null;
  aidStationCount: number;
  memberships: MembershipRow[];
  selectedEventId: string | null;
  onSelectedEventChange: (eventId: string) => void;
  completion: OrganizerCompletionSummary | null;
  hasDirtyChanges: boolean;
  status: "idle" | "loading" | "saving" | "uploading";
  onSaveAll: () => void;
  onPreview: () => void;
  onTogglePublish: () => void;
}) {
  const eventScore = completion?.eventScore ?? 0;
  const formatScore = completion?.formatScore ?? 0;
  const formatScoreLabel = activeRace ? `${formatScore}%` : "-";
  const isLive = event?.is_live !== false;

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">
            Dashboard organisateur
          </p>
          <h1 className="mt-1 break-words text-3xl font-semibold tracking-tight text-foreground dark:text-slate-50">
            {selectedMembership?.race_events?.name ?? event?.name ?? "Evenement"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground dark:text-slate-300">
            {[event?.location, event?.race_date].filter(Boolean).join(" - ") || "Lieu et date a completer"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={selectedEventId ?? ""}
            onChange={(selectEvent) => onSelectedEventChange(selectEvent.target.value)}
          >
            {memberships.map((membership) => (
              <option key={membership.id} value={membership.event_id}>
                {membership.race_events?.name ?? membership.event_id}
              </option>
            ))}
          </select>
          <Link href="/organizers">
            <Button variant="outline">Nouveau claim</Button>
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <MetricPill label="Statut" value={isLive ? "Live" : "Brouillon"} tone={isLive ? "success" : "muted"} />
        <MetricPill label="Formats" value={String(event?.races.length ?? 0)} />
        <MetricPill label="Ravitos" value={String(aidStationCount)} />
        <MetricPill label="Evenement" value={`${eventScore}%`} tone={completion?.requiredComplete ? "success" : "warning"} />
        <MetricPill label="Format actif" value={formatScoreLabel} tone={!activeRace ? "muted" : formatScore >= 80 ? "success" : "warning"} />
        <MetricPill label="Etat" value={hasDirtyChanges ? "Non enregistre" : "A jour"} tone={hasDirtyChanges ? "warning" : "success"} />
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${eventScore}%` }} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onPreview} variant="outline">
          Previsualiser cote coureur
        </Button>
        <Button type="button" onClick={onTogglePublish} variant={isLive ? "outline" : "default"} disabled={status === "saving"}>
          {isLive ? "Depublier" : "Publier"}
        </Button>
        <Button type="button" onClick={onSaveAll} disabled={!hasDirtyChanges || status === "saving"}>
          {status === "saving" ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>
    </section>
  );
}

function MetricPill({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" | "muted" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "success" && "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-400/40 dark:bg-emerald-500/10 dark:text-emerald-100",
        tone === "warning" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100",
        tone === "muted" && "border-border bg-muted text-muted-foreground",
        tone === "default" && "border-border bg-background"
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function CompletionTabsPanel({
  tabs,
  activeTab,
  activeRace,
  completion,
  dirtyModules,
  onTabChange,
  onSelectModule,
  activeModule,
}: {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  activeRace: RaceFormat | null;
  completion: OrganizerCompletionSummary;
  dirtyModules: Set<OrganizerModuleId>;
  onTabChange: (tab: string) => void;
  onSelectModule: (moduleId: OrganizerModuleId) => void;
  activeModule: OrganizerModuleId;
}) {
  const isEventTab = activeTab === EVENT_TAB_ID;
  const isAddTab = activeTab === ADD_FORMAT_TAB_ID;
  const score = isEventTab ? completion.eventScore : activeRace ? completion.formatScore : 0;
  const modules = isEventTab ? completion.eventModules : activeRace ? completion.formatModules : [];
  const description = isEventTab
    ? "Informations communes a tous les formats."
    : activeRace
      ? "Informations propres au format selectionne."
      : "Cree un nouveau format depuis le formulaire ci-dessous.";
  const selectModule = (moduleId: OrganizerModuleId) => {
    if (isEventTab && moduleId === "formats") {
      const firstFormatTab = tabs.find((tab) => tab.id !== EVENT_TAB_ID && tab.id !== ADD_FORMAT_TAB_ID)?.id ?? ADD_FORMAT_TAB_ID;
      onTabChange(firstFormatTab);
      return;
    }
    onSelectModule(moduleId);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Avancement global</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {!isAddTab ? <span className="text-sm font-semibold text-foreground">{score}%</span> : null}
        </div>
        <TabsList tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      </div>

      {!isAddTab ? (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${score}%` }} />
          </div>
          <OrganizerModuleGrid
            modules={modules}
            activeModule={activeModule}
            dirtyModules={dirtyModules}
            onSelectModule={selectModule}
            formatMode={!isEventTab}
          />
        </>
      ) : (
        <div className="mt-3 rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Renseigne le nouveau format dans le formulaire ci-dessous. Ses tuiles apparaitront apres creation.
        </div>
      )}
    </section>
  );
}

function OrganizerModuleGrid({
  modules,
  activeModule,
  dirtyModules,
  onSelectModule,
  formatMode,
}: {
  modules: OrganizerCompletionSummary["modules"];
  activeModule: OrganizerModuleId;
  dirtyModules: Set<OrganizerModuleId>;
  onSelectModule: (moduleId: OrganizerModuleId) => void;
  formatMode?: boolean;
}) {
  const isDirty = (moduleId: OrganizerModuleId) =>
    dirtyModules.has(moduleId) ||
    (formatMode && moduleId !== "aidStations" && moduleId !== "products" && moduleId !== "preview" && dirtyModules.has("formats"));

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {modules.map((module) => (
        <button
          key={module.id}
          type="button"
          className={cn(
            "min-h-40 rounded-lg border bg-card p-4 text-left transition hover:border-brand-border hover:shadow-sm",
            activeModule === module.id && "border-brand-border ring-2 ring-brand/20",
            isDirty(module.id) && "border-amber-300"
          )}
          onClick={() => onSelectModule(module.id)}
        >
          <div className="flex items-start justify-between gap-2">
            <StatusBadge status={module.status} />
            <LevelBadge level={module.level} />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-foreground">{module.title}</h2>
          <p className="mt-1 min-h-10 text-xs text-muted-foreground">{module.description}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-foreground">{module.countLabel}</span>
            <span className="text-xs font-semibold text-brand">{isDirty(module.id) ? "A sauver" : "Modifier"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: OrganizerModuleStatus }) {
  const labels: Record<OrganizerModuleStatus, string> = {
    empty: "Vide",
    incomplete: "Incomplet",
    complete: "Complet",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-1 text-[11px] font-semibold",
        status === "complete" && "border-emerald-300 bg-emerald-50 text-emerald-700",
        status === "incomplete" && "border-amber-300 bg-amber-50 text-amber-700",
        status === "empty" && "border-border bg-muted text-muted-foreground"
      )}
    >
      {labels[status]}
    </span>
  );
}

function LevelBadge({ level }: { level: OrganizerModuleLevel }) {
  const labels: Record<OrganizerModuleLevel, string> = {
    required: "Obligatoire",
    recommended: "Recommande",
    optional: "Optionnel",
  };
  return <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">{labels[level]}</span>;
}

function EventInfoEditor({
  eventForm,
  onChange,
  onSave,
  status,
}: {
  eventForm: EventFormValues;
  onChange: (next: Partial<EventFormValues>, moduleId?: OrganizerModuleId) => void;
  onSave: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <form
      className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <TextField label="Nom" value={eventForm.name} onChange={(value) => onChange({ name: value })} required />
      <TextField label="Lieu" value={eventForm.location} onChange={(value) => onChange({ location: value })} />
      <TextField label="Date" type="date" value={eventForm.raceDate} onChange={(value) => onChange({ raceDate: value })} />
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input type="checkbox" checked={eventForm.isLive} onChange={(event) => onChange({ isLive: event.target.checked })} />
        Live
      </label>
      <div className="lg:col-span-3">
        <TextField label="Image" value={eventForm.thumbnailUrl} onChange={(value) => onChange({ thumbnailUrl: value })} placeholder="https://..." />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={status === "saving"}>
          Sauvegarder
        </Button>
      </div>
    </form>
  );
}

function FormatsEditor({
  activeTab,
  activeRace,
  raceForm,
  newRaceForm,
  showRaceDetails,
  onToggleRaceDetails,
  onRaceFormChange,
  onNewRaceFormChange,
  onCreateRace,
  onSaveRace,
  onUploadGpx,
  onDuplicateRace,
  onPreviewRace,
  status,
}: {
  activeTab: string;
  activeRace: RaceFormat | null;
  raceForm: RaceFormValues;
  newRaceForm: RaceFormValues;
  showRaceDetails: boolean;
  onToggleRaceDetails: () => void;
  onRaceFormChange: (next: Partial<RaceFormValues>) => void;
  onNewRaceFormChange: (next: RaceFormValues) => void;
  onCreateRace: (event: FormEvent<HTMLFormElement>) => void;
  onSaveRace: () => void;
  onUploadGpx: (event: ChangeEvent<HTMLInputElement>) => void;
  onDuplicateRace: () => void;
  onPreviewRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <div className="space-y-5">
      {activeTab === ADD_FORMAT_TAB_ID ? (
        <RaceForm
          title="Ajouter un format"
          values={newRaceForm}
          onChange={(values) => onNewRaceFormChange(values)}
          onSubmit={onCreateRace}
          submitLabel="Ajouter"
          disabled={status === "saving"}
        />
      ) : activeRace ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onDuplicateRace} disabled={status === "saving"}>
              Dupliquer ce format
            </Button>
            <Button type="button" variant="outline" onClick={onPreviewRace}>
              Previsualiser ce format
            </Button>
            <Button type="button" variant="ghost" onClick={onToggleRaceDetails}>
              {showRaceDetails ? "Masquer les details" : "Afficher les details"}
            </Button>
          </div>
          {showRaceDetails ? (
            <RaceForm
              title="Details du format"
              values={raceForm}
              onChange={(values) => onRaceFormChange(values)}
              onSubmit={(event) => {
                event.preventDefault();
                onSaveRace();
              }}
              submitLabel="Sauvegarder le format"
              disabled={status === "saving"}
            />
          ) : null}
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">GPX</p>
                <p className="text-sm text-muted-foreground">
                  {activeRace.gpx_storage_path ? "GPX source present." : "Aucun GPX source pour ce format."}
                </p>
              </div>
              <Input type="file" accept=".gpx,application/gpx+xml" onChange={onUploadGpx} disabled={status === "uploading"} className="max-w-sm" />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Selectionne ou ajoute un format.</p>
      )}
    </div>
  );
}

function RaceForm({
  title,
  values,
  onChange,
  onSubmit,
  submitLabel,
  disabled,
}: {
  title: string;
  values: RaceFormValues;
  onChange: (values: RaceFormValues) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <form className="rounded-lg border border-border bg-background p-4" onSubmit={onSubmit}>
      <p className="mb-3 font-semibold text-foreground">{title}</p>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <TextField label="Nom" value={values.name} onChange={(value) => onChange({ ...values, name: value })} required />
        </div>
        <NumberField label="Distance km" value={values.distanceKm} onChange={(value) => onChange({ ...values, distanceKm: value })} step="0.1" />
        <NumberField label="D+" value={values.elevationGainM} onChange={(value) => onChange({ ...values, elevationGainM: value })} step="1" />
        <TextField label="D-" type="number" value={values.elevationLossM} onChange={(value) => onChange({ ...values, elevationLossM: value })} />
        <TextField label="Date optionnelle" type="date" value={values.raceDate} onChange={(value) => onChange({ ...values, raceDate: value })} />
        <div className="lg:col-span-2">
          <TextField label="Lieu format" value={values.locationText} onChange={(value) => onChange({ ...values, locationText: value })} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={values.isLive} onChange={(event) => onChange({ ...values, isLive: event.target.checked })} />
          Live
        </label>
        <div className="lg:col-span-3">
          <TextField label="Image format" value={values.thumbnailUrl} onChange={(value) => onChange({ ...values, thumbnailUrl: value })} placeholder="https://..." />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={disabled}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

function AidStationsEditor({
  activeRace,
  aidStations,
  expandedStationKey,
  onExpandedStationKeyChange,
  onAddStation,
  onSave,
  onUpdateStation,
  onRemoveStation,
  stationProducts,
  productsById,
  productForm,
  productStationId,
  onOpenProductPicker,
  onRemoveProduct,
  onToggleProductForm,
  onProductFormChange,
  onCreateProduct,
  status,
}: {
  activeRace: RaceFormat | null;
  aidStations: AidStationDraft[];
  expandedStationKey: string | null;
  onExpandedStationKeyChange: (key: string | null) => void;
  onAddStation: () => void;
  onSave: () => void;
  onUpdateStation: (index: number, station: AidStationDraft) => void;
  onRemoveStation: (index: number) => void;
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  productForm: ProductFormValues;
  productStationId: string | null;
  onOpenProductPicker: (stationId: string) => void;
  onRemoveProduct: (stationId: string, productId: string) => void;
  onToggleProductForm: (stationId: string) => void;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (!activeRace) return <p className="text-sm text-muted-foreground">Selectionne un format pour gerer ses ravitos.</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-semibold text-foreground">{activeRace.name}</p>
          <p className="text-sm text-muted-foreground">Saisie rapide en tableau, details par ligne.</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onAddStation}>
            Ajouter un ravito
          </Button>
          <Button type="button" onClick={onSave} disabled={status === "saving"}>
            Sauvegarder les ravitos
          </Button>
        </div>
      </div>

      {aidStations.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">Aucun ravito.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordre</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Barriere</TableHead>
              <TableHead>Produits</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aidStations.map((station, index) => {
              const key = station.id ?? `new-${index}`;
              const isExpanded = expandedStationKey === key;
              const productCount = station.id ? stationProducts.filter((link) => link.aidStationId === station.id).length : 0;
              return (
                <TableRow key={key} className="align-top">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="min-w-52">
                    <Input value={station.name} onChange={(event) => onUpdateStation(index, { ...station, name: event.target.value })} />
                    {isExpanded ? (
                      <StationDetailsPanel
                        station={station}
                        onChange={(next) => onUpdateStation(index, next)}
                        productsSlot={
                          station.id ? (
                            <StationProductsBlock
                              station={station}
                              stationProducts={stationProducts}
                              productsById={productsById}
                              onOpenProductPicker={() => onOpenProductPicker(station.id as string)}
                              onRemoveProduct={(productId) => onRemoveProduct(station.id as string, productId)}
                              productFormOpen={productStationId === station.id}
                              onToggleProductForm={() => onToggleProductForm(station.id as string)}
                              productForm={productForm}
                              onProductFormChange={onProductFormChange}
                              onCreateProduct={onCreateProduct}
                              disabled={status === "saving"}
                            />
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">Sauvegarde le ravito avant d'y ajouter des produits.</p>
                          )
                        }
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="min-w-28">
                    <Input
                      type="number"
                      step="0.1"
                      value={station.distanceKm}
                      onChange={(event) => onUpdateStation(index, { ...station, distanceKm: Number(event.target.value) })}
                    />
                  </TableCell>
                  <TableCell>
                    <select
                      className="h-10 rounded-md border border-border bg-card px-3 text-sm"
                      value={station.organizerDetails.stationType}
                      onChange={(event) =>
                        onUpdateStation(index, {
                          ...station,
                          organizerDetails: { ...station.organizerDetails, stationType: event.target.value as AidStationType },
                        })
                      }
                    >
                      {Object.entries(aidStationTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell>{station.organizerDetails.cutoffTime || "-"}</TableCell>
                  <TableCell>{productCount}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="ghost" onClick={() => onExpandedStationKeyChange(isExpanded ? null : key)}>
                        {isExpanded ? "Fermer" : "Details"}
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => onRemoveStation(index)}>
                        Retirer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function StationDetailsPanel({ station, onChange, productsSlot }: { station: AidStationDraft; onChange: (station: AidStationDraft) => void; productsSlot: ReactNode }) {
  const details = station.organizerDetails;
  return (
    <div className="mt-3 grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-3">
      <NumberField
        label="D+ cumule"
        value={details.cumulativeElevationGainM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationGainM: value } })}
      />
      <NumberField
        label="D- cumule"
        value={details.cumulativeElevationLossM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cumulativeElevationLossM: value } })}
      />
      <NumberField
        label="Altitude"
        value={details.altitudeM ?? 0}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, altitudeM: value } })}
      />
      <TextField
        label="Heure fermeture / barriere"
        value={details.cutoffTime ?? ""}
        onChange={(value) => onChange({ ...station, organizerDetails: { ...details, cutoffTime: value || null } })}
      />
      <div className="flex items-end">
        <ToggleChip
          checked={details.dropBagAvailable}
          label="Sac de delestage"
          onChange={(checked) => onChange({ ...station, organizerDetails: { ...details, dropBagAvailable: checked } })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <ToggleChip checked={station.waterRefill} label="Eau" onChange={(checked) => onChange({ ...station, waterRefill: checked })} />
        <ToggleChip checked={station.solidRefill} label="Solide" onChange={(checked) => onChange({ ...station, solidRefill: checked })} />
        <ToggleChip checked={station.assistanceAllowed} label="Assistance" onChange={(checked) => onChange({ ...station, assistanceAllowed: checked })} />
      </div>
      <div className="md:col-span-3">
        <TextAreaField
          label="Note organisateur"
          value={details.organizerNote ?? station.notes ?? ""}
          onChange={(value) => onChange({ ...station, notes: value, organizerDetails: { ...details, organizerNote: value || null } })}
        />
      </div>
      <div className="md:col-span-3">{productsSlot}</div>
    </div>
  );
}

function EquipmentEditor({
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  onSaveEvent,
  onSaveRace,
  status,
}: {
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <div className="space-y-4">
      <EquipmentFields
        title="Materiel commun a tous les formats"
        description="Renseigne ici uniquement ce qui vaut pour chaque course de l'evenement."
        equipment={eventDetails.mandatoryEquipment}
        onEquipmentChange={(mandatoryEquipment) => onEventChange({ ...eventDetails, mandatoryEquipment })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
      {activeRace ? (
        <EquipmentFields
          title={`Materiel specifique - ${activeRace.name}`}
          description="Ajoute seulement les obligations ou recommandations propres a ce format."
          equipment={raceDetails.mandatoryEquipment}
          onEquipmentChange={(mandatoryEquipment) => onRaceChange({ ...raceDetails, mandatoryEquipment })}
          onSave={onSaveRace}
          saveLabel="Sauvegarder ce format"
          disabled={status === "saving"}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Selectionne un format pour ajouter du materiel specifique.
        </p>
      )}
    </div>
  );
}

function EquipmentFields({
  title,
  description,
  equipment,
  onEquipmentChange,
  onSave,
  saveLabel,
  disabled,
}: {
  title: string;
  description: string;
  equipment: OrganizerEventDetails["mandatoryEquipment"];
  onEquipmentChange: (equipment: OrganizerEventDetails["mandatoryEquipment"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
}) {
  const updateItems = (items: OrganizerEventDetails["mandatoryEquipment"]["items"]) =>
    onEquipmentChange({ ...equipment, items });

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {equipmentSuggestions.map((suggestion) => (
          <Button
            key={suggestion}
            type="button"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => {
              if (equipment.items.some((item) => item.label.toLowerCase() === suggestion.toLowerCase())) return;
              updateItems([...equipment.items, { id: `item-${Date.now()}`, label: suggestion, required: true, note: null }]);
            }}
          >
            + {suggestion}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {equipment.items.map((item, index) => (
          <div key={item.id ?? index} className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-[1fr_auto_auto]">
            <Input
              value={item.label}
              onChange={(event) =>
                updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, label: event.target.value } : candidate)))
              }
            />
            <select
              className="h-10 rounded-md border border-border bg-card px-3 text-sm"
              value={item.required ? "required" : "recommended"}
              onChange={(event) =>
                updateItems(equipment.items.map((candidate, itemIndex) => (itemIndex === index ? { ...candidate, required: event.target.value === "required" } : candidate)))
              }
            >
              <option value="required">Obligatoire</option>
              <option value="recommended">Recommande</option>
            </select>
            <Button type="button" variant="ghost" onClick={() => updateItems(equipment.items.filter((_, itemIndex) => itemIndex !== index))}>
              Retirer
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => updateItems([...equipment.items, { id: `item-${Date.now()}`, label: "Nouvel item", required: true, note: null }])}
      >
        Ajouter un item
      </Button>
      <TextAreaField label="Note materiel" value={equipment.note ?? ""} onChange={(value) => onEquipmentChange({ ...equipment, note: value || null })} />
      <Button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
    </section>
  );
}

function ScheduleEditor({
  activeRace,
  raceForm,
  aidStations,
  onChange,
  onSave,
  status,
}: {
  activeRace: RaceFormat | null;
  raceForm: RaceFormValues;
  aidStations: AidStationDraft[];
  onChange: (next: Partial<RaceFormValues>) => void;
  onSave: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  if (!activeRace) return <p className="text-sm text-muted-foreground">Selectionne un format pour renseigner les horaires.</p>;
  const schedule = raceForm.organizerDetails.schedule;
  const updateSchedule = (next: Partial<OrganizerRaceDetails["schedule"]>) =>
    onChange({ organizerDetails: { ...raceForm.organizerDetails, schedule: { ...schedule, ...next } } });
  const cutoffStations = aidStations.filter((station) => station.organizerDetails.cutoffTime);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Heure de depart" value={schedule.startTime ?? ""} onChange={(value) => updateSchedule({ startTime: value || null })} />
        <TextField label="Heure limite arrivee" value={schedule.finishCutoffTime ?? ""} onChange={(value) => updateSchedule({ finishCutoffTime: value || null })} />
      </div>
      <TextAreaField label="Horaires navettes" value={schedule.shuttleSchedule ?? ""} onChange={(value) => updateSchedule({ shuttleSchedule: value || null })} />
      <TextAreaField label="Note horaires / barrieres" value={schedule.cutoffNote ?? ""} onChange={(value) => updateSchedule({ cutoffNote: value || null })} />
      <div className="rounded-md border border-border bg-background p-3">
        <p className="text-sm font-semibold">Barrieres liees aux ravitos</p>
        {cutoffStations.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Aucune barriere renseignee dans les ravitos.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {cutoffStations.map((station) => (
              <li key={station.id ?? station.name}>
                {station.name} - {formatKm(station.distanceKm)} - {station.organizerDetails.cutoffTime}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button type="button" onClick={onSave} disabled={status === "saving"}>
        Sauvegarder les horaires
      </Button>
    </div>
  );
}

function BibPickupEditor({
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  onSaveEvent,
  onSaveRace,
  status,
}: {
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <div className="space-y-4">
      <BibPickupFields
        title="Retrait dossard commun"
        description="Renseigne les infos valables pour tous les formats."
        bib={eventDetails.bibPickup}
        onBibChange={(bibPickup) => onEventChange({ ...eventDetails, bibPickup })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
      {activeRace ? (
        <BibPickupFields
          title={`Retrait specifique - ${activeRace.name}`}
          description="A remplir seulement si ce format a un retrait, des documents ou un controle different."
          bib={raceDetails.bibPickup}
          onBibChange={(bibPickup) => onRaceChange({ ...raceDetails, bibPickup })}
          onSave={onSaveRace}
          saveLabel="Sauvegarder ce format"
          disabled={status === "saving"}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Selectionne un format pour ajouter une consigne dossard specifique.
        </p>
      )}
    </div>
  );
}

function BibPickupFields({
  title,
  description,
  bib,
  onBibChange,
  onSave,
  saveLabel,
  disabled,
}: {
  title: string;
  description: string;
  bib: OrganizerEventDetails["bibPickup"];
  onBibChange: (bib: OrganizerEventDetails["bibPickup"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
}) {
  const update = (next: Partial<OrganizerEventDetails["bibPickup"]>) => onBibChange({ ...bib, ...next });
  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Lieu de retrait" value={bib.location ?? ""} onChange={(value) => update({ location: value || null })} />
        <TextField label="Horaires retrait" value={bib.schedule ?? ""} onChange={(value) => update({ schedule: value || null })} />
      </div>
      <TextAreaField label="Documents necessaires" value={bib.requiredDocuments ?? ""} onChange={(value) => update({ requiredDocuments: value || null })} />
      <div className="flex flex-wrap gap-2">
        <ToggleChip checked={bib.thirdPartyPickupAllowed === true} label="Retrait par tiers" onChange={(checked) => update({ thirdPartyPickupAllowed: checked })} />
        <ToggleChip checked={bib.equipmentCheck === true} label="Controle materiel" onChange={(checked) => update({ equipmentCheck: checked })} />
      </div>
      <TextAreaField label="Note dossard" value={bib.note ?? ""} onChange={(value) => update({ note: value || null })} />
      <Button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
    </section>
  );
}

function AccessEditor({
  activeRace,
  eventDetails,
  raceDetails,
  onEventChange,
  onRaceChange,
  onSaveEvent,
  onSaveRace,
  status,
}: {
  activeRace: RaceFormat | null;
  eventDetails: OrganizerEventDetails;
  raceDetails: OrganizerRaceDetails;
  onEventChange: (details: OrganizerEventDetails) => void;
  onRaceChange: (details: OrganizerRaceDetails) => void;
  onSaveEvent: () => void;
  onSaveRace: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  return (
    <div className="space-y-4">
      <AccessFields
        title="Acces commun evenement"
        description="Adresse principale, parking et consignes valables pour tous les formats."
        access={eventDetails.access}
        onAccessChange={(access) => onEventChange({ ...eventDetails, access })}
        onSave={onSaveEvent}
        saveLabel="Sauvegarder le commun"
        disabled={status === "saving"}
      />
      {activeRace ? (
        <section className="space-y-4 rounded-lg border border-border bg-background p-4">
          <AccessFields
            title={`Acces specifique - ${activeRace.name}`}
            description="A remplir seulement si ce format a un depart, une arrivee, des navettes ou des restrictions differentes."
            access={raceDetails.access}
            onAccessChange={(access) => onRaceChange({ ...raceDetails, access })}
            onSave={onSaveRace}
            saveLabel="Sauvegarder ce format"
            disabled={status === "saving"}
            embedded
          />
          <RunnerInfoFields
            runnerInfo={raceDetails.runnerInfo}
            onRunnerInfoChange={(runnerInfo) => onRaceChange({ ...raceDetails, runnerInfo })}
          />
          <Button type="button" onClick={onSaveRace} disabled={status === "saving"}>
            Sauvegarder les informations du format
          </Button>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
          Selectionne un format pour ajouter un acces ou une information specifique.
        </p>
      )}
    </div>
  );
}

function AccessFields({
  title,
  description,
  access,
  onAccessChange,
  onSave,
  saveLabel,
  disabled,
  embedded,
}: {
  title: string;
  description: string;
  access: OrganizerEventDetails["access"];
  onAccessChange: (access: OrganizerEventDetails["access"]) => void;
  onSave: () => void;
  saveLabel: string;
  disabled?: boolean;
  embedded?: boolean;
}) {
  const update = (next: Partial<OrganizerEventDetails["access"]>) => onAccessChange({ ...access, ...next });
  return (
    <section className={cn("space-y-4", !embedded && "rounded-lg border border-border bg-background p-4")}>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <TextField label="Adresse depart" value={access.startAddress ?? ""} onChange={(value) => update({ startAddress: value || null })} />
        <TextField label="Adresse arrivee" value={access.finishAddress ?? ""} onChange={(value) => update({ finishAddress: value || null })} />
      </div>
      <TextAreaField label="Parkings officiels" value={access.officialParkings ?? ""} onChange={(value) => update({ officialParkings: value || null })} />
      <TextAreaField label="Navettes" value={access.shuttles ?? ""} onChange={(value) => update({ shuttles: value || null })} />
      <TextAreaField label="Horaires navettes" value={access.shuttleSchedule ?? ""} onChange={(value) => update({ shuttleSchedule: value || null })} />
      <TextAreaField label="Routes fermees / restrictions" value={access.roadRestrictions ?? ""} onChange={(value) => update({ roadRestrictions: value || null })} />
      <TextField label="Lien Google Maps ou adresse" value={access.mapUrl ?? ""} onChange={(value) => update({ mapUrl: value || null })} placeholder="https://..." />
      <TextAreaField label="Note acces" value={access.note ?? ""} onChange={(value) => update({ note: value || null })} />
      <Button type="button" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </Button>
    </section>
  );
}

function RunnerInfoFields({
  runnerInfo,
  onRunnerInfoChange,
}: {
  runnerInfo: OrganizerRaceDetails["runnerInfo"];
  onRunnerInfoChange: (runnerInfo: OrganizerRaceDetails["runnerInfo"]) => void;
}) {
  const update = (next: Partial<OrganizerRaceDetails["runnerInfo"]>) => onRunnerInfoChange({ ...runnerInfo, ...next });
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div>
        <p className="font-semibold text-foreground">Informations coureur specifiques</p>
        <p className="text-sm text-muted-foreground">Briefing, zone de depart ou consigne propre au format actif.</p>
      </div>
      <TextField label="Zone de depart" value={runnerInfo.startArea ?? ""} onChange={(value) => update({ startArea: value || null })} />
      <TextAreaField label="Briefing" value={runnerInfo.briefing ?? ""} onChange={(value) => update({ briefing: value || null })} />
      <TextAreaField label="Regles specifiques" value={runnerInfo.rules ?? ""} onChange={(value) => update({ rules: value || null })} />
      <TextAreaField label="Note format" value={runnerInfo.note ?? ""} onChange={(value) => update({ note: value || null })} />
    </div>
  );
}

function ProductsEditor(props: {
  aidStations: AidStationDraft[];
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  productForm: ProductFormValues;
  productStationId: string | null;
  onOpenProductPicker: (stationId: string) => void;
  onRemoveProduct: (stationId: string, productId: string) => void;
  onToggleProductForm: (stationId: string) => void;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const savedStations = props.aidStations.filter((station): station is AidStationDraft & { id: string } => Boolean(station.id));
  if (savedStations.length === 0) {
    return <p className="text-sm text-muted-foreground">Sauvegarde au moins un ravito avant d'y associer des produits.</p>;
  }
  return (
    <div className="space-y-4">
      {savedStations.map((station) => (
        <div key={station.id} className="rounded-md border border-border bg-background p-4">
          <p className="font-semibold text-foreground">{station.name}</p>
          <p className="text-sm text-muted-foreground">{formatKm(station.distanceKm)}</p>
          <StationProductsBlock
            station={station}
            stationProducts={props.stationProducts}
            productsById={props.productsById}
            onOpenProductPicker={() => props.onOpenProductPicker(station.id)}
            onRemoveProduct={(productId) => props.onRemoveProduct(station.id, productId)}
            productFormOpen={props.productStationId === station.id}
            onToggleProductForm={() => props.onToggleProductForm(station.id)}
            productForm={props.productForm}
            onProductFormChange={props.onProductFormChange}
            onCreateProduct={props.onCreateProduct}
            disabled={props.status === "saving"}
          />
        </div>
      ))}
    </div>
  );
}

function ServicesEditor({
  details,
  onChange,
  onSave,
  status,
}: {
  details: OrganizerEventDetails;
  onChange: (details: OrganizerEventDetails) => void;
  onSave: () => void;
  status: "idle" | "loading" | "saving" | "uploading";
}) {
  const services = details.services;
  const update = (next: Partial<OrganizerEventDetails["services"]>) => onChange({ ...details, services: { ...services, ...next } });
  return (
    <div className="space-y-4">
      <TextAreaField label="Accompagnants" value={services.supporters ?? ""} onChange={(value) => update({ supporters: value || null })} />
      <TextAreaField label="Hebergements" value={services.accommodations ?? ""} onChange={(value) => update({ accommodations: value || null })} />
      <TextAreaField label="Restaurants" value={services.restaurants ?? ""} onChange={(value) => update({ restaurants: value || null })} />
      <TextAreaField label="Massage / recuperation" value={services.recovery ?? ""} onChange={(value) => update({ recovery: value || null })} />
      <TextAreaField label="Partenaires" value={services.partners ?? ""} onChange={(value) => update({ partners: value || null })} />
      <TextAreaField label="Message derniere minute" value={services.lastMinuteMessage ?? ""} onChange={(value) => update({ lastMinuteMessage: value || null })} />
      <TextAreaField label="Note services" value={services.note ?? ""} onChange={(value) => update({ note: value || null })} />
      <Button type="button" onClick={onSave} disabled={status === "saving"}>
        Sauvegarder les services
      </Button>
    </div>
  );
}

function PreviewLauncher({ onPreview }: { onPreview: () => void }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-background p-5">
      <p className="text-sm text-muted-foreground">Ouvre une version simple cote coureur pour verifier les informations renseignees.</p>
      <Button type="button" className="mt-3" onClick={onPreview}>
        Previsualiser cote coureur
      </Button>
    </div>
  );
}

function StationProductsBlock({
  station,
  stationProducts,
  productsById,
  onOpenProductPicker,
  onRemoveProduct,
  productFormOpen,
  onToggleProductForm,
  productForm,
  onProductFormChange,
  onCreateProduct,
  disabled,
}: {
  station: AidStationDraft & { id?: string };
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
  onOpenProductPicker: () => void;
  onRemoveProduct: (productId: string) => void;
  productFormOpen: boolean;
  onToggleProductForm: () => void;
  productForm: ProductFormValues;
  onProductFormChange: (values: ProductFormValues) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
}) {
  const linkedProducts = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Produits proposes</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onOpenProductPicker} disabled={disabled}>
            Ajouter un produit
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={onToggleProductForm}>
            {productFormOpen ? "Fermer" : "Creer un produit"}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex min-h-16 flex-wrap gap-2 rounded-md border border-dashed border-brand-border bg-brand-surface/50 p-2 dark:border-emerald-400/50 dark:bg-emerald-500/5">
        {linkedProducts.length === 0 ? (
          <p className="self-center px-2 text-xs text-muted-foreground">Aucun produit attache a ce ravito.</p>
        ) : (
          linkedProducts.map((link) => {
            const product = link.product ?? productsById.get(link.productId);
            return (
              <div key={link.productId} className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-border bg-card px-3 py-1 text-xs text-foreground">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{product?.name ?? link.productId}</p>
                  {product ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {fuelTypeLabels[product.fuelType]} - {formatProductAmount(product.carbsGrams, "g glucides")} - {formatProductAmount(product.sodiumMg, "mg sodium")}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="h-6 w-6 shrink-0 rounded-full border border-red-200 bg-red-50 text-sm font-semibold leading-none text-red-700"
                  onClick={() => onRemoveProduct(link.productId)}
                  aria-label={`Retirer ${product?.name ?? "ce produit"}`}
                >
                  x
                </button>
              </div>
            );
          })
        )}
      </div>
      {productFormOpen ? (
        <form className="mt-3 grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-3" onSubmit={onCreateProduct}>
          <div className="md:col-span-2">
            <TextField label="Nom produit" value={productForm.name} onChange={(value) => onProductFormChange({ ...productForm, name: value })} required />
          </div>
          <TextField label="Marque" value={productForm.brand} onChange={(value) => onProductFormChange({ ...productForm, brand: value })} />
          <div className="space-y-1">
            <Label>Type</Label>
            <select className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" value={productForm.fuelType} onChange={(event) => onProductFormChange({ ...productForm, fuelType: event.target.value as FuelType })}>
              {fuelTypeValues.map((fuelType) => (
                <option key={fuelType} value={fuelType}>
                  {fuelType}
                </option>
              ))}
            </select>
          </div>
          <NumberField label="Calories" value={productForm.caloriesKcal} onChange={(value) => onProductFormChange({ ...productForm, caloriesKcal: value })} />
          <NumberField label="Glucides g" value={productForm.carbsGrams} onChange={(value) => onProductFormChange({ ...productForm, carbsGrams: value })} />
          <NumberField label="Sodium mg" value={productForm.sodiumMg} onChange={(value) => onProductFormChange({ ...productForm, sodiumMg: value })} />
          <NumberField label="Proteines g" value={productForm.proteinGrams} onChange={(value) => onProductFormChange({ ...productForm, proteinGrams: value })} />
          <NumberField label="Lipides g" value={productForm.fatGrams} onChange={(value) => onProductFormChange({ ...productForm, fatGrams: value })} />
          <TextField label="SKU" value={productForm.sku} onChange={(value) => onProductFormChange({ ...productForm, sku: value })} />
          <div className="md:col-span-2">
            <TextField label="URL produit" value={productForm.productUrl} onChange={(value) => onProductFormChange({ ...productForm, productUrl: value })} placeholder="https://..." />
          </div>
          <TextField label="Note ravito" value={productForm.notes} onChange={(value) => onProductFormChange({ ...productForm, notes: value })} />
          <div className="md:col-span-3">
            <Button type="submit" disabled={disabled}>
              Creer et attacher a {station.name}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ProductPickerModal({
  station,
  products,
  linkedProductIds,
  search,
  onSearchChange,
  onAddProduct,
  onClose,
  disabled,
}: {
  station: (AidStationDraft & { id?: string }) | null;
  products: FuelProduct[];
  linkedProductIds: Set<string>;
  search: string;
  onSearchChange: (value: string) => void;
  onAddProduct: (productId: string) => void;
  onClose: () => void;
  disabled?: boolean;
}) {
  const [activeFilter, setActiveFilter] = useState<(typeof productPickerQuickFilters)[number]["id"]>("all");
  const stationId = station?.id ?? null;

  useEffect(() => {
    if (!station) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, station]);

  useEffect(() => {
    if (stationId) setActiveFilter("all");
  }, [stationId]);

  if (!station) return null;

  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const selectedFilter = productPickerQuickFilters.find((filter) => filter.id === activeFilter) ?? productPickerQuickFilters[0]!;
  const filteredProducts = products.filter((product) => {
    const matchesType = selectedFilter.fuelTypes ? selectedFilter.fuelTypes.includes(product.fuelType) : true;
    if (!matchesType) return false;
    if (!normalizedSearch) return true;
    return [product.name, product.brand, fuelTypeLabels[product.fuelType], product.sku]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("fr").includes(normalizedSearch));
  });
  const groupedProducts = groupProductsByBrand(filteredProducts);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="organizer-product-picker-title" className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border-strong bg-card shadow-2xl dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand dark:text-emerald-300">Catalogue</p>
            <h2 id="organizer-product-picker-title" className="mt-1 text-xl font-semibold text-foreground">
              Ajouter un produit a {station.name}
            </h2>
          </div>
          <Button type="button" variant="ghost" className="h-8 px-2" onClick={onClose} aria-label="Fermer">
            x
          </Button>
        </div>
        <div className="border-b border-border p-4">
          <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Rechercher un produit, une marque ou un type" autoFocus />
          <div className="mt-3 flex flex-wrap gap-2">
            {productPickerQuickFilters.map((filter) => {
              const isActive = filter.id === activeFilter;
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    isActive ? "border-brand bg-brand text-brand-foreground shadow-sm" : "border-border bg-background text-muted-foreground hover:border-brand-border hover:text-foreground"
                  )}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">Aucun produit trouve.</p>
          ) : (
            <div className="grid gap-5">
              {groupedProducts.map((group) => (
                <section key={group.brand} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">{group.brand}</h3>
                    <span className="rounded-full border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground">{group.items.length}</span>
                  </div>
                  <div className="grid gap-3">
                    {group.items.map((product) => {
                      const alreadyLinked = linkedProductIds.has(product.id);
                      return (
                        <div key={product.id} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                            {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1.5" /> : <span className="text-[11px] text-muted-foreground">Produit</span>}
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div>
                              <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{fuelTypeLabels[product.fuelType]}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.carbsGrams, "g glucides")}</span>
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.sodiumMg, "mg sodium")}</span>
                              <span className="rounded-full border border-border bg-card px-2 py-1">{formatProductAmount(product.caloriesKcal, "kcal")}</span>
                            </div>
                          </div>
                          <Button type="button" variant={alreadyLinked ? "outline" : "default"} disabled={alreadyLinked || disabled} onClick={() => onAddProduct(product.id)}>
                            {alreadyLinked ? "Deja ajoute" : "Ajouter"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RunnerPreviewDialog({
  open,
  onOpenChange,
  event,
  activeRaceId,
  aidStations,
  stationProducts,
  productsById,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OrganizerEventDetail | null;
  activeRaceId: string | null;
  aidStations: AidStationDraft[];
  stationProducts: StationProduct[];
  productsById: Map<string, FuelProduct>;
}) {
  const activeRace = event?.races.find((race) => race.id === activeRaceId) ?? event?.races.find((race) => race.is_live) ?? event?.races[0] ?? null;
  const runnerDetails = event ? buildRunnerOrganizerDetails(event.organizerDetails ?? defaultOrganizerEventDetails, activeRace?.organizerDetails) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event?.name ?? "Previsualisation coureur"}</DialogTitle>
          <DialogDescription>{[event?.location, event?.race_date].filter(Boolean).join(" - ") || "Informations a completer"}</DialogDescription>
        </DialogHeader>
        {!event ? (
          <p className="text-sm text-muted-foreground">Aucun evenement charge.</p>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="text-sm font-semibold text-foreground">Formats disponibles</h3>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                {event.races.map((race) => (
                  <div key={race.id} className="rounded-md border border-border bg-background p-3">
                    <p className="font-semibold">{race.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatKm(race.distance_km)} - D+ {Math.round(race.elevation_gain_m)} m - {race.gpx_storage_path ? "GPX disponible" : "GPX a venir"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            {activeRace ? (
              <section>
                <h3 className="text-sm font-semibold text-foreground">Ravitos - {activeRace.name}</h3>
                {aidStations.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">Ravitos a venir.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {aidStations.map((station) => {
                      const products = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];
                      return (
                        <div key={station.id ?? station.name} className="rounded-md border border-border bg-background p-3">
                          <p className="font-semibold">
                            {station.name} - {formatKm(station.distanceKm)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {aidStationTypeLabels[station.organizerDetails.stationType]} - {station.waterRefill ? "eau" : "sans eau"} - {station.solidRefill ? "solide" : "sans solide"} - {station.assistanceAllowed ? "assistance" : "sans assistance"}
                            {station.organizerDetails.cutoffTime ? ` - barriere ${station.organizerDetails.cutoffTime}` : ""}
                          </p>
                          {products.length > 0 ? (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Produits: {products.map((link) => productsById.get(link.productId)?.name ?? link.productId).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
            {runnerDetails ? (
              <>
                <PreviewTextSection
                  title="Materiel commun"
                  values={runnerDetails.commonEquipment.items.map((item) => `${item.label}${item.required ? "" : " (recommande)"}`)}
                  empty="Materiel commun a venir."
                />
                <PreviewTextSection
                  title={activeRace ? `Materiel ${activeRace.name}` : "Materiel format"}
                  values={runnerDetails.raceEquipment.items.map((item) => `${item.label}${item.required ? "" : " (recommande)"}`)}
                  empty="Pas de materiel specifique pour ce format."
                />
                <PreviewTextSection
                  title="Horaires"
                  values={[
                    runnerDetails.schedule.startTime ? `Depart ${runnerDetails.schedule.startTime}` : null,
                    runnerDetails.schedule.finishCutoffTime ? `Limite arrivee ${runnerDetails.schedule.finishCutoffTime}` : null,
                    runnerDetails.schedule.cutoffNote,
                  ]}
                  empty="Horaires a venir."
                />
                <PreviewTextSection
                  title="Dossard"
                  values={[runnerDetails.bibPickup.location, runnerDetails.bibPickup.schedule, runnerDetails.bibPickup.requiredDocuments, runnerDetails.bibPickup.note]}
                  empty="Retrait dossard a venir."
                />
                <PreviewTextSection
                  title="Acces"
                  values={[
                    runnerDetails.access.startAddress,
                    runnerDetails.access.finishAddress,
                    runnerDetails.access.officialParkings,
                    runnerDetails.access.shuttles,
                    runnerDetails.access.roadRestrictions,
                    runnerDetails.access.note,
                  ]}
                  empty="Acces a venir."
                />
                <PreviewTextSection
                  title="Informations format"
                  values={[runnerDetails.runnerInfo.startArea, runnerDetails.runnerInfo.briefing, runnerDetails.runnerInfo.rules, runnerDetails.runnerInfo.note]}
                  empty="Pas d'information specifique pour ce format."
                />
                <PreviewTextSection
                  title="Services"
                  values={[
                    runnerDetails.services.supporters,
                    runnerDetails.services.accommodations,
                    runnerDetails.services.restaurants,
                    runnerDetails.services.recovery,
                    runnerDetails.services.partners,
                    runnerDetails.services.lastMinuteMessage,
                  ]}
                  empty="Services a venir."
                />
              </>
            ) : null}
            {activeRace?.is_live ? (
              <Link href={`/race-planner?catalogRaceId=${activeRace.id}`}>
                <Button>Creer mon plan</Button>
              </Link>
            ) : (
              <p className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">Le bouton "Creer mon plan" apparaitra pour un format live.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewTextSection({ title, values, empty }: { title: string; values: Array<string | null | undefined>; empty: string }) {
  const lines = values.filter((value): value is string => Boolean(value?.trim()));
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {lines.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {lines.map((line, index) => (
            <li key={`${title}-${index}`}>{line}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}

function NumberField({ label, value, onChange, step = "0.1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <textarea
        className="min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ToggleChip({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

function getModuleTitle(moduleId: OrganizerModuleId) {
  const titles: Record<OrganizerModuleId, string> = {
    event: "Informations evenement",
    formats: "Formats & GPX",
    aidStations: "Ravitos & points de course",
    equipment: "Materiel commun / format",
    schedule: "Horaires & barrieres",
    bibPickup: "Dossard commun / format",
    access: "Acces & infos format",
    products: "Produits aux ravitos",
    services: "Partenaires / services",
    preview: "Previsualisation coureur",
  };
  return titles[moduleId];
}

function getModuleDescription(moduleId: OrganizerModuleId) {
  const descriptions: Record<OrganizerModuleId, string> = {
    event: "Les informations parent qui cadrent tout l'evenement.",
    formats: "Les formats restent en onglets, avec resume et actions rapides.",
    aidStations: "Un tableau rapide, avec details extensibles par ravito.",
    equipment: "Materiel commun a l'evenement et specificites du format actif.",
    schedule: "Horaires de depart, arrivee, navettes et barrieres.",
    bibPickup: "Retrait dossard commun avec surcharge possible par format.",
    access: "Acces commun, acces format et informations coureur specifiques.",
    products: "Produits officiels disponibles par ravito.",
    services: "Informations optionnelles utiles aux coureurs.",
    preview: "Controle visuel de la version coureur interne.",
  };
  return descriptions[moduleId];
}
