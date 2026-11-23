"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AidStationIcon } from "@pace-yourself/design-system/icons";
import type { RacePlannerTranslations } from "../../../../locales/types";
import type { AidStation, ElevationPoint, Segment } from "../types";
import { formatClockTime } from "../utils/format";
import { buildWaypointLabelLayout } from "../utils/waypoint-label-layout";

function niceStep(range: number, targetCount: number): number {
  const roughStep = Math.max(range, 1) / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  const niceNorm = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return niceNorm * magnitude;
}

// Chart palette (design-system tokens): climb = forest, descent = alpine blue.
const CHART = {
  climb: "#3F6B1F",
  descent: "#3F6F8F",
  forest: "#2D5016",
  ink: "#1F2410",
  inkSecondary: "#5C6450",
  inkTertiary: "#8A917E",
  grid: "#E5E2D8",
  axis: "#C9C5B8",
  target: "#C8D44E",
  surface: "#FFFFFF",
} as const;
const MONO_FONT = "var(--font-plan-mono), ui-monospace, SFMono-Regular, Menlo, monospace";
const DISPLAY_FONT = "var(--font-plan-display), ui-sans-serif, system-ui, sans-serif";

type Rgb = { r: number; g: number; b: number };
const mix = (from: Rgb, to: Rgb, t: number) => {
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `rgb(${channel(from.r, to.r)}, ${channel(from.g, to.g)}, ${channel(from.b, to.b)})`;
};

function slopeToColor(grade: number) {
  // Steeper grades get the deeper shade of their family; flat reads as climb green.
  const t = Math.min(Math.abs(grade) / 0.2, 1);
  if (grade < -0.01) {
    return mix({ r: 107, g: 148, b: 173 }, { r: 47, g: 88, b: 117 }, t); // alpine blue family
  }
  return mix({ r: 95, g: 130, b: 62 }, { r: 31, g: 56, b: 16 }, t); // forest family
}

