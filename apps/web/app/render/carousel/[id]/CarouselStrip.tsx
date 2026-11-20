/* eslint-disable @next/next/no-img-element -- html-to-image inlines plain <img> elements */
import React, { type CSSProperties, type ReactNode } from "react";

import { BAND_TOP, SKY_TOP, SLIDE_HEIGHT, SLIDE_WIDTH, type BandLayout } from "../../../../lib/carousels/carousel-band";
import type { BriefSnapshot } from "../../../../lib/carousels/carousel-brief";
import type { PlanSnapshot } from "../../../../lib/carousels/carousel-plan";
import { getSlideCount, type CarouselSnapshot } from "../../../../lib/carousels/carousel-snapshot";
import type { WeekSnapshot } from "../../../../lib/carousels/carousel-week";
import { CAROUSEL_CSS } from "./carousel-styles";

/**
 * Draws a carousel snapshot as one continuous strip of 1080 × 1350 slides, side by side. Nothing
 * is fetched or randomised here: the server computed every figure and position. No slide number
 * and nothing in the top-right corner (Instagram draws its « 1/3 » counter there); 80 px side
 * margins keep the 3:4 profile-grid crop.
 */

export const LOGO_GREEN = "/branding/pace-yourself-logo-mark-green-transparent.png";
export const LOGO_WHITE = "/branding/pace-yourself-logo-mark-white-transparent.png";

const H = SLIDE_HEIGHT;
const W = SLIDE_WIDTH;

const Blaze = ({ height, forest = "#2D5016", width }: { height: number; forest?: string; width?: number }) => (
  <div className="blaze" style={{ height, ...(width ? { width } : {}) }}>
    <i style={{ height: height * 0.28, background: "#C8D44E" }} />
    <i style={{ height: height * 0.14, background: "#F0873A" }} />
    <i style={{ flex: 1, background: forest }} />
  </div>
);

const Head = ({ label, color = "#2D5016", forest }: { label: string; color?: string; forest?: string }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
    <Blaze height={70} forest={forest} />
    <span className="mono" style={{ fontSize: 26, fontWeight: 800, letterSpacing: ".14em", color }}>{label}</span>
  </div>
);

const Slide = ({ index, style, children }: { index: number; style?: CSSProperties; children: ReactNode }) => (
  <div style={{ position: "absolute", left: index * W, top: 0, width: W, height: H, ...style }}>{children}</div>
);

// -- Band ---------------------------------------------------------------------------------------

