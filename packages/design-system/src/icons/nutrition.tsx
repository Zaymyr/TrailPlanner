import { Circle, IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function NutritionIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Path d="M12.8 4.5c4.4 2 6.6 5.3 5.6 8.9-1 3.9-4.8 6.3-8.7 5.2-3.5-1-5.5-4-4.5-7.2.8-2.8 3.6-5 7.6-6.9Z" />
          <Path d="M8.2 16.7c3.1-1.2 5.2-3.5 6.2-7.2" opacity={0.55} />
          <Circle cx={11.7} cy={12.4} r={1.25} fill={color} stroke="none" />
        </>
      )}
    </IconBase>
  );
}
