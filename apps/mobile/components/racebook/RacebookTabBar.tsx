import { Pressable, StyleSheet, View } from 'react-native';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';

import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type Props<T extends string> = {
  tabs: { key: T; label: string }[];
  activeTab: T;
  onPress: (tab: T) => void;
  theme: ResolvedRacebookTheme;
};

export function RacebookTabBar<T extends string>({ tabs, activeTab, onPress, theme }: Props<T>) {
  return (
    <View accessibilityRole="tablist" style={styles.wrap}>
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.button,
              tabs.length === 5 && styles.buttonCompact,
              active && { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor },
            ]}
            onPress={() => onPress(tab.key)}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.text,
                tabs.length === 5 && styles.textCompact,
                active && { color: theme.onPrimaryColor },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
  },
  buttonCompact: { minWidth: 0, paddingHorizontal: 4 },
  text: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700' },
  textCompact: { fontSize: 11 },
});
