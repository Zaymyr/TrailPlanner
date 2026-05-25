export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  "3xl": 28,
  full: 9999,
  card: 18,
} as const;

export type Radius = typeof radius;
