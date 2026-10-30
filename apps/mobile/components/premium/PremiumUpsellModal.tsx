import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from '../themed/Text';
import Constants from 'expo-constants';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';
import { useI18n } from '../../lib/i18n';
import { captureAnalyticsEvent } from '../../lib/posthog';
import { WEB_API_BASE_URL } from '../../lib/webApi';

const ANDROID_PACKAGE_NAME = Constants.expoConfig?.android?.package ?? 'com.paceyourself.app';
const PLAY_SUBSCRIPTIONS_URL = `https://play.google.com/store/account/subscriptions?package=${ANDROID_PACKAGE_NAME}`;
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  benefits?: string[];
  planId?: string;
};

export function PremiumUpsellModal({
  visible,
  title,
  message,
  onClose,
  benefits,
  planId,
}: Props) {
  if (!visible) return null;

  return (
    <PremiumUpsellModalContent
      visible={visible}
      title={title}
      message={message}
      onClose={onClose}
      benefits={benefits}
      planId={planId}
    />
  );
}

function PremiumUpsellModalContent({
  visible,
  title,
  message,
  onClose,
  benefits,
  planId,
}: Props) {
  const { t, locale } = useI18n();
  const billing = useRevenueCatBilling();

  useEffect(() => {
    captureAnalyticsEvent('premium paywall viewed', {
      billing_provider: billing.isAvailable ? 'revenuecat' : 'web_fallback',
      paywall_type: 'modal',
      placement: 'feature_gate',
    });
  }, []);

  const upgradeLabel = billing.currentPackage
    ? t.profile.premiumAnnualCta.replace('{price}', billing.currentPackage.product.priceString)
    : t.profile.premiumAnnualFallbackCta;
  const offerTitle = billing.currentPackage?.product.title?.trim() || t.profile.subscriptionOfferTitle;
  const offerPrice = t.profile.subscriptionPriceAnnual.replace(
    '{price}',
    billing.currentPackage?.product.priceString ?? '29,99 €',
  );

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
        const result = await billing.purchase('feature_gate');

        if (result.status === 'purchased') {
          onClose();
          Alert.alert(t.common.ok, t.profile.purchaseSuccess);
          return;
        }

        if (result.status === 'unverified') {
          Alert.alert(t.common.error, t.profile.purchaseFailed);
          return;
        }

        if (result.status === 'unavailable') {
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

    captureAnalyticsEvent('premium checkout started', {
      billing_provider: 'web_fallback',
      placement: 'feature_gate',
      store: 'web',
    });
    const opened = await openExternalUrl(`${WEB_API_BASE_URL}/premium`, t.profile.premiumFallback);
    if (opened) onClose();
  }

  async function handleCoursePurchase() {
    if (!planId) return;
    try {
      const result = await billing.buyCourse(planId);
      if (result === 'purchased') {
        onClose();
        Alert.alert(t.common.ok, locale === 'fr' ? 'Course débloquée.' : 'Race unlocked.');
      } else if (result === 'unverified') {
        Alert.alert(t.profile.subscriptionLabel, locale === 'fr' ? 'Ton achat est en cours de vérification. Rouvre ce plan pour actualiser tes accès.' : 'Your purchase is being verified. Reopen this plan to refresh access.');
      } else if (result === 'unavailable') Alert.alert(t.common.error, t.profile.purchaseUnavailable);
    } catch { Alert.alert(t.common.error, t.profile.purchaseFailed); }
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
        <View accessibilityViewIsModal style={styles.modalSheet}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed" size={20} color={Colors.warning} />
          </View>

          <Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>

          <View style={styles.benefitsCard}>
            <View style={styles.offerSummary}>
              <Text style={styles.offerTitle}>{offerTitle}</Text>
              <Text style={styles.offerBody}>{t.profile.subscriptionDurationAnnual}</Text>
              <Text style={styles.offerBody}>{offerPrice}</Text>
            </View>

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

          {planId ? (
            <TouchableOpacity disabled={actionBusy || !billing.coursePriceString} onPress={() => void handleCoursePurchase()} style={styles.courseButton}>
              <Text style={styles.courseButtonText}>{locale === 'fr' ? 'Débloquer cette course' : 'Unlock this race'} · {billing.coursePriceString ?? '9,99 €'}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.legalButtonsRow}>
            <TouchableOpacity
              disabled={actionBusy}
              onPress={() => void openExternalUrl(`${WEB_API_BASE_URL}/legal/privacy`, t.profile.privacyPolicyFallback)}
              style={[styles.legalButton, actionBusy && styles.primaryButtonDisabled]}
            >
              <Text style={styles.legalButtonText}>{t.profile.privacyPolicyButton}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={actionBusy}
              onPress={() => void openExternalUrl(APPLE_STANDARD_EULA_URL, t.profile.termsOfUseFallback)}
              style={[styles.legalButton, actionBusy && styles.primaryButtonDisabled]}
            >
              <Text style={styles.legalButtonText}>{t.profile.termsOfUseButton}</Text>
            </TouchableOpacity>
          </View>

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
  offerSummary: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.brandBorder,
    backgroundColor: Colors.brandSurface,
    padding: 12,
  },
  offerTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  offerBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
  courseButton: { marginTop: 10, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  courseButtonText: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '800' },
  legalButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  legalButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  legalButtonText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
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
