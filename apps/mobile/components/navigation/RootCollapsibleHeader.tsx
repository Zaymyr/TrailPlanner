import { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { Text } from '../themed/Text';

export const ROOT_HEADER_EXPANDED_BODY_HEIGHT = 112;
export const ROOT_HEADER_COMPACT_BODY_HEIGHT = 60;

type HeaderAction = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
};

type Props = {
  action?: HeaderAction;
  icon: keyof typeof Ionicons.glyphMap;
  scrollY: Animated.Value;
  title: string;
  topInset: number;
};

export function RootCollapsibleHeader({ action, icon, scrollY, title, topInset }: Props) {
  const [compact, setCompact] = useState(false);
  const expandedHeight = topInset + ROOT_HEADER_EXPANDED_BODY_HEIGHT;
  const compactHeight = topInset + ROOT_HEADER_COMPACT_BODY_HEIGHT;
  const collapseDistance = expandedHeight - compactHeight;
  const height = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [expandedHeight, compactHeight],
    extrapolate: 'clamp',
  });
  const expandedOpacity = scrollY.interpolate({
    inputRange: [0, collapseDistance * 0.62, collapseDistance],
    outputRange: [1, 0.7, 0],
    extrapolate: 'clamp',
  });
  const compactOpacity = scrollY.interpolate({
    inputRange: [collapseDistance * 0.55, collapseDistance],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const bottomRadius = scrollY.interpolate({
    inputRange: [0, collapseDistance],
    outputRange: [22, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      setCompact(value >= collapseDistance * 0.72);
    });
    return () => scrollY.removeListener(listenerId);
  }, [collapseDistance, scrollY]);

  return (
    <Animated.View
      style={[
        styles.header,
        {
          height,
          borderBottomLeftRadius: bottomRadius,
          borderBottomRightRadius: bottomRadius,
        },
      ]}
    >
      <Animated.View
        accessibilityElementsHidden={compact}
        importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
        pointerEvents="none"
        style={[styles.expandedContent, { top: topInset, opacity: expandedOpacity }]}
      >
        <View style={styles.iconSurface}>
          <Ionicons color={Colors.textOnBrand} name={icon} size={24} />
        </View>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.expandedTitle}>
          {title}
        </Text>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={!compact}
        importantForAccessibility={compact ? 'auto' : 'no-hide-descendants'}
        pointerEvents="none"
        style={[styles.compactContent, { top: topInset, opacity: compactOpacity }]}
      >
        <Text accessibilityRole="header" numberOfLines={1} style={styles.compactTitle}>
          {title}
        </Text>
      </Animated.View>

      {action ? (
        <Pressable
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(action.disabled) }}
          disabled={action.disabled}
          hitSlop={6}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.action,
            { top: topInset + 8 },
            action.disabled && styles.actionDisabled,
            pressed && styles.actionPressed,
          ]}
          testID={action.testID}
        >
          <Ionicons color={Colors.textOnBrand} name={action.icon} size={21} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    zIndex: 30,
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: Colors.brandPrimary,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  expandedContent: {
    position: 'absolute',
    left: 20,
    right: 68,
    height: ROOT_HEADER_EXPANDED_BODY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  iconSurface: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  expandedTitle: {
    flex: 1,
    color: Colors.textOnBrand,
    fontSize: 27,
    lineHeight: 31,
    fontWeight: '800',
  },
  compactContent: {
    position: 'absolute',
    left: 18,
    right: 68,
    height: ROOT_HEADER_COMPACT_BODY_HEIGHT,
    justifyContent: 'center',
  },
  compactTitle: {
    color: Colors.textOnBrand,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  action: {
    position: 'absolute',
    zIndex: 4,
    right: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  actionDisabled: { opacity: 0.45 },
  actionPressed: { opacity: 0.68 },
});
