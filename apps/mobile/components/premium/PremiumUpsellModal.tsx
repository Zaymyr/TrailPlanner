import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';
import { useI18n } from '../../lib/i18n';
import { WEB_API_BASE_URL } from '../../lib/webApi';

const ANDROID_PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'com.paceyourself.app';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  benefits?: string[];
};

export function PremiumUpsellModal({
  visible,
  title,
  message,
  onClose,
  benefits,
}: Props) {
  if (!visible) return null;

  return (
    <PremiumUpsellModalContent
      visible={visible}
      title={title}
      message={message}
      onClose={onClose}
      benefits={benefits}
    />
  );
}

function PremiumUpsellModalContent({
  visible,
  title,
  message,
  onClose,
  benefits,
}: Props) {
  const { t } = useI18n();
  const billing = useRevenueCatBilling();

  const upgradeLabel = billing.currentPackage
    ? t.profile.premiumAnnualCta.replace('{price}', billing.currentPackage.product.priceString)
    : t.profile.premiumAnnualFallbackCta;

  const benefitItems = useMemo(
    () =>
      benefits && benefits.length > 0
        ? benefits
        : [
            t.profile.premiumBenefitPlans,
            t.profile.premiumBenefitFavorites,
            t.profile.premiumBenefitAutoFill,
          ],
    [benefits, t.profile.premiumBenefitAutoFill, t.profile.premiumBenefitFavorites, t.profile.premiumBenefitPlans],
  );

  async function openExternalUrl(url: string | null, fallbackMessage: string) {
    if (!url) {
      Alert.alert(t.profile.subscriptionLabel, fallbackMessage);
      return false;
    }

    try {
      await Linking.openURL(url);
      return true;
    } catch {
      Alert.alert(t.common.error, t.profile.browserError);
      return false;
    }
  }

  async function handleUpgrade() {
    const inAppBillingEnabled = billing.isAvailable;

    if (inAppBillingEnabled) {
      try {
        const result = await billing.purchase();

        if (result === 'purchased') {
          onClose();
          Alert.alert(t.common.ok, t.profile.purchaseSuccess);
          return;
        }

        if (result === 'unavailable') {
          const fallbackStoreUrl = Platform.OS === 'ios' ? IOS_SUBSCRIPTIONS_URL : PLAY_SUBSCRIPTIONS_URL;
          const openedStore = await openExternalUrl(
            billing.managementUrl ?? fallbackStoreUrl,
            t.profile.purchaseUnavailable,
          );
          if (openedStore) onClose();
        }

        return;
      } catch (purchaseError) {
        console.error('RevenueCat purchase error:', purchaseError);
        Alert.alert(t.common.error, t.profile.purchaseFailed);
        return;
      }
    }

    const opened = await openExternalUrl(`${WEB_API_BASE_URL}/premium`, t.profile.premiumFallback);
    if (opened) onClose();
  }

  const actionBusy = billing.isLoading || billing.isPurchasing;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.modalWrapper}>
        <Pressable style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={20} color={Colors.warning} />
          </View>

          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.benefitsCard}>
            {benefitItems.map((item) => (
              <View key={item} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.brandPrimary} />
                <Text style={styles.benefitText}>{item}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            disabled={actionBusy}
            onPress={() => void handleUpgrade()}
            style={[styles.primaryButton, actionBusy && styles.primaryButtonDisabled]}
          >
            {billing.isPurchasing ? (
              <ActivityIndicator color={Colors.textOnBrand} />
            ) : (
              <Text style={styles.primaryButtonText}>{upgradeLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity disabled={actionBusy} onPress={onClose} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 22,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    alignSelf: 'center',
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalMessage: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  benefitsCard: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    marginBottom: 18,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  benefitText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: Colors.brandPrimary,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: Colors.textOnBrand,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 2,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
});
