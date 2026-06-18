"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { AidStationBadge } from "../../components/race-planner/AidStationBadge";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { TabsList } from "../../components/ui/tabs";
import { fuelTypeValues, type FuelType } from "../../lib/fuel-types";
import type { FuelProduct } from "../../lib/product-types";
import { useVerifiedSession } from "../hooks/useVerifiedSession";

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
};

type OrganizerEventDetail = {
  id: string;
  name: string;
  location?: string | null;
  race_date?: string | null;
  thumbnail_url?: string | null;
  is_live?: boolean | null;
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
};

type StationProduct = {
  id: string;
  aidStationId: string;
  productId: string;
  notes?: string | null;
  orderIndex: number;
  product?: FuelProduct | null;
};

const emptyEventForm = {
  name: "",
  location: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
};

const emptyRaceForm = {
  name: "",
  distanceKm: 0,
  elevationGainM: 0,
  elevationLossM: "",
  locationText: "",
  raceDate: "",
  thumbnailUrl: "",
  isLive: true,
};

const emptyProductForm = {
  name: "",
  brand: "",
  sku: "",
  fuelType: "other" as FuelType,
  productUrl: "",
  caloriesKcal: 0,
  carbsGrams: 0,
  sodiumMg: 0,
  proteinGrams: 0,
  fatGrams: 0,
  notes: "",
};

const formatDate = (value?: string | null) => (value ? value.slice(0, 10) : "");

