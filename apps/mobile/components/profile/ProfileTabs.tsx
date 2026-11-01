import { memo } from 'react';
import { mobileComponents } from '@pace-yourself/design-system';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../themed/Text';
import { Colors } from '../../constants/colors';
import type { ProfileTabKey } from './types';

type ProfileTabsProps = {
  activeTab: ProfileTabKey;
  tabs: Array<{ key: ProfileTabKey; label: string }>;
  onChange: (nextTab: ProfileTabKey) => void;
};

function ProfileTabsComponent({ activeTab, tabs, onChange }: ProfileTabsProps) {
  return (
    <View accessibilityRole="tablist" style={styles.bar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.key}
            style={[styles.button, isActive && styles.buttonActive]}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.buttonText, isActive && styles.buttonTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const ProfileTabs = memo(ProfileTabsComponent);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: mobileComponents.segmentedControl.gap,
    padding: mobileComponents.segmentedControl.padding,
    borderRadius: mobileComponents.segmentedControl.borderRadius,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    flex: 1,
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
});
