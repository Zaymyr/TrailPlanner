"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import type { RaceCheckpoint } from "../../../contexts/OnboardingContext";

type PresetRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_m: number;
  checkpoints: RaceCheckpoint[];
};

function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export default function RacePage() {
  const router = useRouter();
  const { state, setRaceSelection, clearRaceSelection, setDistance, setElevation } = useOnboarding();

  const [races, setRaces] = useState<PresetRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRaceId, setSelectedRaceId] = useState<string | null>(state.raceId);
  const [isManual, setIsManual] = useState(state.raceId === null && state.distance !== null);

  const [distanceInput, setDistanceInput] = useState(
    state.distance !== null && state.raceId === null ? String(state.distance) : ""
  );
  const [elevationInput, setElevationInput] = useState(
    state.elevation !== null && state.raceId === null ? String(state.elevation) : ""
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("preset_races")
      .select("id, name, distance_km, elevation_m, checkpoints")
      .order("distance_km", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setRaces(data as PresetRace[]);
        }
        setLoading(false);
      });
  }, []);

  const selectedRace = races.find((r) => r.id === selectedRaceId) ?? null;

  const canContinue =
    (selectedRaceId !== null && selectedRace !== null) ||
    (isManual &&
      distanceInput !== "" &&
      elevationInput !== "" &&
      Number(distanceInput) > 0 &&
      Number(elevationInput) >= 0);

  function handleSelectRace(race: PresetRace) {
    setSelectedRaceId(race.id);
    setIsManual(false);
  }

  function handleSelectManual() {
    setSelectedRaceId(null);
    setIsManual(true);
  }

  function handleContinue() {
    if (!canContinue) return;
    if (selectedRace) {
      setRaceSelection(
        selectedRace.id,
        selectedRace.distance_km,
        selectedRace.elevation_m,
        selectedRace.checkpoints
      );
    } else {
      clearRaceSelection();
      setDistance(Number(distanceInput));
      setElevation(Number(elevationInput));
    }
    router.push("/onboarding/goal");
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Ta course
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Sélectionne ta course ou saisis manuellement
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl"
              style={{ backgroundColor: "#e8e4de" }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {races.map((race) => {
            const isSelected = selectedRaceId === race.id;
            return (
              <button
                key={race.id}
                onClick={() => handleSelectRace(race)}
                className="flex w-full flex-col gap-2 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: "#ffffff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: isSelected ? "2px solid #2D5016" : "2px solid transparent",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                    {race.name}
                  </span>
                  {isSelected && (
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "#2D5016" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6L5 9L10 3"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#e8f0e0", color: "#2D5016" }}
                  >
                    {race.distance_km} km
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#e8f0e0", color: "#2D5016" }}
                  >
                    {race.elevation_m} m D+
                  </span>
                </div>
              </button>
            );
          })}

          {/* Summary card for selected race */}
          {selectedRace && (
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: "#f0f6e8",
                border: "1px solid #c8dca8",
              }}
            >
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "#2D5016" }}>
                Points de ravitaillement
              </p>
              <div className="flex flex-col gap-1.5">
                {selectedRace.checkpoints.map((cp) => (
                  <div key={cp.km} className="flex items-center gap-2">
                    <div
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: "#2D5016" }}
                    >
                      {cp.km}
                    </div>
                    <span className="text-sm" style={{ color: "#1a2e0a" }}>
                      {cp.name}
                    </span>
                    <span
                      className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: cp.type === "ravito" ? "#dff0d8" : "#d8eaf0",
                        color: cp.type === "ravito" ? "#2D5016" : "#1a4a5a",
                      }}
                    >
                      {cp.type === "ravito" ? "Ravito" : "Checkpoint"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual entry option */}
          <button
            onClick={handleSelectManual}
            className="flex w-full items-center gap-3 rounded-2xl p-4 text-left transition-all active:scale-[0.98]"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              border: isManual ? "2px solid #2D5016" : "2px solid transparent",
            }}
          >
            <span className="text-2xl">✏️</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                Saisir manuellement
              </span>
              <span className="text-sm" style={{ color: "#6b7c5a" }}>
                Entrer distance et dénivelé
              </span>
            </div>
            {isManual && (
              <div
                className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "#2D5016" }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 6L5 9L10 3"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </button>

          {/* Manual inputs */}
          {isManual && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="distance"
                  className="text-sm font-semibold"
                  style={{ color: "#1a2e0a" }}
                >
                  Distance
                </label>
                <div
                  className="flex items-center overflow-hidden rounded-2xl"
                  style={{
                    backgroundColor: "#ffffff",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    border: distanceInput ? "2px solid #2D5016" : "2px solid transparent",
                  }}
                >
                  <input
                    id="distance"
                    type="number"
                    inputMode="numeric"
                    placeholder="42"
                    value={distanceInput}
                    onChange={(e) => setDistanceInput(e.target.value)}
                    className="h-16 flex-1 bg-transparent px-5 text-2xl font-bold outline-none placeholder:font-normal placeholder:text-gray-300"
                    style={{ color: "#1a2e0a" }}
                    min="1"
                    max="500"
                  />
                  <span className="pr-5 text-base font-medium" style={{ color: "#6b7c5a" }}>
                    km
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="elevation"
                  className="text-sm font-semibold"
                  style={{ color: "#1a2e0a" }}
                >
                  Dénivelé positif
                </label>
                <div
                  className="flex items-center overflow-hidden rounded-2xl"
                  style={{
                    backgroundColor: "#ffffff",
                    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                    border: elevationInput ? "2px solid #2D5016" : "2px solid transparent",
                  }}
                >
                  <input
                    id="elevation"
                    type="number"
                    inputMode="numeric"
                    placeholder="1500"
                    value={elevationInput}
                    onChange={(e) => setElevationInput(e.target.value)}
                    className="h-16 flex-1 bg-transparent px-5 text-2xl font-bold outline-none placeholder:font-normal placeholder:text-gray-300"
                    style={{ color: "#1a2e0a" }}
                    min="0"
                    max="10000"
                  />
                  <span className="pr-5 text-base font-medium" style={{ color: "#6b7c5a" }}>
                    m
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ backgroundColor: "#2D5016" }}
        >
          Continuer
        </button>
      </div>

      <div className="h-28" />
    </div>
  );
}
