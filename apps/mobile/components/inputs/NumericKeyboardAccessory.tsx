import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { Text } from '../themed/Text';

export const NUMERIC_KEYBOARD_ACCESSORY_ID = 'pace-yourself-numeric-keyboard';

export function NumericKeyboardAccessory() {
  const { locale } = useI18n();
  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
      <View style={styles.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locale === 'fr' ? 'Masquer le clavier' : 'Dismiss keyboard'}
          hitSlop={8}
          onPress={Keyboard.dismiss}
          style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
          testID="numeric-keyboard-done"
        >
          <Text style={styles.doneText}>{locale === 'fr' ? 'Terminé' : 'Done'}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  doneButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  doneButtonPressed: {
    opacity: 0.65,
  },
  doneText: {
    color: Colors.brandPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
