import type { CSSProperties } from "react";

import type { SocialInstagramTemplateDraft } from "../../../lib/social-instagram-template-draft";
import type { AdminTranslations } from "../../../locales/types";

export const SOCIAL_INSTAGRAM_TEMPLATE_SLIDE_WIDTH = 1080;
export const SOCIAL_INSTAGRAM_TEMPLATE_SLIDE_HEIGHT = 1080;
export const socialInstagramTemplateSlideIds = ["hook", "macro", "nutrition", "cta"] as const;

export type SocialInstagramTemplateSlideId = (typeof socialInstagramTemplateSlideIds)[number];

type CarouselTranslations = AdminTranslations["socialTemplates"]["poster"];
type AccentPalette = { main: string; light: string; warm: string };
type Props = {
  draft: SocialInstagramTemplateDraft;
  slideId: SocialInstagramTemplateSlideId;
};

const SANS = "\"DM Sans\", \"Avenir Next\", \"Segoe UI Variable\", \"Segoe UI\", sans-serif";
const MONO = "\"DM Mono\", \"IBM Plex Mono\", \"SFMono-Regular\", Consolas, monospace";
const COLORS = {
  cream: "#ece6db",
  white: "#fbfaf6",
  line: "#d7d0c3",
  text: "#1d291f",
  muted: "#677061",
  dark: "#213226",
  darkMuted: "#bcc6bc",
  progress: "#e4dccd",
} as const;
const ACCENTS: Record<SocialInstagramTemplateDraft["accentKey"], AccentPalette> = {
  forest: { main: "#335424", light: "#e2ecdf", warm: "#d8aa63" },
  moss: { main: "#2f6051", light: "#e0ece7", warm: "#ccb26b" },
  earth: { main: "#785437", light: "#efe3d9", warm: "#d3a163" },
  slate: { main: "#38506c", light: "#e2e7ee", warm: "#caa367" },
};

const baseSlideStyle: CSSProperties = {
  width: `${SOCIAL_INSTAGRAM_TEMPLATE_SLIDE_WIDTH}px`,
  height: `${SOCIAL_INSTAGRAM_TEMPLATE_SLIDE_HEIGHT}px`,
  position: "relative",
  overflow: "hidden",
  fontFamily: SANS,
};

const cardStyle: CSSProperties = {
  background: COLORS.white,
  border: `1px solid ${COLORS.line}`,
  borderRadius: "22px",
  boxShadow: "0 12px 28px rgba(44, 62, 41, 0.08)",
};

const monoLabelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
};

function stripeStyle(onDark = false): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: onDark
      ? "repeating-linear-gradient(135deg, transparent, transparent 40px, rgba(255,255,255,0.025) 40px, rgba(255,255,255,0.025) 41px)"
      : "repeating-linear-gradient(135deg, transparent, transparent 40px, rgba(0,0,0,0.013) 40px, rgba(0,0,0,0.013) 41px)",
  };
}

function parseNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPace(distanceKm: string, targetTimeLabel: string) {
  const distance = parseNumber(distanceKm);
  const match = targetTimeLabel.match(/(\d+)h\s*(\d{1,2})?/i);
  if (!distance || !match) return "-";
  const totalMinutes = Number(match[1]) * 60 + Number(match[2] ?? "0");
  const paceSeconds = Math.round((totalMinutes * 60) / distance);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function buildRaceKicker(draft: SocialInstagramTemplateDraft) {
  const shortName = draft.raceName.split(" ").slice(0, 2).join(" ").toUpperCase();
  return [shortName, draft.raceYear].filter(Boolean).join(" | ");
}

function getTitleFontSize(title: string) {
  if (title.length > 34) return "60px";
  if (title.length > 24) return "66px";
  return "74px";
}

function getProgressWidth(value: string, maxValue: number) {
  const parsed = parseNumber(value);
  if (!parsed || maxValue <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (parsed / maxValue) * 100)).toFixed(1)}%`;
}

function PYLogo({ accent, onDark = false, size = 34 }: { accent: AccentPalette; onDark?: boolean; size?: number }) {
  const color = onDark ? COLORS.white : accent.main;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <div
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: `${Math.max(1, size * 0.08)}px solid ${color}`,
          borderRadius: `${size * 0.22}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          fontWeight: 700,
          fontSize: `${size * 0.42}px`,
          color,
          letterSpacing: "-0.04em",
          flexShrink: 0,
        }}
      >
        PY
      </div>
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: `${size * 0.44}px`,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          color,
        }}
      >
        Pace Yourself
      </span>
    </div>
  );
}

