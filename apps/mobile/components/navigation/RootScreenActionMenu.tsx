import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import {
  emitHelpTutorialRequest,
  type HelpTutorialScreenKey,
} from '../../lib/helpTutorial';
import { useI18n } from '../../lib/i18n';
import { FeedbackHeaderButton } from '../feedback/FeedbackHeaderButton';
import { RaceRequestHeaderButton } from '../race/RaceRequestHeaderButton';
import { IconAction } from '../themed/IconAction';
import { Text } from '../themed/Text';

type RootScreenHelp =
  | {
      type: 'tutorial';
      screenKey: HelpTutorialScreenKey;
    }
  | {
      type: 'message';
      title: string;
      body: string;
    };

type RootScreenActionMenuProps = {
  contextLabel: string;
  help: RootScreenHelp;
  topInset: number;
};

type MenuContentProps = RootScreenActionMenuProps & {
  openFeedback: () => void;
  openRaceRequest: () => void;
};

function MenuContent({
  help,
  openFeedback,
  openRaceRequest,
  topInset,
}: MenuContentProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const closeThen = (action: () => void) => {
    setOpen(false);
    action();
  };

  const handleHelpPress = () => {
    if (help.type === 'tutorial') {
      emitHelpTutorialRequest(help.screenKey);
      return;
    }

    Alert.alert(help.title, help.body);
  };

  return (
    <>
      <IconAction
        accessibilityLabel={t.rootActionMenu.triggerLabel}
        accessibilityState={{ expanded: open }}
        icon={<Ionicons color={Colors.textOnBrand} name="help" size={22} />}
        onPress={() => setOpen(true)}
        testID="root-help-menu"
        tone="onBrand"
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        transparent
        visible={open}
      >
        <View accessibilityViewIsModal style={styles.modal}>
          <Pressable
            accessibilityLabel={t.rootActionMenu.dismissLabel}
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={styles.backdrop}
          />
          <View style={[styles.actions, { top: topInset + 60 }]}>
            <TouchableOpacity
              accessibilityLabel={t.rootActionMenu.helpLabel}
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => closeThen(handleHelpPress)}
              style={styles.action}
            >
              <View style={styles.actionIcon}>
                <Ionicons color={Colors.textOnBrand} name="help-circle-outline" size={19} />
              </View>
              <Text style={styles.actionLabel}>{t.rootActionMenu.helpLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t.feedback.triggerLabel}
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => closeThen(openFeedback)}
              style={styles.action}
            >
              <View style={styles.actionIcon}>
                <Ionicons color={Colors.textOnBrand} name="bug-outline" size={19} />
              </View>
              <Text style={styles.actionLabel}>{t.rootActionMenu.feedbackLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t.raceRequests.triggerLabel}
              accessibilityRole="button"
              activeOpacity={0.86}
              onPress={() => closeThen(openRaceRequest)}
              style={styles.action}
            >
              <View style={styles.actionIcon}>
                <Ionicons color={Colors.textOnBrand} name="paper-plane-outline" size={19} />
              </View>
              <Text style={styles.actionLabel}>{t.rootActionMenu.raceRequestLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function RootScreenActionMenu(props: RootScreenActionMenuProps) {
  return (
    <RaceRequestHeaderButton>
      {(openRaceRequest) => (
        <FeedbackHeaderButton contextLabel={props.contextLabel}>
          {(openFeedback) => (
            <MenuContent
              {...props}
              openFeedback={openFeedback}
              openRaceRequest={openRaceRequest}
            />
          )}
        </FeedbackHeaderButton>
      )}
    </RaceRequestHeaderButton>
  );
}

const styles = StyleSheet.create({
  modal: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 26, 0.24)',
  },
  actions: {
    position: 'absolute',
    left: 12,
    gap: 8,
    minWidth: 230,
    maxWidth: 300,
  },
  action: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 5,
    boxShadow: '0 6px 16px rgba(26, 26, 26, 0.16)',
  },
  actionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: Colors.textPrimary,
  },
  actionLabel: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
