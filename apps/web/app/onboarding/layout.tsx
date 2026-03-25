"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { OnboardingProvider } from "../../contexts/OnboardingContext";

const STEP_MAP: Record<string, number> = {
  "/onboarding/race": 1,
  "/onboarding/goal": 2,
  "/onboarding/loading": 3,
  "/onboarding/result": 4,
  "/onboarding/nutrition": 5,
  "/onboarding/hydration": 6,
  "/onboarding/install": 7,
  "/onboarding/account": 8,
};

const BACK_MAP: Record<string, string> = {
  "/onboarding/race": "/onboarding",
  "/onboarding/goal": "/onboarding/race",
  "/onboarding/loading": "/onboarding/goal",
  "/onboarding/result": "/onboarding/goal",
  "/onboarding/nutrition": "/onboarding/result",
  "/onboarding/hydration": "/onboarding/nutrition",
  "/onboarding/install": "/onboarding/hydration",
  "/onboarding/account": "/onboarding/install",
};

const TOTAL_STEPS = 8;

function TopoBackground() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.05]"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="topo" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
          <path
            d="M100,20 C130,20 155,45 155,75 C155,105 130,130 100,130 C70,130 45,105 45,75 C45,45 70,20 100,20 Z"
            fill="none"
            stroke="#2D5016"
            strokeWidth="1.5"
          />
          <path
            d="M100,40 C120,40 140,58 140,78 C140,98 120,116 100,116 C80,116 60,98 60,78 C60,58 80,40 100,40 Z"
            fill="none"
            stroke="#2D5016"
            strokeWidth="1.5"
          />
          <path
            d="M100,60 C112,60 125,71 125,83 C125,95 112,106 100,106 C88,106 75,95 75,83 C75,71 88,60 100,60 Z"
            fill="none"
            stroke="#2D5016"
            strokeWidth="1.5"
          />
          <path
            d="M0,160 C30,145 70,170 100,155 C130,140 170,165 200,155"
            fill="none"
            stroke="#2D5016"
            strokeWidth="1.5"
          />
          <path
            d="M0,180 C40,165 60,185 100,175 C140,165 160,185 200,175"
            fill="none"
            stroke="#2D5016"
            strokeWidth="1.5"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#topo)" />
    </svg>
  );
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const step = STEP_MAP[pathname] ?? null;
  const backPath = BACK_MAP[pathname] ?? null;
  const isLanding = pathname === "/onboarding";

  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-[#EDE8E0] flex items-center justify-center">
        <div className="
          w-full sm:max-w-[430px]
          min-h-screen sm:min-h-[844px]
          bg-[#FAF7F2]
          sm:rounded-[40px]
          sm:shadow-2xl
          relative overflow-hidden
        ">
        <TopoBackground />

        <div className="relative mx-auto flex min-h-full max-w-[430px] flex-col">
          {!isLanding && (
            <div className="flex items-center gap-3 px-5 pt-5 pb-2">
              {backPath && (
                <button
                  onClick={() => router.push(backPath as never)}
                  aria-label="Retour"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/5"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M12.5 15L7.5 10L12.5 5"
                      stroke="#2D5016"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              {step !== null && (
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(step / TOTAL_STEPS) * 100}%`,
                        backgroundColor: "#2D5016",
                      }}
                    />
                  </div>
                  <p className="text-xs text-right" style={{ color: "#2D5016", opacity: 0.6 }}>
                    {step}/{TOTAL_STEPS}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col px-5 pb-8">{children}</div>
        </div>
        </div>
      </div>
    </OnboardingProvider>
  );
}
