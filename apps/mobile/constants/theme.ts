import { Colors } from './colors';

export const Theme = {
  colors: Colors,

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  typography: {
    heading1: { fontSize: 28, fontWeight: '700' as const, color: Colors.textPrimary },
    heading2: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary },
    heading3: { fontSize: 17, fontWeight: '600' as const, color: Colors.textPrimary },
    body: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary },
    bodySmall: { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary },
    label: { fontSize: 11, fontWeight: '600' as const, color: Colors.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
    caption: { fontSize: 12, fontWeight: '400' as const, color: Colors.textMuted },
  },
} as const;
