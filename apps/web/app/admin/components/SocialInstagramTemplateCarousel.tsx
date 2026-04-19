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
  t: CarouselTranslations;
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

const SOCIAL_COPY = {
  hookEyebrow: "Plan de course",
  macroEyebrow: "L'equation du jour",
  nutritionEyebrow: "Plan ravito",
  ctaEyebrow: "A toi de jouer",
  hookQuestion: "Tu pars avec quoi en tete le jour J ?",
  hookPrompt: "Swipe pour voir les chiffres clefs, l'equation course et mon plan ravito.",
  nutritionTitle: "Ce que je vise pour tenir jusqu'au bout",
  nutritionSubtitle: "Objectifs moyens puis reprises aux ravitos les plus utiles.",
  ctaQuestion: "Et toi, tu as un plan ?",
  ctaBody: "Distance, denivele, allure, ravitos... tout se calcule. Tout se prepare.",
} as const;

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
  if (!distance || !match) return "—";
  const totalMinutes = Number(match[1]) * 60 + Number(match[2] ?? "0");
  const paceSeconds = Math.round((totalMinutes * 60) / distance);
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = paceSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function buildStationItems(text: string) {
  return text
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const match = chunk.match(/^([^:=>-]+)[:>-]+\s*(.+)$/);
      return match ? { prefix: match[1].trim(), label: match[2].trim() } : { prefix: "", label: chunk };
    });
}

function formatMetaLine(draft: SocialInstagramTemplateDraft) {
  return [draft.raceYear, draft.startDate, draft.raceLocation].filter(Boolean).join(" · ") || "Plan de course";
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
      <TopBar accent={accent} eyebrow={SOCIAL_COPY.hookEyebrow} onDark={isDark} />

      <div style={{ position: "absolute", top: "138px", left: "56px", right: "56px", zIndex: 10 }}>
        <div style={{ ...monoLabelStyle, color: isDark ? COLORS.darkMuted : accent.main }}>{formatMetaLine(draft)}</div>
        <div style={{ marginTop: "14px", maxWidth: "820px", fontSize: "74px", lineHeight: 0.95, fontWeight: 800, letterSpacing: "-0.045em" }}>
          {draft.raceName}
        </div>
        {draft.raceSubtitle ? (
          <div style={{ marginTop: "18px", maxWidth: "760px", fontSize: "30px", lineHeight: 1.15, color: isDark ? COLORS.darkMuted : COLORS.muted }}>
            {draft.raceSubtitle}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "28px" }}>
          {[
            ["Distance", draft.distanceKm ? `${draft.distanceKm} km` : "—"],
            ["D+", draft.elevationGainM ? `${draft.elevationGainM} m` : "—"],
            ["Temps cible", draft.targetTimeLabel || "—"],
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
        <div style={{ ...monoLabelStyle, color: isDark ? accent.main : "rgba(255,255,255,0.72)" }}>{SOCIAL_COPY.hookQuestion}</div>
        <div style={{ marginTop: "14px", fontSize: "50px", lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.03em" }}>{draft.tagline}</div>
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
        <div style={{ display: "inline-flex", alignItems: "center", gap: "14px", fontSize: "31px", fontWeight: 800 }}>
          <span style={{ fontSize: "34px" }}>→</span>
          <span>{draft.ctaS1 || SOCIAL_COPY.hookPrompt}</span>
        </div>
      </div>
    </article>
  );
}

function MacroSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const cards = [
    { label: "Distance", value: draft.distanceKm ? `${draft.distanceKm} km` : "—" },
    { label: "Denivele +", value: draft.elevationGainM ? `${draft.elevationGainM} m` : "—" },
    { label: "Temps prevu", value: draft.targetTimeLabel || "—" },
    { label: "Allure moyenne", value: formatPace(draft.distanceKm, draft.targetTimeLabel) },
  ];

  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />
      <TopBar accent={accent} eyebrow={SOCIAL_COPY.macroEyebrow} />

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
            {draft.targetTimeLabel || "—"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: MONO, fontSize: "18px", color: COLORS.darkMuted }}>
            {(draft.distanceKm ? `${draft.distanceKm} km` : "—") + " · " + (draft.elevationGainM ? `+${draft.elevationGainM} m` : "—")}
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
          <div key={card.label} style={{ ...cardStyle, padding: "24px 26px" }}>
            <div style={{ ...monoLabelStyle, color: accent.main }}>{card.label}</div>
            <div style={{ marginTop: "10px", fontSize: "52px", lineHeight: 0.98, fontWeight: 800, letterSpacing: "-0.035em" }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "92px",
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
            fontSize: "28px",
            fontWeight: 800,
          }}
        >
          <span style={{ marginRight: "12px", fontSize: "32px" }}>→</span>
          {draft.ctaS2}
        </div>
      </div>
    </article>
  );
}

function NutritionSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  const gels = Math.max(0, Math.round(parseNumber(draft.totalCarbsG) / (parseNumber(draft.carbsPerGelG) || 25)));
  const flasks = Math.max(0, Math.round((parseNumber(draft.totalWaterL) * 1000) / (parseNumber(draft.flaskMl) || 500)));
  const capsules = Math.max(0, Math.round((parseNumber(draft.totalSodiumG) * 1000) / (parseNumber(draft.sodiumPerCapMg) || 300)));
  const stations = draft.aidStations.slice(0, 4);

  return (
    <article style={{ ...baseSlideStyle, background: COLORS.cream, color: COLORS.text }}>
      <div style={stripeStyle()} />
      <TopBar accent={accent} eyebrow={SOCIAL_COPY.nutritionEyebrow} />

      <div
        style={{
          position: "absolute",
          top: "110px",
          left: "48px",
          right: "48px",
          height: "132px",
          background: accent.main,
          borderRadius: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          alignItems: "center",
          boxShadow: "0 14px 28px rgba(60,80,30,0.18)",
          zIndex: 10,
        }}
      >
        {[
          [`${gels}`, "GELS", `x ${draft.carbsPerGelG || "25"}g`],
          [`${flasks}`, "FLASQUES", `x ${draft.flaskMl || "500"}ml`],
          [`${capsules}`, "CAPSULES", `x ${draft.sodiumPerCapMg || "300"}mg`],
        ].map(([value, label, unit], index) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              borderRight: index < 2 ? "1px solid rgba(255,255,255,0.15)" : undefined,
            }}
          >
            <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "56px", lineHeight: 1, color: COLORS.white, letterSpacing: "-0.02em" }}>{value}</span>
            <div>
              <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: "13px", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>{label}</div>
              <div style={{ fontFamily: MONO, fontSize: "12px", color: COLORS.darkMuted, marginTop: "2px" }}>{unit}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", top: "266px", left: "48px", right: "48px", zIndex: 10 }}>
        <div style={{ ...monoLabelStyle, color: accent.main }}>{SOCIAL_COPY.nutritionTitle}</div>
        <div style={{ marginTop: "10px", fontSize: "24px", lineHeight: 1.35, color: COLORS.muted }}>{SOCIAL_COPY.nutritionSubtitle}</div>
      </div>

      <div
        style={{
          position: "absolute",
          top: "332px",
          left: "48px",
          right: "48px",
          bottom: "96px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          zIndex: 10,
        }}
      >
        {stations.length > 0 ? (
          stations.map((station, index) => {
            const items = buildStationItems(station.take);
            const visible = items.slice(0, stations.length <= 3 ? 5 : 4);
            const previous = index === 0 ? "Depart" : stations[index - 1]?.name || "Ravito precedent";

            return (
              <div key={`${station.name}-${station.km}-${index}`} style={{ ...cardStyle, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div style={{ background: accent.main, borderRadius: "8px", padding: "4px 10px", flexShrink: 0 }}>
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "13px", color: COLORS.white }}>{station.km || "—"}km</span>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: COLORS.text, minWidth: 0 }}>
                      {previous} <span style={{ color: accent.main }}>→</span> {station.name}
                    </div>
                  </div>
                  <div style={{ background: accent.light, borderRadius: "999px", padding: "4px 12px", flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: "13px", color: accent.main }}>{station.eta || "—"}</span>
                  </div>
                </div>

                {visible.map((item, itemIndex) => (
                  <div key={`${station.name}-${item.label}-${itemIndex}`} style={{ display: "grid", gridTemplateColumns: "46px 1fr", gap: "10px", alignItems: "start", padding: "3px 0" }}>
                    <div style={{ fontFamily: MONO, fontSize: "12px", color: accent.main, fontWeight: 600, textAlign: "right" }}>{item.prefix}</div>
                    <div style={{ fontSize: "16px", fontWeight: itemIndex === 0 ? 700 : 500, color: itemIndex === 0 ? COLORS.text : COLORS.muted, lineHeight: 1.2 }}>{item.label}</div>
                  </div>
                ))}

                {items.length > visible.length ? (
                  <div style={{ paddingLeft: "56px", marginTop: "2px", fontFamily: MONO, fontSize: "12px", color: COLORS.muted }}>+{items.length - visible.length} autres prises</div>
                ) : null}
              </div>
            );
          })
        ) : (
          <div style={{ ...cardStyle, padding: "24px", fontSize: "20px", color: COLORS.muted }}>Ajoute ou precise les ravitos pour enrichir ce slide.</div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "82px",
          background: accent.main,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: "30px", fontWeight: 800, color: COLORS.white, letterSpacing: ".01em" }}>Et toi, t&apos;as un plan ? →</span>
      </div>
    </article>
  );
}

