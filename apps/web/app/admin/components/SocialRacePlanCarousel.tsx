import type { CSSProperties } from "react";

import type { AdminTranslations } from "../../../locales/types";
import type { SocialRacePlanTemplate } from "../../../lib/social-race-plan-template";

export const SOCIAL_RACE_PLAN_SLIDE_WIDTH = 1080;
export const SOCIAL_RACE_PLAN_SLIDE_HEIGHT = 1350;
export const socialRacePlanSlideIds = ["hook", "macro", "nutrition", "cta"] as const;

export type SocialRacePlanSlideId = (typeof socialRacePlanSlideIds)[number];

type CarouselTranslations = AdminTranslations["socialTemplates"]["poster"];

type Props = {
  template: SocialRacePlanTemplate;
  t: CarouselTranslations;
  slideId: SocialRacePlanSlideId;
};

const BRAND_NAME = "Pace Yourself";
const BRAND_SITE = "pace-yourself.app";
const SOCIAL_COPY = {
  eyebrow: "Plan course",
  fallbackBadge: "Estimation",
  hookTitle: "Mon plan pour ne pas subir la course.",
  hookBody: "Swipe pour voir les chiffres clefs, mes cibles nutritionnelles et ce que je reprends aux ravitos.",
  hookScrollCta: "Swipe pour voir tout le plan course",
  macroTitle: "Les chiffres a avoir en tete",
  macroBody: "Distance, D+, temps prevu et allure moyenne. Le resume utile avant le depart.",
  nutritionTitle: "Mes cibles pour tenir la distance",
  nutritionBody: "Ce que je vise par heure, puis ce que je recupere aux ravitos importants.",
  keyAidStationsTitle: "Ce que je recupere aux ravitos",
  aidStationsSubtitle: "Le resume des points de passage les plus importants.",
  noAidStations: "Ajoute ou precise les ravitos pour enrichir ce slide.",
  assumptionsTitle: "Repere",
  ctaSlideTitle: "Tu veux le meme niveau de clarte ?",
  ctaSlideBody: "Pace Yourself transforme ton parcours et tes objectifs en plan ravito clair, partageable et exportable.",
  disclaimerTitle: "A retenir",
} as const;

const formatText = (value: string | null) => value?.trim() || "-";
const formatMetric = (value: number | null, suffix: string) => (value === null ? "-" : `${value}${suffix}`);
const formatRate = (value: number | null, suffix: string) => (value === null ? "-" : `${value}${suffix}/h`);

const joinDefinedText = (parts: Array<string | null | undefined>) =>
  parts.filter((part) => part && part !== "-").join(" | ");

const baseSlideStyle = (background: string, foreground = "#10231a"): CSSProperties => ({
  position: "relative",
  overflow: "hidden",
  width: `${SOCIAL_RACE_PLAN_SLIDE_WIDTH}px`,
  height: `${SOCIAL_RACE_PLAN_SLIDE_HEIGHT}px`,
  padding: "52px",
  borderRadius: "40px",
  background,
  color: foreground,
  boxShadow: "0 30px 80px rgba(15,23,42,0.18)",
  border: "1px solid rgba(16,35,26,0.08)",
  fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "24px",
});

const glassPanelStyle: CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(16,35,26,0.1)",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: "0 16px 30px rgba(16,35,26,0.06)",
  backdropFilter: "blur(10px)",
};

const darkPanelStyle: CSSProperties = {
  background: "rgba(12,32,23,0.92)",
  border: "1px solid rgba(245,242,232,0.12)",
  borderRadius: "28px",
  padding: "24px",
  color: "#f5f2e8",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "9999px",
  padding: "10px 16px",
  background: "#123524",
  color: "#f5f2e8",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontSize: "12px",
  fontWeight: 800,
};

const sectionLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#557765",
};

