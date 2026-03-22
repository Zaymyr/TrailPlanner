"use client";

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseProps = {
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function SparklesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 3.5 13.8 9 19 10.8 13.8 12.6 12 18.1 10.2 12.6 5 10.8 10.2 9 12 3.5Z" />
      <path d="M5.5 5 6.4 7.6 9 8.5 6.4 9.4 5.5 12 4.6 9.4 2 8.5 4.6 7.6 5.5 5Z" />
      <path d="M18.5 13 19.2 15 21 15.8 19.2 16.6 18.5 18.6 17.7 16.6 16 15.8 17.7 15 18.5 13Z" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  );
}

export function Clock3Icon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 1.5" />
    </svg>
  );
}

export function GaugeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 20a7 7 0 1 1 7-7" />
      <path d="M12 13.5 16 9.5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M13 2 5 13h6l-1 9 9-13h-6l1-7Z" />
    </svg>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" {...baseProps} {...props}>
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}
