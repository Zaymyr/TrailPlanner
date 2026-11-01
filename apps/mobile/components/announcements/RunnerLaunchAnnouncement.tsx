import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileComponents } from '@pace-yourself/design-system';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { Button } from '../themed/Button';
import { Heading } from '../themed/Heading';
import { Text } from '../themed/Text';

type Props = {
  onClose: () => void;
  onOpenPlans?: () => void;
  preview?: boolean;
};

export function RunnerLaunchAnnouncement({ onClose, onOpenPlans, preview = false }: Props) {
  const { t } = useI18n();
  const openPlans = () => {
    onClose();
    onOpenPlans?.();
  };

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible>
      <SafeAreaView edges={['top', 'bottom']} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <Pressable
            accessibilityLabel={t.common.close}
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.closeButton}
          >
            <Ionicons color={Colors.textSecondary} name="close" size={22} />
          </Pressable>
          <ScrollView bounces={false} contentContainerStyle={styles.content}>
            <View style={styles.badge}>
              <Text size="xs" tone="brand" weight="bold">{t.runnerLaunch.badge}</Text>
            </View>
            <Heading accessibilityRole="header" variant="h2">{t.runnerLaunch.title}</Heading>
            <Text>{t.runnerLaunch.intro}</Text>
            <Text>{t.runnerLaunch.thanks}</Text>
            <View style={styles.gift}>
              <Heading variant="h3">{t.runnerLaunch.legacyTitle}</Heading>
              <Text lineHeight="relaxed">{t.runnerLaunch.legacyBody}</Text>
            </View>
            <View style={styles.freeDetails}>
              <Text weight="bold">{t.runnerLaunch.freeTitle}</Text>
              <Text lineHeight="relaxed" size="sm" tone="secondary">{t.runnerLaunch.freeBody}</Text>
            </View>
            <Text lineHeight="relaxed" size="sm" tone="secondary">{t.runnerLaunch.offersBody}</Text>
          </ScrollView>
          <View style={styles.actions}>
            <Button fullWidth onPress={openPlans}>{t.runnerLaunch.plansAction}</Button>
            {preview ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => Alert.alert(t.runnerLaunch.previewTitle, t.runnerLaunch.previewBody)}
                style={styles.previewLink}
              >
                <Text size="xs" style={styles.note} tone="tertiary">{t.runnerLaunch.previewTitle}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(15,23,42,0.56)' },
  sheet: { position: 'relative', maxHeight: '100%', maxWidth: 520, width: '100%', alignSelf: 'center', borderRadius: 24, backgroundColor: Colors.surface, overflow: 'hidden' },
  closeButton: { position: 'absolute', zIndex: 2, top: 12, right: 12, width: mobileComponents.closeButtonSize, height: mobileComponents.closeButtonSize, borderRadius: mobileComponents.closeButtonSize / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  badge: { alignSelf: 'flex-start', backgroundColor: Colors.brandSurface, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  gift: { padding: 16, gap: 8, borderRadius: 16, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder },
  freeDetails: { gap: 6 },
  actions: { padding: 20, paddingTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  previewLink: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center' },
});
