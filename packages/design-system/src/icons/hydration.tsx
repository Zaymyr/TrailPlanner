import { Circle, IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function HydrationIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      {({ color }) => (
        <>
          <Path d="M12 3.8c3.7 4.2 5.6 7.3 5.6 10.1 0 3.4-2.4 5.8-5.6 5.8s-5.6-2.4-5.6-5.8c0-2.8 1.9-5.9 5.6-10.1Z" />
          <Path d="M8.4 13.3c1.4-.9 2.9-.9 4.3 0 1.2.8 2.2.8 2.9 0" />
          <Circle cx={12} cy={10.3} r={1} fill={color} stroke="none" />
        </>
      )}
    </IconBase>
  );
}
