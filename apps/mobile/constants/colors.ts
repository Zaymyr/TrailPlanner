export const Colors = {
  // Backgrounds
  background: '#ECEAE3',        // warm sand — main screen background
  surface: '#FFFFFF',           // card surface
  surfaceSecondary: '#F5F3EE',  // subtle secondary surface
  surfaceMuted: '#EAE8E1',      // muted areas, disabled states

  // Brand
  brandPrimary: '#2D5016',      // forest green — primary actions, active states
  brandLight: '#4A7C28',        // lighter green — hover, secondary brand
  brandSurface: '#E8F0E0',      // very light green — badges, pills background
  brandBorder: '#B5CC9A',       // green border for selected cards

  // Text
  textPrimary: '#1A1A1A',       // main text
  textSecondary: '#6B6B6B',     // labels, metadata
  textMuted: '#9E9E9E',         // placeholder, disabled
  textOnBrand: '#FFFFFF',       // text on green backgrounds

  // Borders & Dividers
  border: '#D9D6CE',            // default border
  borderStrong: '#B0ADA5',      // stronger separator

  // Semantic
  success: '#2D5016',
  danger: '#C0392B',
  dangerSurface: '#FDECEA',
  warning: '#D97706',
  warningSurface: '#FEF3C7',

  // Legacy dark (keep temporarily for backward compat during migration)
  // Remove once all screens are migrated
  _darkBackground: '#0D1117',
  _darkSurface: '#1E2530',
  _darkGreen: '#22C55E',
} as const;

export type ColorKey = keyof typeof Colors;
