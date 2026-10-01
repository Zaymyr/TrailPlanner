import { colors } from '@pace-yourself/design-system';

/**
 * Compatibility names for existing mobile callers.
 *
 * Values deliberately alias shared design-system tokens so the mobile app does
 * not keep a diverging local palette.
 */
export const Colors = {
  background: colors.surface.sand,
  surface: colors.surface.white,
  surfaceSecondary: colors.surface.sandLight,
  surfaceMuted: colors.surface.muted,

  brandPrimary: colors.brand.forest,
  brandLight: colors.brand.forestLight,
  brandSurface: colors.brand.surface,
  brandBorder: colors.brand.border,

  textPrimary: colors.text.primary,
  textSecondary: colors.text.secondary,
  textMuted: colors.text.tertiary,
  textOnBrand: colors.text.inverse,

  border: colors.border.subtle,
  borderStrong: colors.border.strong,

  success: colors.semantic.success,
  danger: colors.semantic.danger,
  dangerSurface: colors.semantic.dangerSurface,
  warning: colors.semantic.warning,
  warningSurface: colors.semantic.warningSurface,

  /** @deprecated Prefer the shared light palette for new UI. */
  _darkBackground: colors.text.primary,
  /** @deprecated Prefer the shared light palette for new UI. */
  _darkSurface: colors.brand.forestDark,
  /** @deprecated Prefer the shared light palette for new UI. */
  _darkGreen: colors.brand.forestLight,
} as const;

export type ColorKey = keyof typeof Colors;
