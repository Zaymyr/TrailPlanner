import { Circle, IconBase, Line, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function SummitIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Path d="M5 16.5 12 8l7 8.5" />
          <Circle cx={12} cy={8} r={1.35} fill={color} stroke="none" />
          <Line x1={6.5} y1={19} x2={17.5} y2={19} />
        </>
      )}
    </IconBase>
  );
}
