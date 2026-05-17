import { typography } from '@pace-yourself/design-system';
import type { ComponentProps } from 'react';

import { Text } from './Text';

type HeadingVariant = 'h1' | 'h2' | 'h3';
type Props = Omit<ComponentProps<typeof Text>, 'size' | 'weight' | 'lineHeight' | 'letterSpacing'> & {
  variant?: HeadingVariant;
};

const headingByVariant = {
  h1: {
    fontSize: 32,
    lineHeight: 38,
  },
  h2: {
    fontSize: typography.size['2xl'],
    lineHeight: 29,
  },
  h3: {
    fontSize: typography.size.lg,
    lineHeight: 23,
  },
} as const;

export function Heading({ variant = 'h1', style, ...props }: Props) {
  const heading = headingByVariant[variant];

  return (
    <Text
      {...props}
      weight="semibold"
      lineHeight="snug"
      letterSpacing="tight"
      style={[
        {
          fontSize: heading.fontSize,
          lineHeight: heading.lineHeight,
        },
        style,
      ]}
    />
  );
}
