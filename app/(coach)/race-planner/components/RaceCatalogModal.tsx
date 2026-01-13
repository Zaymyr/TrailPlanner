"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import type { RacePlannerTranslations } from "../../../../locales/types";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { RaceCatalogAdminForm } from "./RaceCatalogAdminForm";

const raceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  location_text: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  elevation_loss_m: z.number().nullable().optional(),
  trace_provider: z.string().nullable().optional(),
  trace_id: z.number().nullable().optional(),
  external_site_url: z.string().nullable().optional(),
  thumbnail_url: z.string().nullable().optional(),
  gpx_storage_path: z.string().nullable().optional(),
});

const responseSchema = z.object({
  races: z.array(raceSchema),
});

type RaceCatalogModalProps = {
  open: boolean;
  isSubmittingId: string | null;
  accessToken?: string;
  isAdmin?: boolean;
  copy: RacePlannerTranslations["raceCatalog"];
  onClose: () => void;
  onUseRace: (raceId: string) => void;
};

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);

export function RaceCatalogModal({
  open,
  isSubmittingId,
  accessToken,
  isAdmin = false,
  copy,
  onClose,
  onUseRace,
}: RaceCatalogModalProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [updatingRaceId, setUpdatingRaceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["race-catalog", deferredSearch],
    queryFn: async () => {
      const searchParam = deferredSearch ? `?search=${encodeURIComponent(deferredSearch)}` : "";
      const response = await fetch(`/api/race-catalog${searchParam}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Unable to load race catalog");
      }
      const payload = await response.json();
      return responseSchema.parse(payload);
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const races = useMemo(() => query.data?.races ?? [], [query.data?.races]);
  const handleAdminCreated = (message?: string) => {
    setAdminError(null);
    setAdminMessage(message ?? copy.admin.messages.created);
    void queryClient.invalidateQueries({ queryKey: ["race-catalog"] });
  };

  const handleAdminError = (message?: string) => {
    setAdminMessage(null);
    setAdminError(message && message.length > 0 ? message : null);
  };
  const handleUpdateMutation = useMutation({
    mutationFn: async ({ raceId, file }: { raceId: string; file: File }) => {
      if (!accessToken) {
        throw new Error(copy.admin.errors.authRequired);
      }
      const formData = new FormData();
      formData.append("gpx", file);
      const response = await fetch(`/api/race-catalog/${raceId}/gpx`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken ?? ""}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? copy.admin.errors.updateFailed);
      }
      return response.json();
    },
    onMutate: () => {
      setAdminMessage(null);
      setAdminError(null);
    },
    onSuccess: () => {
      setAdminError(null);
      setAdminMessage(copy.admin.messages.updated);
      void queryClient.invalidateQueries({ queryKey: ["race-catalog"] });
    },
    onError: (error) => {
      setAdminMessage(null);
      setAdminError(error instanceof Error ? error.message : copy.admin.errors.updateFailed);
    },
    onSettled: () => {
      setUpdatingRaceId(null);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-5xl">
        <Card className="border border-border bg-card text-foreground shadow-xl">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{copy.title}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
            </div>
            <Button variant="outline" onClick={onClose} className="h-9 px-3 text-xs">
              {copy.close}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <RaceCatalogAdminForm
                accessToken={accessToken}
                copy={copy.admin}
                onCreated={handleAdminCreated}
                onError={handleAdminError}
              />
            ) : null}
            {isAdmin && adminMessage ? <p className="text-sm text-emerald-400">{adminMessage}</p> : null}
            {isAdmin && adminError ? <p className="text-sm text-red-500">{adminError}</p> : null}
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
              className="h-9 text-sm"
            />
            {query.isLoading ? <p className="text-sm text-muted-foreground">{copy.loading}</p> : null}
            {query.isError ? <p className="text-sm text-red-500">{copy.loadError}</p> : null}
            {!query.isLoading && races.length === 0 ? (
              <p className="text-sm text-muted-foreground">{copy.empty}</p>
            ) : null}

            {races.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.table.image}</TableHead>
                    <TableHead>{copy.table.name}</TableHead>
                    <TableHead>{copy.table.distance}</TableHead>
                    <TableHead>{copy.table.elevation}</TableHead>
                    <TableHead>{copy.table.location}</TableHead>
                    <TableHead>{copy.table.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {races.map((race) => (
                    <TableRow key={race.id}>
                      <TableCell className="w-20">
                        {race.thumbnail_url ? (
                          <img
                            src={race.thumbnail_url}
                            alt={race.name}
                            className="h-12 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                            {copy.table.noImage}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold">{race.name}</TableCell>
                      <TableCell>
                        {formatNumber(race.distance_km, 1)} {copy.units.kilometer}
                      </TableCell>
                      <TableCell>
                        {formatNumber(race.elevation_gain_m)} {copy.units.meter}
                      </TableCell>
                      <TableCell>{race.location_text ?? race.location ?? "-"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {race.trace_id ? (
                            <a
                              href={`https://tracedetrail.fr/fr/trace/${race.trace_id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                            >
                              {copy.table.openTrace}
                            </a>
                          ) : null}
                          <Button
                            type="button"
                            className="h-8 px-3 text-xs"
                            onClick={() => onUseRace(race.id)}
                            disabled={Boolean(isSubmittingId) || !race.gpx_storage_path}
                          >
                            {isSubmittingId === race.id
                              ? copy.using
                              : race.gpx_storage_path
                                ? copy.useAction
                                : copy.table.noGpx}
                          </Button>
                          {isAdmin ? (
                            <>
                              <input
                                id={`race-gpx-${race.id}`}
                                type="file"
                                accept=".gpx,application/gpx+xml"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;
                                  setUpdatingRaceId(race.id);
                                  handleUpdateMutation.mutate({ raceId: race.id, file });
                                  event.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="h-8 px-3 text-xs"
                                onClick={() => document.getElementById(`race-gpx-${race.id}`)?.click()}
                                disabled={updatingRaceId === race.id}
                              >
                                {updatingRaceId === race.id ? copy.admin.updating : copy.admin.updateAction}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
