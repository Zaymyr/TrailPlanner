import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileComponents } from '@pace-yourself/design-system';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../themed/Text';
import { BlazeLine } from '../themed/TrailBlaze';
import { Colors } from '../../constants/colors';

type Props<T extends string> = {
  tabs: { key: T; label: string; icon: keyof typeof Ionicons.glyphMap }[];
  activeTab: T;
  onPress: (tab: T) => void;
};

export function RacebookTabBar<T extends string>({ tabs, activeTab, onPress }: Props<T>) {
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
              <View style={[styles.iconSurface, active && styles.iconSurfaceActive]}>
                <Ionicons
                  name={tab.icon}
                  size={24}
                  color={active ? Colors.brandPrimary : Colors.textMuted}
                />
              </View>
              {/* Shrink-wrapped to the text so the line underlines the whole label. */}
              <View style={styles.labelInner}>
                <Text
                  numberOfLines={1}
                  style={[styles.text, active && styles.textActive]}
                >
                  {tab.label}
                </Text>
                <BlazeLine style={[styles.line, !active && styles.lineHidden]} />
              </View>
            </Pressable>
          );
        })}

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  wrap: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: 4,
  },
  button: {
    flex: 1,
    minWidth: 0,
    minHeight: 60,
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
    borderRadius: mobileComponents.dataRadius,
  },
  iconSurfaceActive: {
    backgroundColor: Colors.brandSurface,
  },
  labelInner: { maxWidth: '100%', alignItems: 'stretch' },
  line: { marginTop: 2 },
  lineHidden: { opacity: 0 },
  text: { color: Colors.textMuted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  textActive: { color: Colors.brandPrimary },
});