function CtaSlide({ draft, accent }: { draft: SocialInstagramTemplateDraft; accent: AccentPalette }) {
  return (
    <article style={{ ...baseSlideStyle, background: accent.main, color: COLORS.white }}>
      <div style={stripeStyle(true)} />
      <TopBar accent={accent} eyebrow={SOCIAL_COPY.ctaEyebrow} onDark />

      <div style={{ position: "absolute", right: "-18px", top: "62px", fontSize: "520px", fontWeight: 800, color: "rgba(255,255,255,0.06)", lineHeight: 1, userSelect: "none", zIndex: 2, fontFamily: MONO }}>?</div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px", textAlign: "center", zIndex: 10 }}>
        <PYLogo accent={accent} size={72} onDark />
        <div style={{ width: "64px", height: "2px", background: "rgba(255,255,255,0.25)", margin: "44px auto 40px" }} />
        <div style={{ fontSize: "64px", fontWeight: 800, lineHeight: 1.15, color: COLORS.white, letterSpacing: "-0.02em", maxWidth: "800px" }}>
          Et toi, tu as
          <br />
          un <span style={{ color: accent.warm }}>plan</span> ?
        </div>
        <div style={{ fontSize: "28px", color: COLORS.darkMuted, marginTop: "20px", maxWidth: "640px", lineHeight: 1.4 }}>{SOCIAL_COPY.ctaBody}</div>
        <div style={{ marginTop: "52px", background: COLORS.white, borderRadius: "24px", padding: "28px 72px", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
          <span style={{ fontSize: "34px", fontWeight: 800, color: accent.main, letterSpacing: ".01em" }}>→ {draft.ctaS4}</span>
        </div>
        <div style={{ marginTop: "28px", fontFamily: MONO, fontSize: "22px", color: COLORS.darkMuted, letterSpacing: ".04em" }}>{draft.appHandle}</div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "80px", background: COLORS.dark, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
        <div style={{ fontFamily: MONO, fontSize: "15px", color: COLORS.darkMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>{[draft.raceName, draft.raceYear, draft.raceLocation].filter(Boolean).join(" · ")}</div>
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
