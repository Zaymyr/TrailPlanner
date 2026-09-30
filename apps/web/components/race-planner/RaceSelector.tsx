"use client";

import { useState } from "react";

import type { Race } from "../../app/(planner)/race-planner/types";
import { Input } from "../ui/input";

type RetiredCreateRaceValues = {
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  location_text?: string | null;
  race_date?: string | null;
  aid_stations: Array<{ name: string; distanceKm: number; waterRefill: boolean }>;
  gpx_content?: string | null;
};

type Props = {
  races: Race[];
  userId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRaceSelected: (raceId: string) => void;
  onCreateRace: (values: RetiredCreateRaceValues) => Promise<Race | null>;
};

export function RaceSelector({ races, isOpen, onClose, onRaceSelected }: Props) {
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const available = races.filter((race) => race.isPublic && race.gpxStoragePath);
  const filtered = search.trim()
    ? available.filter((race) => race.name.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Choisir une course</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une course…"
            autoFocus
          />
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground dark:text-slate-400">
              {available.length === 0 ? "Aucune course disponible." : "Aucune course correspondante."}
            </p>
          ) : null}
          <div className="space-y-2">
            {filtered.map((race) => (
              <button
                key={race.id}
                type="button"
                onClick={() => {
                  onRaceSelected(race.id);
                  onClose();
                }}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-left transition hover:border-[hsl(var(--brand))] hover:bg-card/80"
              >
                <p className="truncate text-sm font-semibold text-foreground">{race.name}</p>
                <p className="text-xs text-muted-foreground dark:text-slate-400">
                  {race.distanceKm} km · D+ {race.elevationGainM}m
                  {race.locationText ? ` · ${race.locationText}` : ""}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
