"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, Segment } from "../types";
import { formatClockTime } from "../utils/format";

function slopeToColor(grade: number) {
  const clamped = Math.max(-0.25, Math.min(0.25, grade));
  const t = (clamped + 0.25) / 0.5;
  const start = { r: 59, g: 130, b: 246 }; // blue
  const end = { r: 239, g: 68, b: 68 }; // red
  const channel = (from: number, to: number) => Math.round(from + (to - from) * t);

  return `rgb(${channel(start.r, end.r)}, ${channel(start.g, end.g)}, ${channel(start.b, end.b)})`;
}

type EnrichedElevationPoint = ElevationPoint & {
  segmentGainM: number;
  segmentLossM: number;
  cumulativeGainM: number;
  cumulativeLossM: number;
  timeMinutes: number | null;
};

type ChartHoverState = {
  hoveredIndex: number | null;
  isPinned: boolean;
  setPinned: (pinned: boolean) => void;
  updateFromClientX: (clientX: number) => void;
  clearHover: () => void;
};

const findNearestPointIndex = (points: ElevationPoint[], distanceKm: number) => {
  if (points.length === 0) return null;
  let left = 0;
  let right = points.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const current = points[mid];
    if (!current) break;
    if (current.distanceKm === distanceKm) return mid;
    if (current.distanceKm < distanceKm) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  const leftPoint = points[left];
  const rightPoint = points[Math.max(left - 1, 0)];
  if (!leftPoint) return points.length - 1;
  if (!rightPoint) return 0;
  return Math.abs(leftPoint.distanceKm - distanceKm) < Math.abs(rightPoint.distanceKm - distanceKm) ? left : left - 1;
};

const useChartHover = (
  points: ElevationPoint[],
  getDistanceForClientX: (clientX: number) => number | null
): ChartHoverState => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isPinned, setPinned] = useState(false);
  const hoveredIndexRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingClientXRef = useRef<number | null>(null);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      pendingClientXRef.current = clientX;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        const pendingClientX = pendingClientXRef.current;
        frameRef.current = null;
        if (pendingClientX === null) return;
        const distanceKm = getDistanceForClientX(pendingClientX);
        if (distanceKm === null) return;
        const nextIndex = findNearestPointIndex(points, distanceKm);
        if (nextIndex === null) return;
        if (hoveredIndexRef.current !== nextIndex) {
          hoveredIndexRef.current = nextIndex;
          setHoveredIndex(nextIndex);
        }
      });
    },
    [getDistanceForClientX, points]
  );

  const clearHover = useCallback(() => {
    hoveredIndexRef.current = null;
    setHoveredIndex(null);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    hoveredIndex,
    isPinned,
    setPinned,
    updateFromClientX,
    clearHover,
  };
};

