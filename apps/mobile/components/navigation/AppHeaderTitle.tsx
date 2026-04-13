import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '../../constants/colors';

type Props = {
  title: string;
  subtitle?: string;
};

export function AppHeaderTitle({ title, subtitle = 'Pace Yourself' }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowDot} />
        <Text numberOfLines={1} style={styles.eyebrowText}>
          {subtitle}
        </Text>
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
    gap: 1,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brandPrimary,
  },
  eyebrowText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
});
