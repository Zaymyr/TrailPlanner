import { TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Colors } from '../../constants/colors';
import { emitHelpTutorialRequest, type HelpTutorialScreenKey } from '../../lib/helpTutorial';
import { useI18n } from '../../lib/i18n';

type HelpHeaderButtonProps = {
  screenKey: HelpTutorialScreenKey;
};

export function HelpHeaderButton({ screenKey }: HelpHeaderButtonProps) {
  const { t } = useI18n();

  return (
    <TouchableOpacity
      accessibilityLabel={t.helpTutorial.triggerLabel}
      accessibilityRole="button"
      onPress={() => emitHelpTutorialRequest(screenKey)}
      style={styles.iconButton}
    >
      <Ionicons name="help-circle-outline" size={22} color={Colors.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
