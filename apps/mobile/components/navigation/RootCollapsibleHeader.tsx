import { useEffect, useState, type ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';
import { TopoContourPattern } from '../themed/TopoContourPattern';

export const ROOT_HEADER_EXPANDED_BODY_HEIGHT = 76;
export const ROOT_HEADER_COMPACT_BODY_HEIGHT = 60;
/** Centers the 48pt watch buttons in the 60pt compact bar. */
const HEADER_ACTION_TOP = 6;
const HEADER_ACTION_SIZE = 48;

type HeaderAction = {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
};

type Props = {
  action?: HeaderAction;
  helpAction?: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  scrollY: Animated.Value;
  title: string;
  topInset: number;
};

export function RootCollapsibleHeader({ action, helpAction, icon, scrollY, title, topInset }: Props) {
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
        compact && styles.headerScrolled,
        { height },
      ]}
    >
      <TopoContourPattern color={Colors.textOnBrand} opacity={0.1} />
      <Animated.View
        accessibilityElementsHidden={compact}
        importantForAccessibility={compact ? 'no-hide-descendants' : 'auto'}
        pointerEvents={helpAction ? 'box-none' : 'none'}
        style={[styles.expandedContent, { top: topInset, opacity: expandedOpacity }]}
      >
        {/*
          Without a help watch, the screen icon is decorative only: drawn bare
          (no button frame) in the same 48pt slot so the title keeps its place.
        */}
        {helpAction ? <View style={styles.leadingActionSpacer} /> : (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.leadingActionSpacer, styles.decorativeIcon]}
          >
            <Ionicons color={Colors.textOnBrand} name={icon} size={26} />
          </View>
        )}
        <Text
          accessibilityRole="header"
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={styles.expandedTitle}
        >
          {title}
        </Text>
      </Animated.View>

      <Animated.View
        accessibilityElementsHidden={!compact}
        importantForAccessibility={compact ? 'auto' : 'no-hide-descendants'}
        pointerEvents="none"
        style={[
          styles.compactContent,
          helpAction ? styles.compactContentWithLeadingAction : undefined,
          { top: topInset, opacity: compactOpacity },
        ]}
      >
        <Text accessibilityRole="header" numberOfLines={1} style={styles.compactTitle}>
          {title}
        </Text>
      </Animated.View>

      {helpAction ? (
        <View pointerEvents="box-none" style={[styles.helpAction, { top: topInset + HEADER_ACTION_TOP }]}>
          {helpAction}
        </View>
      ) : null}

      {action ? (
        <IconAction
          accessibilityLabel={action.accessibilityLabel}
          disabled={action.disabled}
          icon={<Ionicons color={Colors.textOnBrand} name={action.icon} size={21} />}
          onPress={action.onPress}
          style={[styles.action, { top: topInset + HEADER_ACTION_TOP }]}
          testID={action.testID}
          tone="onBrand"
        />
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
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerScrolled: {
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8,
  },
  expandedContent: {
    position: 'absolute',
    left: 16,
    right: 72,
    height: ROOT_HEADER_COMPACT_BODY_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadingActionSpacer: {
    width: HEADER_ACTION_SIZE,
    height: HEADER_ACTION_SIZE,
    flexShrink: 0,
  },
  decorativeIcon: {
    alignItems: 'center',
    justifyContent: 'center',
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
    left: 16,
    right: 72,
    height: ROOT_HEADER_COMPACT_BODY_HEIGHT,
    justifyContent: 'center',
  },
  compactTitle: {
    color: Colors.textOnBrand,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '800',
  },
  compactContentWithLeadingAction: {
    left: 72,
  },
  helpAction: {
    position: 'absolute',
    zIndex: 5,
    left: 16,
    // The slot grows for a back blade (62pt) passed instead of a watch button.
    minWidth: HEADER_ACTION_SIZE,
    minHeight: HEADER_ACTION_SIZE,
  },
  action: {
    position: 'absolute',
    zIndex: 4,
    right: 16,
  },
});
