"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = [
  "Analyse de ta course",
  "Optimisation énergétique",
  "Distribution des ravitaillements",
  "Ajustements finaux",
];

export default function LoadingPage() {
  const router = useRouter();
  const [visibleSteps, setVisibleSteps] = useState<number[]>([]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEPS.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleSteps((prev) => [...prev, index]);
        }, index * 800)
      );
    });

    const redirectTimer = setTimeout(() => {
      router.push("/onboarding/result");
    }, STEPS.length * 800 + 600);

    timers.push(redirectTimer);

    return () => timers.forEach(clearTimeout);
  }, [router]);

  return (
    <div className="flex min-h-[calc(100dvh-120px)] flex-col items-center justify-center gap-8 px-6 pt-10 pb-8">
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: "#2D5016" }}
        >
          <svg
            className="h-8 w-8 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold" style={{ color: "#1a2e0a" }}>
          Calcul de ton plan...
        </h1>
      </div>

      <div
        className="w-full rounded-2xl p-5"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex flex-col gap-3">
          {STEPS.map((step, index) => (
            <div
              key={step}
              className="flex items-center gap-3 transition-all duration-500"
              style={{
                opacity: visibleSteps.includes(index) ? 1 : 0,
                transform: visibleSteps.includes(index) ? "translateY(0)" : "translateY(8px)",
              }}
            >
              <div
                className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: visibleSteps.includes(index) ? "#2D5016" : "#e5e7eb",
                }}
              >
                {visibleSteps.includes(index) ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6L5 9L10 3"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <div className="h-2 w-2 rounded-full bg-gray-300" />
                )}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: visibleSteps.includes(index) ? "#1a2e0a" : "#9ca3af" }}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
