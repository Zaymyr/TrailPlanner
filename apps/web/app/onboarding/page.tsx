"use client";

import Link from "next/link";

export default function OnboardingLandingPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '40px 24px 32px',
    }}>

      {/* Icon + title */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <div style={{
          width: 56,
          height: 56,
          backgroundColor: '#2D5016',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}>
          🏔️
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{
            fontSize: 'clamp(28px, 7vw, 36px)',
            fontWeight: 900,
            lineHeight: 1.15,
            color: '#1a2e0a',
            margin: 0,
          }}>
            Ton plan ravito<br />en 30 secondes
          </h1>
          <p style={{ fontSize: 16, color: '#6b7c5a', margin: 0 }}>
            Fini l&apos;improvisation en course
          </p>
        </div>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {[
          { icon: '⚡', title: 'Calcul instantané', sub: 'Glucides, eau, sodium adaptés à ta course' },
          { icon: '🎯', title: 'Personnalisé', sub: 'Basé sur ta distance, dénivelé et objectif' },
          { icon: '🚫', title: 'Pas de compte requis', sub: 'Vois ton plan en 30 secondes, sans inscription' },
        ].map(({ icon, title, sub }) => (
          <div key={title} style={{
            backgroundColor: '#fff',
            border: '1px solid #ede8e0',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ fontWeight: 600, color: '#1a2e0a', margin: 0, fontSize: 15 }}>{title}</p>
                <p style={{ color: '#9ca3af', margin: 0, fontSize: 13, marginTop: 2 }}>{sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* CTA */}
      <div style={{
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 16,
      }}>
        <Link
          href="/onboarding/race"
          style={{
            display: 'flex',
            height: 56,
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            backgroundColor: '#2D5016',
            color: '#fff',
            fontWeight: 600,
            fontSize: 16,
            textDecoration: 'none',
          }}
        >
          Créer mon plan
        </Link>
      </div>

    </div>
  );
}
