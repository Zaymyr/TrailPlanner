"use client";

import React, { memo, useSyncExternalStore } from "react";
import Image from "next/image";

import {
  getProfileTicks,
  getProfileWindow,
  getProfileY,
  PROFILE_UNITS_PER_KM,
  type ElevationProfile,
  type ScheduledAidLabel,
  type VideoCompositionSettings,
  type VideoFrameState,
} from "./video-composition";

export type VideoRaceInfo = {
  title: string;
  subtitle: string | null;
  distanceKm: number;
  elevationGainM: number | null;
  /** Start place, date and time, e.g. "Lyon · 28 novembre · 23:30". */
  startDetail: string | null;
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
const FADE_MS = 250;
const TEXT_SHADOW = "0 0.3cqmin 1.2cqmin rgba(0, 0, 0, 0.65)";

const formatKm = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const formatInteger = (value: number) => Math.round(value).toLocaleString("fr-FR");
const formatGrade = (grade: number) => `${grade >= 0 ? "+" : "−"}${Math.abs(Math.round(grade * 100))} %`;

export const formatRaceStats = (race: VideoRaceInfo, settings: VideoCompositionSettings) => [
  settings.showDistance ? `${formatInteger(race.distanceKm)} KM` : null,
  settings.showElevation && race.elevationGainM ? `${formatInteger(race.elevationGainM)} M D+` : null,
].filter(Boolean).join(" · ");

const getLabelOpacity = (label: ScheduledAidLabel, timeMs: number) =>
  Math.max(0, Math.min(1, (timeMs - label.startMs) / FADE_MS, (label.endMs - timeMs) / FADE_MS));

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

function AidLabelCard({ accent, label, timeMs }: { accent: string; label: ScheduledAidLabel; timeMs: number }) {
  const meta = label.kind === "start"
    ? label.detail
    : [`KM ${formatKm(label.distanceKm)}`, label.cutoffTime ? `Barrière ${label.cutoffTime}` : null].filter(Boolean).join(" · ");
  return (
    <div
      className="absolute left-1/2 max-w-[86%] -translate-x-1/2 rounded-[1.5cqmin] bg-black/60 text-center backdrop-blur-sm"
      style={{ top: "30%", padding: "2cqmin 4cqmin", borderLeft: `1cqmin solid ${accent}`, opacity: getLabelOpacity(label, timeMs) }}
    >
      {label.isLifeBase ? (
        <p className="mx-auto mb-[1cqmin] w-fit rounded-full px-[2cqmin] font-black uppercase tracking-wide text-black" style={{ fontSize: "2.8cqmin", background: accent }}>
          Base de vie
        </p>
      ) : null}
      <p className="font-black uppercase leading-tight" style={{ fontSize: "5cqmin" }}>{label.name}</p>
      {meta ? <p className="font-bold tabular-nums" style={{ fontSize: "3.6cqmin", color: accent }}>{meta}</p> : null}
      {label.services.length ? (
        <div className="mt-[1.2cqmin] flex flex-wrap justify-center" style={{ gap: "1cqmin" }}>
          {label.services.map((service) => (
            <span key={service} className="rounded-full bg-white/15 font-semibold" style={{ fontSize: "2.9cqmin", padding: "0.4cqmin 1.8cqmin" }}>
              {service}
            </span>
          ))}
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

  const profileWindow = getProfileWindow(profile.totalDistanceKm, frame.distanceKm, settings.profileMode);
  const windowSpanKm = Math.max(0.001, profileWindow.endKm - profileWindow.startKm);
  const toWindowPercent = (distanceKm: number) => ((distanceKm - profileWindow.startKm) / windowSpanKm) * 100;
  const currentElevationM = elevationAtDistance(frame.distanceKm);
  const cursorX = frame.distanceKm * PROFILE_UNITS_PER_KM;
  const totalUnits = profile.totalDistanceKm * PROFILE_UNITS_PER_KM;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-white" style={{ textShadow: TEXT_SHADOW }}>
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-black/60 to-transparent" style={{ opacity: chromeOpacity }} />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-gradient-to-t from-black/75 to-transparent" style={{ opacity: isOutro ? 1 : chromeOpacity }} />

      {settings.showTitle || stats ? (
        <header className="absolute" style={{ left: "5cqmin", right: "5cqmin", top: "6cqmin", opacity: chromeOpacity }}>
          {settings.showTitle ? (
            <>
              <p className="font-black uppercase leading-none tracking-tight" style={{ fontSize: "7.5cqmin" }}>{race.title}</p>
              {race.subtitle ? <p className="mt-[1cqmin] font-semibold uppercase" style={{ fontSize: "4cqmin" }}>{race.subtitle}</p> : null}
            </>
          ) : null}
          {stats ? <p className="mt-[1.5cqmin] font-bold tabular-nums" style={{ fontSize: "4.2cqmin", color: accent }}>{stats}</p> : null}
        </header>
      ) : null}

      {frame.aidLabel ? <AidLabelCard accent={accent} label={frame.aidLabel} timeMs={frame.timeMs} /> : null}

      {settings.showProfile || settings.showCurrentKm ? (
        <section className="absolute" style={{ left: "4cqmin", right: "4cqmin", bottom: "14cqmin", opacity: chromeOpacity }}>
          {settings.showCurrentKm ? (
            <p className="flex items-baseline justify-between font-black tabular-nums" style={{ fontSize: "5cqmin" }}>
              <span>
                KM {formatKm(frame.distanceKm)}
                <span className="font-semibold text-white/75"> / {formatInteger(profile.totalDistanceKm)}</span>
              </span>
              <span className="font-bold" style={{ fontSize: "3.6cqmin" }}>
                {formatInteger(currentElevationM)} m
                <span style={{ color: accent }}> · {formatGrade(gradeAtDistance(frame.distanceKm))}</span>
              </span>
            </p>
          ) : null}
          {settings.showProfile ? (
            <>
              <div className="relative mt-[1.2cqmin]" style={{ height: "20cqmin" }}>
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
              <p className="font-black uppercase" style={{ fontSize: "2.8cqmin" }}>Prépare ton plan de course</p>
              <p className="font-semibold" style={{ fontSize: "2.8cqmin", color: accent }}>pace-yourself.com</p>
            </div>
          ) : null}
        </footer>
      ) : null}

      {isIntro ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 px-[6cqmin] text-center" style={{ opacity: introOpacity }}>
          <p className="font-black uppercase leading-none" style={{ fontSize: "10cqmin" }}>{race.title}</p>
          {race.subtitle ? <p className="mt-[2cqmin] font-bold uppercase" style={{ fontSize: "5.5cqmin" }}>{race.subtitle}</p> : null}
          {stats ? <p className="mt-[3cqmin] font-black tabular-nums" style={{ fontSize: "5.5cqmin", color: accent }}>{stats}</p> : null}
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
              <p className="mt-[3cqmin] font-black uppercase leading-tight" style={{ fontSize: "6.5cqmin" }}>Prépare ton plan de course</p>
              <p className="mt-[1.5cqmin] font-bold" style={{ fontSize: "5cqmin", color: accent }}>pace-yourself.com</p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const VideoCompositionOverlay = memo(VideoCompositionOverlayComponent);
