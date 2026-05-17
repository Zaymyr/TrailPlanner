import { Circle, IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function CutoffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Circle cx={12} cy={4.2} r={0.8} fill={color} stroke="none" />
          <Circle cx={15.9} cy={5.3} r={0.8} fill={color} stroke="none" />
          <Circle cx={18.7} cy={8.1} r={0.8} fill={color} stroke="none" />
          <Circle cx={19.8} cy={12} r={0.8} fill={color} stroke="none" />
          <Circle cx={18.7} cy={15.9} r={0.8} fill={color} stroke="none" />
          <Circle cx={15.9} cy={18.7} r={0.8} fill={color} stroke="none" />
          <Circle cx={8.1} cy={18.7} r={0.8} fill={color} stroke="none" />
          <Circle cx={5.3} cy={15.9} r={0.8} fill={color} stroke="none" />
          <Circle cx={4.2} cy={12} r={0.8} fill={color} stroke="none" />
          <Path d="M5.4 8.1A7.8 7.8 0 0 1 8.1 5.4" />
        </>
      )}
    </IconBase>
  );
}
