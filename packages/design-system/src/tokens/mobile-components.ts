import { radius } from './radius';
import { spacing } from './spacing';

/** Shared geometry for equivalent controls across the React Native app. */
export const mobileComponents = {
  screenGutter: spacing[4],
  actionRadius: radius.lg,
  buttonRadius: radius.lg,
  dataRadius: radius.data,
  cardRadius: radius.card,
  pillRadius: radius.full,
  closeButtonSize: 44,
  action: {
    minHeight: {
      sm: 44,
      md: 48,
      lg: 54,
    },
    paddingHorizontal: {
      sm: spacing[3],
      md: spacing[5],
      lg: spacing[6],
    },
  },
  topoCard: {
    borderRadius: radius.card,
    signatureBottomRightRadius: radius.sm,
    padding: spacing[4],
    markerWidth: spacing[1],
    markerHeight: spacing[8],
  },
  filterChip: {
    minHeight: 44,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
  },
  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    signatureBottomRightRadius: radius.sm,
    paddingHorizontal: spacing[3],
  },
  signature: {
    actionBottomRightRadius: radius.sm,
    dataBottomRightRadius: radius.sm,
    markerRadius: radius.sm,
  },
  segmentedControl: {
    borderRadius: radius.xl,
    padding: spacing[1],
    gap: spacing[1],
  },
  segment: {
    minHeight: 44,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
  },
  motion: {
    pressScale: 0.98,
    fastDurationMs: 140,
    standardDurationMs: 180,
  },
} as const;

export type MobileComponents = typeof mobileComponents;
