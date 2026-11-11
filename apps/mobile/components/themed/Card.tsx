import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { TopoCard, type TopoCardVariant } from './TopoCard';

type CardSurface = 'white' | 'cream' | 'sandLight';

type Props = ViewProps & {
  surface?: CardSurface;
  padded?: boolean;
  variant?: TopoCardVariant;
  /** Stable id so each card in a list gets its own decorative variation. */
  variationKey?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ surface = 'white', padded = true, variant = 'signature', style, children, ...props }: Props) {
  return <TopoCard {...props} padded={padded} style={style} surface={surface} variant={variant}>{children}</TopoCard>;
}
