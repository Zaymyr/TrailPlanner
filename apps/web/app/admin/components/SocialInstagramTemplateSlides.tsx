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
const BRAND_LOGO_MARK_GREEN = "/branding/pace-yourself-logo-mark-green-transparent.png";
const BRAND_LOGO_MARK_WHITE = "/branding/pace-yourself-logo-mark-white-transparent.png";
const BRAND_GREEN = "#2a5b1f";
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

const RACE_LABEL_STOPWORDS = new Set(["DE", "DU", "DES", "LA", "LE", "LES", "L", "D", "ET", "THE", "OF", "AND"]);

function buildRaceKickerLabel(draft: SocialInstagramTemplateDraft, includeLocation = false) {
  return [draft.raceName.trim(), draft.raceYear.trim(), includeLocation ? draft.raceLocation.trim() : ""].filter(Boolean).join(" | ");
}

function getAdaptiveTitleFontSize(value: string) {
  const length = value.trim().length;
  if (length > 64) return "34px";
  if (length > 48) return "40px";
  if (length > 34) return "46px";
  if (length > 24) return "54px";
  return "64px";
}

function getCompactMetaFontSize(value: string) {
  const length = value.trim().length;
  if (length > 72) return "12px";
  if (length > 52) return "14px";
  return "16px";
}

function adaptiveCourseTitleStyle(value: string, color: string): CSSProperties {
  return {
    maxWidth: "820px",
    fontSize: getAdaptiveTitleFontSize(value),
    lineHeight: 1.02,
    fontWeight: 800,
    letterSpacing: "-0.045em",
    overflowWrap: "anywhere",
    textTransform: "uppercase",
    color,
  };
}

function RaceKicker({
  draft,
  color,
  maxWidth = "660px",
  align = "left",
  includeLocation = false,
  fontSize,
}: {
  draft: SocialInstagramTemplateDraft;
  color: string;
  maxWidth?: string;
  align?: "left" | "center";
  includeLocation?: boolean;
  fontSize?: string;
}) {
  const label = buildRaceKickerLabel(draft, includeLocation) || "COURSE | ANNEE";

  return (
    <div
      style={{
        ...monoLabelStyle,
        color,
        maxWidth,
        fontSize: fontSize ?? getCompactMetaFontSize(label),
        lineHeight: 1.35,
        overflowWrap: "anywhere",
        textAlign: align,
      }}
    >
      {label}
    </div>
  );
}

function getHookHeroLabel(draft: SocialInstagramTemplateDraft) {
  const source = [draft.raceSubtitle, draft.raceName].find((value) => value.trim().length > 0) || "RACE";
  const tokens = source
    .replace(/[|/]/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const meaningfulTokens = tokens.filter((token) => !RACE_LABEL_STOPWORDS.has(token.toUpperCase()));
  const compactTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;
  const uppercaseToken = compactTokens.find((token) => /^[A-Z0-9]{3,8}$/.test(token));

  if (uppercaseToken) return uppercaseToken;
  if (compactTokens.length >= 2 && compactTokens.join(" ").length > 14) {
    return compactTokens.slice(0, 5).map((token) => token[0]).join("").toUpperCase();
  }
  if (compactTokens[0] && compactTokens[0].length <= 8) return compactTokens[0].toUpperCase();

  const initials = compactTokens.slice(0, 5).map((token) => token[0]).join("");
  return (initials || "RACE").toUpperCase();
}

function getHookHeroFontSize(label: string, hasCourseTitle = false) {
  if (hasCourseTitle) {
    if (label.length >= 8) return "132px";
    if (label.length >= 6) return "150px";
    return "172px";
  }
  if (label.length >= 8) return "188px";
  if (label.length >= 6) return "212px";
  return "244px";
}

function normalizeQuoteText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Bien manger le jour J, ça se prépare avant le départ.";
  if (trimmed.startsWith("«") || trimmed.startsWith("\"")) return trimmed;
  return `« ${trimmed} »`;
}

