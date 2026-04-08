"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "../../../contexts/OnboardingContext";
import { calculateNutrition, calculateAdjustedPace } from "../../../lib/nutrition";
import { saveOnboardingToLocalStorage, clearOnboardingFromLocalStorage } from "../../../lib/supabase-onboarding";
import { persistSessionToStorage } from "../../../lib/auth-storage";
import { buildSupabaseOAuthUrl } from "../../../lib/oauth";
import { trackOnboardingEvent } from "../../../lib/google-analytics";

// Module-level guard survives React StrictMode double-mount within the same session.
let _planSaved = false;
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.paceyourself.app";

function detectMobileDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android|iphone|ipod|ipad|mobile|windows phone/.test(userAgent);
}

export default function AccountPage() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);
  const hasSavedPlan = useRef(false);

  const distance = state.distance ?? 42;
  const elevation = state.elevation ?? 1500;
  const goal = state.goal ?? "comfort";
  const plan = calculateNutrition(distance, elevation, goal);

  const paceMinPerKm = calculateAdjustedPace(distance, elevation, goal);
  const paceMinutes = Math.floor(paceMinPerKm);
  const paceSeconds = Math.round((paceMinPerKm - paceMinutes) * 60);
  const speedKph = 60 / paceMinPerKm;

  const planData = {
    distanceKm: distance,
    elevationM: elevation,
    goal,
    eatingEase: state.eatingEase,
    sweatLevel: state.sweatLevel,
    carbsPerHour: plan.carbsPerHour,
    waterPerHour: plan.waterPerHour,
    sodiumPerHour: plan.sodiumPerHour,
    // planner fields
    paceType: "pace" as const,
    paceMinutes,
    paceSeconds,
    speedKph,
    elevationGain: elevation,
    raceDistanceKm: distance,
    targetIntakePerHour: plan.carbsPerHour,
    sodiumIntakePerHour: plan.sodiumPerHour,
    waterIntakePerHour: plan.waterPerHour,
    fuelTypes: state.fuelTypes,
  };

  const getAccountAnalyticsParams = () => ({
    distance_km: distance,
    elevation_gain_m: elevation,
    goal,
    is_mobile_device: isMobileDevice ?? undefined,
    step_name: "account",
  });

  useEffect(() => {
    setIsMobileDevice(detectMobileDevice());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    let planSaved = false;
    trackOnboardingEvent("action", {
      ...getAccountAnalyticsParams(),
      action: "signup_email_submit",
    });

    try {
      console.log("[onboarding-signup] form submitted");

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: email.split("@")[0],
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        access_token?: string;
        refresh_token?: string;
        message?: string;
        requiresEmailConfirmation?: boolean;
        user?: { id?: string };
      } | null;

      const storedState = (() => {
        try {
          const raw = localStorage.getItem("trailplanner.onboardingState");
          console.log("[onboarding-signup] onboardingState from localStorage:", raw ? "found" : "NOT FOUND");
          return raw ? JSON.parse(raw) as { race?: { id?: string; aidStations?: { name: string; distanceKm: number }[] } | null; elevationProfile?: { distanceKm: number; elevationM: number }[]; values?: Record<string, unknown> } : null;
        } catch { return null; }
      })();

      console.log("[onboarding-signup] signup response:", response.status, "user.id:", data?.user?.id, "requiresEmailConfirmation:", data?.requiresEmailConfirmation);
      console.log("[onboarding-signup] context state — raceId:", state.raceId, "checkpoints:", state.checkpoints?.length ?? 0, "elevationProfile:", state.elevationProfile?.length ?? 0);
      console.log("[onboarding-signup] all localStorage keys:", Object.keys(localStorage));

      if (!response.ok) {
        trackOnboardingEvent("error", {
          ...getAccountAnalyticsParams(),
          action: "signup_email_error",
          error_message: data?.message ?? "unknown",
          response_status: response.status,
        });
        setError(data?.message ?? "Impossible de créer le compte.");
        return;
      }

      if (data?.access_token) {
        persistSessionToStorage({ accessToken: data.access_token, refreshToken: data.refresh_token, email });
      }

      // Save plan server-side via service role so it's ready when the user confirms their email.
      // user.id is real and permanent even before email confirmation.
      const newUserId = data?.user?.id;
      if (!newUserId) {
        console.error("[onboarding-signup] no user.id in signup response — save-plan skipped", data);
      } else if (!hasSavedPlan.current && !_planSaved && !sessionStorage.getItem('onboarding_plan_saved') && !localStorage.getItem('onboarding_plan_saved')) {
        hasSavedPlan.current = true;
        _planSaved = true;
        try {
          // Prefer React context (same-session), fall back to localStorage (after page refresh)
          const rawCheckpoints =
            (state.checkpoints ?? []).length > 0
              ? state.checkpoints!.map((cp) => ({ name: cp.name, distanceKm: cp.km }))
              : (storedState?.race?.aidStations ?? []);

          // Merge computed nutrition (supplies) into aid stations when available
          const nutritionByName = Object.fromEntries(
            state.computedNutrition.map((s) => [s.name, s.nutrition]),
          );
          const aidStations = rawCheckpoints.map((cp) => ({
            name: cp.name,
            distanceKm: cp.distanceKm,
            waterRefill: true,
            supplies: (nutritionByName[cp.name] ?? []).map((n) => ({
              productId: n.productId,
              quantity: Math.ceil(n.quantity),
            })),
          }));
          const elevationProfile = state.elevationProfile?.length
            ? state.elevationProfile
            : (storedState?.elevationProfile ?? []);
          const catalogRaceId = state.raceId ?? storedState?.race?.id ?? undefined;

          console.log("[onboarding-signup] calling save-plan for userId:", newUserId, "aidStations:", aidStations.length, "catalogRaceId:", catalogRaceId);
          const planRes = await fetch("/api/onboarding/save-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: newUserId,
              name: "Mon plan de course",
              plannerValues: { ...planData, aidStations },
              elevationProfile,
              catalogRaceId,
            }),
          });
          console.log("[onboarding-signup] save-plan response:", planRes.status);
          if (planRes.ok) {
            planSaved = true;
            const { plan } = (await planRes.json().catch(() => null)) as { plan?: { id?: string } } ?? {};
            if (plan?.id) localStorage.setItem("trailplanner.pendingPlanId", plan.id);
            sessionStorage.setItem('onboarding_plan_saved', '1');
            localStorage.setItem('onboarding_plan_saved', '1');
            // Clear the onboarding localStorage keys so /sign-up page won't create a duplicate plan.
            localStorage.removeItem('trailplanner.onboardingState');
            clearOnboardingFromLocalStorage();
          }
        } catch (err) {
          hasSavedPlan.current = false;
          _planSaved = false;
          console.error("[onboarding-signup] save-plan error:", err);
        }
      }

      trackOnboardingEvent("action", {
        ...getAccountAnalyticsParams(),
        action: "signup_email_success",
        plan_saved: planSaved,
        requires_email_confirmation: Boolean(data?.requiresEmailConfirmation),
        response_status: response.status,
      });
      setConfirmed(true);
    } catch (err) {
      console.error("Sign up error", err);
      trackOnboardingEvent("error", {
        ...getAccountAnalyticsParams(),
        action: "signup_email_exception",
        error_message: err instanceof Error ? err.message : "unknown",
      });
      setError("Une erreur est survenue. Réessaie.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogleSignUp() {
    trackOnboardingEvent("action", {
      ...getAccountAnalyticsParams(),
      action: "signup_google_clicked",
    });
    saveOnboardingToLocalStorage(planData);
    try {
      const url = buildSupabaseOAuthUrl({
        provider: "google",
        redirectPath: "/auth/callback",
      });
      window.location.href = url;
    } catch (err) {
      setError("Impossible de lancer la connexion Google.");
      trackOnboardingEvent("error", {
        ...getAccountAnalyticsParams(),
        action: "signup_google_error",
        error_message: err instanceof Error ? err.message : "unknown",
      });
      console.error(err);
    }
  }

  function handleSkip() {
    trackOnboardingEvent("action", {
      ...getAccountAnalyticsParams(),
      action: "account_skip",
    });
    saveOnboardingToLocalStorage(planData);
    router.push("/app" as any);
  }

  function handleDownloadApp() {
    trackOnboardingEvent("action", {
      ...getAccountAnalyticsParams(),
      action: "download_app_clicked",
    });
    saveOnboardingToLocalStorage(planData);
    window.location.href = PLAY_STORE_URL;
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-6 px-6 pt-16 pb-8 text-center">
        <span className="text-6xl">📬</span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
            Vérifie ta boîte mail
          </h1>
          <p className="text-sm" style={{ color: "#6b7c5a" }}>
            On t&apos;a envoyé un lien de confirmation à{" "}
            <span className="font-semibold" style={{ color: "#1a2e0a" }}>
              {email}
            </span>
            . Clique dessus pour activer ton compte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-6 pt-10 pb-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold" style={{ color: "#1a2e0a" }}>
          Sauvegarde ton plan
        </h1>
        <p className="text-sm" style={{ color: "#6b7c5a" }}>
          Crée un compte pour retrouver ton plan sur tous tes appareils
        </p>
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold" style={{ color: "#1a2e0a" }}>
              Ton plan
            </span>
            <span className="text-xs" style={{ color: "#6b7c5a" }}>
              {distance} km · {elevation} m D+
            </span>
          </div>
          <div className="flex gap-3 text-sm font-medium" style={{ color: "#2D5016" }}>
            <span>🍬 {plan.carbsPerHour}g/h</span>
            <span>💧 {plan.waterPerHour}ml/h</span>
          </div>
        </div>
      </div>

      {isMobileDevice === null ? (
        <div
          className="rounded-2xl px-4 py-5 text-center text-sm"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            color: "#6b7c5a",
          }}
        >
          Chargement...
        </div>
      ) : isMobileDevice ? (
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#ffffff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          <div className="flex flex-col gap-3 text-center">
            <div className="text-4xl">📱</div>
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold" style={{ color: "#1a2e0a" }}>
                Continue dans l&apos;app mobile
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: "#6b7c5a" }}>
                Sur téléphone, c&apos;est plus simple de finaliser ton compte et retrouver ton plan
                directement dans l&apos;app Pace Yourself.
              </p>
            </div>

            <div
              className="rounded-2xl px-4 py-3 text-left text-sm"
              style={{ backgroundColor: "#f4f8ef", color: "#2D5016" }}
            >
              <div className="font-semibold">Pourquoi passer par l&apos;app ?</div>
              <div className="mt-2 flex flex-col gap-2">
                <span>• accès plus simple à tes plans pendant la course</span>
                <span>• rappels et suivi pensés pour le mobile</span>
                <span>• même compte, même expérience que sur le web</span>
              </div>
            </div>

            <button
              onClick={handleDownloadApp}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: "#2D5016" }}
            >
              <span>▶</span>
              Télécharger sur Google Play
            </button>

            <button
              onClick={handleGoogleSignUp}
              className="text-center text-sm font-medium underline underline-offset-2"
              style={{ color: "#2D5016" }}
            >
              Continuer quand même sur le web
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={handleGoogleSignUp}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border-2 text-base font-semibold transition-colors active:opacity-80"
            style={{ borderColor: "#2D5016", color: "#2D5016", backgroundColor: "#ffffff" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </button>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ backgroundColor: "#e5e7eb" }} />
            <span className="text-xs" style={{ color: "#9ca3af" }}>
              ou avec un email
            </span>
            <div className="h-px flex-1" style={{ backgroundColor: "#e5e7eb" }} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold" style={{ color: "#1a2e0a" }}>
                Email
              </label>
              <input
                type="email"
                placeholder="ton@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-14 w-full rounded-2xl px-4 text-sm outline-none transition-all"
                style={{
                  backgroundColor: "#ffffff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: email ? "2px solid #2D5016" : "2px solid transparent",
                  color: "#1a2e0a",
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold" style={{ color: "#1a2e0a" }}>
                Mot de passe
              </label>
              <input
                type="password"
                placeholder="8 caractères minimum"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="h-14 w-full rounded-2xl px-4 text-sm outline-none transition-all"
                style={{
                  backgroundColor: "#ffffff",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  border: password ? "2px solid #2D5016" : "2px solid transparent",
                  color: "#1a2e0a",
                }}
              />
            </div>

            {error && (
              <p className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: "#fef2f2", color: "#dc2626" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-60"
              style={{ backgroundColor: "#2D5016" }}
            >
              {submitting ? "Création..." : "Créer un compte"}
            </button>

            <p className="text-center text-sm" style={{ color: "#16a34a" }}>
              🎁 15 jours Premium offerts à la création de ton compte
            </p>
          </form>
        </>
      )}

      <button
        onClick={handleSkip}
        className="text-center text-sm font-medium underline underline-offset-2"
        style={{ color: "#2D5016" }}
      >
        Plus tard
      </button>
    </div>
  );
}
