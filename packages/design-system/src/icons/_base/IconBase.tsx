import * as React from "react";
import type { IconBaseProps } from "./types";

export function IconBase({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
  title,
  accessibilityLabel,
  testID,
  className,
  style,
  children,
}: IconBaseProps) {
  const label = accessibilityLabel ?? title;
  const content =
    typeof children === "function" ? children({ color, strokeWidth }) : children;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      data-testid={testID}
      className={className}
      style={style as React.CSSProperties | undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      <g
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </g>
    </svg>
  );
}

export const Circle = "circle" as unknown as React.ComponentType<
  React.SVGProps<SVGCircleElement>
>;
export const G = "g" as unknown as React.ComponentType<
  React.SVGProps<SVGGElement>
>;
export const Line = "line" as unknown as React.ComponentType<
  React.SVGProps<SVGLineElement>
>;
export const Path = "path" as unknown as React.ComponentType<
  React.SVGProps<SVGPathElement>
>;
