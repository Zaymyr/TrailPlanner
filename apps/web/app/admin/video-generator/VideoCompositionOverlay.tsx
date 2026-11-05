"use client";

import React, { memo, useSyncExternalStore } from "react";
import Image from "next/image";

import {
  getProfileTicks,
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

export type VideoRaceInfo = {
  /** Catalog race id, used to file background renders. */
  id?: string;
  title: string;
  subtitle: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  /** Start place, date and time, e.g. "Lyon · 28 novembre · 23:30". */
  startDetail: string | null;
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

const formatKm = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatInteger = (value: number) => Math.round(value).toLocaleString("fr-FR");
const formatGrade = (grade: number) => `${grade >= 0 ? "+" : "−"}${Math.abs(Math.round(grade * 100))} %`;

export const formatRaceStats = (race: VideoRaceInfo, settings: VideoCompositionSettings) => [
  settings.showDistance ? `${formatInteger(race.distanceKm)} KM` : null,
  settings.showElevation && race.elevationGainM ? `${formatInteger(race.elevationGainM)} M D+` : null,
].filter(Boolean).join(" · ");

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
  finish: "Arrivée",
  outro: "",
};

const getCaptionTitle = (beat: ScheduledBeat) => {
  if (beat.kind === "climb" || beat.kind === "descent" || beat.kind === "flat") return `km ${formatKm(beat.startKm)} → ${formatKm(beat.endKm)}`;
  if (beat.kind === "start" || beat.kind === "finish") return null;
  return beat.title;
};

/**
 * Lower-third caption of the narrated moment: fixed above the profile so it stays readable
 * whatever the route does, and in sync with the voice-over.
 */
function StoryCaption({ accent, beat, timeMs, top }: { accent: string; beat: ScheduledBeat; timeMs: number; top: string }) {
  const appear = Math.max(0, Math.min(1, (timeMs - beat.startMs) / FADE_MS, (beat.endMs - timeMs) / FADE_MS));
  const title = getCaptionTitle(beat);
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
        <span className="shrink-0 rounded-full font-black uppercase leading-none text-white" style={{ fontSize: "2.6cqmin", padding: "0.8cqmin 1.8cqmin", background: accent }}>
          {CAPTION_KIND_LABELS[beat.kind]}
        </span>
        {title ? <p className="truncate font-black uppercase leading-none" style={{ fontSize: "4.4cqmin" }}>{title}</p> : null}
      </div>
      {beat.facts.length || beat.services.length ? (
        <div className="flex flex-wrap items-center font-bold tabular-nums leading-tight" style={{ gap: "2cqmin", marginTop: "1.4cqmin", fontSize: "3.4cqmin" }}>
          {beat.facts.length ? <span>{beat.facts.join(" · ")}</span> : null}
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
  frameStore: VideoFrameStore;
  gradeAtDistance: (distanceKm: number) => number;
  profile: ElevationProfile;
  race: VideoRaceInfo;
  settings: VideoCompositionSettings;
};

function VideoCompositionOverlayComponent({ elevationAtDistance, frameStore, gradeAtDistance, profile, race, settings }: OverlayProps) {
  const frame = useSyncExternalStore(frameStore.subscribe, frameStore.get, frameStore.get);
  const stats = formatRaceStats(race, settings);
  const isIntro = frame.phase === "intro";
  const isOutro = frame.phase === "outro";
  const introOpacity = isIntro ? Math.min(1, (1 - frame.phaseProgress) / 0.3) : 0;
  const outroOpacity = isOutro ? Math.min(1, Math.max(0, (frame.phaseProgress - 0.4) / 0.3)) : 0;
  const chromeOpacity = isIntro ? 1 - introOpacity : isOutro ? 1 - outroOpacity : 1;
  const accent = settings.accentColor;
  const hasHeader = settings.showTitle || Boolean(stats);
  const hasProfileBand = settings.showProfile || settings.showCurrentKm;
  // The leg card sits under the profile band so the bottom stays free for the subtitles.
  const captionTop = hasProfileBand ? (hasHeader ? "47cqmin" : "35cqmin") : hasHeader ? "16cqmin" : "4cqmin";
  // The accent is a background, never text on the dark gradients, so a dark brand green stays legible.
  const accentPill = { background: accent, color: "#ffffff", padding: "0.6cqmin 2.2cqmin", textShadow: "none" };

  const profileWindow = getProfileWindow(profile.totalDistanceKm, frame.distanceKm, settings.profileMode);
  const windowSpanKm = Math.max(0.001, profileWindow.endKm - profileWindow.startKm);
  const toWindowPercent = (distanceKm: number) => ((distanceKm - profileWindow.startKm) / windowSpanKm) * 100;
  const currentElevationM = elevationAtDistance(frame.distanceKm);
  const cursorX = frame.distanceKm * PROFILE_UNITS_PER_KM;
  const totalUnits = profile.totalDistanceKm * PROFILE_UNITS_PER_KM;

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

      {settings.showCaptions && frame.beat ? <StoryCaption accent={accent} beat={frame.beat} timeMs={frame.timeMs} top={captionTop} /> : null}

      {/* Burned-in subtitles of the voice-over in the Pace Yourself look: white text on a brand-green
          band with a soft shadow; high contrast on any map. */}
      {settings.showSubtitles && frame.subtitle ? (
        <p
          className="absolute text-center font-medium leading-snug text-white"
          style={{ left: "6cqmin", right: "6cqmin", bottom: "15cqmin", fontSize: "4.2cqmin", textShadow: "none", letterSpacing: "0.01em" }}
        >
          <span
            className="rounded-[1.2cqmin]"
            style={{
              padding: "0.6cqmin 1.8cqmin",
              background: `${accent}eb`,
              boxShadow: "0 0.5cqmin 1.6cqmin rgba(0, 0, 0, 0.35)",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {frame.subtitle}
          </span>
        </p>
      ) : null}

      {/* Mapbox attribution as legible text; the Mapbox logo stays on the map itself. */}
      <p className="absolute text-white/75" style={{ right: "2cqmin", bottom: "7cqmin", fontSize: "1.9cqmin" }}>© Mapbox © OpenStreetMap</p>

      {settings.showProfile || settings.showCurrentKm ? (
        <section className="absolute" style={{ left: "4cqmin", right: "4cqmin", top: hasHeader ? "16cqmin" : "4cqmin", opacity: chromeOpacity }}>
          {settings.showCurrentKm ? (
            <p className="flex items-baseline justify-between font-black tabular-nums" style={{ fontSize: "5cqmin" }}>
              <span>
                KM {formatKm(frame.distanceKm)}
                <span className="font-semibold text-white/75"> / {formatInteger(profile.totalDistanceKm)}</span>
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
                  <ProfileSegments profile={profile} />
                  <rect x={cursorX} y={0} width={Math.max(0, totalUnits - cursorX)} height={profile.height} fill="black" fillOpacity={0.45} />
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
              <div className="relative h-[3.6cqmin]">
                {getProfileTicks(profileWindow).map((km) => (
                  <span key={km} className="absolute top-0 -translate-x-1/2 font-semibold tabular-nums text-white/75" style={{ left: `${toWindowPercent(km)}%`, fontSize: "2.6cqmin" }}>
                    {km} km
                  </span>
                ))}
              </div>
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

      {(settings.showLogo || settings.showCta) && !isOutro ? (
        <footer className="absolute flex items-center" style={{ left: "4cqmin", bottom: "4cqmin", gap: "2cqmin", opacity: chromeOpacity }}>
          {settings.showLogo ? <Image src={LOGO_SRC} alt="" width={256} height={256} unoptimized style={{ width: "7cqmin", height: "7cqmin" }} /> : null}
          {settings.showCta ? (
            <div className="leading-tight">
              <p className="font-black uppercase" style={{ fontSize: "2.8cqmin" }}>Télécharge l’appli</p>
              <p className="font-semibold text-white/85" style={{ fontSize: "2.8cqmin" }}>Dispo sur iPhone et Android</p>
            </div>
          ) : null}
        </footer>
      ) : null}

      {isIntro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-[6cqmin] text-center" style={{ opacity: introOpacity }}>
          <p className="font-black uppercase leading-none" style={{ fontSize: "10cqmin" }}>{race.title}</p>
          {race.subtitle ? <p className="mt-[2cqmin] font-bold uppercase" style={{ fontSize: "5.5cqmin" }}>{race.subtitle}</p> : null}
          {stats ? <p className="mt-[3cqmin] rounded-full font-black tabular-nums" style={{ ...accentPill, fontSize: "5cqmin" }}>{stats}</p> : null}
          {settings.showStartInfo && race.startDetail ? (
            <p className="mt-[2.5cqmin] font-semibold" style={{ fontSize: "4cqmin" }}>Départ · {race.startDetail}</p>
          ) : null}
        </div>
      ) : null}

      {isOutro ? (
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
