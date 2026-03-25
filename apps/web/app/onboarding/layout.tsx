import React from "react";
import { OnboardingProvider } from "../../contexts/OnboardingContext";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#FAF7F2',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
      }}>
        {children}
      </div>
    </OnboardingProvider>
  )
}
