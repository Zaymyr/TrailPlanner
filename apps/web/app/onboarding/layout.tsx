import React from "react";
import { OnboardingProvider } from "../../contexts/OnboardingContext";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingProvider>
      <div style={{
      width: '100vw',
      maxWidth: '430px',
      minHeight: '100dvh',
      margin: '0 auto',
      backgroundColor: '#FAF7F2',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {children}
    </div>
    </OnboardingProvider>
  )
}
