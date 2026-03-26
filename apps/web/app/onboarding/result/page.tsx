"use client";

import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import { calculateNutrition, getCheckpoints, getInsightMessage, formatEstimatedTime, formatAveragePace } from "../../../lib/nutrition";
import { ElevationProfileChart } from "../../(coach)/race-planner/components/ElevationProfileChart";
import type { RacePlannerTranslations } from "../../../locales/types";

const ELEVATION_COPY = {
  sections: {
    courseProfile: {
      title: "",
      description: "",
      empty: "",
      sectionEmpty: "",
      axisLabel: "Altitude (m)",
      ariaLabel: "Profil du parcours",
      speedLabel: "",
      speedUnit: "km/h",
      legendClimb: "Montée",
      legendDescent: "Descente",
      startLabel: "Départ",
      finishLabel: "Arrivée",
      tooltip: {
        distance: "Distance",
        elevation: "Altitude",
        segmentGain: "D+",
        segmentLoss: "D-",
        cumulativeGain: "D+ total",
        cumulativeLoss: "D- total",
        time: "Temps",
        pace: "Allure",
        speed: "Vitesse",
        ravitoTitle: "Ravito",
        waterRefill: "Eau",
        waterRefillYes: "Oui",
        waterRefillNo: "Non",
        plannedGels: "Gels",
        plannedCarbs: "Glucides",
        plannedCalories: "Calories",
        plannedSodium: "Sodium",
        plannedWater: "Eau",
      },
    },
  },
  units: {
    hourShort: "h",
    minuteShort: "min",
    kilometer: "km",
    meter: "m",
    grams: "g",
    milliliters: "ml",
    milligrams: "mg",
  },
} as unknown as RacePlannerTranslations;

export default function ResultPage() {
  const router = useRouter();
  const { state } = useOnboarding();

  const distance = state.distance ?? 42;
  const elevation = state.elevation ?? 1500;
  const goal = state.goal ?? "comfort";

  const plan = calculateNutrition(distance, elevation, goal);
  const checkpoints = getCheckpoints(distance, elevation, goal);
  const insight = getInsightMessage(distance, elevation, goal);
  const estimatedTime = formatEstimatedTime(distance, elevation, goal);
  const averagePace = formatAveragePace(distance, elevation, goal);

  // All real aid stations + explicit finish at totalDistanceKm so the chart
  // renders "Arrivée" at the actual race end, not at the last real aid station.
  const chartAidStations = [
    ...(state.checkpoints ?? []).map((cp) => ({ name: cp.name, distanceKm: cp.km })),
    { name: "Arrivée", distanceKm: distance },
  ];

  return (
    <div className="flex flex-col gap-3 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Ton plan est prêt 🎉
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          {distance} km · {elevation} m D+
        </p>
      </div>

      {state.elevationProfile && state.elevationProfile.length > 1 && (
        <div
          className="h-[200px] overflow-visible rounded-2xl"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <ElevationProfileChart
            profile={state.elevationProfile}
            aidStations={chartAidStations}
            segments={[]}
            totalDistanceKm={distance}
            copy={ELEVATION_COPY}
            baseMinutesPerKm={null}
          />
        </div>
      )}

      <div
        className="rounded-2xl p-3"
        style={{
          background: "linear-gradient(135deg, #2D5016 0%, #4a7c25 100%)",
          boxShadow: "0 4px 16px rgba(45,80,22,0.3)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="text-xl">💡</span>
          <p className="text-sm font-medium leading-relaxed text-white">{insight}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-lg">🍬</span>
          <span className="text-base font-bold" style={{ color: "#1a2e0a" }}>{plan.carbsPerHour}g</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Glucides/h</span>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-lg">💧</span>
          <span className="text-base font-bold" style={{ color: "#1a2e0a" }}>{plan.waterPerHour}ml</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Eau/h</span>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-lg">🧂</span>
          <span className="text-base font-bold" style={{ color: "#1a2e0a" }}>{plan.sodiumPerHour}mg</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Sodium/h</span>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-lg">⏱️</span>
          <span className="text-base font-bold" style={{ color: "#1a2e0a" }}>{estimatedTime}</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Temps estimé</span>
        </div>
        <div
          className="flex items-center gap-3 rounded-2xl px-3 py-2"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <span className="text-lg">🏃</span>
          <span className="text-base font-bold" style={{ color: "#1a2e0a" }}>{averagePace}</span>
          <span className="text-xs" style={{ color: "#6b7c5a" }}>Allure moyenne</span>
        </div>
      </div>

      <div
        className="rounded-2xl p-3"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <h2 className="mb-2 text-sm font-semibold" style={{ color: "#1a2e0a" }}>
          Ravitaillements clés
        </h2>
        <div className="flex flex-col gap-2">
          {state.checkpoints
            ? state.checkpoints.map((cp) => (
                <div key={cp.km} className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#2D5016" }}
                  >
                    {cp.km}
                  </div>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: "#1a2e0a" }}>
                      {cp.name}
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: "#e8f0e0", color: "#2D5016" }}
                    >
                      km {cp.km}
                    </span>
                  </div>
                </div>
              ))
            : checkpoints.map((cp) => (
                <div key={cp.km} className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: "#2D5016" }}
                  >
                    {cp.km}
                  </div>
                  <div className="flex flex-1 items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: "#1a2e0a" }}>
                      km {cp.km}
                    </span>
                    <div className="flex gap-3 text-xs" style={{ color: "#6b7c5a" }}>
                      <span>🍬 {cp.carbs}g</span>
                      <span>💧 {cp.water}ml</span>
                    </div>
                  </div>
                </div>
              ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push("/onboarding/nutrition")}
            className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
            style={{ backgroundColor: "#2D5016" }}
          >
            Améliorer mon plan
          </button>
          <button
            onClick={() => router.push("/onboarding/account")}
            className="text-center text-sm font-medium underline underline-offset-2"
            style={{ color: "#2D5016" }}
          >
            Continuer sur l&apos;app
          </button>
        </div>
      </div>

      <div className="h-28" />
    </div>
  );
}
