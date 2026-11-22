"use client";

import React, { memo, useSyncExternalStore } from "react";
import Image from "next/image";

import {
  getProfileShades,
  getToldSlope,
  getProfileTicks,
  isHookIntroEnabled,
  isCompactOverlayEnabled,
  COMPACT_TOP_CQMIN,
  END_SCREEN_FONT_CQMIN,
  END_SCREEN_SIDE_PADDING_CQMIN,
  END_SCREEN_TEXT,
  CUTOFF_RED,
  OVERLAY_FONT_CQMIN,
  getProfileWindow,
  getProfileY,
  PROFILE_UNITS_PER_KM,
  type AidService,
  type ElevationProfile,
  type ScheduledBeat,
  type VideoCompositionSettings,
  type VideoFrameState,
} from "./video-composition";
import { formatClockTime } from "./route-clock";
import {
  getHookOverlayState,
  getShockFigureFontCqmin,
  HOOK_FIGURE_TOP_RATIO,
  HOOK_INTRO_MS,
  HOOK_LEFT_RATIO,
  HOOK_NAME_CQMIN,
  HOOK_NAME_GAP_CQMIN,
  HOOK_EVENT_CQMIN,
  HOOK_EVENT_GAP_CQMIN,
  HOOK_NAME_LINE_HEIGHT,
  HOOK_RIGHT_RATIO,
  HOOK_UNIT_SCALE,
  pickShockFigure,
} from "./reel-hook";
import {
  SUBTITLE_CENTER_Y_RATIO,
  SUBTITLE_FONT_CQMIN,
  SUBTITLE_LEFT_RATIO,
  SUBTITLE_LINE_HEIGHT,
  SUBTITLE_PADDING_X_CQMIN,
  SUBTITLE_PADDING_Y_CQMIN,
  SUBTITLE_RIGHT_RATIO,
} from "./subtitle-groups";
import {
  formatKm,
  formatKmFixed,
  formatTotalElevationM,
  formatTotalKm,
  toAnnouncedKm,
  toRouteKm,
  type RaceFigures,
} from "./race-figures";

export type VideoRaceInfo = {
  /** Catalog race id, used to file background renders. */
  id?: string;
  title: string;
  subtitle: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  /** Start place, date and time, e.g. "Lyon · 28 novembre · 23:30". */
  startDetail: string | null;
  /** Short event name of the reel hook (race_events.short_name, else derived from the event name). */
  shortName?: string | null;
  /** Name of the format (« Marathon de l'Orchis »), shown large by the hook above the event name; null when generic. */
  formatName?: string | null;
  /** Organizer start place, shortened to its landmark ("Saint-Étienne"), for the map label. */
  startPlace?: string | null;
  /** Raw race date (YYYY-MM-DD) and start time (HH:MM), for the estimated race clock. */
  raceDate?: string | null;
  startTime?: string | null;
};

export type VideoFrameStore = {
  get: () => VideoFrameState;
  set: (frame: VideoFrameState) => void;
  subscribe: (listener: () => void) => () => void;
};

