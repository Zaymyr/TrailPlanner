import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

export type FloatingActionMenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

type FloatingActionMenuProps = {
  accessibilityLabel: string;
  actions: FloatingActionMenuItem[];
  dismissAccessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function FloatingActionMenu({
  accessibilityLabel,
  actions,
  dismissAccessibilityLabel,
  style,
}: FloatingActionMenuProps) {
  const [open, setOpen] = useState(false);

  if (actions.length === 0) return null;

  const handleActionPress = (onPress: () => void) => {
    setOpen(false);
    onPress();
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, style]}>
      {open ? (
        <Pressable
          accessibilityLabel={dismissAccessibilityLabel}
          onPress={() => setOpen(false)}
          style={styles.dismissLayer}
        />
      ) : null}

      <View pointerEvents="box-none" style={styles.cluster}>
        {open ? (
          <View style={styles.actionsList}>
            {actions.map((action) => (
              <TouchableOpacity
                activeOpacity={0.86}
                accessibilityLabel={action.label}
                key={action.key}
                onPress={() => handleActionPress(action.onPress)}
                style={styles.actionButton}
              >
                <Text numberOfLines={1} style={styles.actionLabel}>
                  {action.label}
                </Text>
                <View style={styles.actionIcon}>
                  <Ionicons color={Colors.textOnBrand} name={action.icon} size={18} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          activeOpacity={0.88}
          accessibilityLabel={accessibilityLabel}
          onPress={() => setOpen((current) => !current)}
          style={styles.fab}
        >
          <Ionicons color={Colors.textOnBrand} name={open ? 'close' : 'add'} size={28} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingBottom: 16,
    paddingRight: 18,
    zIndex: 20,
  },
  dismissLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.2)',
  },
  cluster: {
    alignItems: 'flex-end',
  },
  actionsList: {
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  actionButton: {
    minHeight: 46,
    maxWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    boxShadow: '0 6px 16px rgba(26, 26, 26, 0.16)',
  },
  actionLabel: {
    flexShrink: 1,
    overflow: 'hidden',
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    boxShadow: '0 8px 18px rgba(26, 26, 26, 0.28)',
  },
});
