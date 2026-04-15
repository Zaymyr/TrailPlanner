import { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { ProfileTabKey } from './types';

type ProfileTabsProps = {
  activeTab: ProfileTabKey;
  tabs: Array<{ key: ProfileTabKey; label: string }>;
  onChange: (nextTab: ProfileTabKey) => void;
};

function ProfileTabsComponent({ activeTab, tabs, onChange }: ProfileTabsProps) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
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
    gap: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  buttonActive: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
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
