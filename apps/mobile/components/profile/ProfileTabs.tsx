import { memo } from 'react';
import { mobileComponents } from '@pace-yourself/design-system';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { ProfileTabKey } from './types';

type ProfileTabsProps = {
  activeTab: ProfileTabKey;
  tabs: {
    key: ProfileTabKey;
    label: string;
    hasUnread?: boolean;
    accessibilityLabel?: string;
  }[];
  onChange: (nextTab: ProfileTabKey) => void;
};

function ProfileTabsComponent({ activeTab, tabs, onChange }: ProfileTabsProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
    >
      <View accessibilityRole="tablist" style={styles.bar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              accessibilityRole="tab"
              accessibilityLabel={tab.accessibilityLabel ?? tab.label}
              accessibilityState={{ selected: isActive }}
              key={tab.key}
              style={[styles.button, isActive && styles.buttonActive]}
              onPress={() => onChange(tab.key)}
            >
              <View style={styles.labelRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.buttonText, isActive && styles.buttonTextActive]}
                >
                  {tab.label}
                </Text>
                {tab.hasUnread ? <View style={styles.unreadDot} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

export const ProfileTabs = memo(ProfileTabsComponent);

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -1 },
  scrollContent: { flexGrow: 1 },
  bar: {
    flexGrow: 1,
    flexDirection: 'row',
    gap: mobileComponents.segmentedControl.gap,
    padding: mobileComponents.segmentedControl.padding,
    borderRadius: mobileComponents.segmentedControl.borderRadius,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    flexGrow: 1,
    minWidth: 104,
    minHeight: mobileComponents.segment.minHeight,
    borderRadius: mobileComponents.segment.borderRadius,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: mobileComponents.segment.paddingHorizontal,
  },
  buttonActive: {
    backgroundColor: Colors.surface,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  buttonTextActive: {
    color: Colors.brandPrimary,
  },
  labelRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  unreadDot: {
    backgroundColor: Colors.danger,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
