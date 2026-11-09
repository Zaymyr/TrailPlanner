import { colors, mobileComponents, spacing } from '@pace-yourself/design-system';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { DataText } from './DataText';
import { Text } from './Text';

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  trend?: string;
  tone?: 'neutral' | 'brand' | 'info';
  style?: StyleProp<ViewStyle>;
};

export function MetricTile({ label, value, unit, trend, tone = 'neutral', style }: Props) {
  const dataTone = tone === 'brand' ? 'brand' : tone === 'info' ? 'secondary' : 'primary';

  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Text tone="secondary" size="xs" weight="semibold" numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.valueRow}>
        <DataText tone={dataTone} size="lg" weight="bold">
          {value}
        </DataText>
        {unit ? <DataText tone="secondary" size="xs" weight="semibold">{unit}</DataText> : null}
      </View>
      {trend ? <Text tone="secondary" size="xs">{trend}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 88,
    borderRadius: mobileComponents.dataRadius,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    gap: spacing[0.5],
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing[1],
  },
});

const toneStyles = StyleSheet.create({
  neutral: { backgroundColor: colors.surface.sandLight, borderColor: colors.border.subtle },
  brand: { backgroundColor: colors.brand.surface, borderColor: colors.brand.border },
  info: { backgroundColor: colors.semantic.infoSurface, borderColor: colors.semantic.infoBorder },
});
