import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TrailTabs } from '../themed/TrailTabs';
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
    <TrailTabs
      activeKey={activeTab}
      onChange={onChange}
      scrollable
      tabs={tabs.map((tab) => ({
        key: tab.key,
        label: tab.label,
        accessibilityLabel: tab.accessibilityLabel ?? tab.label,
        trailing: tab.hasUnread ? <View style={styles.unreadDot} /> : undefined,
      }))}
    />
  );
}

export const ProfileTabs = memo(ProfileTabsComponent);

const styles = StyleSheet.create({
  unreadDot: {
    backgroundColor: Colors.danger,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
