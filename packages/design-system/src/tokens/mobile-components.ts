import { radius } from './radius';
import { spacing } from './spacing';

/** Shared geometry for equivalent controls across the React Native app. */
export const mobileComponents = {
  screenGutter: spacing[4],
  actionRadius: radius.lg,
  buttonRadius: radius.lg,
  closeButtonSize: 44,
  filterChip: {
    minHeight: 38,
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
} as const;

export type MobileComponents = typeof mobileComponents;
