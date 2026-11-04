"use client";

import "mapbox-gl/dist/mapbox-gl.css";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { videoGeneratorDetailSchema, type VideoGeneratorDetail } from "../../../lib/video-generator";
import { useVerifiedSession } from "../../hooks/useVerifiedSession";
import { VideoGeneratorMap } from "./VideoGeneratorMap";
import type { VideoRaceInfo } from "./VideoCompositionOverlay";
import {
  getEventChoices,
  getRacesForEvent,
  videoGeneratorCatalogSchema,
  type VideoGeneratorCatalog,
} from "./video-generator-catalog";

type LoadState<T> =
  | { status: "idle" | "loading"; data: null; message: null }
  | { status: "success"; data: T; message: null }
  | { status: "error"; data: null; message: string };

const idleState = <T,>(): LoadState<T> => ({ status: "idle", data: null, message: null });

const readErrorMessage = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null) as { message?: unknown } | null;
  return typeof payload?.message === "string" ? payload.message : fallback;
};

const formatStartDetail = (race: VideoGeneratorDetail["race"]) => {
  const date = race.raceDate && /^\d{4}-\d{2}-\d{2}/.test(race.raceDate)
    ? new Date(`${race.raceDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })
    : null;
  const parts = [shortenPlace(race.startLocation), date, race.startTime].filter((part): part is string => Boolean(part?.trim()));
  return parts.length ? parts.join(" · ") : null;
};

/**
 * Organizer start places are often full postal addresses ("Musée de Bibracte, Mont Beuvray, 71990
 * Saint-Léger-sous-Beuvray"). The video only needs the landmark: the first part of the address.
 */
const shortenPlace = (place: string | null | undefined) => {
  const first = place?.split(/[,\n]/)[0]?.trim();
  if (!first) return null;
  return first.length > 48 ? `${first.slice(0, 47).trimEnd()}…` : first;
};

const buildVideoRaceInfo = (detail: VideoGeneratorDetail): VideoRaceInfo => {
  const { race } = detail;
  const baseTitle = race.eventName ?? race.name;
  return {
    title: race.editionYear && !baseTitle.includes(String(race.editionYear))
      ? `${baseTitle} ${race.editionYear}`
      : baseTitle,
    subtitle: race.eventName && race.eventName !== race.name ? race.name : null,
    distanceKm: race.distanceKm,
    elevationGainM: race.elevationGainM,
    startDetail: formatStartDetail(race),
    raceDate: race.raceDate,
    startTime: race.startTime,
  };
};

const formatMetric = (value: number | null | undefined, unit: string) =>
  typeof value === "number"
    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} ${unit}`
    : "—";

export default function AdminVideoGeneratorPage() {
  const { session, isLoading: sessionLoading } = useVerifiedSession();
  const accessToken = session?.accessToken ?? null;
  const [catalogState, setCatalogState] = useState<LoadState<VideoGeneratorCatalog>>(idleState);
  const [detailState, setDetailState] = useState<LoadState<VideoGeneratorDetail>>(idleState);
  const [eventId, setEventId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [detailRequestVersion, setDetailRequestVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) {
      setCatalogState(idleState());
      return;
    }

    const controller = new AbortController();
    setCatalogState({ status: "loading", data: null, message: null });

    void fetch("/api/admin/race-catalog", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readErrorMessage(response, "Impossible de charger le catalogue."));
        const parsed = videoGeneratorCatalogSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Le catalogue reçu est invalide.");
        if (!controller.signal.aborted) setCatalogState({ status: "success", data: parsed.data, message: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setCatalogState({
          status: "error",
          data: null,
          message: error instanceof Error ? error.message : "Impossible de charger le catalogue.",
        });
      });

    return () => controller.abort();
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !raceId) {
      setDetailState(idleState());
      return;
    }

    const controller = new AbortController();
    setDetailState({ status: "loading", data: null, message: null });

    void fetch(`/api/admin/video-generator/races/${raceId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readErrorMessage(response, "Impossible de charger le parcours."));
        const parsed = videoGeneratorDetailSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Les données du parcours reçues sont invalides.");
        if (!controller.signal.aborted) setDetailState({ status: "success", data: parsed.data, message: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDetailState({
          status: "error",
          data: null,
          message: error instanceof Error ? error.message : "Impossible de charger le parcours.",
        });
      });

    return () => controller.abort();
  }, [accessToken, detailRequestVersion, raceId]);

  const catalog = catalogState.status === "success" ? catalogState.data : null;
  const eventChoices = useMemo(() => catalog ? getEventChoices(catalog) : [], [catalog]);
  const raceChoices = useMemo(
    () => catalog && eventId ? getRacesForEvent(catalog, eventId) : [],
    [catalog, eventId],
  );
  const selectedCatalogRace = raceChoices.find((race) => race.id === raceId) ?? null;
  const detail = detailState.status === "success" ? detailState.data : null;
  const displayedRace = detail?.race ?? (selectedCatalogRace
    ? {
        name: selectedCatalogRace.name,
        distanceKm: selectedCatalogRace.distance_km,
        elevationGainM: selectedCatalogRace.elevation_gain_m,
        elevationLossM: selectedCatalogRace.elevation_loss_m ?? null,
      }
    : null);

  const handleEventChange = (nextEventId: string) => {
    setEventId(nextEventId);
    setRaceId("");
    setDetailState(idleState());
  };

  const renderPreviewMessage = (message: ReactNode) => (
    <>
      <section className="flex min-w-0 items-start justify-center">{message}</section>
      <Card className="hidden h-fit lg:block">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Composition vidéo</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Les réglages apparaissent une fois le parcours chargé.</p>
        </CardContent>
      </Card>
    </>
  );

  const renderMapContent = () => {
    if (!raceId) {
      return renderPreviewMessage(<MapMessage title="Sélectionnez un format" description="Choisissez un événement puis un format pour charger son parcours." />);
    }
    if (detailState.status === "loading") {
      return renderPreviewMessage(<MapMessage title="Chargement du GPX…" description="Lecture et préparation du parcours complet." loading />);
    }
    if (detailState.status === "error") {
      return renderPreviewMessage(
        <MapMessage title="Impossible de charger le parcours" description={detailState.message}>
          <Button type="button" variant="outline" onClick={() => setDetailRequestVersion((version) => version + 1)}>
            Réessayer
          </Button>
        </MapMessage>,
      );
    }
    if (!detail) return renderPreviewMessage(<MapMessage title="Parcours indisponible" description="Aucune donnée de parcours n’a été reçue." />);
    if (detail.gpx.status === "missing") {
      return renderPreviewMessage(<MapMessage title="Aucun GPX disponible" description="Ce format ne possède pas encore de fichier GPX." />);
    }

    return (
      <VideoGeneratorMap
        key={detail.race.id}
        aidStations={detail.aidStations}
        bounds={detail.gpx.bounds}
        points={detail.gpx.points}
        race={buildVideoRaceInfo(detail)}
        accessToken={accessToken ?? ""}
      />
    );
  };

  if (sessionLoading) {
    return <MapMessage title="Vérification de la session…" description="Contrôle des droits administrateur." loading />;
  }

  if (!accessToken) {
    return <MapMessage title="Session administrateur requise" description="Reconnectez-vous pour accéder au générateur vidéo 3D." />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-3 px-4 py-4 sm:px-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Administration</p>
          <h1 className="text-2xl font-semibold text-foreground">Générateur vidéo 3D</h1>
        </div>
        <Link href="/admin" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Retour à l’administration
        </Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[17rem_auto_minmax(24rem,1fr)] xl:grid-cols-[19rem_auto_minmax(28rem,1fr)]">
        <Card className="h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="video-event">Événement</Label>
              <select
                id="video-event"
                className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground"
                value={eventId}
                disabled={catalogState.status === "loading" || catalogState.status === "error"}
                onChange={(event) => handleEventChange(event.target.value)}
              >
                <option value="">Sélectionner un événement</option>
                {eventChoices.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
              </select>
              {catalogState.status === "loading" ? <p className="text-xs text-muted-foreground">Chargement du catalogue…</p> : null}
              {catalogState.status === "error" ? <p className="text-xs text-red-700">{catalogState.message}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="video-race">Format</Label>
              <select
                id="video-race"
                className="min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                value={raceId}
                disabled={!eventId}
                onChange={(event) => setRaceId(event.target.value)}
              >
                <option value="">Sélectionner un format</option>
                {raceChoices.map((race) => <option key={race.id} value={race.id}>{race.name}</option>)}
              </select>
              {eventId && raceChoices.length === 0 ? <p className="text-xs text-muted-foreground">Aucun format pour cet événement.</p> : null}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Course</p>
              <p className="mt-1 font-semibold text-foreground">{displayedRace?.name ?? "—"}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Distance" value={formatMetric(displayedRace?.distanceKm, "km")} />
              <Metric label="D+" value={formatMetric(displayedRace?.elevationGainM, "m")} />
              <Metric label="D-" value={formatMetric(displayedRace?.elevationLossM, "m")} />
              <Metric label="Ravitaillements" value={detail ? String(detail.aidStations.length) : "—"} />
            </dl>

            <div className="rounded-md border border-border bg-muted/40 p-3" aria-live="polite">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">État du GPX</p>
              <p className="mt-1 text-sm text-foreground">
                {!raceId
                  ? "En attente d’un format"
                  : detailState.status === "loading"
                    ? "Chargement…"
                    : detailState.status === "error"
                      ? "Erreur de chargement"
                      : detail?.gpx.status === "missing"
                        ? "GPX absent"
                        : detail?.gpx.status === "ready"
                          ? `${detail.gpx.pointCount.toLocaleString("fr-FR")} points chargés`
                          : "En attente"}
              </p>
            </div>
          </CardContent>
        </Card>

        {renderMapContent()}
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
function MapMessage({
  children,
  description,
  loading = false,
  title,
}: {
  children?: ReactNode;
  description: string;
  loading?: boolean;
  title: string;
}) {
  return (
    <div className="flex min-h-[34rem] h-full w-full items-center justify-center bg-muted/30 p-8 text-center">
      <div className="max-w-md">
        {loading ? <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" /> : null}
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </div>
  );
}
