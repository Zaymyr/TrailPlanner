import { memo } from 'react';
import { mobileComponents } from '@pace-yourself/design-system';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ChoiceChip } from '../themed/ChoiceChip';
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
            <ChoiceChip
              accessibilityRole="tab"
              accessibilityLabel={tab.accessibilityLabel ?? tab.label}
              key={tab.key}
              label={tab.label}
              selected={isActive}
              style={styles.button}
              trailing={tab.hasUnread ? <View style={styles.unreadDot} /> : undefined}
              onPress={() => onChange(tab.key)}
            />
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
  unreadDot: {
    backgroundColor: Colors.danger,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
