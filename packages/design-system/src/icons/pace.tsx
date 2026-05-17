import { IconBase, Path } from "./_base/IconBase";
import type { IconProps } from "./_base/types";

export function PaceIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <Path d="m3.6 15.5 3.2-3.2 3.2 3.2" opacity={0.3} />
      <Path d="m7.3 15.5 4.1-4.1 4.1 4.1" opacity={0.6} />
      <Path d="m12.1 15.5 4.6-4.6 4.6 4.6" />
    </IconBase>
  );
}
