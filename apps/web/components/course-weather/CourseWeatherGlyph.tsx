import React from "react";

import type { WeatherGlyphKind } from "./copy";

const CLOUD = "M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 8.9 4.6 4.6 0 0 0 7 18Z";

/**
 * Small weather glyph on the 24 grid, drawn with the signature stroke of the design-system icons.
 * The set is intentionally tiny: every MET Norway symbol maps to one of `WeatherGlyphKind`.
 */
export function CourseWeatherGlyph({ kind, label, size = 24 }: { kind: WeatherGlyphKind; label?: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    role: label ? "img" : undefined,
    "aria-label": label,
    "aria-hidden": label ? undefined : true,
    className: "shrink-0",
  };
  const sun = (cx: number, cy: number, r: number, rays = true) => (
    <g stroke="#B45309">
      <circle cx={cx} cy={cy} r={r} />
      {rays
        ? [0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={cx + Math.cos(rad) * (r + 2.2)}
                y1={cy + Math.sin(rad) * (r + 2.2)}
                x2={cx + Math.cos(rad) * (r + 4)}
                y2={cy + Math.sin(rad) * (r + 4)}
              />
            );
          })
        : null}
    </g>
  );

  const moon = (path: string) => <path d={path} stroke="#5C6450" />;

  switch (kind) {
    case "clear":
      return <svg {...common}>{sun(12, 12, 4)}</svg>;
    case "clear_night":
      return <svg {...common}>{moon("M15.5 4.5a7.5 7.5 0 1 0 4 12.6A6.2 6.2 0 0 1 15.5 4.5Z")}</svg>;
    case "partly_night":
      return (
        <svg {...common}>
          {moon("M9.5 3.5a4.6 4.6 0 1 0 3.4 7.7A3.8 3.8 0 0 1 9.5 3.5Z")}
          <path d="M9.5 19h8a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 9.6 13 3.1 3.1 0 0 0 9.5 19Z" stroke="#5C6450" />
        </svg>
      );
    case "partly":
      return (
        <svg {...common}>
          {sun(8, 8, 2.8)}
          <path d="M9.5 19h8a3.5 3.5 0 0 0 .5-6.96A4.8 4.8 0 0 0 9.6 13 3.1 3.1 0 0 0 9.5 19Z" stroke="#5C6450" />
        </svg>
      );
    case "cloudy":
      return (
        <svg {...common}>
          <path d={CLOUD} stroke="#5C6450" />
        </svg>
      );
    case "fog":
      return (
        <svg {...common} stroke="#5C6450">
          <path d="M5 9h14M3 13h18M6 17h12" />
        </svg>
      );
    case "rain":
      return (
        <svg {...common}>
          <path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 5.9 4.6 4.6 0 0 0 7 15Z" stroke="#5C6450" />
          <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" stroke="#3F6F8F" />
        </svg>
      );
    case "snow":
      return (
        <svg {...common}>
          <path d="M7 15h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 5.9 4.6 4.6 0 0 0 7 15Z" stroke="#5C6450" />
          <path d="M9 18.5v.01M13 20v.01M17 18.5v.01" stroke="#3F6F8F" strokeWidth={2.6} />
        </svg>
      );
    case "storm":
      return (
        <svg {...common}>
          <path d="M7 14h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 4.9 4.6 4.6 0 0 0 7 14Z" stroke="#5C6450" />
          <path d="M12.5 14l-2.5 4h3l-1.5 4" stroke="#B45309" />
        </svg>
      );
    default:
      return (
        <svg {...common} stroke="#5C6450">
          <circle cx={12} cy={12} r={8} strokeDasharray="2 3" />
        </svg>
      );
  }
}
