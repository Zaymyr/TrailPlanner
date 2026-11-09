import type { StyleProp, ViewProps, ViewStyle } from 'react-native';

import { TopoCard, type TopoCardVariant } from './TopoCard';

type CardSurface = 'white' | 'cream' | 'sandLight';

type Props = ViewProps & {
  surface?: CardSurface;
  padded?: boolean;
  variant?: TopoCardVariant;
  style?: StyleProp<ViewStyle>;
};

export function Card({ surface = 'white', padded = true, variant = 'signature', style, children, ...props }: Props) {
  return <TopoCard {...props} padded={padded} style={style} surface={surface} variant={variant}>{children}</TopoCard>;
}
