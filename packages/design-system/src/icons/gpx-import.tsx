import { Circle, IconBase, Line, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function GpxImportIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Circle cx={5.2} cy={16.8} r={0.65} fill={color} stroke="none" />
          <Circle cx={4.4} cy={13.9} r={0.7} fill={color} stroke="none" />
          <Circle cx={5.6} cy={11.2} r={0.75} fill={color} stroke="none" />
          <Circle cx={8.2} cy={10.2} r={0.8} fill={color} stroke="none" />
          <Circle cx={10.4} cy={11.7} r={0.8} fill={color} stroke="none" />
          <Circle cx={10.1} cy={14.2} r={0.75} fill={color} stroke="none" />
          <Circle cx={12.6} cy={15.4} r={0.75} fill={color} stroke="none" />
          <Path d="M13.8 15.3h4.1" />
          <Path d="m16.4 13.2 2.1 2.1-2.1 2.1" />
          <Line x1={19.6} y1={8.2} x2={16.6} y2={8.2} />
          <Line x1={16.6} y1={8.2} x2={16.6} y2={11.2} />
          <Line x1={19.6} y1={20} x2={16.6} y2={20} />
          <Line x1={16.6} y1={20} x2={16.6} y2={17} />
        </>
      )}
    </IconBase>
  );
}