/** Picks a "nice" kilometre step so that ticks keep at least ~48 px apart. */
function distanceTickStep(trackDistanceKm: number, plotWidthPx: number) {
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100];
  const maxTicks = Math.max(Math.floor(plotWidthPx / 48), 2);
  return candidates.find((step) => trackDistanceKm / step <= maxTicks) ?? 100;
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
  const gradientId = `elevation-fill-${useId().replace(/:/g, "")}`;
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

  // Render at the real container width (no down-scaling on phones) so the
  // mono labels keep their size; ticks adapt their density below.
  const width = Math.max(Math.round(chartWidth), 300);
  const paddingX = 14;
  const paddingLeft = 46;
  const paddingY = 26;
  const paddingYBottom = 50;
  const elevationAreaHeight = 150;
  const height = paddingY + elevationAreaHeight + paddingYBottom;
  const elevationBottom = paddingY + elevationAreaHeight;
  const maxElevation = Math.max(...safeProfile.map((p) => p.elevationM));
  const minElevation = Math.min(...safeProfile.map((p) => p.elevationM));
  const elevationRange = Math.max(maxElevation - minElevation, 1);
  const scaledMax = Math.ceil(maxElevation / 10) * 10;
  const scaledMin = Math.floor(minElevation / 10) * 10;
  const trackDistanceKm = Math.max(totalDistanceKm, safeProfile.at(-1)?.distanceKm ?? 0, 1);

  const xScale = useCallback(
    (distanceKm: number) =>
      paddingLeft +
      Math.min(Math.max(distanceKm, 0), trackDistanceKm) * ((width - paddingLeft - paddingX) / trackDistanceKm),
    [paddingLeft, paddingX, trackDistanceKm, width]
  );

  const yTicks = useMemo(() => {
    const range = Math.max(scaledMax - scaledMin, 1);
    const step = niceStep(range, 4);
    const first = Math.ceil(scaledMin / step) * step;
    const ticks: number[] = [];
    for (let t = first; t <= scaledMax + step * 0.01; t += step) {
      ticks.push(Math.round(t));
    }
    return ticks;
  }, [scaledMin, scaledMax]);

  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = distanceTickStep(trackDistanceKm, width - paddingLeft - paddingX);
    for (let d = step; d <= trackDistanceKm; d += step) {
      ticks.push(Math.round(d * 10) / 10);
    }
    return ticks;
  }, [paddingLeft, paddingX, trackDistanceKm, width]);

  const finishStationIndex = useMemo(() => {
    if (aidStations.length === 0) return -1;
    let maxDist = -Infinity;
    let maxIdx = 0;
    aidStations.forEach((s, i) => {
      if (s.distanceKm > maxDist) {
        maxDist = s.distanceKm;
        maxIdx = i;
      }
    });
    return maxIdx;
  }, [aidStations]);

  const aidStationLabelLayout = useMemo(() => {
    const layout = buildWaypointLabelLayout(
      aidStations.map((station, index) => ({
        index,
        name: station.name,
        x: xScale(station.distanceKm),
        isFinish: index === finishStationIndex,
        isSelected: ravitoIndex === index,
      })),
      { widthPx: width }
    );

    return new Map(layout.map((item) => [item.index, item] as const));
  }, [aidStations, finishStationIndex, ravitoIndex, width, xScale]);
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
    return <p className="text-sm text-[#5C6450]">{copy.sections.courseProfile.empty}</p>;
  }

  const monoText = { fontFamily: MONO_FONT, fontVariantNumeric: "tabular-nums" } as const;
  // White halo keeps place names legible where they cross the profile line.
  const displayText = { fontFamily: DISPLAY_FONT, paintOrder: "stroke" } as const;
  const halo = { stroke: CHART.surface, strokeWidth: 3, strokeLinejoin: "round" as const };

  // Discreet legend, top-right: short stroke swatches + muted labels.
  const legendY = 12;
  const estimateTextWidth = (label: string) => label.length * 5.6;
  const descentTextX = width - paddingX;
  const descentSwatchX2 = descentTextX - estimateTextWidth(copy.sections.courseProfile.legendDescent) - 5;
  const descentSwatchX1 = descentSwatchX2 - 12;
  const climbTextX = descentSwatchX1 - 12;
  const climbSwatchX2 = climbTextX - estimateTextWidth(copy.sections.courseProfile.legendClimb) - 5;
  const climbSwatchX1 = climbSwatchX2 - 12;

  const units = copy.units;
  const tooltipCopy = copy.sections.courseProfile.tooltip;
  const tooltipCells: Array<{ label: string; value: string }> = activeRavito
    ? [
        { label: tooltipCopy.distance, value: `${activeRavito.distanceKm.toFixed(1)} ${units.kilometer}` },
        {
          label: tooltipCopy.waterRefill,
          value: activeRavito.waterRefill !== false ? tooltipCopy.waterRefillYes : tooltipCopy.waterRefillNo,
        },
        ...(activeSegment
          ? [
              { label: tooltipCopy.plannedGels, value: activeSegment.gelsPlanned.toFixed(1) },
              { label: tooltipCopy.plannedCarbs, value: `${activeSegment.plannedFuelGrams.toFixed(0)} ${units.grams}` },
              { label: tooltipCopy.plannedCalories, value: `${(activeSegment.plannedFuelGrams * 4).toFixed(0)} kcal` },
              {
                label: tooltipCopy.plannedSodium,
                value: `${activeSegment.plannedSodiumMg.toFixed(0)} ${units.milligrams}`,
              },
              {
                label: tooltipCopy.plannedWater,
                value: `${activeSegment.plannedWaterMl.toFixed(0)} ${units.milliliters}`,
              },
            ]
          : []),
      ]
    : activePoint
      ? [
          { label: tooltipCopy.distance, value: `${activePoint.distanceKm.toFixed(1)} ${units.kilometer}` },
          { label: tooltipCopy.elevation, value: `${activePoint.elevationM.toFixed(0)} ${units.meter}` },
          { label: tooltipCopy.segmentGain, value: `${activePoint.segmentGainM.toFixed(0)} ${units.meter}` },
          { label: tooltipCopy.segmentLoss, value: `${activePoint.segmentLossM.toFixed(0)} ${units.meter}` },
          { label: tooltipCopy.cumulativeGain, value: `${activePoint.cumulativeGainM.toFixed(0)} ${units.meter}` },
          { label: tooltipCopy.cumulativeLoss, value: `${activePoint.cumulativeLossM.toFixed(0)} ${units.meter}` },
          ...(activePoint.timeMinutes !== null
            ? [{ label: tooltipCopy.time, value: formatClockTime(activePoint.timeMinutes) }]
            : []),
        ]
      : [];

  return (
    <div ref={chartContainerRef} className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={copy.sections.courseProfile.ariaLabel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={CHART.forest} stopOpacity="0.16" />
            <stop offset="100%" stopColor={CHART.forest} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const lineY = yScale(tick);
          return (
            <g key={tick}>
              <line
                x1={paddingLeft}
                x2={width - paddingX}
                y1={lineY}
                y2={lineY}
                stroke={CHART.grid}
                strokeWidth={1}
                strokeDasharray="2 4"
              />
              <text x={paddingLeft - 8} y={lineY + 3.5} fontSize={10} fill={CHART.inkTertiary} textAnchor="end" style={monoText}>
                {tick.toFixed(0)} {copy.units.meter}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        {slopeSegments.map((segment, index) => (
          <line
            key={`${segment.x1}-${segment.x2}-${index}`}
            x1={segment.x1}
            y1={segment.y1}
            x2={segment.x2}
            y2={segment.y2}
            stroke={segment.color}
            strokeWidth={2.25}
            strokeLinecap="round"
          />
        ))}

        <line
          x1={paddingLeft}
          x2={width - paddingX}
          y1={elevationBottom}
          y2={elevationBottom}
          stroke={CHART.axis}
          strokeWidth={1}
        />

        {(() => {
          const startX = xScale(0);
          const startElevation = getElevationAtDistance(0);
          const startY = yScale(startElevation);
          return (
            <g>
              <line x1={startX} x2={startX} y1={startY} y2={elevationBottom} stroke={CHART.forest} strokeWidth={1.25} />
              <circle cx={startX} cy={startY} r={4} fill={CHART.surface} stroke={CHART.forest} strokeWidth={2} />
              <text
                x={startX - 2}
                y={Math.max(startY - 10, 10)}
                fontSize={10}
                fontWeight={600}
                fill={CHART.ink}
                textAnchor="start"
                style={displayText}
                  {...halo}
              >
                {copy.sections.courseProfile.startLabel}
              </text>
            </g>
          );
        })()}

        {aidStations.map((station, index) => {
          const isFinish = index === finishStationIndex;
          const isActive = ravitoIndex === index;
          const x = xScale(station.distanceKm);
          const elevationAtPoint = getElevationAtDistance(station.distanceKm);
          const y = yScale(elevationAtPoint);
          const labelLayout = aidStationLabelLayout.get(index);
          const showLabel = !isFinish && Boolean(labelLayout?.visibleLabel);
          const labelY = labelLayout?.lane === "top" ? Math.max(y - 14, paddingY + 6) : elevationBottom + 33;
          const labelText = labelLayout?.shortLabel ?? station.name;
          return (
            <g
              key={`${station.name}-${station.distanceKm}`}
              role="button"
              tabIndex={0}
              className="cursor-pointer outline-none"
              aria-label={`${copy.sections.courseProfile.tooltip.ravitoTitle}: ${station.name}`}
              onFocus={() => setRavitoIndex(index)}
              onBlur={() => setRavitoIndex(null)}
              onPointerEnter={() => setRavitoIndex(index)}
              onPointerLeave={() => setRavitoIndex(null)}
              onClick={() => setRavitoIndex((current) => (current === index ? null : index))}
            >
              <title>{station.name}</title>
              <line
                x1={x}
                x2={x}
                y1={y}
                y2={elevationBottom}
                stroke={isFinish || isActive ? CHART.forest : CHART.inkTertiary}
                strokeWidth={isFinish ? 1.5 : 1}
                strokeDasharray={isFinish ? undefined : "1.5 3"}
              />
              {isActive ? (
                <circle cx={x} cy={y} r={9} fill="none" stroke={CHART.forest} strokeOpacity={0.35} strokeWidth={1.5} />
              ) : null}
              {isFinish ? (
                <circle cx={x} cy={y} r={5} fill={CHART.forest} stroke={CHART.surface} strokeWidth={2} />
              ) : (
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 5 : 3.75}
                  fill={isActive ? CHART.target : CHART.surface}
                  stroke={CHART.forest}
                  strokeWidth={1.75}
                />
              )}
              {isFinish ? (
                <text
                  x={x + 2}
                  y={Math.max(y - 10, paddingY + 4)}
                  fontSize={10}
                  fontWeight={600}
                  fill={CHART.ink}
                  textAnchor="end"
                  style={displayText}
                  {...halo}
                >
                  {copy.sections.courseProfile.finishLabel}
                </text>
              ) : showLabel ? (
                <text
                  x={x}
                  y={labelY}
                  fontSize={10}
                  fontWeight={600}
                  fill={isActive ? CHART.ink : CHART.inkSecondary}
                  textAnchor="middle"
                  style={displayText}
                  {...halo}
                >
                  {labelText}
                </text>
              ) : null}
            </g>
          );
        })}

        {cursorX !== null && cursorY !== null && (
          <g pointerEvents="none">
            <line
              x1={cursorX}
              x2={cursorX}
              y1={paddingY}
              y2={elevationBottom}
              stroke={CHART.ink}
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <circle cx={cursorX} cy={cursorY} r={4.5} fill={CHART.surface} stroke={CHART.forest} strokeWidth={2} />
          </g>
        )}

        {xTicks.map((d) => {
          const x = xScale(d);
          return (
            <g key={d}>
              <line x1={x} x2={x} y1={elevationBottom} y2={elevationBottom + 4} stroke={CHART.axis} strokeWidth={1} />
              <text x={x} y={elevationBottom + 15} fontSize={10} fill={CHART.inkTertiary} textAnchor="middle" style={monoText}>
                {d}
              </text>
            </g>
          );
        })}

        <text
          x={width - paddingX}
          y={elevationBottom + 46}
          fontSize={10}
          fill={CHART.inkTertiary}
          textAnchor="end"
        >
          {copy.sections.courseProfile.axisLabel}
        </text>

        <g aria-hidden="true">
          <line
            x1={climbSwatchX1}
            x2={climbSwatchX2}
            y1={legendY - 3.5}
            y2={legendY - 3.5}
            stroke={CHART.climb}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <text x={climbTextX} y={legendY} fontSize={10} fill={CHART.inkSecondary} textAnchor="end">
            {copy.sections.courseProfile.legendClimb}
          </text>
          <line
            x1={descentSwatchX1}
            x2={descentSwatchX2}
            y1={legendY - 3.5}
            y2={legendY - 3.5}
            stroke={CHART.descent}
            strokeWidth={2.5}
            strokeLinecap="round"
          />
          <text x={descentTextX} y={legendY} fontSize={10} fill={CHART.inkSecondary} textAnchor="end">
            {copy.sections.courseProfile.legendDescent}
          </text>
        </g>
      </svg>

      {(activePoint || activeRavito) && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-[10px] border border-[#E5E2D8] bg-white/95 p-3 text-[#1F2410] shadow-[0_10px_30px_rgba(31,36,16,0.12)] backdrop-blur"
          style={
            tooltipPosition
              ? { left: tooltipPosition.left, top: tooltipPosition.top }
              : { left: 12, top: 12 }
          }
        >
          {activeRavito ? (
            <div className="mb-2 flex items-center gap-1.5 font-[family-name:var(--font-plan-display)] text-[13px] font-semibold leading-tight">
              <AidStationIcon size={14} strokeWidth={1.8} color={CHART.forest} />
              <span>
                {copy.sections.courseProfile.tooltip.ravitoTitle}: {activeRavito.name}
              </span>
            </div>
          ) : null}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {tooltipCells.map((cell) => (
              <div key={cell.label} className="min-w-0">
                <dt className="text-[10px] leading-tight text-[#8A917E]">{cell.label}</dt>
                <dd className="font-[family-name:var(--font-plan-mono)] text-[12px] font-medium leading-tight tabular-nums">
                  {cell.value}
                </dd>
              </div>
            ))}
          </dl>
          {!activeRavito && (paceLabel || speedLabel) ? (
            <p className="mt-2 border-t border-[#E5E2D8] pt-2 text-[11px] text-[#5C6450]">
              {paceLabel ? `${copy.sections.courseProfile.tooltip.pace}: ${paceLabel}` : null}
              {paceLabel && speedLabel ? " · " : null}
              {speedLabel ? `${copy.sections.courseProfile.tooltip.speed}: ${speedLabel}` : null}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
