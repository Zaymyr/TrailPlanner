import React from "react";
import { OnboardingProvider } from "../../contexts/OnboardingContext";
import { OnboardingAnalyticsTracker } from "./onboarding-analytics-tracker";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div
        className="fixed inset-0 z-[9999] flex overflow-hidden"
        style={{ backgroundColor: '#FAF7F2' }}
      >
        <OnboardingAnalyticsTracker />
        <main
          className="mx-auto flex h-full w-full max-w-[430px] min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain shadow-[0_0_40px_rgba(45,80,22,0.08)]"
          style={{ backgroundColor: '#FAF7F2' }}
        >
          {children}
        </main>
      </div>
    </OnboardingProvider>
  )
}
