import * as React from "react";
import Svg, {
  Circle,
  G,
  Line,
  Path,
} from "react-native-svg";
import { colors } from "../../tokens/colors";
import type { IconBaseProps } from "./types";

export function IconBase({
  size = 24,
  color = colors.brand.forest,
  strokeWidth = 2,
  title,
  accessibilityLabel,
  testID,
  style,
  children,
}: IconBaseProps) {
  const label = accessibilityLabel ?? title;
  const content =
    typeof children === "function" ? children({ color, strokeWidth }) : children;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityRole="image"
      accessibilityLabel={label}
      testID={testID}
      style={style as never}
    >
      <G
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {content}
      </G>
    </Svg>
  );
}

export { Circle, G, Line, Path };