const serifTitleStyle: CSSProperties = {
  margin: 0,
  fontFamily: "\"Iowan Old Style\", \"Palatino Linotype\", \"Book Antiqua\", Georgia, serif",
  fontWeight: 800,
  letterSpacing: "-0.04em",
};

function formatAveragePaceLabel(targetMinutes: number | null, distanceKm: number | null) {
  if (targetMinutes === null || distanceKm === null || distanceKm <= 0) return "-";

  const totalSeconds = Math.round((targetMinutes * 60) / distanceKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}/km`;
}

function buildItemSummary(item: SocialRacePlanTemplate["startCarry"]["items"][number], t: CarouselTranslations) {
  const metrics: string[] = [];
  const quantityLabel = item.quantity !== null ? t.quantity.replace("{count}", String(item.quantity)) : null;

  if (item.carbsG !== null) metrics.push(`${item.carbsG}g ${t.carbsShort}`);
  if (item.waterMl !== null) metrics.push(`${item.waterMl}ml ${t.waterShort}`);
  if (item.sodiumMg !== null) metrics.push(`${item.sodiumMg}mg ${t.sodiumShort}`);

  const metricsLabel = metrics.join(" | ");

  if (item.kind === "product") {
    if (quantityLabel && metricsLabel) return `${quantityLabel} ${item.label} | ${metricsLabel}`;
    if (quantityLabel) return `${quantityLabel} ${item.label}`;
    if (metricsLabel) return `${item.label} | ${metricsLabel}`;
    return item.label;
  }

  return metricsLabel || item.note || item.label;
}

function buildStationPreview(station: SocialRacePlanTemplate["aidStations"][number], t: CarouselTranslations) {
  const summary = station.take.items
    .slice(0, 2)
    .map((item) => buildItemSummary(item, t) || item.note || item.label)
    .filter(Boolean)
    .join(" | ");

  return summary || t.noDetails;
}

function SlideMetric({
  label,
  value,
  accent,
  valueColor,
}: {
  label: string;
  value: string;
  accent?: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        ...glassPanelStyle,
        padding: "20px",
        background: accent ?? glassPanelStyle.background,
      }}
    >
      <p style={sectionLabelStyle}>{label}</p>
      <p
        style={{
          margin: "12px 0 0 0",
          fontSize: "34px",
          fontWeight: 800,
          lineHeight: 1.05,
          color: valueColor ?? "inherit",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function SlideCounter({ index, dark = false }: { index: number; dark?: boolean }) {
  return (
    <div
      style={{
        borderRadius: "9999px",
        padding: "10px 14px",
        background: dark ? "rgba(245,242,232,0.12)" : "rgba(255,255,255,0.78)",
        color: dark ? "#f5f2e8" : "#37624b",
        fontSize: "12px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {`${String(index + 1).padStart(2, "0")} / ${String(socialRacePlanSlideIds.length).padStart(2, "0")}`}
    </div>
  );
}

function SlideProgressBars({ activeIndex, dark = false }: { activeIndex: number; dark?: boolean }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {socialRacePlanSlideIds.map((slideId, index) => (
        <div
          key={slideId}
          style={{
            height: "6px",
            width: index === activeIndex ? "44px" : "22px",
            borderRadius: "9999px",
            background:
              index === activeIndex
                ? dark
                  ? "#f5f2e8"
                  : "#123524"
                : dark
                  ? "rgba(245,242,232,0.22)"
                  : "rgba(18,53,36,0.16)",
            transition: "all 160ms ease",
          }}
        />
      ))}
    </div>
  );
}

function SlideTopBadges({
  t,
  index,
  showFallbackBadge,
  dark = false,
}: {
  t: CarouselTranslations;
  index: number;
  showFallbackBadge: boolean;
  dark?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <p style={eyebrowStyle}>{SOCIAL_COPY.eyebrow}</p>
        {showFallbackBadge ? (
          <span
            style={{
              borderRadius: "9999px",
              padding: "10px 14px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#fff4d9",
              color: "#8a5a12",
            }}
          >
            {SOCIAL_COPY.fallbackBadge}
          </span>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            borderRadius: "9999px",
            padding: "10px 14px",
            background: dark ? "rgba(245,242,232,0.12)" : "rgba(255,255,255,0.78)",
            color: dark ? "#f5f2e8" : "#37624b",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          {BRAND_NAME}
        </div>
        <SlideCounter index={index} dark={dark} />
      </div>
    </div>
  );
}

function HookSlide({ template, t }: { template: SocialRacePlanTemplate; t: CarouselTranslations }) {
  const averagePaceLabel = formatAveragePaceLabel(template.race.targetTime.minutes, template.race.distanceKm);
  const planSubtitle = template.plan.name !== template.race.name ? template.plan.name : null;
  const metaChips = [
    formatMetric(template.race.distanceKm, " km"),
    formatMetric(template.race.elevationGainM, " m D+"),
    formatText(template.race.targetTime.label),
    averagePaceLabel,
  ].filter((value) => value !== "-");
  const teaserCards = [
    {
      label: t.slideLabels.macro,
      value: joinDefinedText([
        formatMetric(template.race.distanceKm, " km"),
        formatMetric(template.race.elevationGainM, " m D+"),
      ]),
    },
    {
      label: t.targetTimeLabel,
      value: joinDefinedText([formatText(template.race.targetTime.label), averagePaceLabel]),
    },
    {
      label: t.slideLabels.nutrition,
      value: joinDefinedText([
        formatRate(template.averagesPerHour.carbsG, "g"),
        formatRate(template.averagesPerHour.waterMl, "ml"),
      ]),
    },
  ];

  return (
    <article style={baseSlideStyle("linear-gradient(180deg, #f6efe5 0%, #ebf6ef 48%, #f7f2ea 100%)")}>
      <div style={{ position: "absolute", top: "-120px", right: "-60px", width: "330px", height: "330px", borderRadius: "9999px", background: "rgba(39,140,94,0.16)", filter: "blur(10px)" }} />
      <div style={{ position: "absolute", bottom: "-110px", left: "-90px", width: "280px", height: "280px", borderRadius: "9999px", background: "rgba(242,187,98,0.16)", filter: "blur(10px)" }} />

      <SlideTopBadges t={t} index={0} showFallbackBadge={template.missingData.length > 0} />

      <section style={{ position: "relative", zIndex: 1, maxWidth: "860px" }}>
        <h1 style={{ ...serifTitleStyle, fontSize: "78px", lineHeight: 0.94 }}>{template.race.name}</h1>
        {planSubtitle ? <p style={{ margin: "16px 0 0 0", fontSize: "22px", color: "#4f6b5b" }}>{planSubtitle}</p> : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "24px" }}>
          {metaChips.map((chip) => (
            <span
              key={chip}
              style={{
                borderRadius: "9999px",
                padding: "10px 14px",
                background: "rgba(255,255,255,0.74)",
                border: "1px solid rgba(16,35,26,0.08)",
                fontSize: "14px",
                fontWeight: 700,
                color: "#244b37",
              }}
            >
              {chip}
            </span>
          ))}
        </div>

        <div style={{ ...glassPanelStyle, marginTop: "28px", padding: "26px 28px", maxWidth: "780px" }}>
          <p style={{ ...sectionLabelStyle, color: "#37624b" }}>{t.slideLabels.hook}</p>
          <p style={{ margin: "14px 0 0 0", fontSize: "40px", lineHeight: 1.04, fontWeight: 800 }}>{SOCIAL_COPY.hookTitle}</p>
          <p style={{ margin: "14px 0 0 0", fontSize: "18px", lineHeight: 1.55, color: "#3f5f4f" }}>{SOCIAL_COPY.hookBody}</p>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {teaserCards.map((card) => (
          <div key={card.label} style={{ ...glassPanelStyle, padding: "22px" }}>
            <p style={sectionLabelStyle}>{card.label}</p>
            <p style={{ margin: "12px 0 0 0", fontSize: "24px", lineHeight: 1.25, fontWeight: 800 }}>{card.value || "-"}</p>
          </div>
        ))}
      </section>

      <footer style={{ ...darkPanelStyle, marginTop: "auto", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#dce9df" }}>
              {SOCIAL_COPY.hookScrollCta}
            </p>
            <p style={{ margin: "12px 0 0 0", fontSize: "20px", lineHeight: 1.45, color: "#f5f2e8" }}>{template.cta}</p>
          </div>
          <SlideProgressBars activeIndex={0} dark />
        </div>
      </footer>
    </article>
  );
}

function MacroSlide({ template, t }: { template: SocialRacePlanTemplate; t: CarouselTranslations }) {
  const averagePaceLabel = formatAveragePaceLabel(template.race.targetTime.minutes, template.race.distanceKm);

  return (
    <article style={baseSlideStyle("linear-gradient(180deg, #f7f3eb 0%, #eef3e8 100%)")}>
      <div style={{ position: "absolute", top: "120px", right: "-40px", width: "260px", height: "260px", borderRadius: "9999px", background: "rgba(28,110,77,0.12)", filter: "blur(10px)" }} />

      <SlideTopBadges t={t} index={1} showFallbackBadge={template.missingData.length > 0} />

      <section style={{ position: "relative", zIndex: 1 }}>
        <p style={sectionLabelStyle}>{t.slideLabels.macro}</p>
        <h2 style={{ ...serifTitleStyle, marginTop: "16px", fontSize: "64px", lineHeight: 0.95 }}>{SOCIAL_COPY.macroTitle}</h2>
        <p style={{ margin: "18px 0 0 0", maxWidth: "760px", fontSize: "20px", lineHeight: 1.6, color: "#446554" }}>{SOCIAL_COPY.macroBody}</p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <SlideMetric label={t.distanceLabel} value={formatMetric(template.race.distanceKm, " km")} />
        <SlideMetric label={t.elevationLabel} value={formatMetric(template.race.elevationGainM, " m")} />
        <SlideMetric label={t.targetTimeLabel} value={formatText(template.race.targetTime.label)} />
        <SlideMetric label={t.avgPaceLabel} value={averagePaceLabel} />
      </section>

      <div style={{ ...glassPanelStyle, marginTop: "auto", position: "relative", zIndex: 1 }}>
        <p style={sectionLabelStyle}>{SOCIAL_COPY.assumptionsTitle}</p>
        <p style={{ margin: "12px 0 0 0", fontSize: "18px", lineHeight: 1.6, color: "#3f5f4f" }}>
          {template.assumptions[0] ?? t.noDetails}
        </p>
      </div>
    </article>
  );
}

function NutritionSlide({ template, t }: { template: SocialRacePlanTemplate; t: CarouselTranslations }) {
  const visibleAidStations = template.aidStations.slice(0, 3);
  const startCarryPreview = joinDefinedText(
    template.startCarry.items.slice(0, 2).map((item) => buildItemSummary(item, t) || item.note || item.label)
  );

  return (
    <article style={baseSlideStyle("linear-gradient(180deg, #f6efe5 0%, #edf7ef 100%)")}>
      <div style={{ position: "absolute", top: "-80px", left: "120px", width: "260px", height: "260px", borderRadius: "9999px", background: "rgba(242,187,98,0.14)", filter: "blur(10px)" }} />
      <div style={{ position: "absolute", bottom: "-80px", right: "60px", width: "260px", height: "260px", borderRadius: "9999px", background: "rgba(28,110,77,0.12)", filter: "blur(10px)" }} />

      <SlideTopBadges t={t} index={2} showFallbackBadge={template.missingData.length > 0} />

      <section style={{ position: "relative", zIndex: 1 }}>
        <p style={sectionLabelStyle}>{t.slideLabels.nutrition}</p>
        <h2 style={{ ...serifTitleStyle, marginTop: "16px", fontSize: "58px", lineHeight: 0.97 }}>{SOCIAL_COPY.nutritionTitle}</h2>
        <p style={{ margin: "18px 0 0 0", maxWidth: "760px", fontSize: "20px", lineHeight: 1.6, color: "#446554" }}>{SOCIAL_COPY.nutritionBody}</p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <SlideMetric label={t.carbsLabel} value={formatRate(template.averagesPerHour.carbsG, "g")} accent="rgba(255,255,255,0.88)" />
        <SlideMetric label={t.waterLabel} value={formatRate(template.averagesPerHour.waterMl, "ml")} accent="rgba(255,255,255,0.88)" />
        <SlideMetric label={t.sodiumLabel} value={formatRate(template.averagesPerHour.sodiumMg, "mg")} accent="rgba(255,255,255,0.88)" />
      </section>

      {startCarryPreview ? (
        <div style={{ ...glassPanelStyle, position: "relative", zIndex: 1 }}>
          <p style={sectionLabelStyle}>{t.startCarryTitle}</p>
          <p style={{ margin: "12px 0 0 0", fontSize: "18px", lineHeight: 1.55, color: "#3f5f4f" }}>{startCarryPreview}</p>
        </div>
      ) : null}

      <section style={{ ...darkPanelStyle, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dce9df" }}>
              {SOCIAL_COPY.keyAidStationsTitle}
            </p>
            <p style={{ margin: "10px 0 0 0", fontSize: "16px", lineHeight: 1.6, color: "#dce9df" }}>{SOCIAL_COPY.aidStationsSubtitle}</p>
          </div>
          <SlideProgressBars activeIndex={2} dark />
        </div>

        <div style={{ display: "grid", gap: "14px", marginTop: "20px" }}>
          {visibleAidStations.length > 0 ? (
            visibleAidStations.map((station) => (
              <div
                key={`${station.name}-${station.km ?? "na"}`}
                style={{
                  borderRadius: "20px",
                  padding: "18px",
                  background: "rgba(245,242,232,0.1)",
                  border: "1px solid rgba(245,242,232,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                  <p style={{ margin: 0, fontSize: "22px", fontWeight: 800 }}>{station.name}</p>
                  {station.take.fallbackUsed ? (
                    <span style={{ borderRadius: "9999px", padding: "8px 12px", fontSize: "12px", fontWeight: 700, background: "rgba(255,244,217,0.16)", color: "#ffe3a6" }}>
                      {t.estimateBadge}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: "#dce9df" }}>
                  {t.stationMeta.replace("{km}", station.km === null ? "-" : `${station.km}`).replace("{eta}", formatText(station.eta.label))}
                </p>
                <p style={{ margin: "12px 0 0 0", fontSize: "18px", lineHeight: 1.55, color: "#f5f2e8" }}>{buildStationPreview(station, t)}</p>
                {station.take.items.length > 2 ? (
                  <p style={{ margin: "10px 0 0 0", fontSize: "12px", color: "#dce9df" }}>
                    {t.moreItems.replace("{count}", String(station.take.items.length - 2))}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: "16px", color: "#dce9df" }}>{SOCIAL_COPY.noAidStations}</p>
          )}
        </div>

        {template.aidStations.length > visibleAidStations.length ? (
          <p style={{ margin: "16px 0 0 0", fontSize: "13px", color: "#dce9df" }}>
            {t.moreAidStations.replace("{count}", String(template.aidStations.length - visibleAidStations.length))}
          </p>
        ) : null}
      </section>
    </article>
  );
}

function CtaSlide({ template, t }: { template: SocialRacePlanTemplate; t: CarouselTranslations }) {
  return (
    <article style={baseSlideStyle("linear-gradient(180deg, #10231a 0%, #183626 100%)", "#f5f2e8")}>
      <div style={{ position: "absolute", top: "-120px", right: "-30px", width: "340px", height: "340px", borderRadius: "9999px", background: "rgba(242,187,98,0.18)", filter: "blur(16px)" }} />
      <div style={{ position: "absolute", bottom: "-120px", left: "-50px", width: "260px", height: "260px", borderRadius: "9999px", background: "rgba(96,198,142,0.14)", filter: "blur(14px)" }} />

      <SlideTopBadges t={t} index={3} showFallbackBadge={template.missingData.length > 0} dark />

      <section style={{ position: "relative", zIndex: 1, maxWidth: "760px" }}>
        <p style={{ ...sectionLabelStyle, color: "#dce9df" }}>{t.ctaTitle}</p>
        <h2 style={{ ...serifTitleStyle, marginTop: "16px", fontSize: "66px", lineHeight: 0.96, color: "#f5f2e8" }}>{SOCIAL_COPY.ctaSlideTitle}</h2>
        <p style={{ margin: "18px 0 0 0", fontSize: "20px", lineHeight: 1.65, color: "#dce9df" }}>{SOCIAL_COPY.ctaSlideBody}</p>
      </section>

      <div style={{ ...glassPanelStyle, position: "relative", zIndex: 1, padding: "32px", background: "rgba(245,242,232,0.9)" }}>
        <p style={sectionLabelStyle}>{template.race.name}</p>
        <p style={{ margin: "16px 0 0 0", fontSize: "44px", lineHeight: 1.08, fontWeight: 800, color: "#10231a" }}>{template.cta}</p>
        <p style={{ margin: "16px 0 0 0", fontSize: "16px", color: "#466352" }}>{BRAND_SITE}</p>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <SlideMetric
          label={t.distanceLabel}
          value={formatMetric(template.race.distanceKm, " km")}
          accent="rgba(245,242,232,0.14)"
          valueColor="#f5f2e8"
        />
        <SlideMetric
          label={t.elevationLabel}
          value={formatMetric(template.race.elevationGainM, " m")}
          accent="rgba(245,242,232,0.14)"
          valueColor="#f5f2e8"
        />
        <SlideMetric
          label={t.targetTimeLabel}
          value={formatText(template.race.targetTime.label)}
          accent="rgba(245,242,232,0.14)"
          valueColor="#f5f2e8"
        />
      </section>

      <footer
        style={{
          ...darkPanelStyle,
          marginTop: "auto",
          position: "relative",
          zIndex: 1,
          background: "rgba(245,242,232,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#dce9df" }}>{SOCIAL_COPY.disclaimerTitle}</p>
            <p style={{ margin: "12px 0 0 0", maxWidth: "680px", fontSize: "16px", lineHeight: 1.7, color: "#f5f2e8" }}>{template.disclaimer}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>
            <div
              style={{
                borderRadius: "20px",
                background: "rgba(245,242,232,0.12)",
                padding: "14px 16px",
                textAlign: "right",
              }}
            >
              <p style={{ margin: 0, fontSize: "12px", opacity: 0.76 }}>{BRAND_NAME}</p>
              <p style={{ margin: "8px 0 0 0", fontSize: "18px", fontWeight: 800 }}>{BRAND_SITE}</p>
            </div>
            <SlideProgressBars activeIndex={3} dark />
          </div>
        </div>
      </footer>
    </article>
  );
}

export function getSocialRacePlanSlideLabel(slideId: SocialRacePlanSlideId, t: CarouselTranslations) {
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

export function SocialRacePlanCarousel({ template, t, slideId }: Props) {
  switch (slideId) {
    case "hook":
      return <HookSlide template={template} t={t} />;
    case "macro":
      return <MacroSlide template={template} t={t} />;
    case "nutrition":
      return <NutritionSlide template={template} t={t} />;
    case "cta":
      return <CtaSlide template={template} t={t} />;
    default:
      return null;
  }
}
