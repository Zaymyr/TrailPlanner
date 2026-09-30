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
    left: 12,
    right: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    padding: 6,
    marginTop: 8,
    shadowColor: '#1A1A1A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
});
