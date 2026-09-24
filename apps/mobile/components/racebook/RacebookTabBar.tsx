import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ResolvedRacebookTheme } from '@pace-yourself/design-system';

import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';

type Props<T extends string> = {
  tabs: { key: T; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: T;
  onPress: (tab: T) => void;
  exitAction: {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
  };
  theme: ResolvedRacebookTheme;
};

export function RacebookTabBar<T extends string>({ tabs, activeTab, onPress, exitAction, theme }: Props<T>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.safeArea, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View accessibilityRole="tablist" style={styles.wrap}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => onPress(tab.key)}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
              <View style={styles.iconSurface}>
                <Ionicons
                  name={tab.icon}
                  size={24}
                  color={active ? theme.primaryColor : Colors.textMuted}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.text, active && { color: theme.primaryColor }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.exitDivider} />
        <Pressable
          accessibilityLabel={exitAction.accessibilityLabel}
          accessibilityRole="button"
          onPress={exitAction.onPress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          testID="racebook-exit-to-catalog"
        >
          <View style={styles.iconSurface}>
            <Ionicons name="trail-sign" size={24} color={Colors.textSecondary} />
          </View>
          <Text numberOfLines={1} style={styles.exitText}>{exitAction.label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  wrap: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
    paddingTop: 4,
  },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
  },
  buttonPressed: { opacity: 0.62 },
  iconSurface: {
    width: 34,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  exitText: { color: Colors.textSecondary, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  exitDivider: {
    width: 1,
    marginHorizontal: 1,
    marginVertical: 10,
    backgroundColor: Colors.border,
  },
});