const toNumberOrNull = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default function OrganizerDashboardPage() {
  const { session, isLoading } = useVerifiedSession();
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<OrganizerEventDetail | null>(null);
  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [activeTab, setActiveTab] = useState("__add");
  const [raceForm, setRaceForm] = useState(emptyRaceForm);
  const [newRaceForm, setNewRaceForm] = useState(emptyRaceForm);
  const [aidStations, setAidStations] = useState<AidStationDraft[]>([]);
  const [stationProducts, setStationProducts] = useState<StationProduct[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<FuelProduct[]>([]);
  const [productPickerStationId, setProductPickerStationId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productStationId, setProductStationId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "uploading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accessToken = session?.accessToken ?? null;
  const selectedMembership = memberships.find((membership) => membership.event_id === selectedEventId) ?? memberships[0] ?? null;
  const activeRace = eventDetail?.races.find((race) => race.id === activeTab) ?? null;
  const productPickerStation = productPickerStationId
    ? aidStations.find((station) => station.id === productPickerStationId) ?? null
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

  const loadEvent = async (eventId: string) => {
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
      setEventDetail({ ...data.event, races: sortedRaces });
      setEventForm({
        name: data.event.name,
        location: data.event.location ?? "",
        raceDate: formatDate(data.event.race_date),
        thumbnailUrl: data.event.thumbnail_url ?? "",
        isLive: data.event.is_live !== false,
      });
      const nextRaceId = sortedRaces.find((race) => race.id === activeTab)?.id ?? sortedRaces[0]?.id ?? "__add";
      setActiveTab(nextRaceId);
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

  useEffect(() => {
    if (!activeRace) {
      setRaceForm(emptyRaceForm);
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
    });
    void loadRaceSidecar(activeRace.id);
  }, [activeRace?.id]);

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

  const saveEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !selectedEventId) return;
    setStatus("saving");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/organizer/events/${selectedEventId}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: eventForm.name,
          location: eventForm.location,
          raceDate: eventForm.raceDate,
          thumbnailUrl: eventForm.thumbnailUrl,
          isLive: eventForm.isLive,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Impossible d'enregistrer l'evenement.");
        return;
      }
      setMessage("Evenement mis a jour.");
      await loadEvent(selectedEventId);
    } finally {
      setStatus("idle");
    }
  };

  const saveRace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken || !activeRace || !selectedEventId) return;
    setStatus("saving");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/organizer/races/${activeRace.id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: raceForm.name,
          distanceKm: raceForm.distanceKm,
          elevationGainM: raceForm.elevationGainM,
          elevationLossM: toNumberOrNull(raceForm.elevationLossM),
          locationText: raceForm.locationText,
          raceDate: raceForm.raceDate,
          thumbnailUrl: raceForm.thumbnailUrl,
          isLive: raceForm.isLive,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { message?: string } | null;
        setError(data?.message ?? "Impossible d'enregistrer le format.");
        return;
      }
      setMessage("Format mis a jour.");
      await loadEvent(selectedEventId);
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
        }),
      });
      const data = (await response.json().catch(() => null)) as { race?: RaceFormat; message?: string } | null;
      if (!response.ok || !data?.race) {
        setError(data?.message ?? "Impossible d'ajouter le format.");
        return;
      }
      setNewRaceForm(emptyRaceForm);
      setActiveTab(data.race.id);
      setMessage("Format ajoute.");
      await loadEvent(selectedEventId);
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
      await loadEvent(selectedEventId);
      await loadRaceSidecar(activeRace.id);
    } finally {
      setStatus("idle");
      event.target.value = "";
    }
  };

  const saveAidStations = async () => {
    if (!accessToken || !activeRace) return;
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
        return;
      }
      setMessage("Ravitos mis a jour.");
      await loadRaceSidecar(activeRace.id);
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

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">Verification de session...</div>;
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Dashboard organisateur</CardTitle>
            <CardDescription>Connecte-toi pour acceder aux courses claimées.</CardDescription>
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

  const pendingClaims = claims.filter((claim) => claim.status === "pending");
  const rejectedClaims = claims.filter((claim) => claim.status === "rejected");

  if (memberships.length === 0) {
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

  const tabs = [
    ...(eventDetail?.races ?? []).map((race) => ({ id: race.id, label: race.name })),
    { id: "__add", label: "+" },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand dark:text-emerald-300">
            Dashboard organisateur
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground dark:text-slate-50">
            {selectedMembership?.race_events?.name ?? eventDetail?.name ?? "Evenement"}
          </h1>
          <p className="text-sm text-muted-foreground dark:text-slate-300">
            Les changements sont publies directement. Les plans deja crees restent des snapshots.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-10 rounded-md border border-border bg-card px-3 text-sm"
            value={selectedEventId ?? ""}
            onChange={(event) => setSelectedEventId(event.target.value)}
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

      {error ? <p className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p> : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Evenement</CardTitle>
          <CardDescription>Date, lieu et visibilite de l'evenement parent.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 lg:grid-cols-[1fr_1fr_160px_auto]" onSubmit={saveEvent}>
            <div className="space-y-1">
              <Label htmlFor="event-name">Nom</Label>
              <Input id="event-name" value={eventForm.name} onChange={(event) => setEventForm((current) => ({ ...current, name: event.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-location">Lieu</Label>
              <Input id="event-location" value={eventForm.location} onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="event-date">Date</Label>
              <Input id="event-date" type="date" value={eventForm.raceDate} onChange={(event) => setEventForm((current) => ({ ...current, raceDate: event.target.value }))} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" checked={eventForm.isLive} onChange={(event) => setEventForm((current) => ({ ...current, isLive: event.target.checked }))} />
              Live
            </label>
            <div className="space-y-1 lg:col-span-3">
              <Label htmlFor="event-thumb">Image</Label>
              <Input id="event-thumb" value={eventForm.thumbnailUrl} onChange={(event) => setEventForm((current) => ({ ...current, thumbnailUrl: event.target.value }))} placeholder="https://..." />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Sauvegarde..." : "Sauvegarder"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>Formats</CardTitle>
          <CardDescription>Un onglet par ligne `races`, plus un onglet + pour ajouter un format.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <TabsList tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          {activeTab === "__add" ? (
            <RaceForm title="Ajouter un format" values={newRaceForm} onChange={setNewRaceForm} onSubmit={createRace} submitLabel="Ajouter" disabled={status === "saving"} />
          ) : activeRace ? (
            <div className="space-y-6">
              <RaceForm title="Details du format" values={raceForm} onChange={setRaceForm} onSubmit={saveRace} submitLabel="Sauvegarder le format" disabled={status === "saving"} />

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">GPX</p>
                    <p className="text-sm text-muted-foreground">
                      {activeRace.gpx_storage_path ? "GPX source present." : "Aucun GPX source pour ce format."}
                    </p>
                  </div>
                  <Input type="file" accept=".gpx,application/gpx+xml" onChange={uploadGpx} disabled={status === "uploading"} className="max-w-sm" />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">Ravitos</p>
                    <p className="text-sm text-muted-foreground">Les produits proposes sont attaches aux ravitos.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setAidStations((current) => [...current, { name: "Nouveau ravito", distanceKm: 0, waterRefill: true, solidRefill: true, assistanceAllowed: true, notes: "" }])}>
                      Ajouter un ravito
                    </Button>
                    <Button type="button" onClick={saveAidStations} disabled={status === "saving"}>
                      Sauvegarder les ravitos
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {aidStations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun ravito.</p>
                  ) : (
                    aidStations.map((station, index) => (
                      <AidStationTimelineCard
                        key={station.id ?? `new-${index}`}
                        station={station}
                        index={index}
                        onChange={(nextStation) =>
                          setAidStations((current) => current.map((item, i) => (i === index ? nextStation : item)))
                        }
                        onRemove={() => setAidStations((current) => current.filter((_, i) => i !== index))}
                        productsSlot={
                          station.id ? (
                            <StationProductsBlock
                              station={station}
                              stationProducts={stationProducts}
                              productsById={productsById}
                              onOpenProductPicker={() => {
                                setProductSearch("");
                                setProductPickerStationId(station.id as string);
                              }}
                              onRemoveProduct={(productId) => removeStationProduct(station.id as string, productId)}
                              productFormOpen={productStationId === station.id}
                              onToggleProductForm={() => setProductStationId((current) => current === station.id ? null : station.id ?? null)}
                              productForm={productForm}
                              onProductFormChange={setProductForm}
                              onCreateProduct={createStationProduct}
                              disabled={status === "saving"}
                            />
                          ) : (
                            <p className="mt-3 text-xs text-muted-foreground">Sauvegarde le ravito avant d'y ajouter des produits.</p>
                          )
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Selectionne ou ajoute un format.</p>
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
          if (productPickerStationId) attachCatalogProduct(productPickerStationId, productId);
        }}
        onClose={() => {
          setProductPickerStationId(null);
          setProductSearch("");
        }}
        disabled={status === "saving"}
      />
    </div>
  );
}

const fuelTypeLabels: Record<FuelType, string> = {
  gel: "Gel",
  drink_mix: "Boisson",
  electrolyte: "Electrolytes",
  capsule: "Capsule",
  bar: "Barre",
  real_food: "Aliment",
  other: "Autre",
};

const formatProductAmount = (value: number | undefined, unit: string) => `${Number(value ?? 0)} ${unit}`;

const getAidStationServiceLabel = (station: AidStationDraft) => {
  if (station.waterRefill && station.solidRefill) return "Eau + solide";
  if (station.waterRefill) return "Eau seulement";
  if (station.solidRefill) return "Solide seulement";
  return "Aucun service";
};

function ServicePill({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-100"
          : "border-border bg-muted text-muted-foreground dark:bg-slate-900"
      }`}
    >
      {children}
    </span>
  );
}

function ToggleChip({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
      <span>{label}</span>
    </label>
  );
}

function AidStationTimelineCard({
  station,
  index,
  onChange,
  onRemove,
  productsSlot,
}: {
  station: AidStationDraft;
  index: number;
  onChange: (station: AidStationDraft) => void;
  onRemove: () => void;
  productsSlot: ReactNode;
}) {
  const serviceLabel = getAidStationServiceLabel(station);
  const assistanceLabel = station.assistanceAllowed ? "Assistance" : "Sans assistance";

  return (
    <div className="relative pl-5 sm:pl-8">
      <div className="absolute left-7 top-16 hidden h-[calc(100%-2rem)] border-l border-dashed border-border sm:block" />
      <div className="relative z-10 rounded-2xl border-2 border-brand-border bg-card/95 px-4 py-4 shadow-md shadow-[rgba(45,80,22,0.08)] dark:border-emerald-400/60 dark:bg-slate-950/95">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <AidStationBadge step={index + 1} variant="ravito" />
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                value={station.name}
                onChange={(event) => onChange({ ...station, name: event.target.value })}
                aria-label="Nom du ravito"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Input
                  type="number"
                  step="0.1"
                  value={station.distanceKm}
                  onChange={(event) => onChange({ ...station, distanceKm: Number(event.target.value) })}
                  aria-label="Distance du ravito"
                  className="h-9 max-w-28"
                />
                <span>km</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-center">
            <ServicePill enabled={station.waterRefill || station.solidRefill}>{serviceLabel}</ServicePill>
            <ServicePill enabled={station.assistanceAllowed}>{assistanceLabel}</ServicePill>
          </div>

          <div className="flex justify-start lg:justify-end">
            <Button type="button" variant="ghost" onClick={onRemove}>
              Retirer
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            value={station.notes ?? ""}
            onChange={(event) => onChange({ ...station, notes: event.target.value })}
            placeholder="Notes ravito"
          />
          <div className="flex flex-wrap gap-2">
            <ToggleChip
              checked={station.waterRefill}
              label="Eau"
              onChange={(checked) => onChange({ ...station, waterRefill: checked })}
            />
            <ToggleChip
              checked={station.solidRefill}
              label="Solide"
              onChange={(checked) => onChange({ ...station, solidRefill: checked })}
            />
            <ToggleChip
              checked={station.assistanceAllowed}
              label="Assistance"
              onChange={(checked) => onChange({ ...station, assistanceAllowed: checked })}
            />
          </div>
        </div>

        {productsSlot}
      </div>
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
  values: typeof emptyRaceForm;
  onChange: (values: typeof emptyRaceForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  disabled?: boolean;
}) {
  return (
    <form className="rounded-lg border border-border bg-background p-4" onSubmit={onSubmit}>
      <p className="mb-3 font-semibold text-foreground">{title}</p>
      <div className="grid gap-3 lg:grid-cols-4">
        <div className="space-y-1 lg:col-span-2">
          <Label>Nom</Label>
          <Input value={values.name} onChange={(event) => onChange({ ...values, name: event.target.value })} required />
        </div>
        <div className="space-y-1">
          <Label>Distance km</Label>
          <Input type="number" step="0.1" value={values.distanceKm} onChange={(event) => onChange({ ...values, distanceKm: Number(event.target.value) })} required />
        </div>
        <div className="space-y-1">
          <Label>D+</Label>
          <Input type="number" step="1" value={values.elevationGainM} onChange={(event) => onChange({ ...values, elevationGainM: Number(event.target.value) })} required />
        </div>
        <div className="space-y-1">
          <Label>D-</Label>
          <Input type="number" step="1" value={values.elevationLossM} onChange={(event) => onChange({ ...values, elevationLossM: event.target.value })} />
        </div>
        <div className="space-y-1">
          <Label>Date optionnelle</Label>
          <Input type="date" value={values.raceDate} onChange={(event) => onChange({ ...values, raceDate: event.target.value })} />
        </div>
        <div className="space-y-1 lg:col-span-2">
          <Label>Lieu format</Label>
          <Input value={values.locationText} onChange={(event) => onChange({ ...values, locationText: event.target.value })} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" checked={values.isLive} onChange={(event) => onChange({ ...values, isLive: event.target.checked })} />
          Live
        </label>
        <div className="space-y-1 lg:col-span-3">
          <Label>Image format</Label>
          <Input value={values.thumbnailUrl} onChange={(event) => onChange({ ...values, thumbnailUrl: event.target.value })} placeholder="https://..." />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={disabled}>{submitLabel}</Button>
        </div>
      </div>
    </form>
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
  productForm: typeof emptyProductForm;
  onProductFormChange: (values: typeof emptyProductForm) => void;
  onCreateProduct: (event: FormEvent<HTMLFormElement>) => void;
  disabled?: boolean;
}) {
  const linkedProducts = station.id ? stationProducts.filter((link) => link.aidStationId === station.id) : [];

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Produits proposes</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 rounded-full border-brand-border p-0 text-brand"
            onClick={onOpenProductPicker}
            disabled={disabled}
            aria-label="Ajouter un produit existant"
            title="Ajouter un produit existant"
          >
            +
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={onToggleProductForm}>
            {productFormOpen ? "Fermer" : "Creer un produit"}
          </Button>
        </div>
      </div>
      <div className="mt-3 flex min-h-16 flex-wrap gap-2 rounded-2xl border border-dashed border-brand-border bg-brand-surface/50 p-2 dark:border-emerald-400/50 dark:bg-emerald-500/5">
        {linkedProducts.length === 0 ? (
          <p className="self-center px-2 text-xs text-muted-foreground">Aucun produit attache a ce ravito.</p>
        ) : (
          linkedProducts.map((link) => {
            const product = link.product ?? productsById.get(link.productId);
            return (
              <div key={link.productId} className="inline-flex max-w-full items-center gap-2 rounded-full border border-brand-border bg-card px-3 py-1 text-xs text-foreground dark:border-emerald-400/40 dark:bg-slate-950/70">
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
          <div className="space-y-1 md:col-span-2">
            <Label>Nom produit</Label>
            <Input value={productForm.name} onChange={(event) => onProductFormChange({ ...productForm, name: event.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label>Marque</Label>
            <Input value={productForm.brand} onChange={(event) => onProductFormChange({ ...productForm, brand: event.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <select className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm" value={productForm.fuelType} onChange={(event) => onProductFormChange({ ...productForm, fuelType: event.target.value as FuelType })}>
              {fuelTypeValues.map((fuelType) => (
                <option key={fuelType} value={fuelType}>{fuelType}</option>
              ))}
            </select>
          </div>
          <NumberInput label="Calories" value={productForm.caloriesKcal} onChange={(value) => onProductFormChange({ ...productForm, caloriesKcal: value })} />
          <NumberInput label="Glucides g" value={productForm.carbsGrams} onChange={(value) => onProductFormChange({ ...productForm, carbsGrams: value })} />
          <NumberInput label="Sodium mg" value={productForm.sodiumMg} onChange={(value) => onProductFormChange({ ...productForm, sodiumMg: value })} />
          <NumberInput label="Proteines g" value={productForm.proteinGrams} onChange={(value) => onProductFormChange({ ...productForm, proteinGrams: value })} />
          <NumberInput label="Lipides g" value={productForm.fatGrams} onChange={(value) => onProductFormChange({ ...productForm, fatGrams: value })} />
          <div className="space-y-1">
            <Label>SKU</Label>
            <Input value={productForm.sku} onChange={(event) => onProductFormChange({ ...productForm, sku: event.target.value })} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>URL produit</Label>
            <Input value={productForm.productUrl} onChange={(event) => onProductFormChange({ ...productForm, productUrl: event.target.value })} placeholder="https://..." />
          </div>
          <div className="space-y-1">
            <Label>Note ravito</Label>
            <Input value={productForm.notes} onChange={(event) => onProductFormChange({ ...productForm, notes: event.target.value })} />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={disabled}>Creer et attacher a {station.name}</Button>
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
  useEffect(() => {
    if (!station) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, station]);

  if (!station) return null;

  const normalizedSearch = search.trim().toLocaleLowerCase("fr");
  const filteredProducts = products.filter((product) => {
    if (!normalizedSearch) return true;
    return [product.name, product.brand, fuelTypeLabels[product.fuelType], product.sku]
      .filter(Boolean)
      .some((value) => String(value).toLocaleLowerCase("fr").includes(normalizedSearch));
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Fermer" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="organizer-product-picker-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border-strong bg-card shadow-2xl dark:bg-slate-950"
      >
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
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un produit, une marque ou un type"
            autoFocus
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <p className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
              Aucun produit trouve.
            </p>
          ) : (
            <div className="grid gap-3">
              {filteredProducts.map((product) => {
                const alreadyLinked = linkedProductIds.has(product.id);
                return (
                  <div
                    key={product.id}
                    className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1.5" />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Produit</span>
                      )}
                    </div>
                    <div className="min-w-0 space-y-2">
                      <div>
                        <p className="break-words text-sm font-semibold text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[product.brand, fuelTypeLabels[product.fuelType]].filter(Boolean).join(" - ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                          {formatProductAmount(product.carbsGrams, "g glucides")}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                          {formatProductAmount(product.sodiumMg, "mg sodium")}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                          {formatProductAmount(product.caloriesKcal, "kcal")}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                          {formatProductAmount(product.proteinGrams, "g proteines")}
                        </span>
                        <span className="rounded-full border border-border bg-card px-2 py-1">
                          {formatProductAmount(product.fatGrams, "g lipides")}
                        </span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={alreadyLinked ? "outline" : "default"}
                      disabled={alreadyLinked || disabled}
                      onClick={() => onAddProduct(product.id)}
                    >
                      {alreadyLinked ? "Deja ajoute" : "Ajouter"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" step="0.1" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  );
}