function TopBar({ accent, eyebrow, onDark = false }: { accent: AccentPalette; eyebrow: string; onDark?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "96px",
        padding: "0 56px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 10,
      }}
    >
      <div style={{ ...monoLabelStyle, color: onDark ? COLORS.darkMuted : COLORS.muted }}>{eyebrow}</div>
      <PYLogo accent={accent} size={36} onDark={onDark} />
    </div>
  );
}

function HookSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const isDark = draft.darkSlide1;
  const background = isDark ? `linear-gradient(180deg, ${accent.main} 0%, ${COLORS.dark} 100%)` : COLORS.cream;
  const foreground = isDark ? COLORS.white : COLORS.text;
  const chipBackground = isDark ? "rgba(255,255,255,0.12)" : accent.light;
  const chipColor = isDark ? COLORS.white : accent.main;

  return (
    <article style={{ ...baseSlideStyle, background, color: foreground }}>
      <div style={stripeStyle(isDark)} />
      <TopBar accent={accent} eyebrow="Plan de course" onDark={isDark} />

      <div style={{ position: "absolute", top: "136px", left: "56px", right: "56px", zIndex: 10 }}>
        <div style={{ ...monoLabelStyle, color: isDark ? COLORS.darkMuted : accent.main }}>
          {[draft.raceYear, draft.startDate, draft.raceLocation].filter(Boolean).join(" | ") || "Plan de course"}
        </div>
        <div
          style={{
            marginTop: "16px",
            maxWidth: "860px",
            fontSize: getTitleFontSize(draft.raceName),
            lineHeight: 0.95,
            fontWeight: 800,
            letterSpacing: "-0.045em",
            overflowWrap: "anywhere",
          }}
        >
          {draft.raceName}
        </div>
        {draft.raceSubtitle ? (
          <div style={{ marginTop: "18px", maxWidth: "760px", fontSize: "28px", lineHeight: 1.18, color: isDark ? COLORS.darkMuted : COLORS.muted }}>
            {draft.raceSubtitle}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "28px" }}>
          {[
            ["Distance", draft.distanceKm ? `${draft.distanceKm} km` : "-"],
            ["D+", draft.elevationGainM ? `${draft.elevationGainM} m` : "-"],
            ["Temps cible", draft.targetTimeLabel || "-"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: "999px",
                padding: "12px 18px",
                background: chipBackground,
                border: isDark ? "1px solid rgba(255,255,255,0.1)" : `1px solid ${COLORS.line}`,
                color: chipColor,
              }}
            >
              <div style={{ ...monoLabelStyle, fontSize: "10px", opacity: 0.78 }}>{label}</div>
              <div style={{ marginTop: "6px", fontSize: "24px", lineHeight: 1, fontWeight: 800 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "56px",
          right: "56px",
          bottom: "146px",
          padding: "28px 30px",
          borderRadius: "26px",
          background: isDark ? COLORS.white : accent.main,
          color: isDark ? COLORS.text : COLORS.white,
          boxShadow: "0 14px 32px rgba(0,0,0,0.14)",
          zIndex: 10,
        }}
      >
        <div style={{ ...monoLabelStyle, color: isDark ? accent.main : "rgba(255,255,255,0.72)" }}>Tu pars avec quoi en tete le jour J ?</div>
        <div style={{ marginTop: "14px", fontSize: "48px", lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.03em", overflowWrap: "anywhere" }}>{draft.tagline}</div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "96px",
          background: isDark ? COLORS.white : accent.main,
          color: isDark ? accent.main : COLORS.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "14px", fontSize: "30px", fontWeight: 800 }}>
          <span style={{ fontSize: "34px" }}>-&gt;</span>
          <span>{draft.ctaS1 || "Swipe pour voir les chiffres clefs."}</span>
        </div>
      </div>
    </article>
  );
}

function MacroSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const cards = [
    { label: "Distance", value: draft.distanceKm ? `${draft.distanceKm} km` : "-" },
    { label: "Denivele +", value: draft.elevationGainM ? `${draft.elevationGainM} m` : "-" },
    { label: "Temps prevu", value: draft.targetTimeLabel || "-" },
    { label: "Allure moyenne", value: formatPace(draft.distanceKm, draft.targetTimeLabel) },
  ];

  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />
      <TopBar accent={accent} eyebrow="L'equation du jour" />

      <div
        style={{
          position: "absolute",
          top: "110px",
          left: "48px",
          right: "48px",
          height: "150px",
          background: accent.main,
          borderRadius: "22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 38px",
          color: COLORS.white,
          boxShadow: "0 18px 34px rgba(60,80,30,0.18)",
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ ...monoLabelStyle, color: "rgba(255,255,255,0.72)" }}>Temps cible</div>
          <div style={{ marginTop: "10px", fontFamily: MONO, fontWeight: 700, fontSize: "78px", lineHeight: 1, letterSpacing: "-0.025em" }}>
            {draft.targetTimeLabel || "-"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: "18px", color: COLORS.darkMuted }}>
            {(draft.distanceKm ? `${draft.distanceKm} km` : "-") + " | " + (draft.elevationGainM ? `+${draft.elevationGainM} m` : "-")}
          </div>
          <div style={{ marginTop: "8px", fontFamily: MONO, fontWeight: 600, fontSize: "28px", color: accent.warm }}>objectif</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "290px",
          left: "48px",
          right: "48px",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "14px",
          zIndex: 10,
        }}
      >
        {cards.map((card) => (
          <div key={card.label} style={{ ...cardStyle, padding: "24px 26px", minHeight: "160px" }}>
            <div style={{ ...monoLabelStyle, color: accent.main }}>{card.label}</div>
            <div style={{ marginTop: "10px", fontSize: "52px", lineHeight: 0.98, fontWeight: 800, letterSpacing: "-0.035em", overflowWrap: "anywhere" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "96px",
          background: COLORS.white,
          borderTop: `1px solid ${COLORS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            padding: "16px 42px",
            background: accent.light,
            border: `1.5px solid ${accent.main}`,
            color: accent.main,
            fontSize: "30px",
            fontWeight: 800,
          }}
        >
          <span style={{ marginRight: "12px", fontSize: "32px" }}>-&gt;</span>
          {draft.ctaS2 || "Comment manger tout ca ?"}
        </div>
      </div>
    </article>
  );
}

function NeedGauge({
  accent,
  label,
  value,
  unit,
  descriptor,
  maxLabel,
  maxValue,
}: {
  accent: AccentPalette;
  label: string;
  value: string;
  unit: string;
  descriptor: string;
  maxLabel: string;
  maxValue: number;
}) {
  return (
    <div style={{ ...cardStyle, padding: "18px 28px 16px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "18px" }}>
        <div>
          <div style={{ ...monoLabelStyle, color: accent.main }}>{label}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
            <span
              style={{
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: "64px",
                lineHeight: 1,
                color: COLORS.text,
                letterSpacing: "-0.035em",
              }}
            >
              {value || "0"}
            </span>
            <span style={{ fontFamily: MONO, fontSize: "20px", color: accent.main, fontWeight: 700 }}>{unit}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", paddingTop: "10px" }}>
          <div style={{ fontFamily: MONO, fontSize: "15px", color: COLORS.muted }}>{descriptor}</div>
          <div style={{ marginTop: "4px", fontFamily: MONO, fontSize: "17px", color: COLORS.muted }}>{maxLabel}</div>
        </div>
      </div>
      <div style={{ marginTop: "14px", height: "8px", background: COLORS.progress, borderRadius: "999px", overflow: "hidden" }}>
        <div style={{ width: getProgressWidth(value, maxValue), height: "100%", background: accent.main, borderRadius: "999px" }} />
      </div>
    </div>
  );
}

function NutritionSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />

      <div style={{ position: "absolute", top: "26px", left: "56px", right: "56px", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <div style={{ ...monoLabelStyle, color: COLORS.muted }}>{buildRaceKicker(draft) || "COURSE | ANNEE"}</div>
            <div style={{ marginTop: "14px", fontSize: "56px", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}>
              Quels sont mes besoins ?
            </div>
          </div>
          <PYLogo accent={accent} size={36} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "170px",
          left: "48px",
          right: "48px",
          height: "136px",
          background: accent.main,
          borderRadius: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          boxShadow: "0 14px 28px rgba(60,80,30,0.18)",
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ ...monoLabelStyle, color: "rgba(255,255,255,0.72)" }}>Duree de course</div>
          <div style={{ marginTop: "6px", fontFamily: MONO, fontWeight: 700, fontSize: "78px", lineHeight: 1, color: COLORS.white, letterSpacing: "-0.03em" }}>
            {draft.targetTimeLabel || "-"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: "18px", color: COLORS.darkMuted }}>
            {(draft.distanceKm ? `${draft.distanceKm} km` : "-") + " | " + (draft.elevationGainM ? `+${draft.elevationGainM} m` : "-")}
          </div>
          <div style={{ marginTop: "8px", fontFamily: MONO, fontWeight: 600, fontSize: "28px", color: COLORS.white }}>objectif</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "348px",
          left: "48px",
          right: "48px",
          display: "grid",
          gap: "14px",
          zIndex: 10,
        }}
      >
        <NeedGauge
          accent={accent}
          label="Glucides"
          value={draft.avgCarbsG}
          unit="g/h"
          descriptor="energie musculaire"
          maxLabel="max 90 g/h"
          maxValue={90}
        />
        <NeedGauge
          accent={accent}
          label="Eau"
          value={draft.avgWaterMl}
          unit="ml/h"
          descriptor="hydratation"
          maxLabel="max 800 ml/h"
          maxValue={800}
        />
        <NeedGauge
          accent={accent}
          label="Sodium"
          value={draft.avgSodiumMg}
          unit="mg/h"
          descriptor="electrolytes"
          maxLabel="max 1500 mg/h"
          maxValue={1500}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "96px",
          background: COLORS.white,
          borderTop: `1px solid ${COLORS.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            borderRadius: "999px",
            padding: "16px 42px",
            background: accent.light,
            border: `1.5px solid ${accent.main}`,
            color: accent.main,
            fontSize: "30px",
            fontWeight: 800,
          }}
        >
          <span style={{ marginRight: "12px", fontSize: "32px" }}>-&gt;</span>
          {draft.ctaS2 || "Comment manger tout ca ?"}
        </div>
      </div>
    </article>
  );
}

function CtaSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  return (
    <article style={{ ...baseSlideStyle, background: accent.main, color: COLORS.white }}>
      <div style={stripeStyle(true)} />
      <TopBar accent={accent} eyebrow="A toi de jouer" onDark />

      <div
        style={{
          position: "absolute",
          right: "-18px",
          top: "62px",
          fontSize: "520px",
          fontWeight: 800,
          color: "rgba(255,255,255,0.06)",
          lineHeight: 1,
          userSelect: "none",
          zIndex: 2,
          fontFamily: MONO,
        }}
      >
        ?
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <PYLogo accent={accent} size={72} onDark />
        <div style={{ width: "64px", height: "2px", background: "rgba(255,255,255,0.25)", margin: "44px auto 40px" }} />
        <div style={{ fontSize: "64px", fontWeight: 800, lineHeight: 1.15, color: COLORS.white, letterSpacing: "-0.02em", maxWidth: "800px" }}>
          Et toi, tu as
          <br />
          un <span style={{ color: accent.warm }}>plan</span> ?
        </div>
        <div style={{ fontSize: "28px", color: COLORS.darkMuted, marginTop: "20px", maxWidth: "640px", lineHeight: 1.4 }}>
          Distance, denivele, allure, ravitos... tout se calcule. Tout se prepare.
        </div>
        <div
          style={{
            marginTop: "52px",
            background: COLORS.white,
            borderRadius: "24px",
            padding: "28px 72px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          <span style={{ fontSize: "34px", fontWeight: 800, color: accent.main, letterSpacing: ".01em" }}>-&gt; {draft.ctaS4}</span>
        </div>
        <div style={{ marginTop: "28px", fontFamily: MONO, fontSize: "22px", color: COLORS.darkMuted, letterSpacing: ".04em" }}>{draft.appHandle}</div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "80px",
          background: COLORS.dark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: "15px", color: COLORS.darkMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>
          {[draft.raceName, draft.raceYear, draft.raceLocation].filter(Boolean).join(" | ")}
        </div>
      </div>
    </article>
  );
}

export function getSocialInstagramTemplateSlideLabel(slideId: SocialInstagramTemplateSlideId, t: CarouselTranslations) {
  switch (slideId) {
    case "hook":
      return t.slideLabels.hook;
    case "macro":
      return t.slideLabels.macro;
    case "nutrition":
      return t.slideLabels.nutrition;
    case "cta":
      return t.slideLabels.cta;
    default:
      return slideId;
  }
}

export function SocialInstagramTemplateCarousel({ draft, slideId }: Props) {
  const accent = ACCENTS[draft.accentKey] ?? ACCENTS.forest;

  switch (slideId) {
    case "hook":
      return <HookSlide draft={draft} accent={accent} />;
    case "macro":
      return <MacroSlide draft={draft} accent={accent} />;
    case "nutrition":
      return <NutritionSlide draft={draft} accent={accent} />;
    case "cta":
      return <CtaSlide draft={draft} accent={accent} />;
    default:
      return null;
  }
}
