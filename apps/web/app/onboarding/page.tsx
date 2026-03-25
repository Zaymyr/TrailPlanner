"use client";

import Link from "next/link";

export default function OnboardingLandingPage() {
  return (
    <div className="flex min-h-[calc(100dvh-40px)] flex-col items-center justify-center px-2 py-12">
      <div className="flex w-full flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ backgroundColor: "#2D5016" }}
          >
            🏔️
          </div>
          <h1
            className="text-3xl font-bold leading-tight tracking-tight"
            style={{ color: "#1a2e0a" }}
          >
            Ton plan ravito
            <br />
            en 30 secondes
          </h1>
          <p className="text-base" style={{ color: "#4a5e38" }}>
            Fini l&apos;improvisation en course
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <div
            className="rounded-2xl p-4 text-sm"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold" style={{ color: "#1a2e0a" }}>
                  Calcul instantané
                </p>
                <p style={{ color: "#6b7c5a" }}>
                  Glucides, eau, sodium adaptés à ta course
                </p>
              </div>
            </div>
          </div>
          <div
            className="rounded-2xl p-4 text-sm"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="font-semibold" style={{ color: "#1a2e0a" }}>
                  Personnalisé
                </p>
                <p style={{ color: "#6b7c5a" }}>
                  Basé sur ta distance, dénivelé et objectif
                </p>
              </div>
            </div>
          </div>
          <div
            className="rounded-2xl p-4 text-sm"
            style={{
              backgroundColor: "#ffffff",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            }}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚫</span>
              <div>
                <p className="font-semibold" style={{ color: "#1a2e0a" }}>
                  Pas de compte requis
                </p>
                <p style={{ color: "#6b7c5a" }}>
                  Vois ton plan en 30 secondes, sans inscription
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 px-5 pb-8 pt-4"
        style={{ backgroundColor: "#FAF7F2" }}
      >
        <Link
          href="/onboarding/race"
          className="flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: "#2D5016" }}
        >
          Créer mon plan
        </Link>
      </div>

      <div className="h-28" />
    </div>
  );
}