export const createVideoFrameStore = (initial: VideoFrameState): VideoFrameStore => {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (frame) => {
      current = frame;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

const LOGO_SRC = "/branding/pace-yourself-logo-mark-white-transparent.png";
const FADE_MS = 300;
const TEXT_SHADOW = "0 0.3cqmin 1.2cqmin rgba(0, 0, 0, 0.65)";

const formatInteger = (value: number) => Math.round(value).toLocaleString("fr-FR");
const formatGrade = (grade: number) => `${grade >= 0 ? "+" : "−"}${Math.abs(Math.round(grade * 100))} %`;

/** Badge figures: the canonical announced totals, so they match the counter and the voice. */
export const formatRaceStats = (figures: RaceFigures, settings: VideoCompositionSettings) => {
  const gain = formatTotalElevationM(figures);
  return [
    settings.showDistance && figures.distanceKm > 0 ? `${formatTotalKm(figures.distanceKm)} KM` : null,
    settings.showElevation && gain ? `${gain} M D+` : null,
  ].filter(Boolean).join(" · ");
};

const ProfileSegments = memo(function ProfileSegments({ profile }: { profile: ElevationProfile }) {
  return (
    <>
      {profile.segments.map((segment, index) => (
        <path key={`area-${index}`} d={segment.areaPath} fill={segment.color} fillOpacity={0.5} />
      ))}
      {profile.segments.map((segment, index) => (
        <path key={`line-${index}`} d={segment.linePath} fill="none" stroke={segment.color} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  );
});

const ICON_PATHS: Record<AidService, string[]> = {
  water: ["M12 2.7s-6 6.4-6 11a6 6 0 0 0 12 0c0-4.6-6-11-6-11z"],
  food: ["M5 3v6a3 3 0 0 0 6 0V3", "M8 3v18", "M18 21V3c-2 0-4 2.5-4 7h4"],
  assistance: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  dropBag: ["M5 10a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z", "M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1", "M8 14h8v4"],
};

function CaptionIcon({ name }: { name: AidService }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ width: "3.6cqmin", height: "3.6cqmin" }} aria-hidden="true">
      {ICON_PATHS[name].map((path) => <path key={path} d={path} />)}
    </svg>
  );
}

const CAPTION_KIND_LABELS: Record<ScheduledBeat["kind"], string> = {
  intro: "",
  start: "Départ",
  climb: "Montée",
  descent: "Descente",
  flat: "Roulant",
  aid: "Ravito",
  lifeBase: "Base de vie",
  night: "Nuit",
  finish: "Arrivée",
  outro: "",
};

const getCaptionTitle = (beat: ScheduledBeat, figures: RaceFigures) => {
  if (beat.kind === "climb" || beat.kind === "descent" || beat.kind === "flat") {
    return `km ${formatKm(toAnnouncedKm(figures, beat.startKm))} → ${formatKm(toAnnouncedKm(figures, beat.endKm))}`;
  }
  if (beat.kind === "start" || beat.kind === "finish") return null;
  return beat.title;
};

/**
 * Lower-third caption of the narrated moment: fixed above the profile so it stays readable
 * whatever the route does, and in sync with the voice-over.
 */
function StoryCaption({ accent, beat, figures, timeMs, top }: { accent: string; beat: ScheduledBeat; figures: RaceFigures; timeMs: number; top: string }) {
  const appear = Math.max(0, Math.min(1, (timeMs - beat.startMs) / FADE_MS, (beat.endMs - timeMs) / FADE_MS));
  const title = getCaptionTitle(beat, figures);
  // The station cutoff lives in the leg card (the light map bubble shows the name only), unless a fact already says it.
  const cutoff = beat.cutoffTime && !beat.facts.some((fact) => fact.startsWith("Barrière")) ? `Barrière ${beat.cutoffTime}` : null;
  return (
    <div
      className="absolute rounded-[2cqmin] bg-white text-[#1a1a1a] shadow-[0_0.6cqmin_2.4cqmin_rgba(0,0,0,0.35)]"
      style={{
        left: "4cqmin",
        right: "4cqmin",
        top,
        padding: "1.4cqmin 2.4cqmin",
        borderLeft: `1.2cqmin solid ${accent}`,
        opacity: appear,
        transform: `translateY(${(1 - appear) * 3}cqmin)`,
        textShadow: "none",
      }}
    >
      <div className="flex items-center" style={{ gap: "1.8cqmin" }}>
        <span className="shrink-0 rounded-full font-black uppercase leading-none text-white" style={{ fontSize: `${OVERLAY_FONT_CQMIN.captionKind}cqmin`, padding: "0.8cqmin 1.8cqmin", background: accent }}>
          {CAPTION_KIND_LABELS[beat.kind]}
        </span>
        {title ? <p className="truncate font-black uppercase leading-none" style={{ fontSize: "4.4cqmin" }}>{title}</p> : null}
      </div>
      {beat.facts.length || beat.services.length || cutoff ? (
        <div className="flex flex-wrap items-center font-bold tabular-nums leading-tight" style={{ gap: "2cqmin", marginTop: "1.4cqmin", fontSize: `${OVERLAY_FONT_CQMIN.captionFacts}cqmin` }}>
          {beat.facts.length ? <span>{beat.facts.join(" · ")}</span> : null}
          {cutoff ? <span style={{ color: CUTOFF_RED }}>{cutoff}</span> : null}
          {beat.services.length ? (
            <span className="flex items-center" style={{ gap: "1.6cqmin", color: accent }}>
              {beat.services.map((service) => <CaptionIcon key={service} name={service} />)}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type OverlayProps = {
  elevationAtDistance: (distanceKm: number) => number;
  /** Canonical figures: announced totals and the GPX rescale of every kilometre shown. */
  figures: RaceFigures;
  frameStore: VideoFrameStore;
  gradeAtDistance: (distanceKm: number) => number;
  profile: ElevationProfile;
  race: VideoRaceInfo;
  settings: VideoCompositionSettings;
};

function VideoCompositionOverlayComponent({ elevationAtDistance, figures, frameStore, gradeAtDistance, profile, race, settings }: OverlayProps) {
  const frame = useSyncExternalStore(frameStore.subscribe, frameStore.get, frameStore.get);
  const stats = formatRaceStats(figures, settings);
  const isIntro = frame.phase === "intro";
  const isOutro = frame.phase === "outro";
  // The hook replaces the title card: one figure and the short name, no pill, subtitle or start.
  const hook = isIntro && isHookIntroEnabled(settings) ? getHookOverlayState(frame.timeMs, HOOK_INTRO_MS) : null;
  const shockFigure = hook ? pickShockFigure(figures) : null;
  const introOpacity = isIntro && !hook ? Math.min(1, (1 - frame.phaseProgress) / 0.3) : 0;
  const outroOpacity = isOutro ? Math.min(1, Math.max(0, (frame.phaseProgress - 0.4) / 0.3)) : 0;
  const chromeOpacity = hook ? hook.chromeOpacity : isIntro ? 1 - introOpacity : isOutro ? 1 - outroOpacity : 1;
  const accent = settings.accentColor;
  const compact = isCompactOverlayEnabled(settings);
  // The hook names the format in large type and the event under it; a generic format keeps the event alone.
  const hookTitle = race.formatName || race.shortName || null;
  const hookEvent = race.formatName && race.shortName ? race.shortName : null;
  // Light overlay: no title band (the hook and the voice already name the race and its figures).
  const hasHeader = !compact && (settings.showTitle || Boolean(stats));
  const hasProfileBand = settings.showProfile || settings.showCurrentKm;
  // The leg card sits under the profile band; the subtitles sit low, centred at 86 % of the frame.
  // The light overlay starts lower, below Instagram's own top bar, and has no tick row.
  const bandTop = compact ? `${COMPACT_TOP_CQMIN}cqmin` : hasHeader ? "16cqmin" : "4cqmin";
  const captionTop = compact
    ? `${COMPACT_TOP_CQMIN + (hasProfileBand ? 28 : 0)}cqmin`
    : hasProfileBand ? (hasHeader ? "47cqmin" : "35cqmin") : hasHeader ? "16cqmin" : "4cqmin";
  // The accent is a background, never text on the dark gradients, so a dark brand green stays legible.
  const accentPill = { background: accent, color: "#ffffff", padding: "0.6cqmin 2.2cqmin", textShadow: "none" };

  const profileWindow = getProfileWindow(profile.totalDistanceKm, frame.distanceKm, settings.profileMode);
  const windowSpanKm = Math.max(0.001, profileWindow.endKm - profileWindow.startKm);
  const toWindowPercent = (distanceKm: number) => ((distanceKm - profileWindow.startKm) / windowSpanKm) * 100;
  const currentElevationM = elevationAtDistance(frame.distanceKm);
  const cursorX = frame.distanceKm * PROFILE_UNITS_PER_KM;
  const toldSlope = settings.highlightToldSlopes ? getToldSlope(frame) : null;
  const profileShades = getProfileShades(frame.distanceKm, profile.totalDistanceKm, toldSlope);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-white" style={{ textShadow: TEXT_SHADOW }}>
      {/* Day/night: a navy multiply veil at night and a warm soft-light tint around sunrise and sunset,
          on top of the map but under the composition, so it works with any basemap. */}
      {frame.daylight ? (
        <>
          <div className="absolute inset-0" style={{ background: "#16224d", mixBlendMode: "multiply", opacity: (1 - frame.daylight.level) * 0.32 }} />
          <div className="absolute inset-0" style={{ background: "#ff8a3d", mixBlendMode: "soft-light", opacity: frame.daylight.warmth * 0.3 }} />
        </>
      ) : null}

      {/* Top band: compact title then the profile; the map keeps the middle; captions sit at the bottom. */}
      <div className="absolute inset-x-0 top-0 h-[36%] bg-gradient-to-b from-black/70 via-black/40 to-transparent" style={{ opacity: chromeOpacity }} />
      <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-black/70 to-transparent" style={{ opacity: isOutro ? 1 : chromeOpacity }} />

      {hasHeader ? (
        <header className="absolute" style={{ left: "4cqmin", right: "4cqmin", top: "4cqmin", opacity: chromeOpacity }}>
          {settings.showTitle ? (
            <p className="truncate font-black uppercase leading-none tracking-tight" style={{ fontSize: "5.6cqmin" }}>{race.title}</p>
          ) : null}
          <div className="flex items-center" style={{ gap: "1.6cqmin", marginTop: settings.showTitle ? "1.2cqmin" : 0 }}>
            {settings.showTitle && race.subtitle ? <p className="truncate font-semibold uppercase" style={{ fontSize: "3cqmin" }}>{race.subtitle}</p> : null}
            {stats ? <p className="shrink-0 rounded-full font-bold tabular-nums" style={{ ...accentPill, fontSize: "3cqmin" }}>{stats}</p> : null}
          </div>
        </header>
      ) : null}

      {settings.showCaptions && frame.beat ? <StoryCaption accent={accent} beat={frame.beat} figures={figures} timeMs={frame.timeMs} top={captionTop} /> : null}

      {/* Burned-in subtitles of the voice-over: a fixed-width accent box centred horizontally and at
          86 % of the frame height, clear of the action column (subtitle-groups.ts). */}
      {settings.showSubtitles && frame.subtitle ? (
        <div
          className="absolute flex items-center justify-center text-center font-medium text-white"
          style={{
            left: `${SUBTITLE_LEFT_RATIO * 100}%`,
            width: `${(SUBTITLE_RIGHT_RATIO - SUBTITLE_LEFT_RATIO) * 100}%`,
            top: `${SUBTITLE_CENTER_Y_RATIO * 100}%`,
            transform: "translateY(-50%)",
            minHeight: `${SUBTITLE_FONT_CQMIN * SUBTITLE_LINE_HEIGHT + 2 * SUBTITLE_PADDING_Y_CQMIN}cqmin`,
            padding: `${SUBTITLE_PADDING_Y_CQMIN}cqmin ${SUBTITLE_PADDING_X_CQMIN}cqmin`,
            fontSize: `${SUBTITLE_FONT_CQMIN}cqmin`,
            lineHeight: SUBTITLE_LINE_HEIGHT,
            letterSpacing: "0.01em",
            textShadow: "none",
            background: `${accent}eb`,
            borderRadius: "1.2cqmin",
            boxShadow: "0 0.5cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
          }}
        >
          {frame.subtitle}
        </div>
      ) : null}

      {/* Mapbox attribution as legible text; the Mapbox logo stays on the map itself. */}
      <p className="absolute text-white/75" style={{ right: "2cqmin", bottom: "7cqmin", fontSize: "1.9cqmin" }}>© Mapbox © OpenStreetMap</p>

      {settings.showProfile || settings.showCurrentKm ? (
        <section className="absolute" style={{ left: "4cqmin", right: "4cqmin", top: bandTop, opacity: chromeOpacity }}>
          {settings.showCurrentKm ? (
            <p className="flex items-baseline justify-between font-black tabular-nums" style={{ fontSize: "5cqmin" }}>
              <span>
                KM {formatKmFixed(toAnnouncedKm(figures, frame.distanceKm))}
                <span className="font-semibold text-white/75"> / {formatTotalKm(figures.distanceKm)}</span>
              </span>
              <span className="font-bold" style={{ fontSize: "3.6cqmin" }}>
                {frame.daylight ? (
                  <span className="text-white/90">{frame.daylight.isNight ? "☾" : "☀"} {formatClockTime(frame.daylight.minutesOfDay)} · </span>
                ) : null}
                {formatInteger(currentElevationM)} m
                <span className="text-white/80"> · {formatGrade(gradeAtDistance(frame.distanceKm))}</span>
              </span>
            </p>
          ) : null}
          {settings.showProfile ? (
            <>
              <div className="relative mt-[1.2cqmin]" style={{ height: "15cqmin" }}>
                <svg
                  className="absolute inset-0 h-full w-full"
                  viewBox={`${profileWindow.startKm * PROFILE_UNITS_PER_KM} 0 ${windowSpanKm * PROFILE_UNITS_PER_KM} ${profile.height}`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {toldSlope && toldSlope.opacity > 0 ? (
                    <rect
                      x={toldSlope.startKm * PROFILE_UNITS_PER_KM}
                      y={0}
                      width={(toldSlope.endKm - toldSlope.startKm) * PROFILE_UNITS_PER_KM}
                      height={profile.height}
                      fill="white"
                      fillOpacity={0.16 * toldSlope.opacity}
                    />
                  ) : null}
                  <ProfileSegments profile={profile} />
                  {profileShades.map((shade) => (
                    <rect
                      key={shade.fromKm}
                      x={shade.fromKm * PROFILE_UNITS_PER_KM}
                      y={0}
                      width={(shade.toKm - shade.fromKm) * PROFILE_UNITS_PER_KM}
                      height={profile.height}
                      fill="black"
                      fillOpacity={shade.opacity}
                    />
                  ))}
                  <line x1={cursorX} x2={cursorX} y1={0} y2={profile.height} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </svg>
                <span
                  className="absolute rounded-full border-white"
                  style={{
                    left: `${toWindowPercent(frame.distanceKm)}%`,
                    top: `${(getProfileY(profile, currentElevationM) / profile.height) * 100}%`,
                    width: "3cqmin",
                    height: "3cqmin",
                    borderWidth: "0.6cqmin",
                    background: accent,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </div>
              {compact ? null : (
                <div className="relative h-[4cqmin]">
                  {/* Ticks in announced kilometres, placed on the GPX. */}
                  {getProfileTicks({ startKm: toAnnouncedKm(figures, profileWindow.startKm), endKm: toAnnouncedKm(figures, profileWindow.endKm) }).map((km) => (
                    <span key={km} className="absolute top-0 -translate-x-1/2 font-semibold tabular-nums text-white/75" style={{ left: `${toWindowPercent(toRouteKm(figures, km))}%`, fontSize: `${OVERLAY_FONT_CQMIN.profileTick}cqmin` }}>
                      {km} km
                    </span>
                  ))}
                </div>
              )}
              {settings.profileMode === "window" ? (
                <div className="relative mt-[0.8cqmin] h-[1cqmin] rounded-full bg-white/25">
                  <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${frame.routeProgress * 100}%`, background: accent }} />
                  <div
                    className="absolute -inset-y-[0.4cqmin] rounded-sm border border-white/80"
                    style={{
                      left: `${(profileWindow.startKm / Math.max(0.001, profile.totalDistanceKm)) * 100}%`,
                      width: `${(windowSpanKm / Math.max(0.001, profile.totalDistanceKm)) * 100}%`,
                    }}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {settings.showFooterBrand && (settings.showLogo || settings.showCta) && !isOutro ? (
        <footer className="absolute flex items-center" style={{ left: "4cqmin", bottom: "4cqmin", gap: "2cqmin", opacity: chromeOpacity }}>
          {settings.showLogo ? <Image src={LOGO_SRC} alt="" width={256} height={256} unoptimized style={{ width: "7cqmin", height: "7cqmin" }} /> : null}
          {settings.showCta ? (
            <div className="leading-tight">
              <p className="font-black uppercase" style={{ fontSize: `${OVERLAY_FONT_CQMIN.footerCta}cqmin` }}>Télécharge l’appli</p>
              <p className="font-semibold text-white/85" style={{ fontSize: `${OVERLAY_FONT_CQMIN.footerCta}cqmin` }}>Dispo sur iPhone et Android</p>
            </div>
          ) : null}
        </footer>
      ) : null}

      {hook ? (
        <>
          {/* Legibility veil over the upper half only: the map stays bright where the camera flies. */}
          <div className="absolute inset-x-0 top-0 h-[55%] bg-gradient-to-b from-black/60 via-black/30 to-transparent" style={{ opacity: Math.max(hook.figureOpacity, hook.nameOpacity) }} />
          <div
            className="absolute flex flex-col items-center text-center"
            style={{ left: `${HOOK_LEFT_RATIO * 100}%`, width: `${(HOOK_RIGHT_RATIO - HOOK_LEFT_RATIO) * 100}%`, top: `${HOOK_FIGURE_TOP_RATIO * 100}%` }}
          >
            {shockFigure ? (
              <p
                className="whitespace-nowrap font-black leading-none tabular-nums tracking-tight"
                style={{ fontSize: `${getShockFigureFontCqmin(shockFigure)}cqmin`, opacity: hook.figureOpacity }}
              >
                {shockFigure.value}
                <span style={{ fontSize: `${HOOK_UNIT_SCALE}em`, marginLeft: "0.25em" }}>{shockFigure.unit}</span>
              </p>
            ) : null}
            {hookTitle ? (
              <p
                className="font-black uppercase"
                style={{
                  marginTop: `${HOOK_NAME_GAP_CQMIN}cqmin`,
                  fontSize: `${HOOK_NAME_CQMIN}cqmin`,
                  lineHeight: HOOK_NAME_LINE_HEIGHT,
                  overflowWrap: "break-word",
                  opacity: hook.nameOpacity,
                  transform: `translateY(${hook.nameOffsetCqmin}cqmin)`,
                }}
              >
                {hookTitle}
              </p>
            ) : null}
            {hookEvent ? (
              <p
                className="font-bold uppercase text-white/85"
                style={{
                  marginTop: `${HOOK_EVENT_GAP_CQMIN}cqmin`,
                  fontSize: `${HOOK_EVENT_CQMIN}cqmin`,
                  letterSpacing: "0.08em",
                  lineHeight: HOOK_NAME_LINE_HEIGHT,
                  opacity: hook.nameOpacity,
                  transform: `translateY(${hook.nameOffsetCqmin}cqmin)`,
                }}
              >
                {hookEvent}
              </p>
            ) : null}
          </div>
        </>
      ) : null}

      {isIntro && !hook ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-[6cqmin] text-center" style={{ opacity: introOpacity }}>
          <p className="font-black uppercase leading-none" style={{ fontSize: "10cqmin" }}>{race.title}</p>
          {race.subtitle ? <p className="mt-[2cqmin] font-bold uppercase" style={{ fontSize: "5.5cqmin" }}>{race.subtitle}</p> : null}
          {stats ? <p className="mt-[3cqmin] rounded-full font-black tabular-nums" style={{ ...accentPill, fontSize: "5cqmin" }}>{stats}</p> : null}
          {settings.showStartInfo && race.startDetail ? (
            <p className="mt-[2.5cqmin] font-semibold" style={{ fontSize: "4cqmin" }}>Départ · {race.startDetail}</p>
          ) : null}
        </div>
      ) : null}

      {isOutro && settings.storyMode === "highlights" ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 pb-[8cqmin] text-center"
          style={{ opacity: outroOpacity, paddingInline: `${END_SCREEN_SIDE_PADDING_CQMIN}cqmin` }}
        >
          {settings.showLogo ? <Image src={LOGO_SRC} alt="" width={256} height={256} unoptimized style={{ width: "20cqmin", height: "20cqmin" }} /> : null}
          {settings.showCta ? (
            <>
              <p className="mt-[3cqmin] font-black uppercase leading-tight" style={{ fontSize: `${END_SCREEN_FONT_CQMIN.headline}cqmin` }}>{END_SCREEN_TEXT.headline}</p>
              <p className="mt-[1.5cqmin] font-semibold" style={{ fontSize: `${END_SCREEN_FONT_CQMIN.sub}cqmin` }}>{END_SCREEN_TEXT.sub}</p>
              <p className="mt-[2.5cqmin] rounded-full font-bold" style={{ ...accentPill, fontSize: `${END_SCREEN_FONT_CQMIN.pill}cqmin` }}>{END_SCREEN_TEXT.pill}</p>
            </>
          ) : null}
        </div>
      ) : isOutro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 px-[6cqmin] text-center" style={{ opacity: outroOpacity }}>
          {settings.showLogo ? <Image src={LOGO_SRC} alt="" width={256} height={256} unoptimized style={{ width: "22cqmin", height: "22cqmin" }} /> : null}
          {settings.showCta ? (
            <>
              <p className="mt-[3cqmin] font-black uppercase leading-tight" style={{ fontSize: "6.5cqmin" }}>Télécharge l’appli Pace Yourself</p>
              <p className="mt-[1.5cqmin] font-semibold" style={{ fontSize: "4cqmin" }}>Prépare ton plan de course</p>
              <p className="mt-[2.5cqmin] rounded-full font-bold" style={{ ...accentPill, fontSize: "4.6cqmin" }}>App Store · Google Play</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const VideoCompositionOverlay = memo(VideoCompositionOverlayComponent);
