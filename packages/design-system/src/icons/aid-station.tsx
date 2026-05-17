import { colors } from "../tokens/colors";
import { Circle, IconBase, Line } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function AidStationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color, strokeWidth }) => (
        <>
          <Circle cx={8.5} cy={6.4} r={0.8} fill={color} stroke="none" />
          <Circle cx={11.2} cy={4.9} r={0.9} fill={color} stroke="none" />
          <Circle cx={14.2} cy={4.7} r={0.9} fill={color} stroke="none" />
          <Circle cx={17} cy={6} r={0.8} fill={color} stroke="none" />
          <Circle cx={12} cy={13.4} r={5.1} fill={color} stroke="none" />
          <Line
            x1={12}
            y1={10.6}
            x2={12}
            y2={16.2}
            stroke={colors.surface.cream}
            strokeWidth={strokeWidth}
          />
          <Line
            x1={9.2}
            y1={13.4}
            x2={14.8}
            y2={13.4}
            stroke={colors.surface.cream}
            strokeWidth={strokeWidth}
          />
        </>
      )}
    </IconBase>
  );
}
