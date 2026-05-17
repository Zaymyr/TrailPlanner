import { Circle, IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function TrailIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Circle cx={3.5} cy={15.5} r={0.7} fill={color} stroke="none" />
          <Circle cx={5.4} cy={14.7} r={0.8} fill={color} stroke="none" />
          <Circle cx={7.4} cy={13.9} r={0.9} fill={color} stroke="none" />
          <Circle cx={9.4} cy={13.4} r={1} fill={color} stroke="none" />
          <Path d="M10.5 13.2c3.6-.9 4.8 4.4 9.9-2.9" />
        </>
      )}
    </IconBase>
  );
}
