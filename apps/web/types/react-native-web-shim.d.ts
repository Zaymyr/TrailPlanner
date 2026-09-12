import type { ComponentType, ReactNode } from "react";

type StyleValue = Record<string, unknown> | null | false | undefined;
type StyleProp = StyleValue | readonly StyleProp[];

type CommonProps = {
  children?: ReactNode;
  style?: StyleProp;
  accessibilityRole?: string;
  accessibilityState?: Record<string, unknown>;
  accessibilityValue?: Record<string, number | string>;
  onLayout?: (event: { nativeEvent: { layout: { width: number; height: number; x: number; y: number } } }) => void;
};

type TextProps = CommonProps & {
  numberOfLines?: number;
};

type PressableProps = CommonProps & {
  disabled?: boolean;
  onPress?: () => void;
};

type ImageProps = CommonProps & {
  source: { uri: string };
  resizeMode?: "contain" | "cover" | "center" | "repeat" | "stretch";
};

export const View: ComponentType<CommonProps>;
export const Text: ComponentType<TextProps>;
export const Pressable: ComponentType<PressableProps>;
export const Image: ComponentType<ImageProps>;
export const ScrollView: ComponentType<CommonProps & {
  horizontal?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  contentContainerStyle?: StyleProp;
}>;
type AnimatedValue = {
  setValue(value: number): void;
  stopAnimation(): void;
  interpolate(config: { inputRange: number[]; outputRange: Array<number | string>; extrapolate?: string }): unknown;
};
export const Animated: {
  Value: new (value: number) => AnimatedValue;
  View: ComponentType<CommonProps>;
  timing(value: AnimatedValue, config: Record<string, unknown>): { start(callback?: (result: { finished: boolean }) => void): void; stop(): void };
};
export const Easing: {
  cubic: unknown;
  out(value: unknown): unknown;
  inOut(value: unknown): unknown;
};
export const StyleSheet: {
  create<T extends Record<string, StyleValue>>(styles: T): T;
  flatten(style: StyleProp): Record<string, unknown>;
};
