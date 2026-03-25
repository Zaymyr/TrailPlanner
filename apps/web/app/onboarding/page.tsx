"use client";

import Link from "next/link";

export default function OnboardingLandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Top: icon + title */}
      <div className="flex flex-col items-center gap-4 pt-10 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ backgroundColor: "#2D5016" }}
        >
          🏔️
        </div>
        <div className="flex flex-col gap-2">
          <h1
            className="text-4xl font-black leading-tight tracking-tight"
            style={{ color: "#1a2e0a" }}
          >
            Ton plan ravito
            <br />
            en 30 secondes
          </h1>
          <p className="text-lg" style={{ color: "#6b7c5a" }}>
            Fini l&apos;improvisation en course
          </p>
        </div>
      </div>

      {/* Middle: feature cards — fills remaining space */}
      <div className="flex flex-1 flex-col justify-center gap-3 py-8">
        <div
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                Calcul instantané
              </p>
              <p className="text-sm text-gray-400">
                Glucides, eau, sodium adaptés à ta course
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                Personnalisé
              </p>
              <p className="text-sm text-gray-400">
                Basé sur ta distance, dénivelé et objectif
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <span className="text-2xl">🚫</span>
            <div>
              <p className="text-base font-semibold" style={{ color: "#1a2e0a" }}>
                Pas de compte requis
              </p>
              <p className="text-sm text-gray-400">
                Vois ton plan en 30 secondes, sans inscription
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: CTA */}
      <div className="mt-auto">
        <Link
          href="/onboarding/race"
          className="flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
          style={{ backgroundColor: "#2D5016" }}
        >
          Créer mon plan
        </Link>
      </div>
    </div>
  );
}