function Sky({ band }: { band: BandLayout }) {
  return (
    <svg aria-hidden="true" width={band.width} height={H - SKY_TOP} viewBox={`0 ${SKY_TOP} ${band.width} ${H - SKY_TOP}`} style={{ position: "absolute", left: 0, top: SKY_TOP }}>
      <defs>
        <linearGradient id="cz-sky" x1="0" y1="0" x2="1" y2="0">
          {band.sky.map((stop) => <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
        </linearGradient>
        <linearGradient id="cz-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.35" />
          <stop offset="0.82" stopColor="#FFFFFF" stopOpacity="1" />
        </linearGradient>
        <mask id="cz-sky-mask"><rect x="0" y={SKY_TOP} width={band.width} height={H - SKY_TOP} fill="url(#cz-fade)" /></mask>
      </defs>
      <rect x="0" y={SKY_TOP} width={band.width} height={H - SKY_TOP} fill="url(#cz-sky)" mask="url(#cz-sky-mask)" />
    </svg>
  );
}

function Band({ band }: { band: BandLayout }) {
  const flag = ({ x, y, label, right, ink }: BandLayout["flags"][number]) => (
    <g key={right ? "finish" : "start"}>
      <line x1={x} y1={y} x2={x} y2={y - 78} stroke={ink} strokeWidth="5" />
      <rect x={right ? x - 37 : x + 3} y={y - 78} width="34" height="8" fill="#C8D44E" />
      <rect x={right ? x - 37 : x + 3} y={y - 70} width="34" height="4" fill="#F0873A" />
      <rect x={right ? x - 37 : x + 3} y={y - 66} width="34" height="16" fill="#2D5016" />
      <text x={right ? x - 48 : x + 46} y={y - 56} textAnchor={right ? "end" : "start"} fontFamily="var(--font-bricolage), sans-serif" fontSize="24" fontWeight="800" fill={ink}>{label}</text>
    </g>
  );
  return (
    <svg aria-hidden="true" width={band.width} height={H - BAND_TOP} viewBox={`0 ${BAND_TOP} ${band.width} ${H - BAND_TOP}`} style={{ position: "absolute", left: 0, top: BAND_TOP }}>
      {band.stars.map((star) => <circle key={`${star.x}-${star.y}`} cx={star.x} cy={star.y} r={star.r} fill="#FAF8F2" opacity="0.75" />)}
      {band.moon ? <><circle cx={band.moon.x} cy={band.moon.y} r="20" fill="#F6EBD0" /><circle cx={band.moon.x + 10} cy={band.moon.y - 6} r="20" fill="#0E1A06" /></> : null}
      {band.sun ? <circle cx={band.sun.x} cy={band.sun.y} r={band.sun.r} fill="#F0873A" opacity="0.9" /> : null}
      {band.decor.map((layer) => <path key={layer.path} d={layer.path} fill={layer.color} opacity={layer.opacity} />)}
      <path d={`${band.ridgePath} L${band.width} ${H} L0 ${H} Z`} fill={band.groundColor} />
      <path d={band.ridgePath} fill="none" stroke="#F0873A" strokeWidth={band.level === 1 ? 4 : 5} strokeDasharray={band.level === 1 ? "2 12" : "2 14"} strokeLinecap="round" transform={band.level === 1 ? "translate(0 -7)" : "translate(0 14)"} />
      {band.stones.map((stone) => (
        <g key={stone.km}>
          <path d={`M${stone.x - 22} 1290 L${stone.x - 22} 1238 Q${stone.x} 1218 ${stone.x + 22} 1238 L${stone.x + 22} 1290 Z`} fill="#E5E2D8" stroke="#A9A595" strokeWidth="3" />
          <rect x={stone.x - 22} y="1236" width="44" height="12" fill="#2D5016" />
          <text x={stone.x} y="1276" textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="20" fontWeight="800" fill="#1F3810">{stone.km}</text>
        </g>
      ))}
      {band.flags.map(flag)}
      {band.signs.map((sign) => (
        <g key={sign.x}>
          <line x1={sign.x} y1={sign.groundY} x2={sign.x} y2={sign.plate ? sign.top : sign.groundY - 40} stroke="#6E5A3C" strokeWidth="5" />
          {sign.plate ? (
            <>
              <path d={`M${sign.x - 6} ${sign.top - 34} h${sign.width} l18 17 l-18 17 h-${sign.width} Z`} fill="#E2CFA3" stroke="#B89E6C" strokeWidth="2" />
              <circle cx={sign.x + 6} cy={sign.top - 17} r="4" fill="#8A7A5A" />
              <text x={sign.x + 18} y={sign.top - 10} fontFamily="var(--font-jetbrains), monospace" fontSize="19" fontWeight="800" fill="#3B2E17">{sign.label}</text>
            </>
          ) : null}
        </g>
      ))}
      {band.thirds.map((label, index) => (
        <text key={label} x={index * W + 40} y="1340" fontFamily="var(--font-jetbrains), monospace" fontSize="20" fontWeight="800" letterSpacing="3" fill={band.thirdsColor}>{label}</text>
      ))}
    </svg>
  );
}

// -- Le plan chiffré ----------------------------------------------------------------------------

function PlanBars({ plan }: { plan: PlanSnapshot }) {
  const maxH = Math.max(...plan.objectives.map((objective) => objective.carbsPerHour));
  const maxT = Math.max(...plan.objectives.map((objective) => objective.totalCarbsG));
  const bar = (x: number, value: number, max: number, color: string, text: string) => {
    const height = Math.round((value / max) * 112);
    return (
      <g key={`${x}-${text}`}>
        <rect x={x} y={158 - height} width="64" height={height} rx="6" fill={color} />
        <text x={x + 32} y={148 - height} textAnchor="middle" fontFamily="var(--font-jetbrains), monospace" fontSize="20" fontWeight="800" fill="#1F3810">{text}</text>
      </g>
    );
  };
  return (
    <svg role="img" aria-label={plan.chartLabel} width="884" height="198" viewBox="0 0 884 198">
      <rect x="0" y="4" width="16" height="16" rx="4" fill="#B5CC9A" />
      <text x="24" y="18" fontFamily="var(--font-bricolage), sans-serif" fontSize="19" fontWeight="700" fill="#3F4632">par heure</text>
      <rect x="130" y="4" width="16" height="16" rx="4" fill="#2D5016" />
      <text x="154" y="18" fontFamily="var(--font-bricolage), sans-serif" fontSize="19" fontWeight="700" fill="#3F4632">au total</text>
      <line x1="60" y1="158" x2="824" y2="158" stroke="#C9C5B8" strokeWidth="2" />
      {plan.objectives.map((objective, index) => {
        const center = 270 + index * 250;
        return (
          <g key={objective.label}>
            {bar(center - 72, objective.carbsPerHour, maxH, "#B5CC9A", `${objective.carbsPerHour} g/h`)}
            {bar(center + 8, objective.totalCarbsG, maxT, "#2D5016", objective.total)}
            <text x={center} y="188" textAnchor="middle" fontFamily="var(--font-bricolage), sans-serif" fontSize="21" fontWeight="700" fill="#5C6450">{index ? objective.label : `objectif ${objective.label}`}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PlanRows({ rows, dense }: { rows: PlanSnapshot["pages"][number]; dense: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: dense ? 5 : 10 }}>
      {rows.map((row) => {
        const main = row.hourText ?? row.kmText;
        const second = row.hourText ? row.kmText : row.lengthText;
        return dense ? (
          <div key={main} className="srow dense">
            <span className="mono" style={{ fontSize: 21, fontWeight: 800, letterSpacing: ".06em", color: "#3F4632", width: 270, whiteSpace: "nowrap" }}>{main}</span>
            <span className="mono" style={{ fontSize: 17, fontWeight: 700, color: "#8A917E", width: 150, whiteSpace: "nowrap" }}>{second}</span>
            <span className="grams" style={{ fontSize: 30, width: 130 }}>{row.grams}</span>
            <span className="bar" style={{ width: 170, marginLeft: "auto" }}><i className="done" style={{ width: `${row.donePct}%` }} /><i className="now" style={{ width: `${row.nowPct}%` }} /></span>
            <span className="cumul" style={{ width: 70, textAlign: "right" }}>{row.cumulPct}</span>
          </div>
        ) : (
          <div key={main} className="srow">
            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 320 }}>
              <span className="mono" style={{ fontSize: 28, fontWeight: 800, letterSpacing: ".04em", color: "#3F4632", whiteSpace: "nowrap" }}>{main}</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".12em", color: "#8A917E", whiteSpace: "nowrap" }}>{second}</span>
            </div>
            <span className="grams">{row.grams}</span>
            <span className="gauge">
              <span className="bar"><i className="done" style={{ width: `${row.donePct}%` }} /><i className="now" style={{ width: `${row.nowPct}%` }} /></span>
              <span className="cumul">{row.cumulText}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlanStrip({ plan }: { plan: PlanSnapshot }) {
  const dense = plan.density === "compact";
  const lastPage = plan.pages.length - 1;
  return (
    <>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex" }}>
        {Array.from({ length: plan.slideCount }, (_, index) => <div key={index} style={{ width: W, background: index % 2 ? "#ECEAE3" : "#FAF8F2" }} />)}
      </div>
      <Sky band={plan.band} />

      <Slide index={0}>
        <svg aria-hidden="true" width="1080" height="900" style={{ position: "absolute", inset: 0 }}>
          <g fill="none" stroke="#2D5016" strokeOpacity="0.08" strokeWidth="2">
            <path d="M-40 300 C 200 220, 380 380, 620 300 S 1000 200, 1140 280" />
            <path d="M-40 360 C 220 280, 400 440, 640 360 S 1010 260, 1140 340" />
            <path d="M-40 420 C 240 340, 420 500, 660 420 S 1020 320, 1140 400" />
          </g>
        </svg>
        <div style={{ position: "absolute", left: 80, top: 80, display: "flex", alignItems: "center", gap: 22 }}>
          <Blaze height={112} />
          <div className="plate"><span className="bolt" /><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: ".06em" }}>LE PLAN CHIFFRÉ</span></div>
        </div>
        <div style={{ position: "absolute", left: 80, right: 80, top: 280, display: "flex", flexDirection: "column", gap: 24 }}>
          <span className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".2em", color: "#3F6B1F" }}>{plan.eyebrow}</span>
          <h1 style={{ margin: 0, fontSize: plan.h1Size, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.02em", color: "#1F3810" }}>{plan.h1}</h1>
          <div style={{ display: "flex", gap: 40, alignItems: "baseline" }}>
            <span className="mono" style={{ fontSize: 52, fontWeight: 800, color: "#2D5016" }}>{plan.km}<span className="unit"> KM</span></span>
            <span className="mono" style={{ fontSize: 52, fontWeight: 800, color: "#2D5016" }}><span className="unit">D+ </span>{plan.dplus}<span className="unit"> M</span></span>
            {plan.stationCount > 0 ? <span className="mono" style={{ fontSize: 52, fontWeight: 800, color: "#2D5016" }}>{plan.stationCount}<span className="unit"> {plan.stationCount > 1 ? "RAVITOS" : "RAVITO"}</span></span> : null}
          </div>
        </div>
        <div style={{ position: "absolute", left: 80, top: plan.h1Size >= 96 ? 760 : 790, display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="mono" style={{ fontSize: 170, lineHeight: 1, fontWeight: 800, color: "#1F3810", letterSpacing: "-0.04em" }}>{plan.big}</span>
          <span className="mono" style={{ fontSize: 32, fontWeight: 700, letterSpacing: ".2em", color: "#5C6450" }}>G DE GLUCIDES / HEURE</span>
        </div>
        <span className="mono" style={{ position: "absolute", right: 80, top: BAND_TOP - 40, fontSize: 24, fontWeight: 800, letterSpacing: ".12em", color: "#2D5016" }}>SUIS LE PARCOURS →</span>
      </Slide>

      <Slide index={1} style={{ padding: "76px 80px 0", display: "flex", flexDirection: "column", gap: 26 }}>
        <Head label={plan.label2} />
        <h2 style={{ margin: 0, fontSize: 64, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.02em", color: "#1F3810" }}>Ton objectif change tout.</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="grid" style={{ paddingBottom: 2 }}>
            <span className="head">TON OBJECTIF</span>
            <span className="head">GLUCIDES<span className="headunit">G / HEURE</span></span>
            <span className="head">EAU<span className="headunit">ML / HEURE</span></span>
            <span className="head">SODIUM<span className="headunit">MG / HEURE</span></span>
            <span className="head" style={{ color: "#2D5016" }}>GLUCIDES<span className="headunit" style={{ color: "#3F6B1F" }}>AU TOTAL</span></span>
          </div>
          {plan.objectives.map((objective) => (
            <div key={objective.label} className="grid row">
              <div className="goal"><span className="plate2"><span className="bolt2" /><span className="goaltxt">{objective.label}</span></span></div>
              <span className="cell" style={{ color: "#2D5016" }}>{objective.carbsPerHour}</span>
              <span className="cell" style={{ color: "#3F6F8F" }}>{objective.waterMlPerHour}</span>
              <span className="cell" style={{ color: "#B45309", borderRight: "none" }}>{objective.sodiumMgPerHour}</span>
              <span className="total">{objective.total}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: 0, fontSize: 28, lineHeight: 1.35, color: "#3F4632" }}>
          {plan.sentence.map((part, index) => (part.strong ? <strong key={index} style={{ color: "#1F3810" }}>{part.text}</strong> : <span key={index}>{part.text}</span>))}
        </p>
        <div style={{ marginTop: "auto", marginBottom: H - BAND_TOP + 4, background: "#FFFFFF", border: "2px solid #E5E2D8", borderRadius: 16, padding: "8px 16px 2px" }}>
          <PlanBars plan={plan} />
        </div>
      </Slide>

      {plan.pages.map((rows, pageIndex) => (
        <Slide key={pageIndex} index={2 + pageIndex} style={{ padding: "76px 80px 0", display: "flex", flexDirection: "column", gap: dense ? 18 : 22 }}>
          <Head label={pageIndex ? `${plan.label3} · SUITE` : plan.label3} />
          {pageIndex === 0 ? (
            <h2 style={{ margin: 0, fontSize: dense ? 52 : 58, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-0.02em", color: "#1F3810" }}>
              {plan.total}&nbsp;g de glucides, {plan.rowsMode === "hours" ? "heure par heure" : "tronçon par tronçon"}.
            </h2>
          ) : null}
          <PlanRows rows={rows} dense={dense} />
          {pageIndex === lastPage ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <div className="plate"><span className="bolt" /><span style={{ fontSize: 28, fontWeight: 800 }}>Ton plan exact · lien en bio</span></div>
              <img src={LOGO_GREEN} alt="Pace Yourself" style={{ width: 56, height: 56, objectFit: "contain" }} />
            </div>
          ) : null}
        </Slide>
      ))}

      <Band band={plan.band} />
    </>
  );
}

// -- Le brief -----------------------------------------------------------------------------------

const BRIEF_THEMES = {
  night: {
    coverBg: "linear-gradient(180deg, #142608 0%, #1F3810 55%, #2D5016 100%)", bg: "linear-gradient(180deg, #142608 0%, #1F3810 100%)",
    closingBg: "linear-gradient(180deg, #1F3810 0%, #2D5016 100%)", ink: "#FAF8F2", accent: "#C8D44E", soft: "#E8F0E0", coverSoft: "#B5CC9A",
    ridge: "#0E1A06", plateBg: "linear-gradient(180deg,#FAF8F2 0%,#E8F0E0 80%)", plateInk: "#1F3810", rail: "#C8D44E", logo: LOGO_WHITE,
    footAccent: "#C8D44E",
  },
  day: {
    coverBg: "linear-gradient(180deg, #CFE3EE 0%, #EAF1F5 45%, #ECEAE3 100%)", bg: "linear-gradient(180deg, #DCEBF2 0%, #ECEAE3 100%)",
    closingBg: "linear-gradient(180deg, #DCEBF2 0%, #ECEAE3 100%)", ink: "#1F3810", accent: "#2D5016", soft: "#3F4632", coverSoft: "#5C6450",
    ridge: "#3F6B1F", plateBg: "linear-gradient(180deg,#4A7A2A 0%,#2D5016 70%)", plateInk: "#FAF8F2", rail: "#2D5016", logo: LOGO_GREEN,
    footAccent: "#F6EBD0",
  },
} as const;

const TICKET_SIZES = {
  tall: { height: 150, gap: 18, name: 36, big: 54, kmSize: 18 },
  medium: { height: 100, gap: 12, name: 30, big: 42, kmSize: 16 },
  compact: { height: 66, gap: 8, name: 24, big: 30, kmSize: 14 },
} as const;

function BriefStrip({ brief }: { brief: BriefSnapshot }) {
  const t = BRIEF_THEMES[brief.palette];
  const night = brief.palette === "night";
  const size = TICKET_SIZES[brief.stations.density];
  const leans = ["-0.6deg", "0.5deg", "-0.4deg", "0.7deg", "-0.5deg"];
  const widths = [720, 760, 700, 740, 690];
  return (
    <>
      <Slide index={0} style={{ background: t.coverBg, color: t.ink }}>
        <svg aria-hidden="true" width="1080" height="1350" viewBox="0 0 1080 1350" style={{ position: "absolute", inset: 0 }}>
          {night ? (
            <>
              <g fill="#FAF8F2">
                {[[140, 250, 2.5, 0.7], [320, 190, 2, 0.5], [520, 240, 3, 0.8], [700, 170, 2, 0.6], [880, 230, 2.5, 0.7], [980, 320, 2, 0.5], [610, 330, 1.8, 0.5], [230, 360, 1.8, 0.4]]
                  .map(([cx, cy, r, opacity]) => <circle key={`${cx}`} cx={cx} cy={cy} r={r} opacity={opacity} />)}
              </g>
              <circle cx="900" cy="300" r="54" fill="#F6EBD0" opacity=".9" />
              <circle cx="922" cy="286" r="54" fill="#142608" />
            </>
          ) : (
            <>
              <circle cx="880" cy="300" r="70" fill="#F0873A" opacity=".9" />
              <circle cx="880" cy="300" r="104" fill="#F0873A" opacity=".18" />
              <path d="M120 300 q40 -34 86 -8 q34 -26 70 4 q30 6 22 26 l-200 0 q-14 -16 22 -22 Z" fill="#FFFFFF" opacity=".85" />
            </>
          )}
          <path d="M0 1120 L140 1060 L230 1090 L360 990 L430 1030 L560 930 L640 970 L760 900 L860 980 L960 950 L1080 1010 L1080 1350 L0 1350 Z" fill={t.ridge} />
          <path d="M90 1110 L220 1080 L330 1012 L470 990 L600 950 L760 922" stroke="#F0873A" strokeWidth="5" strokeLinecap="round" fill="none" strokeDasharray="2 18" />
        </svg>
        <div style={{ position: "absolute", left: 80, top: 80, display: "flex", alignItems: "center", gap: 22 }}>
          <Blaze height={112} width={26} forest="#3F6B1F" />
          <div className="plate" style={{ background: t.plateBg, color: t.plateInk }}><span className="bolt" /><span style={{ fontSize: 34, fontWeight: 800, letterSpacing: ".06em" }}>LE BRIEF</span></div>
        </div>
        <div style={{ position: "absolute", left: 80, right: 80, top: 420, display: "flex", flexDirection: "column", gap: 30 }}>
          <span className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".2em", color: night ? t.accent : "#3F6F8F" }}>{brief.cover.eyebrow}</span>
          <h1 style={{ margin: 0, fontSize: brief.cover.headline.length > 48 ? 88 : 104, lineHeight: 1.0, fontWeight: 800, letterSpacing: "-0.02em" }}>{brief.cover.headline}</h1>
          <div style={{ display: "flex", gap: 40, alignItems: "baseline", marginTop: 6 }}>
            <span className="mono" style={{ fontSize: 50, fontWeight: 800 }}>{brief.cover.km}<span className="unit" style={{ color: t.coverSoft }}> KM</span></span>
            {brief.cover.dplus ? <span className="mono" style={{ fontSize: 50, fontWeight: 800 }}><span className="unit" style={{ color: t.coverSoft }}>D+ </span>{brief.cover.dplus}<span className="unit" style={{ color: t.coverSoft }}> M</span></span> : null}
            <span className="mono" style={{ fontSize: 50, fontWeight: 800 }}>{brief.cover.third.value}<span className="unit" style={{ color: t.coverSoft }}> {brief.cover.third.label}</span></span>
          </div>
        </div>
        <div style={{ position: "absolute", left: 80, right: 80, bottom: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={LOGO_WHITE} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
            <span style={{ fontSize: 30, fontWeight: 700, color: "#FAF8F2" }}>pace_your.self</span>
          </div>
          <span className="mono" style={{ fontSize: 28, fontWeight: 700, letterSpacing: ".12em", color: t.footAccent }}>GLISSE →</span>
        </div>
      </Slide>

      <Slide index={1} style={{ background: t.bg, color: t.ink, display: "flex", flexDirection: "column", padding: "72px 80px 64px", gap: 30 }}>
        <Head label={brief.label} color={t.accent} forest="#3F6B1F" />
        <h2 style={{ margin: 0, fontSize: 84, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.02em" }}>{brief.stations.title}</h2>
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.35, color: t.soft }}>{brief.stations.lead}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: size.gap, marginTop: 6 }}>
          {brief.stations.rows.map((row) => (
            <div key={`${row.kmLabel}-${row.name}-${row.big}`} className="ticket" style={{ height: size.height }}>
              <div className="stub"><span style={{ fontSize: size.kmSize, fontWeight: 700, letterSpacing: ".2em" }}>{row.kmLabel}</span><span style={{ fontSize: size.big, fontWeight: 800, color: "#B45309" }}>{row.big}</span></div>
              <div style={{ display: "flex", flexDirection: brief.stations.density === "compact" ? "row" : "column", alignItems: brief.stations.density === "compact" ? "center" : "flex-start", justifyContent: "center", padding: "0 28px", gap: 12, minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: size.name, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{row.name}</span>
                <div style={{ display: "flex", gap: 10, flex: "none" }}>
                  {row.chips.map((chip) => (
                    <span key={chip.text} className="chip" style={{ background: chip.tone === "ok" ? "#E8F0E0" : "#FEF3C7", color: chip.tone === "ok" ? "#1F3810" : "#7A5A22", fontSize: brief.stations.density === "compact" ? 15 : 20 }}>{chip.text}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
          {brief.stations.more > 0 ? <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: t.soft }}>+ {brief.stations.more} AUTRES DANS TON PLAN</span> : null}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: ".1em", color: t.soft }}>SOURCE : ORGANISATION</span>
          <img src={t.logo} alt="Pace Yourself" style={{ width: 64, height: 64, objectFit: "contain" }} />
        </div>
      </Slide>

      <Slide index={2} style={{ background: t.closingBg, color: t.ink, display: "flex", flexDirection: "column", padding: "72px 80px 64px", gap: 30 }}>
        <Head label="LE BRIEF · LE RESTE" color={t.accent} forest="#3F6B1F" />
        <h2 style={{ margin: 0, fontSize: 84, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-0.02em" }}>{brief.closing.title}</h2>
        <p style={{ margin: 0, fontSize: 30, lineHeight: 1.35, color: t.soft }}>{brief.closing.lead}</p>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 22, marginTop: 10, paddingLeft: 40 }}>
          <div aria-hidden="true" style={{ position: "absolute", left: 8, top: 0, bottom: 0, borderLeft: `4px dotted ${t.rail}` }} />
          {brief.closing.signs.map((sign, index) => (
            <div key={sign.title} className="sign" style={{ width: widths[index % widths.length], transform: `rotate(${leans[index % leans.length]})` }}>
              <span className="wbolt" /><span style={{ fontSize: 40, fontWeight: 800 }}>{sign.title}</span><span style={{ fontSize: 26, color: "#6E5A3C" }}>· {sign.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="plate" style={{ background: t.plateBg, color: t.plateInk, padding: "18px 54px 18px 28px" }}><span className="bolt" /><span style={{ fontSize: 34, fontWeight: 800 }}>{brief.closing.cta}</span></div>
          <img src={t.logo} alt="Pace Yourself" style={{ width: 72, height: 72, objectFit: "contain" }} />
        </div>
      </Slide>
    </>
  );
}

// -- La semaine qui vient -----------------------------------------------------------------------

function WeekStrip({ week }: { week: WeekSnapshot }) {
  return (
    <>
      <Slide index={0} style={{ background: "#ECEAE3" }}>
        <svg aria-hidden="true" width="1080" height="1350" viewBox="0 0 1080 1350" style={{ position: "absolute", inset: 0 }}>
          <g fill="none" stroke="#2D5016" strokeOpacity="0.08" strokeWidth="2">
            <path d="M-40 1000 C 200 940, 420 1060, 660 990 S 1000 920, 1140 980" />
            <path d="M-40 1060 C 220 1000, 440 1120, 680 1050 S 1010 980, 1140 1040" />
            <path d="M-40 1120 C 240 1060, 460 1180, 700 1110 S 1020 1040, 1140 1100" />
            <path d="M-40 1180 C 260 1120, 480 1240, 720 1170 S 1030 1100, 1140 1160" />
          </g>
        </svg>
        <div style={{ position: "absolute", left: 80, top: 80, display: "flex", alignItems: "center", gap: 22 }}>
          <Blaze height={112} width={26} />
          <div className="plate"><span className="bolt" /><span style={{ fontSize: 32, fontWeight: 800, letterSpacing: ".06em" }}>LA SEMAINE QUI VIENT</span></div>
        </div>
        <div style={{ position: "absolute", left: 80, top: 240, display: "flex", flexDirection: "column", gap: 4 }}>
          <span className="mono" style={{ fontSize: 96, fontWeight: 800, color: "#1F3810", letterSpacing: "-0.03em" }}>{week.range}</span>
          <span className="mono" style={{ fontSize: week.subtitle.length > 36 ? 22 : 28, fontWeight: 700, letterSpacing: week.subtitle.length > 36 ? ".12em" : ".2em", color: "#5C6450", whiteSpace: "nowrap" }}>{week.subtitle}</span>
        </div>
        <div aria-hidden="true" style={{ position: "absolute", left: 524, top: 430, width: 32, height: 920, background: "linear-gradient(90deg, #5E4C32, #7A6444 50%, #5E4C32)", borderRadius: 4 }} />
        {week.planks.map((plank, index) => (
          <div
            key={plank.name}
            className={plank.side === "right" ? "plank-r" : "plank-l"}
            style={{ top: 470 + index * 146, width: 460, ...(plank.side === "right" ? { left: 540 } : { right: 540 }) }}
          >
            <span style={{ fontSize: plank.name.length > 22 ? 26 : plank.name.length > 16 ? 30 : 34, fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{plank.name}</span>
            <span className="cotes" style={{ fontSize: plank.cotes.length > 22 ? 19 : 24, whiteSpace: "nowrap" }}>{plank.cotes}</span>
          </div>
        ))}
        <div style={{ position: "absolute", left: 80, right: 80, bottom: 44, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={LOGO_GREEN} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
            <span style={{ fontSize: 30, fontWeight: 700, color: "#2D5016" }}>pace_your.self</span>
          </div>
          <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: "#2D5016", letterSpacing: ".12em" }}>TU COURS OÙ ? →</span>
        </div>
      </Slide>

      <Slide index={1} style={{ background: "#FAF8F2", display: "flex", flexDirection: "column", padding: "72px 80px 64px", gap: 8 }}>
        <div style={{ marginBottom: 10 }}><Head label={week.label} /></div>
        {week.days.map((day, dayIndex) => (
          <React.Fragment key={day.label}>
            <div style={{ marginTop: dayIndex ? 12 : 0 }}><span className="day">{day.label}</span></div>
            {day.rows.map((row, rowIndex) => (
              <div key={`${row.name}-${rowIndex}`} className="wrow" style={rowIndex === day.rows.length - 1 ? { borderBottom: "none" } : undefined}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
                  <span className="wname" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{row.name}</span>
                  {row.meta ? <span className="wmeta" style={{ whiteSpace: "nowrap", flex: "none" }}>{row.meta}</span> : null}
                </div>
                <div className="tiles">
                  {row.tiles.map((tile, tileIndex) => (
                    <div key={`${tile.km}-${tileIndex}`} className="tile"><span className="km">{tile.km}</span>{tile.dplus ? <span className="dp">{tile.dplus}</span> : null}</div>
                  ))}
                </div>
              </div>
            ))}
          </React.Fragment>
        ))}
        {week.more > 0 ? <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#5C6450", marginTop: 8 }}>+ {week.more} {week.more > 1 ? "AUTRES COURSES" : "AUTRE COURSE"} CETTE SEMAINE DANS L’APPLI</span> : null}
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, background: "#E8F0E0", borderRadius: 16, padding: "20px 28px" }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: "#1F3810", lineHeight: 1.2 }}>Ta course y est&nbsp;? Ton plan de course en 2 minutes, lien en bio.</span>
          <img src={LOGO_GREEN} alt="Pace Yourself" style={{ width: 72, height: 72, objectFit: "contain", flex: "none" }} />
        </div>
      </Slide>
    </>
  );
}

/** The strip root: `fontClassName` carries the next/font CSS variables. */
export const CarouselStrip = React.forwardRef<HTMLDivElement, { snapshot: CarouselSnapshot; fontClassName: string }>(function CarouselStrip({ snapshot, fontClassName }, ref) {
  const width = getSlideCount(snapshot) * W;
  return (
    <div ref={ref} className={`cz ${fontClassName}`} style={{ width, height: H, background: "#FAF8F2" }}>
      <style>{CAROUSEL_CSS}</style>
      {snapshot.series === "plan" ? <PlanStrip plan={snapshot} /> : snapshot.series === "brief" ? <BriefStrip brief={snapshot} /> : <WeekStrip week={snapshot} />}
    </div>
  );
});
