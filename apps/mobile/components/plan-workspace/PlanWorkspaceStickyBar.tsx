import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';

type Props = PropsWithChildren<{
  top: number;
  visible: boolean;
  testID?: string;
}>;

export function PlanWorkspaceStickyBar({ children, top, visible, testID }: Props) {
  if (!visible) return null;

  return (
    <View
      accessibilityViewIsModal={false}
      style={[styles.bar, { top }]}
      testID={testID}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    zIndex: 24,
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
