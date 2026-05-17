import { Circle, IconBase } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function EmptyPlanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Circle cx={12} cy={4} r={0.72} fill={color} stroke="none" />
          <Circle cx={16} cy={5.1} r={0.72} fill={color} stroke="none" />
          <Circle cx={18.9} cy={8} r={0.72} fill={color} stroke="none" />
          <Circle cx={20} cy={12} r={0.72} fill={color} stroke="none" />
          <Circle cx={18.9} cy={16} r={0.72} fill={color} stroke="none" />
          <Circle cx={16} cy={18.9} r={0.72} fill={color} stroke="none" />
          <Circle cx={12} cy={20} r={0.72} fill={color} stroke="none" />
          <Circle cx={8} cy={18.9} r={0.72} fill={color} stroke="none" />
          <Circle cx={5.1} cy={16} r={0.72} fill={color} stroke="none" />
          <Circle cx={4} cy={12} r={0.72} fill={color} stroke="none" />
          <Circle cx={5.1} cy={8} r={0.72} fill={color} stroke="none" />
          <Circle cx={8} cy={5.1} r={0.72} fill={color} stroke="none" />
        </>
      )}
    </IconBase>
  );
}