function getProgressWidth(value: string, maxValue: number) {
  const parsed = parseNumber(value);
  if (!parsed || maxValue <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (parsed / maxValue) * 100)).toFixed(1)}%`;
}

function formatNutritionCount(total: string, perUnit: string, multiplier = 1) {
  const totalValue = parseNumber(total) * multiplier;
  const perUnitValue = parseNumber(perUnit);

  if (!totalValue || !perUnitValue) return "-";
  return String(Math.max(1, Math.ceil(totalValue / perUnitValue)));
}

function buildAidStationLegLabel(draft: SocialInstagramTemplateDraft, index: number) {
  const current = draft.aidStations[index];
  if (!current) return "";

  const previousName = index === 0 ? "Départ" : (draft.aidStations[index - 1]?.name || "Ravito précédent");
  const currentName = current.name || `Ravito ${index + 1}`;
  return `${previousName} - ${currentName}`;
}

function buildAidStationBullets(take: string) {
  return take
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .slice(0, 3);
}

function PYLogo({ onDark = false, size = 34 }: { onDark?: boolean; size?: number }) {
  const height = Math.round(size * 1.45);
  const markSize = Math.round(size * 1.35);
  const logoColor = onDark ? COLORS.white : BRAND_GREEN;

  return (
    <div
      style={{
        height: `${height}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: `${Math.max(8, size * 0.2)}px`,
        flexShrink: 0,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        aria-hidden="true"
        alt=""
        src={onDark ? BRAND_LOGO_MARK_WHITE : BRAND_LOGO_MARK_GREEN}
        style={{
          display: "block",
          width: `${markSize}px`,
          height: `${markSize}px`,
          flexShrink: 0,
          objectFit: "contain",
        }}
      />
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: `${size * 0.42}px`,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          color: logoColor,
          whiteSpace: "nowrap",
        }}
      >
        Pace Yourself
      </span>
    </div>
  );
}

function HookSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const isDark = draft.darkSlide1;
  const heroLabel = getHookHeroLabel(draft);
  const fullRaceLabel =
    heroLabel !== draft.raceName.toUpperCase() && draft.raceName.trim().length > 0 ? draft.raceName : draft.raceSubtitle;
  const background = isDark ? `linear-gradient(180deg, ${accent.main} 0%, #234116 100%)` : COLORS.cream;
  const foreground = isDark ? COLORS.cream : COLORS.text;
  const topMetaColor = isDark ? "rgba(236,230,219,0.72)" : COLORS.muted;
  const dividerColor = isDark ? "rgba(236,230,219,0.18)" : COLORS.line;
  const pillBackground = isDark ? "#f1bb57" : accent.warm;
  const bottomBand = isDark ? "rgba(19, 35, 18, 0.55)" : COLORS.white;

  return (
    <article style={{ ...baseSlideStyle, background, color: foreground }}>
      <div style={stripeStyle(isDark)} />
      <div
        style={{
          position: "absolute",
          top: "24px",
          left: "52px",
          right: "52px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <PYLogo size={58} onDark={isDark} />
        <div style={{ fontFamily: MONO, fontSize: "18px", color: topMetaColor }}>{draft.startDate || "Plan de course"}</div>
      </div>

      <div style={{ position: "absolute", top: "192px", left: "52px", right: "52px", zIndex: 10 }}>
        {fullRaceLabel ? (
          <div style={adaptiveCourseTitleStyle(fullRaceLabel, foreground)}>{fullRaceLabel}</div>
        ) : null}
        <div
          style={{
            marginTop: fullRaceLabel ? "18px" : 0,
            maxWidth: "820px",
            fontSize: getHookHeroFontSize(heroLabel, Boolean(fullRaceLabel)),
            lineHeight: 0.88,
            fontWeight: 800,
            letterSpacing: "-0.07em",
            overflowWrap: "anywhere",
            textTransform: "uppercase",
          }}
        >
          {heroLabel}
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "138px",
            height: "76px",
            marginTop: "26px",
            padding: "0 34px",
            borderRadius: "999px",
            background: pillBackground,
            color: COLORS.text,
            fontFamily: MONO,
            fontSize: "56px",
            fontWeight: 700,
            letterSpacing: "-0.05em",
          }}
        >
          {draft.raceYear || "2025"}
        </div>

        <div style={{ width: "62px", height: "2px", background: dividerColor, marginTop: "28px" }} />
        <div
          style={{
            marginTop: "28px",
            maxWidth: "820px",
            fontSize: "26px",
            lineHeight: 1.35,
            fontWeight: 600,
            fontStyle: "italic",
            color: isDark ? "rgba(236,230,219,0.92)" : COLORS.muted,
            overflowWrap: "anywhere",
          }}
        >
          {normalizeQuoteText(draft.tagline)}
        </div>

        <div style={{ display: "flex", alignItems: "center", maxWidth: "760px", fontSize: "30px", fontWeight: 800 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              minHeight: "94px",
              gap: "14px",
              marginTop: "30px",
              padding: "18px 30px",
              borderRadius: "28px",
              background: isDark ? "rgba(255,255,255,0.1)" : accent.light,
              border: isDark ? "1px solid rgba(255,255,255,0.16)" : `1px solid ${COLORS.line}`,
              color: isDark ? COLORS.cream : accent.main,
              boxShadow: isDark ? "none" : "0 8px 20px rgba(44, 62, 41, 0.08)",
              lineHeight: 1.08,
            }}
          >
            <span style={{ fontSize: "34px", flexShrink: 0 }}>-&gt;</span>
            <span style={{ display: "block", minWidth: 0, overflowWrap: "anywhere" }}>
              {draft.ctaS1 || "Alors ca se planifie !"}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "112px",
          background: bottomBand,
          borderTop: isDark ? "1px solid rgba(255,255,255,0.06)" : `1px solid ${COLORS.line}`,
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          zIndex: 10,
        }}
      >
        {[
          ["Distance", draft.distanceKm ? `${draft.distanceKm} km` : "-"],
          ["Denivele+", draft.elevationGainM ? `+${draft.elevationGainM} m` : "-"],
        ].map(([label, value], index) => (
          <div
            key={label}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "0 52px",
              borderLeft: index === 0 ? "none" : isDark ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${COLORS.line}`,
            }}
          >
            <div style={{ ...monoLabelStyle, color: topMetaColor }}>{label}</div>
            <div style={{ marginTop: "8px", fontFamily: MONO, fontSize: "44px", lineHeight: 1, fontWeight: 700, color: foreground, letterSpacing: "-0.04em" }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function MacroSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />
      <div style={{ position: "absolute", top: "26px", left: "56px", right: "56px", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <RaceKicker draft={draft} color={COLORS.muted} />
            <div style={{ marginTop: "14px", fontSize: "52px", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.04em" }}>
              Quels sont mes besoins ?
            </div>
          </div>
          <PYLogo size={36} />
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

      <FullWidthFooterCta accent={accent} text={draft.ctaS2 || "Comment manger tout ca ?"} />
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

function FullWidthFooterCta({
  accent,
  text,
}: {
  accent: AccentPalette;
  text: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: "96px",
        background: accent.main,
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
          gap: "14px",
          fontSize: "30px",
          fontWeight: 800,
          color: COLORS.white,
        }}
      >
        <span style={{ fontSize: "34px" }}>-&gt;</span>
        <span>{text}</span>
      </div>
    </div>
  );
}

function NutritionSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const nutritionStats = [
    {
      label: "Gels",
      value: formatNutritionCount(draft.totalCarbsG, draft.carbsPerGelG),
      detail: `~ ${draft.carbsPerGelG || "25"}g`,
    },
    {
      label: "Flasques",
      value: formatNutritionCount(draft.totalWaterL, draft.flaskMl, 1000),
      detail: `~ ${draft.flaskMl || "500"}ml`,
    },
    {
      label: "Capsules",
      value: formatNutritionCount(draft.totalSodiumG, draft.sodiumPerCapMg, 1000),
      detail: `~ ${draft.sodiumPerCapMg || "300"}mg`,
    },
  ];
  const visibleStations = draft.aidStations.slice(0, 4);

  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />

      <div style={{ position: "absolute", top: "26px", left: "56px", right: "56px", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <RaceKicker draft={draft} color={COLORS.muted} />
            <div style={{ marginTop: "14px", fontSize: "44px", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.04em" }}>
              Plan de nutrition détaillé
            </div>
          </div>
          <PYLogo size={36} />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "128px",
          left: "56px",
          right: "56px",
          height: "130px",
          padding: "0 22px",
          background: accent.main,
          borderRadius: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          zIndex: 10,
        }}
      >
        {nutritionStats.map((stat, index) => (
          <div
            key={stat.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              borderLeft: index === 0 ? "none" : "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: "62px", lineHeight: 1, fontWeight: 700, color: COLORS.white, letterSpacing: "-0.04em" }}>{stat.value}</div>
            <div style={{ paddingTop: "10px" }}>
              <div style={{ ...monoLabelStyle, color: COLORS.white }}>{stat.label}</div>
              <div style={{ marginTop: "4px", fontFamily: MONO, fontSize: "15px", color: COLORS.darkMuted }}>{stat.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          top: "286px",
          left: "56px",
          right: "56px",
          zIndex: 10,
        }}
      >
        <div style={{ ...monoLabelStyle, color: COLORS.muted }}>{"Ce que je vise pour tenir jusqu'au bout"}</div>
        <div style={{ marginTop: "10px", fontSize: "24px", lineHeight: 1.25, color: COLORS.muted }}>
          Objectifs moyens puis reprises aux ravitos les plus utiles.
        </div>

        <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
          {visibleStations.length > 0 ? (
            visibleStations.map((station, index) => {
              const bullets = buildAidStationBullets(station.take);

              return (
                <div
                  key={`${station.name}-${station.km}-${index}`}
                  style={{
                    ...cardStyle,
                    minHeight: "118px",
                    padding: "16px 18px",
                    borderRadius: "18px",
                    boxShadow: "0 10px 24px rgba(44, 62, 41, 0.05)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        minWidth: "54px",
                        height: "28px",
                        padding: "0 10px",
                        borderRadius: "999px",
                        background: accent.main,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: COLORS.white,
                        fontFamily: MONO,
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {station.km ? `${station.km}k` : `R${index + 1}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, fontSize: "20px", fontWeight: 700, lineHeight: 1.2, overflowWrap: "anywhere" }}>
                      {buildAidStationLegLabel(draft, index)}
                    </div>
                    <div
                      style={{
                        marginLeft: "auto",
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: accent.light,
                        color: accent.main,
                        fontFamily: MONO,
                        fontSize: "13px",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {station.eta || "--"}
                    </div>
                  </div>

                  <div style={{ marginTop: "10px", display: "grid", gap: "6px" }}>
                    {bullets.length > 0 ? (
                      bullets.map((bullet) => (
                        <div key={bullet} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "17px", lineHeight: 1.32, color: COLORS.text }}>
                          <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: accent.main, marginTop: "8px", flexShrink: 0 }} />
                          <span style={{ overflowWrap: "anywhere" }}>{bullet}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "17px", lineHeight: 1.32, color: COLORS.muted }}>
                        {"Aucun détail de reprise n'est renseigné pour ce ravito."}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ ...cardStyle, padding: "22px 24px", borderRadius: "18px" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: COLORS.text }}>{"Aucun ravito détaillé pour l'instant."}</div>
              <div style={{ marginTop: "8px", fontSize: "18px", lineHeight: 1.35, color: COLORS.muted }}>
                {"Tu peux completer cette slide depuis l'editeur Admin si tu veux ajouter les reprises clefs."}
              </div>
            </div>
          )}
        </div>
      </div>

      <FullWidthFooterCta accent={accent} text="Et toi, t'as un plan ?" />
    </article>
  );
}

function CtaSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  return (
    <article style={{ ...baseSlideStyle, background: accent.main, color: COLORS.white }}>
      <div style={stripeStyle(true)} />
      <div
        style={{
          position: "absolute",
          right: "-34px",
          top: "98px",
          fontSize: "560px",
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
          top: "42px",
          left: "56px",
          right: "56px",
          height: "88px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <div
          style={{
            ...monoLabelStyle,
            color: COLORS.darkMuted,
            fontSize: "22px",
            lineHeight: 1,
            letterSpacing: ".14em",
          }}
        >
          A toi de jouer
        </div>
        <PYLogo size={58} onDark />
      </div>

      <div
        style={{
          position: "absolute",
          left: "72px",
          right: "72px",
          top: "202px",
          zIndex: 10,
        }}
      >
        <div style={{ width: "76px", height: "3px", background: "rgba(255,255,255,0.28)", marginBottom: "42px" }} />
        <div style={{ fontSize: "92px", fontWeight: 800, lineHeight: 1.03, color: COLORS.white, letterSpacing: "-0.025em", maxWidth: "760px" }}>
          Et toi, tu as
          <br />
          un <span style={{ color: accent.warm }}>plan</span> ?
        </div>
        <div style={{ fontSize: "38px", color: COLORS.darkMuted, marginTop: "30px", maxWidth: "820px", lineHeight: 1.26 }}>
          Distance, dénivelé, allure, ravitos... tout se calcule. Tout se prépare.
        </div>
        <div
          style={{
            marginTop: "62px",
            background: COLORS.white,
            borderRadius: "28px",
            minHeight: "112px",
            width: "820px",
            maxWidth: "100%",
            padding: "24px 46px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          }}
        >
          <span style={{ fontSize: "38px", fontWeight: 800, lineHeight: 1.1, color: accent.main, letterSpacing: ".01em", overflowWrap: "anywhere" }}>
            -&gt; {draft.ctaS4}
          </span>
        </div>
        <div style={{ marginTop: "30px", fontFamily: MONO, fontSize: "28px", color: COLORS.darkMuted, letterSpacing: ".04em" }}>{draft.appHandle}</div>
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
        <RaceKicker draft={draft} color={COLORS.darkMuted} maxWidth="940px" align="center" includeLocation fontSize="18px" />
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
