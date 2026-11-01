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
    left: 16,
    right: 16,
    backgroundColor: Colors.background,
  },
});
