import { colors, spacing } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { formatCoteUnit, splitCoteLabel } from '../../lib/trailSignature';
import { DataText } from './DataText';
import { Text } from './Text';

export type CoteSize = 'sm' | 'md' | 'lg' | 'xl';
export type CoteTone = 'primary' | 'secondary' | 'brand' | 'danger' | 'warning';

type Props = {
  /** Either a raw value with `unit`, or an already formatted label ("1 240 m"). */
  value: string | number | null | undefined;
  unit?: string | null;
  /** Optional caption shown above the value, in normal language. */
  label?: string;
  prefix?: string;
  size?: CoteSize;
  tone?: CoteTone;
  /** Explicit color for organizer-themed surfaces (overrides `tone`). */
  color?: string;
  align?: 'left' | 'center';
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  valueStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

const valueSizeByCote = { sm: 'sm', md: 'base', lg: 'xl', xl: '3xl' } as const;
const unitSizeByCote = { sm: 'xs', md: 'xs', lg: 'xs', xl: 'sm' } as const;

const colorByTone: Record<CoteTone, string> = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  brand: colors.brand.forest,
  danger: colors.semantic.danger,
  warning: colors.semantic.warning,
};

/**
 * A measurement typeset like an elevation mark on a topographic map: bold
 * mono figure, unit in spaced capitals. Use it for distances, elevation,
 * durations, paces and nutrition rates so race data is recognisable at a
 * glance across the app.
 */
export function Cote({
  value,
  unit,
  label,
  prefix,
  size = 'md',
  tone = 'primary',
  color,
  align = 'left',
  numberOfLines = 1,
  style,
  valueStyle,
  accessibilityLabel,
}: Props) {
  const parts = unit != null && unit !== ''
    ? { value: value == null || value === '' ? '—' : String(value), unit }
    : splitCoteLabel(value);
  const resolvedColor = color ?? colorByTone[tone];
  const unitColor = color ?? (tone === 'primary' ? colors.text.secondary : resolvedColor);
  const spoken = accessibilityLabel
    ?? [label, prefix, parts.value, parts.unit].filter(Boolean).join(' ');

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={[styles.container, align === 'center' && styles.centered, style]}
    >
      {label ? (
        <Text
          numberOfLines={1}
          size="xs"
          weight="semibold"
          style={[styles.label, { color: color ?? colors.text.secondary }, align === 'center' && styles.textCentered]}
        >
          {label}
        </Text>
      ) : null}
      <View style={[styles.row, align === 'center' && styles.rowCentered]}>
        {prefix ? (
          <DataText size={unitSizeByCote[size]} weight="semibold" style={[styles.unit, { color: unitColor }]}>
            {formatCoteUnit(prefix)}
          </DataText>
        ) : null}
        <DataText
          numberOfLines={numberOfLines}
          size={valueSizeByCote[size]}
          weight="bold"
          style={[styles.value, { color: resolvedColor }, valueStyle]}
        >
          {parts.value}
        </DataText>
        {parts.unit ? (
          <DataText size={unitSizeByCote[size]} weight="semibold" style={[styles.unit, { color: unitColor }]}>
            {formatCoteUnit(parts.unit)}
          </DataText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing[0.5], minWidth: 0 },
  centered: { alignItems: 'center' },
  label: { letterSpacing: 0.1 },
  textCentered: { textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
    minWidth: 0,
  },
  rowCentered: { justifyContent: 'center' },
  value: { flexShrink: 1, letterSpacing: -0.3 },
  unit: { letterSpacing: 1.1 },
});
