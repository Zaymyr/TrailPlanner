"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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

const raceSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  location: z.string().nullable().optional(),
  distance_km: z.number(),
  elevation_gain_m: z.number(),
  source_url: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
});

const responseSchema = z.object({
  races: z.array(raceSchema),
});

type RaceCatalogEntry = z.infer<typeof raceSchema>;

type RaceCatalogModalProps = {
  open: boolean;
  isSubmittingId: string | null;
  copy: RacePlannerTranslations["raceCatalog"];
  onClose: () => void;
  onUseRace: (raceId: string) => void;
};

const formatNumber = (value: number, maximumFractionDigits = 0) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);

export function RaceCatalogModal({ open, isSubmittingId, copy, onClose, onUseRace }: RaceCatalogModalProps) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());

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
                    <TableHead>{copy.table.link}</TableHead>
                    <TableHead>{copy.table.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {races.map((race) => (
                    <TableRow key={race.id}>
                      <TableCell className="w-20">
                        {race.image_url ? (
                          <img
                            src={race.image_url}
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
                      <TableCell>{race.location ?? "-"}</TableCell>
                      <TableCell>
                        {race.source_url ? (
                          <a
                            href={race.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-400 hover:text-emerald-300"
                          >
                            {copy.table.viewLink}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          onClick={() => onUseRace(race.id)}
                          disabled={Boolean(isSubmittingId)}
                        >
                          {isSubmittingId === race.id ? copy.using : copy.useAction}
                        </Button>
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