export function ElevationProfileChart({
  profile,
  aidStations,
  segments,
  totalDistanceKm,
  copy,
  baseMinutesPerKm,
}: {
  profile: ElevationPoint[];
  aidStations: AidStation[];
  segments: Segment[];
  totalDistanceKm: number;
  copy: RacePlannerTranslations;
  baseMinutesPerKm: number | null;
}) {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [chartWidth, setChartWidth] = useState(900);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [ravitoIndex, setRavitoIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setChartWidth(entry.contentRect.width);
    });

    observer.observe(chartContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const hasProfile = profile.length > 0 && totalDistanceKm > 0;
  const safeProfile = useMemo(
    () => (profile.length > 0 ? profile : [{ distanceKm: 0, elevationM: 0 }]),
    [profile]
  );

  const width = Math.max(Math.round(chartWidth), 480);
  const paddingX = 20;
  const paddingY = 14;
  const elevationAreaHeight = 150;
  const height = paddingY + elevationAreaHeight + paddingY;
  const elevationBottom = paddingY + elevationAreaHeight;
  const maxElevation = Math.max(...safeProfile.map((p) => p.elevationM));
  const minElevation = Math.min(...safeProfile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;
  const trackDistanceKm = Math.max(totalDistanceKm, safeProfile.at(-1)?.distanceKm ?? 0, 1);

  const xScale = useCallback(
    (distanceKm: number) =>
      paddingX +
      Math.min(Math.max(distanceKm, 0), trackDistanceKm) * ((width - paddingX * 2) / trackDistanceKm),
    [paddingX, trackDistanceKm, width]
  );
  const yScale = useCallback(
    (elevation: number) =>
      elevationBottom - ((elevation - minElevation) / elevationRange) * elevationAreaHeight,
    [elevationAreaHeight, elevationBottom, elevationRange, minElevation]
  );

  const enrichedProfile = useMemo<EnrichedElevationPoint[]>(() => {
    const sorted = [...safeProfile].sort((a, b) => a.distanceKm - b.distanceKm);
    let cumulativeGainM = 0;
    let cumulativeLossM = 0;
    return sorted.map((point, index) => {
      const previous = sorted[index - 1];
      const delta = previous ? point.elevationM - previous.elevationM : 0;
      const segmentGainM = Math.max(delta, 0);
      const segmentLossM = Math.max(-delta, 0);
      cumulativeGainM += segmentGainM;
      cumulativeLossM += segmentLossM;
      const timeMinutes =
        baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
          ? point.distanceKm * baseMinutesPerKm
          : null;
      return {
        ...point,
        segmentGainM,
        segmentLossM,
        cumulativeGainM,
        cumulativeLossM,
        timeMinutes,
      };
    });
  }, [baseMinutesPerKm, safeProfile]);

  const getDistanceForClientX = useCallback(
    (clientX: number) => {
      if (!chartContainerRef.current) return null;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const clampedX = Math.min(Math.max(offsetX, 0), rect.width);
      const ratio = rect.width > 0 ? clampedX / rect.width : 0;
      return ratio * trackDistanceKm;
    },
    [trackDistanceKm]
  );

  const { hoveredIndex, isPinned, setPinned, updateFromClientX, clearHover } = useChartHover(
    enrichedProfile,
    getDistanceForClientX
  );

  const getElevationAtDistance = (distanceKm: number) => {
    if (safeProfile.length === 0) return minElevation;
    const clamped = Math.min(Math.max(distanceKm, 0), totalDistanceKm);
    const nextIndex = safeProfile.findIndex((point) => point.distanceKm >= clamped);
    if (nextIndex <= 0) return safeProfile[0].elevationM;
    const prevPoint = safeProfile[nextIndex - 1];
    const nextPoint = safeProfile[nextIndex] ?? prevPoint;
    const ratio =
      nextPoint.distanceKm === prevPoint.distanceKm
        ? 0
        : (clamped - prevPoint.distanceKm) / (nextPoint.distanceKm - prevPoint.distanceKm);
    return prevPoint.elevationM + (nextPoint.elevationM - prevPoint.elevationM) * ratio;
  };

  const path = safeProfile
    .map((point, index) => `${index === 0 ? "M" : "L"}${xScale(point.distanceKm)},${yScale(point.elevationM)}`)
    .join(" ");

  const areaPath = `${path} L${xScale(safeProfile.at(-1)?.distanceKm ?? 0)},${elevationBottom} L${xScale(
    safeProfile[0].distanceKm
  )},${elevationBottom} Z`;

  const slopeSegments = safeProfile.slice(1).map((point, index) => {
    const prev = safeProfile[index];
    const deltaDistanceKm = Math.max(point.distanceKm - prev.distanceKm, 0.0001);
    const grade = (point.elevationM - prev.elevationM) / (deltaDistanceKm * 1000);

    return {
      x1: xScale(prev.distanceKm),
      y1: yScale(prev.elevationM),
      x2: xScale(point.distanceKm),
      y2: yScale(point.elevationM),
      color: slopeToColor(grade),
    };
  });

  const activeRavito = ravitoIndex !== null ? aidStations[ravitoIndex] : null;
  const activePoint =
    ravitoIndex !== null
      ? null
      : hoveredIndex !== null
        ? enrichedProfile[hoveredIndex] ?? null
        : null;

  const activeDistanceKm = activeRavito?.distanceKm ?? activePoint?.distanceKm ?? null;
  const activeElevationM =
    activeDistanceKm !== null ? getElevationAtDistance(activeDistanceKm) : activePoint?.elevationM ?? null;

  const activeSegment =
    activeRavito &&
    segments.find(
      (segment) =>
        segment.checkpoint === activeRavito.name && Math.abs(segment.distanceKm - activeRavito.distanceKm) < 0.05
    );

  const paceLabel =
    baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
      ? (() => {
          const minutes = Math.floor(baseMinutesPerKm);
          const seconds = Math.round((baseMinutesPerKm - minutes) * 60);
          const safeSeconds = seconds === 60 ? 0 : seconds;
          const safeMinutes = seconds === 60 ? minutes + 1 : minutes;
          return `${safeMinutes}:${String(safeSeconds).padStart(2, "0")} /km`;
        })()
      : null;
  const speedLabel =
    baseMinutesPerKm && Number.isFinite(baseMinutesPerKm) && baseMinutesPerKm > 0
      ? `${(60 / baseMinutesPerKm).toFixed(1)} ${copy.sections.courseProfile.speedUnit}`
      : null;

  useLayoutEffect(() => {
    if (!chartContainerRef.current || !svgRef.current || !tooltipRef.current) return;
    if (activeDistanceKm === null || activeElevationM === null) {
      setTooltipPosition(null);
      return;
    }
    const containerRect = chartContainerRef.current.getBoundingClientRect();
    const svgRect = svgRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const anchorX = (xScale(activeDistanceKm) / width) * svgRect.width;
    const anchorY = (yScale(activeElevationM) / height) * svgRect.height;
    let left = anchorX + 12;
    let top = anchorY - tooltipRect.height - 12;
    if (left + tooltipRect.width > containerRect.width) {
      left = anchorX - tooltipRect.width - 12;
    }
    if (left < 8) left = 8;
    if (top < 8) {
      top = anchorY + 12;
    }
    if (top + tooltipRect.height > containerRect.height - 8) {
      top = containerRect.height - tooltipRect.height - 8;
    }
    setTooltipPosition({ left, top });
  }, [activeDistanceKm, activeElevationM, height, width, xScale, yScale]);

  useEffect(() => {
    if (!isPinned) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (chartContainerRef.current?.contains(event.target as Node)) return;
      setPinned(false);
      setRavitoIndex(null);
      clearHover();
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [clearHover, isPinned, setPinned]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPinned(false);
      setRavitoIndex(null);
      clearHover();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearHover, setPinned]);

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (isPinned) return;
    updateFromClientX(event.clientX);
  };

  const handlePointerLeave = () => {
    if (isPinned) return;
    clearHover();
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "touch") return;
    setPinned(true);
    updateFromClientX(event.clientX);
  };

  const cursorX =
    activeDistanceKm !== null && activeDistanceKm !== undefined ? xScale(activeDistanceKm) : null;
  const cursorY =
    activeElevationM !== null && activeElevationM !== undefined ? yScale(activeElevationM) : null;

  if (!hasProfile) {
    return <p className="text-sm text-muted-foreground dark:text-slate-400">{copy.sections.courseProfile.empty}</p>;
  }

  return (
    <div ref={chartContainerRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[190px] w-full"
        role="img"
        aria-label={copy.sections.courseProfile.ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <defs>
          <linearGradient id="elevationGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {[scaledMin, scaledMax].map((tick) => (
          <g key={tick}>
            <line
              x1={paddingX}
              x2={width - paddingX}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke="#1f2937"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text x={paddingX - 8} y={yScale(tick) + 4} className="fill-slate-400 text-[10px]" textAnchor="end">
              {tick.toFixed(0)} {copy.units.meter}
            </text>
          </g>
        ))}

        <path d={areaPath} fill="url(#elevationGradient)" stroke="none" />
        {slopeSegments.map((segment, index) => (
          <line
            key={`${segment.x1}-${segment.x2}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {cursorX !== null && cursorY !== null && (
          <>
            <line x1={cursorX} x2={cursorX} y1={paddingY} y2={elevationBottom} stroke="#38bdf8" strokeWidth={1} />
            <circle cx={cursorX} cy={cursorY} r={4} fill="#38bdf8" stroke="#0f172a" strokeWidth={2} />
          </>
        )}

        {aidStations.map((station, index) => {
          const x = xScale(station.distanceKm);
          const elevationAtPoint = getElevationAtDistance(station.distanceKm);
          const y = yScale(elevationAtPoint);
          return (
            <g
              key={`${station.name}-${station.distanceKm}`}
              role="button"
              tabIndex={0}
              aria-label={`${copy.sections.courseProfile.tooltip.ravitoTitle}: ${station.name}`}
              onFocus={() => setRavitoIndex(index)}
              onBlur={() => setRavitoIndex(null)}
              onPointerEnter={() => setRavitoIndex(index)}
              onPointerLeave={() => setRavitoIndex(null)}
            >
              <line x1={x} x2={x} y1={y} y2={elevationBottom} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="2 3" />
              <circle cx={x} cy={y} r={4} fill="#fbbf24" />
              <text x={x} y={elevationBottom + 12} className="fill-slate-300 text-[10px]" textAnchor="middle">
                {station.name}
              </text>
            </g>
          );
        })}

        <text
          x={width / 2}
          y={height - 4}
          className="fill-slate-400 text-[10px]"
          textAnchor="middle"
        >
          {copy.sections.courseProfile.axisLabel}
        </text>
      </svg>

      {(activePoint || activeRavito) && (
        <div
          ref={tooltipRef}
          className="absolute z-10 max-w-[220px] rounded-md border border-border bg-slate-950/90 p-3 text-xs text-slate-100 shadow-lg backdrop-blur"
          style={
            tooltipPosition
              ? { left: tooltipPosition.left, top: tooltipPosition.top }
              : { left: 12, top: 12 }
          }
        >
          {activeRavito ? (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-slate-50">
                {copy.sections.courseProfile.tooltip.ravitoTitle}: {activeRavito.name}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-200">
                <div>
                  {copy.sections.courseProfile.tooltip.distance}: {activeRavito.distanceKm.toFixed(1)} {" "}
                  {copy.units.kilometer}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.waterRefill}: {" "}
                  {activeRavito.waterRefill !== false
                    ? copy.sections.courseProfile.tooltip.waterRefillYes
                    : copy.sections.courseProfile.tooltip.waterRefillNo}
                </div>
                {activeSegment ? (
                  <>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedGels}: {activeSegment.gelsPlanned.toFixed(1)}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedCarbs}: {activeSegment.plannedFuelGrams.toFixed(0)} {" "}
                      {copy.units.grams}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedCalories}: {" "}
                      {(activeSegment.plannedFuelGrams * 4).toFixed(0)} kcal
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedSodium}: {activeSegment.plannedSodiumMg.toFixed(0)} {" "}
                      {copy.units.milligrams}
                    </div>
                    <div>
                      {copy.sections.courseProfile.tooltip.plannedWater}: {activeSegment.plannedWaterMl.toFixed(0)} {" "}
                      {copy.units.milliliters}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          ) : activePoint ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-200">
                <div>
                  {copy.sections.courseProfile.tooltip.distance}: {activePoint.distanceKm.toFixed(1)} {" "}
                  {copy.units.kilometer}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.elevation}: {activePoint.elevationM.toFixed(0)} {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.segmentGain}: {activePoint.segmentGainM.toFixed(0)} {" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.segmentLoss}: {activePoint.segmentLossM.toFixed(0)} {" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.cumulativeGain}: {activePoint.cumulativeGainM.toFixed(0)} {" "}
                  {copy.units.meter}
                </div>
                <div>
                  {copy.sections.courseProfile.tooltip.cumulativeLoss}: {activePoint.cumulativeLossM.toFixed(0)} {" "}
                  {copy.units.meter}
                </div>
                {activePoint.timeMinutes !== null ? (
                  <div>
                    {copy.sections.courseProfile.tooltip.time}: {formatClockTime(activePoint.timeMinutes)}
                  </div>
                ) : null}
              </div>
              {(paceLabel || speedLabel) && (
                <div className="text-[11px] text-slate-300">
                  {paceLabel ? `${copy.sections.courseProfile.tooltip.pace}: ${paceLabel}` : null}
                  {paceLabel && speedLabel ? " • " : null}
                  {speedLabel ? `${copy.sections.courseProfile.tooltip.speed}: ${speedLabel}` : null}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
