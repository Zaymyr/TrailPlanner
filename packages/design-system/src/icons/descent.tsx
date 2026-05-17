import { Circle, IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function DescentIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Circle cx={5} cy={5.6} r={0.75} fill={color} stroke="none" />
          <Circle cx={7.1} cy={7.2} r={0.85} fill={color} stroke="none" />
          <Circle cx={9.3} cy={9} r={0.95} fill={color} stroke="none" />
          <Circle cx={11.6} cy={10.7} r={1.05} fill={color} stroke="none" />
          <Path d="m5.7 10.2 6.3 6.4 6.3-6.4" />
        </>
      )}
    </IconBase>
  );
}
