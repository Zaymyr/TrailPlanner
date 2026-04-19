import type { CSSProperties } from "react";

import type { AdminTranslations } from "../../../locales/types";
import type { SocialRacePlanTemplate } from "../../../lib/social-race-plan-template";

type PosterTranslations = AdminTranslations["socialTemplates"]["poster"];

type Props = {
  template: SocialRacePlanTemplate;
  t: PosterTranslations;
};

const panelStyle: CSSProperties = {
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(16,35,26,0.1)",
  borderRadius: "26px",
  padding: "22px",
  boxShadow: "0 16px 30px rgba(16,35,26,0.06)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#37624b",
};

const formatText = (value: string | null) => value?.trim() || "-";
const formatMetric = (value: number | null, suffix: string) => (value === null ? "-" : `${value}${suffix}`);

const summarizeItem = (item: SocialRacePlanTemplate["startCarry"]["items"][number], t: PosterTranslations) => {
  const parts: string[] = [];
  if (item.quantity !== null) parts.push(t.quantity.replace("{count}", String(item.quantity)));
  if (item.carbsG !== null) parts.push(`${item.carbsG}g ${t.carbsShort}`);
  if (item.waterMl !== null) parts.push(`${item.waterMl}ml ${t.waterShort}`);
  if (item.sodiumMg !== null) parts.push(`${item.sodiumMg}mg ${t.sodiumShort}`);
  return parts.join(" | ");
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panelStyle, padding: "20px" }}>
      <p style={{ ...titleStyle, fontSize: "12px", color: "#557765" }}>{label}</p>
      <p style={{ margin: "12px 0 0 0", fontSize: "34px", fontWeight: 800, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function NeedsPanel({
  title,
  carbs,
  water,
  sodium,
  t,
}: {
  title: string;
  carbs: number | null;
  water: number | null;
  sodium: number | null;
  t: PosterTranslations;
}) {
  return (
    <div style={panelStyle}>
      <p style={titleStyle}>{title}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "12px", marginTop: "18px" }}>
        {[
          { label: t.carbsLabel, value: formatMetric(carbs, "g") },
          { label: t.waterLabel, value: formatMetric(water, "ml") },
          { label: t.sodiumLabel, value: formatMetric(sodium, "mg") },
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              borderRadius: "18px",
              padding: "16px",
              background: "rgba(16,35,26,0.05)",
              border: "1px solid rgba(16,35,26,0.08)",
            }}
          >
            <p style={{ ...titleStyle, margin: 0, fontSize: "11px", color: "#557765" }}>{metric.label}</p>
            <p style={{ margin: "10px 0 0 0", fontSize: "22px", fontWeight: 800 }}>{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ItemBlock({
  title,
  items,
  overflowCount,
  fallbackUsed,
  t,
}: {
  title: string;
  items: SocialRacePlanTemplate["startCarry"]["items"];
  overflowCount: number;
  fallbackUsed: boolean;
  t: PosterTranslations;
}) {
  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <p style={titleStyle}>{title}</p>
        {fallbackUsed ? (
          <span
            style={{
              borderRadius: "9999px",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: 700,
              background: "#fff4d9",
              color: "#8a5a12",
            }}
          >
            {t.estimateBadge}
          </span>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              padding: "16px 18px",
              borderRadius: "18px",
              background: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(16,35,26,0.08)",
            }}
          >
            <p style={{ margin: 0, fontSize: "17px", fontWeight: 700, lineHeight: 1.3 }}>{item.label}</p>
            <p style={{ margin: "8px 0 0 0", fontSize: "13px", lineHeight: 1.55, color: "#4f6b5b" }}>
              {summarizeItem(item, t) || item.note || t.noDetails}
            </p>
            {item.note ? (
              <p style={{ margin: "8px 0 0 0", fontSize: "12px", lineHeight: 1.5, color: "#6b7f73" }}>{item.note}</p>
            ) : null}
          </div>
        ))}
      </div>

      {overflowCount > 0 ? (
        <p style={{ margin: "14px 0 0 0", fontSize: "13px", color: "#4f6b5b" }}>
          {t.moreItems.replace("{count}", String(overflowCount))}
        </p>
      ) : null}
    </div>
  );
}

