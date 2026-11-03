"use client";

import React, { memo, useId, useSyncExternalStore } from "react";
import Image from "next/image";

import {
  getProfileY,
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

export const formatRaceStats = (race: VideoRaceInfo, settings: VideoCompositionSettings) => [
  settings.showDistance ? `${formatInteger(race.distanceKm)} KM` : null,
  settings.showElevation && race.elevationGainM ? `${formatInteger(race.elevationGainM)} M D+` : null,
].filter(Boolean).join(" · ");

const getLabelOpacity = (label: ScheduledAidLabel, timeMs: number) =>
  Math.max(0, Math.min(1, (timeMs - label.startMs) / FADE_MS, (label.endMs - timeMs) / FADE_MS));

type OverlayProps = {
  elevationAtDistance: (distanceKm: number) => number;
  frameStore: VideoFrameStore;
  profile: ElevationProfile;
  race: VideoRaceInfo;
  settings: VideoCompositionSettings;
};

function VideoCompositionOverlayComponent({ elevationAtDistance, frameStore, profile, race, settings }: OverlayProps) {
  const frame = useSyncExternalStore(frameStore.subscribe, frameStore.get, frameStore.get);
  const clipId = useId();
  const stats = formatRaceStats(race, settings);
  const isIntro = frame.phase === "intro";
  const isOutro = frame.phase === "outro";
  const introOpacity = isIntro ? Math.min(1, (1 - frame.phaseProgress) / 0.3) : 0;
  const outroOpacity = isOutro ? Math.min(1, Math.max(0, (frame.phaseProgress - 0.4) / 0.3)) : 0;
  const chromeOpacity = isIntro ? 1 - introOpacity : isOutro ? 1 - outroOpacity : 1;
  const cursorX = frame.routeProgress * profile.width;
  const cursorY = getProfileY(profile, elevationAtDistance(frame.distanceKm));
  const accent = settings.accentColor;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden text-white" style={{ textShadow: TEXT_SHADOW }}>
      <div className="absolute inset-x-0 top-0 h-[30%] bg-gradient-to-b from-black/60 to-transparent" style={{ opacity: chromeOpacity }} />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/70 to-transparent" style={{ opacity: isOutro ? 1 : chromeOpacity }} />

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

      {frame.aidLabel ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-[1.5cqmin] bg-black/55 text-center backdrop-blur-sm"
          style={{ top: "34%", padding: "2cqmin 4cqmin", borderLeft: `1cqmin solid ${accent}`, opacity: getLabelOpacity(frame.aidLabel, frame.timeMs) }}
        >
          <p className="font-black uppercase leading-tight" style={{ fontSize: "5cqmin" }}>{frame.aidLabel.name}</p>
          <p className="font-bold tabular-nums" style={{ fontSize: "4cqmin", color: accent }}>KM {formatKm(frame.aidLabel.distanceKm)}</p>
        </div>
      ) : null}

      {settings.showProfile || settings.showCurrentKm ? (
        <section className="absolute" style={{ left: "5cqmin", right: "16cqmin", bottom: "15cqmin", opacity: chromeOpacity }}>
          {settings.showCurrentKm ? (
            <p className="font-black tabular-nums" style={{ fontSize: "5cqmin" }}>
              KM {formatKm(frame.distanceKm)}
              <span className="font-semibold text-white/75"> / {formatInteger(profile.totalDistanceKm)}</span>
            </p>
          ) : null}
          {settings.showProfile ? (
            <div className="relative mt-[1.5cqmin]" style={{ height: "22cqmin" }}>
              <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${profile.width} ${profile.height}`} preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <clipPath id={clipId}>
                    <rect x={0} y={0} width={cursorX} height={profile.height} />
                  </clipPath>
                </defs>
                <path d={profile.areaPath} fill="rgba(255,255,255,0.14)" />
                <path d={profile.linePath} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={3} vectorEffect="non-scaling-stroke" />
                <g clipPath={`url(#${clipId})`}>
                  <path d={profile.areaPath} fill={accent} fillOpacity={0.4} />
                  <path d={profile.linePath} fill="none" stroke={accent} strokeWidth={4} vectorEffect="non-scaling-stroke" />
                </g>
                <line x1={cursorX} x2={cursorX} y1={0} y2={profile.height} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
              </svg>
              <span
                className="absolute rounded-full border-white"
                style={{
                  left: `${frame.routeProgress * 100}%`,
                  top: `${(cursorY / profile.height) * 100}%`,
                  width: "3cqmin",
                  height: "3cqmin",
                  borderWidth: "0.6cqmin",
                  background: accent,
                  transform: "translate(-50%, -50%)",
                }}
              />
              <span className="absolute left-0 top-0 font-semibold tabular-nums text-white/70" style={{ fontSize: "2.6cqmin" }}>{formatInteger(profile.maxElevationM)} m</span>
              <span className="absolute bottom-0 left-0 font-semibold tabular-nums text-white/70" style={{ fontSize: "2.6cqmin" }}>{formatInteger(profile.minElevationM)} m</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {(settings.showLogo || settings.showCta) && !isOutro ? (
        <footer className="absolute flex items-center" style={{ left: "5cqmin", bottom: "5cqmin", gap: "2cqmin", opacity: chromeOpacity }}>
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
