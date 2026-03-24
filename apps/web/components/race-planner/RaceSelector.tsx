"use client";

import { useState } from "react";
import type { Race } from "../../app/(coach)/race-planner/types";
import { CreateRaceForm, type CreateRaceFormValues } from "./CreateRaceForm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

type Props = {
  races: Race[];
  userId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRaceSelected: (raceId: string) => void;
  onCreateRace: (values: CreateRaceFormValues) => Promise<Race | null>;
};

export function RaceSelector({ races, isOpen, onClose, onRaceSelected, onCreateRace }: Props) {
  const [tab, setTab] = useState<"select" | "create">("select");
  const [search, setSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Only show races that have a GPX file or were created by the current user
  const available = races.filter((r) => r.gpxStoragePath || (!r.isPublic && r.createdBy));

  const filtered = search.trim()
    ? available.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : available;

  const handleCreate = async (values: CreateRaceFormValues) => {
    setIsCreating(true);
    setCreateError(null);
    const newRace = await onCreateRace(values);
    setIsCreating(false);
    if (newRace) {
      onRaceSelected(newRace.id);
      onClose();
    } else {
      setCreateError("Impossible de créer la course. Veuillez réessayer.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Choisir une course</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border px-5 pt-3">
          <button
            type="button"
            onClick={() => setTab("select")}
            className={`pb-2 text-sm font-medium transition ${
              tab === "select"
                ? "border-b-2 border-[hsl(var(--brand))] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Courses disponibles
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`pb-2 text-sm font-medium transition ${
              tab === "create"
                ? "border-b-2 border-[hsl(var(--brand))] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Créer une course
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "select" && (
            <div className="space-y-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une course…"
                autoFocus
              />
              {filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground dark:text-slate-400">
                  {available.length === 0
                    ? "Aucune course disponible. Créez votre première course."
                    : "Aucune course correspondante."}
                </p>
              )}
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{race.name}</p>
                        <p className="text-xs text-muted-foreground dark:text-slate-400">
                          {race.distanceKm} km · D+ {race.elevationGainM}m
                          {race.locationText ? ` · ${race.locationText}` : ""}
                        </p>
                      </div>
                      {!race.isPublic && (
                        <span className="shrink-0 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          Ma course
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {available.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTab("create")}
                  className="w-full rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-[hsl(var(--brand))] hover:text-foreground dark:text-slate-400"
                >
                  + Créer une nouvelle course
                </button>
              )}
            </div>
          )}

          {tab === "create" && (
            <CreateRaceForm
              onSubmit={handleCreate}
              isSubmitting={isCreating}
              error={createError}
            />
          )}
        </div>
      </div>
    </div>
  );
}
