import type { ReactNode } from "react";

export type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  title?: string;
  accessibilityLabel?: string;
  testID?: string;
  className?: string;
  style?: unknown;
};

export type IconRenderContext = {
  color: string;
  strokeWidth: number;
};

export type IconBaseProps = IconProps & {
  children: ReactNode | ((context: IconRenderContext) => ReactNode);
};
