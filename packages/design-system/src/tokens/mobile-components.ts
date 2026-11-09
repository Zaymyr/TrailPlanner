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
    padding: spacing[4],
    /** Distance from the card top to the leading-edge trail blaze. */
    blazeTop: spacing[5],
  },
  /**
   * Pace Yourself trail blaze: two painted bands (light over strong), the
   * product's own waymark. Never the red/white GR waymark.
   */
  blaze: {
    sm: { width: 10, bandHeight: 3, gap: 2 },
    md: { width: 14, bandHeight: 4, gap: 2 },
    lg: { width: 20, bandHeight: 5, gap: 3 },
    radius: 1,
  },
  /** Ridge-line motif (dividers, loaders, course silhouettes, celebration). */
  ridge: {
    strokeWidth: 2,
    dividerHeight: 14,
    loaderHeight: 40,
    silhouetteHeight: 34,
    samples: 48,
    loaderDurationMs: 1600,
    celebrationDurationMs: 1100,
  },
  /** Dotted trail line linking timeline steps. */
  timeline: {
    railWidth: 2,
    dash: 4,
    gap: 4,
  },
  filterChip: {
    minHeight: 44,
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
  },
  input: {
    minHeight: 48,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3],
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