export function SocialRacePlanPoster({ template, t }: Props) {
  const planSubtitle = template.plan.name !== template.race.name ? template.plan.name : null;
  const visibleStartCarry = template.startCarry.items.slice(0, 4);
  const visibleAidStations = template.aidStations.slice(0, 6);

  return (
    <article
      style={{
        position: "relative",
        overflow: "hidden",
        width: "1080px",
        minHeight: "1350px",
        padding: "56px",
        borderRadius: "40px",
        background: "linear-gradient(180deg, #f6efe5 0%, #ebf6ef 48%, #f7f2ea 100%)",
        color: "#10231a",
        boxShadow: "0 30px 80px rgba(15,23,42,0.18)",
        border: "1px solid rgba(16,35,26,0.08)",
        fontFamily: "\"Avenir Next\", \"Segoe UI\", sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: "26px",
      }}
    >
      <div style={{ position: "absolute", top: "-120px", right: "-80px", width: "330px", height: "330px", borderRadius: "9999px", background: "rgba(39,140,94,0.16)", filter: "blur(8px)" }} />
      <div style={{ position: "absolute", bottom: "-110px", left: "-80px", width: "280px", height: "280px", borderRadius: "9999px", background: "rgba(242,187,98,0.16)", filter: "blur(8px)" }} />

      <header style={{ display: "flex", justifyContent: "space-between", gap: "24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: "760px" }}>
          <p
            style={{
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
            }}
          >
            {t.eyebrow}
          </p>
          <h1
            style={{
              margin: "20px 0 0 0",
              fontSize: "68px",
              lineHeight: 0.95,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              fontFamily: "\"Iowan Old Style\", \"Palatino Linotype\", \"Book Antiqua\", Georgia, serif",
            }}
          >
            {template.race.name}
          </h1>
          {planSubtitle ? <p style={{ margin: "14px 0 0 0", fontSize: "20px", color: "#4f6b5b" }}>{planSubtitle}</p> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
          <div style={{ borderRadius: "9999px", padding: "10px 16px", background: "rgba(255,255,255,0.78)", fontSize: "12px", fontWeight: 700, color: "#37624b" }}>
            Trail Planner
          </div>
          {template.missingData.length > 0 ? (
            <div style={{ borderRadius: "9999px", padding: "10px 16px", background: "#fff4d9", fontSize: "12px", fontWeight: 700, color: "#8a5a12" }}>
              {t.fallbackBadge}
            </div>
          ) : null}
        </div>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "16px", position: "relative", zIndex: 1 }}>
        <MetricCard label={t.distanceLabel} value={formatMetric(template.race.distanceKm, " km")} />
        <MetricCard label={t.elevationLabel} value={formatMetric(template.race.elevationGainM, " m")} />
        <MetricCard label={t.targetTimeLabel} value={formatText(template.race.targetTime.label)} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "16px", position: "relative", zIndex: 1 }}>
        <NeedsPanel
          title={t.perHourTitle}
          carbs={template.averagesPerHour.carbsG}
          water={template.averagesPerHour.waterMl}
          sodium={template.averagesPerHour.sodiumMg}
          t={t}
        />
        <NeedsPanel
          title={t.totalTitle}
          carbs={template.totals.carbsG}
          water={template.totals.waterMl}
          sodium={template.totals.sodiumMg}
          t={t}
        />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "16px", position: "relative", zIndex: 1 }}>
        <ItemBlock
          title={t.startCarryTitle}
          items={visibleStartCarry}
          overflowCount={Math.max(0, template.startCarry.items.length - visibleStartCarry.length)}
          fallbackUsed={template.startCarry.fallbackUsed}
          t={t}
        />

        <div style={panelStyle}>
          <p style={titleStyle}>{t.assumptionsTitle}</p>
          <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
            {template.assumptions.slice(0, 2).map((assumption) => (
              <div key={assumption} style={{ borderRadius: "18px", padding: "16px 18px", background: "rgba(16,35,26,0.05)" }}>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "#305241" }}>{assumption}</p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "18px", borderRadius: "18px", padding: "18px", background: "#123524", color: "#f5f2e8" }}>
            <p style={{ ...titleStyle, color: "#dce9df", fontSize: "12px" }}>{t.disclaimerTitle}</p>
            <p style={{ margin: "10px 0 0 0", fontSize: "14px", lineHeight: 1.6 }}>{template.disclaimer}</p>
          </div>
        </div>
      </section>

      <section style={{ ...panelStyle, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <p style={titleStyle}>{t.aidStationsTitle}</p>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "#4f6b5b" }}>{t.aidStationsSubtitle}</p>
          </div>
          <div style={{ borderRadius: "9999px", padding: "10px 14px", background: "rgba(16,35,26,0.05)", fontSize: "12px", fontWeight: 700, color: "#37624b" }}>
            {t.durationLabel.replace("{value}", formatText(template.race.targetTime.label))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
          {visibleAidStations.map((station) => (
            <div
              key={`${station.name}-${station.km ?? "na"}`}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: "16px",
                alignItems: "stretch",
                borderRadius: "20px",
                padding: "16px",
                background: "rgba(255,255,255,0.72)",
                border: "1px solid rgba(16,35,26,0.08)",
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: "19px", fontWeight: 700 }}>{station.name}</p>
                <p style={{ margin: "8px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: "#4f6b5b" }}>
                  {t.stationMeta.replace("{km}", station.km === null ? "-" : `${station.km}`).replace("{eta}", formatText(station.eta.label))}
                </p>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                {station.take.items.slice(0, 2).map((item, index) => (
                  <div key={`${station.name}-${item.label}-${index}`}>
                    <p style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>{item.label}</p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "13px", lineHeight: 1.5, color: "#4f6b5b" }}>
                      {summarizeItem(item, t) || item.note || t.noDetails}
                    </p>
                  </div>
                ))}
                {station.take.items.length > 2 ? (
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#4f6b5b" }}>
                    {t.moreItems.replace("{count}", String(station.take.items.length - 2))}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {template.aidStations.length > visibleAidStations.length ? (
          <p style={{ margin: "16px 0 0 0", fontSize: "13px", color: "#4f6b5b" }}>
            {t.moreAidStations.replace("{count}", String(template.aidStations.length - visibleAidStations.length))}
          </p>
        ) : null}
      </section>

      <footer
        style={{
          marginTop: "auto",
          borderRadius: "28px",
          padding: "24px 28px",
          background: "#123524",
          color: "#f5f2e8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div>
          <p style={{ ...titleStyle, color: "#dce9df", fontSize: "12px" }}>{t.ctaTitle}</p>
          <p style={{ margin: "10px 0 0 0", fontSize: "24px", lineHeight: 1.25, fontWeight: 700 }}>{template.cta}</p>
        </div>
        <div style={{ minWidth: "168px", borderRadius: "22px", background: "rgba(245,242,232,0.12)", padding: "16px 18px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.76 }}>{t.schemaTitle}</p>
          <p style={{ margin: "8px 0 0 0", fontSize: "22px", fontWeight: 800 }}>v{template.schemaVersion}</p>
        </div>
      </footer>
    </article>
  );
}
