"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import type { RaceCheckpoint } from "../../../contexts/OnboardingContext";

type AidStation = {
  id: string;
  name: string;
  km: number;
  order_index: number;
};

type Race = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  race_aid_stations: AidStation[];
};

function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function RacePage() {
  const router = useRouter();
  const { state, setRaceSelection, clearRaceSelection, setDistance, setElevation } = useOnboarding();

  const [races, setRaces] = useState<Race[]>([]);
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
    const supabase = getSupabaseClient();
    supabase
      .from("races")
      .select("id, name, distance_km, elevation_gain_m, race_aid_stations(id, name, km, order_index)")
      .eq("is_live", true)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (!error && data) {
          const mapped = (data as Race[]).map((r) => ({
            ...r,
            race_aid_stations: [...r.race_aid_stations].sort(
              (a, b) => a.order_index - b.order_index
            ),
          }));
          setRaces(mapped);
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

  function handleSelectRace(race: Race) {
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
      const checkpoints: RaceCheckpoint[] = selectedRace.race_aid_stations.map((s) => ({
        km: s.km,
        name: s.name,
      }));
      setRaceSelection(
        selectedRace.id,
        selectedRace.distance_km,
        selectedRace.elevation_gain_m,
        checkpoints
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
          {races.length === 0 && !loading && (
            <p className="text-center text-sm" style={{ color: "#6b7c5a" }}>
              Aucune course disponible pour le moment
            </p>
          )}

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
                    {race.elevation_gain_m} m D+
                  </span>
                  {race.race_aid_stations.length > 0 && (
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: "#f0ece6", color: "#6b7c5a" }}
                    >
                      {race.race_aid_stations.length} ravitos
                    </span>
                  )}
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
              <p
                className="mb-2 text-xs font-semibold uppercase tracking-wide"
                style={{ color: "#2D5016" }}
              >
                Points de ravitaillement
              </p>
              {selectedRace.race_aid_stations.length === 0 ? (
                <p className="text-sm" style={{ color: "#6b7c5a" }}>
                  Aucun ravito défini pour cette course
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {selectedRace.race_aid_stations.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: "#2D5016" }}
                      >
                        {s.km}
                      </div>
                      <span className="text-sm" style={{ color: "#1a2e0a" }}>
                        {s.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
