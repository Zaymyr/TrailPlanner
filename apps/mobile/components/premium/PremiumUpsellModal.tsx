import Ionicons from '@expo/vector-icons/Ionicons';
import { mobileComponents } from '@pace-yourself/design-system';
import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '../../constants/colors';
import { useRevenueCatBilling } from '../../hooks/useRevenueCatBilling';
import { useI18n } from '../../lib/i18n';
import { captureAnalyticsEvent } from '../../lib/posthog';
import { WEB_API_BASE_URL } from '../../lib/webApi';
import { Text } from '../themed/Text';

const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export type PremiumPaywallPlacement =
  | 'feature_gate'
  | 'auto_fill'
  | 'pace'
  | 'nutrition'
  | 'plan_limit'
  | 'favorite_limit'
  | 'recap'
  | 'settings';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  benefits?: string[];
  planId?: string;
  placement?: PremiumPaywallPlacement;
};

export function PremiumUpsellModal(props: Props) {
  if (!props.visible) return null;
  return <PremiumUpsellModalContent {...props} />;
}

function PremiumUpsellModalContent({
  visible,
  title,
  message,
  onClose,
  benefits,
  planId,
  placement = 'feature_gate',
}: Props) {
  const { t } = useI18n();
  const billing = useRevenueCatBilling();
  const reportedCourseFailure = useRef<string | null>(null);
  const isCourseOffer = Boolean(planId);

  useEffect(() => {
    captureAnalyticsEvent('premium paywall viewed', {
      billing_provider: billing.isAvailable ? 'revenuecat' : 'web_fallback',
      paywall_type: 'modal',
      placement,
    });
  }, [billing.isAvailable, placement]);

  useEffect(() => {
    if (!isCourseOffer || billing.coursePriceStatus !== 'unavailable') return;
    const reason = billing.coursePriceFailureReason ?? 'product_missing';
    if (reportedCourseFailure.current === reason) return;
    reportedCourseFailure.current = reason;
    captureAnalyticsEvent('premium course price unavailable', {
      billing_provider: billing.isAvailable ? 'revenuecat' : 'web_fallback',
      placement,
      reason,
      store: Platform.OS === 'ios' ? 'app_store' : 'play_store',
    });
  }, [billing.coursePriceFailureReason, billing.coursePriceStatus, billing.isAvailable, isCourseOffer, placement]);

  const placementMessage = {
    feature_gate: message ?? t.profile.premiumPaywallGenericMessage,
    auto_fill: t.profile.premiumPaywallAutoFillMessage,
    pace: t.profile.premiumPaywallPaceMessage,
    nutrition: t.profile.premiumPaywallNutritionMessage,
    plan_limit: t.profile.premiumPaywallPlanLimitMessage,
    favorite_limit: t.profile.premiumPaywallFavoriteLimitMessage,
    recap: t.profile.premiumPaywallRecapMessage,
    settings: t.profile.premiumPaywallSettingsMessage,
  }[placement];

  const annualPrice = billing.currentPackage?.product.priceString ?? null;
  const upgradeLabel = annualPrice
    ? t.profile.premiumAnnualCta.replace('{price}', annualPrice)
    : t.profile.premiumAnnualFallbackCta;
  const offerTitle = billing.currentPackage?.product.title?.trim() || t.profile.subscriptionOfferTitle;
  const offerPrice = annualPrice
    ? t.profile.subscriptionPriceAnnual.replace('{price}', annualPrice)
    : t.profile.purchaseUnavailable;
  const coursePurchaseLabel = billing.coursePriceString
    ? t.profile.premiumCourseCta.replace('{price}', billing.coursePriceString)
    : null;

  const defaultBenefits = isCourseOffer
    ? [t.profile.premiumBenefitPace, t.profile.premiumBenefitNutrition, t.profile.premiumBenefitCourseAccess]
    : [t.profile.premiumBenefitPlans, t.profile.premiumBenefitFavorites, t.profile.premiumBenefitAutoFill];
  const firstBenefit = placement === 'pace'
    ? t.profile.premiumBenefitPace
    : placement === 'nutrition' || placement === 'auto_fill'
      ? t.profile.premiumBenefitNutrition
      : t.profile.premiumBenefitCourseAccess;
  const benefitItems = benefits?.length
    ? benefits
    : isCourseOffer
      ? [firstBenefit, ...defaultBenefits.filter((item) => item !== firstBenefit)]
      : defaultBenefits;

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
    if (billing.isAvailable) {
      try {
        const result = await billing.purchase('feature_gate');
        if (result.status === 'purchased') {
          onClose();
          Alert.alert(t.common.ok, t.profile.purchaseSuccess);
        } else if (result.status === 'unverified') {
          Alert.alert(t.common.error, t.profile.purchaseFailed);
        } else if (result.status === 'unavailable') {
          Alert.alert(t.common.error, t.profile.purchaseUnavailable);
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
      placement,
      store: 'web',
    });
    const opened = await openExternalUrl(`${WEB_API_BASE_URL}/premium`, t.profile.premiumFallback);
    if (opened) onClose();
  }

  async function handleCoursePurchase() {
    if (!planId || !coursePurchaseLabel) return;
    try {
      const result = await billing.buyCourse(planId);
      if (result === 'purchased') {
        onClose();
        Alert.alert(t.common.ok, t.profile.premiumCourseUnlocked);
      } else if (result === 'unverified') {
        Alert.alert(t.profile.subscriptionLabel, t.profile.premiumCourseVerificationPending);
      } else if (result === 'unavailable') {
        Alert.alert(t.common.error, t.profile.purchaseUnavailable);
      }
    } catch {
      Alert.alert(t.common.error, t.profile.purchaseFailed);
    }
  }

  async function handleRestore() {
    try {
      const result = await billing.restore();
      if (result === 'restored') Alert.alert(t.common.ok, t.profile.restoreSuccess);
      else if (result === 'cancelled') Alert.alert(t.profile.subscriptionLabel, t.profile.restoreCancelled);
      else Alert.alert(t.common.error, t.profile.restoreFailed);
    } catch {
      Alert.alert(t.common.error, t.profile.restoreFailed);
    }
  }

  const actionBusy = billing.isLoading || billing.isPurchasing || billing.isRestoring;
  const annualPurchaseUnavailable = billing.isAvailable && !billing.isLoading && !billing.currentPackage;
  const termsUrl = Platform.OS === 'ios' ? APPLE_STANDARD_EULA_URL : `${WEB_API_BASE_URL}/legal/cgu`;

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalWrapper}>
        <Pressable onPress={actionBusy ? undefined : onClose} style={styles.modalOverlay} />
        <View accessibilityViewIsModal style={styles.modalSheet}>
          <TouchableOpacity accessibilityLabel={t.common.close} accessibilityRole="button" disabled={actionBusy} onPress={onClose} style={styles.closeButton}>
            <Ionicons color={Colors.textSecondary} name="close" size={20} />
          </TouchableOpacity>
          <ScrollView bounces={false} contentContainerStyle={styles.modalContent}>
            <View style={styles.iconWrap}>
              <Ionicons color={Colors.brandPrimary} name="lock-closed" size={20} />
            </View>
            <Text accessibilityRole="header" style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalMessage}>{placementMessage}</Text>

            <View style={styles.benefitsCard}>
              {isCourseOffer ? (
                <View style={styles.offerSummary}>
                  <Text style={styles.offerTitle}>{t.profile.premiumCourseTitle}</Text>
                  <Text style={styles.offerBody}>{t.profile.premiumCourseBody}</Text>
                  {billing.coursePriceStatus === 'loading' ? (
                    <View style={styles.inlineLoading}><ActivityIndicator color={Colors.brandPrimary} size="small" /><Text style={styles.offerBody}>{t.profile.premiumCoursePriceLoading}</Text></View>
                  ) : billing.coursePriceString ? (
                    <Text style={styles.offerPrice}>{billing.coursePriceString}</Text>
                  ) : (
                    <Text accessibilityLiveRegion="polite" style={styles.errorText}>{t.profile.premiumCoursePriceUnavailable}</Text>
                  )}
                </View>
              ) : (
                <View style={styles.offerSummary}>
                  <Text style={styles.offerTitle}>{offerTitle}</Text>
                  <Text style={styles.offerBody}>{t.profile.subscriptionDurationAnnual}</Text>
                  <Text style={styles.offerPrice}>{offerPrice}</Text>
                </View>
              )}
              {benefitItems.map((item) => (
                <View key={item} style={styles.benefitRow}>
                  <Ionicons color={Colors.brandPrimary} name="checkmark-circle" size={16} />
                  <Text style={styles.benefitText}>{item}</Text>
                </View>
              ))}
            </View>

            {isCourseOffer ? (
              billing.coursePriceStatus === 'available' && coursePurchaseLabel ? (
                <TouchableOpacity disabled={actionBusy} onPress={() => void handleCoursePurchase()} style={[styles.primaryButton, actionBusy && styles.primaryButtonDisabled]}>
                  {billing.isPurchasing ? <ActivityIndicator color={Colors.textOnBrand} /> : <Text style={styles.primaryButtonText}>{coursePurchaseLabel}</Text>}
                </TouchableOpacity>
              ) : billing.coursePriceStatus === 'loading' ? (
                <View accessibilityState={{ busy: true, disabled: true }} style={[styles.primaryButton, styles.primaryButtonDisabled]}>
                  <ActivityIndicator color={Colors.textOnBrand} />
                  <Text style={styles.primaryButtonText}>{t.profile.premiumCoursePriceLoading}</Text>
                </View>
              ) : (
                <TouchableOpacity disabled={actionBusy} onPress={() => void billing.refresh()} style={styles.retryButton}>
                  <Ionicons color={Colors.brandPrimary} name="refresh" size={18} />
                  <Text style={styles.retryButtonText}>{t.common.retry}</Text>
                </TouchableOpacity>
              )
            ) : null}

            <View style={isCourseOffer ? styles.annualSection : undefined}>
              {isCourseOffer ? <Text style={styles.annualTitle}>{offerTitle}</Text> : null}
              <TouchableOpacity disabled={actionBusy || annualPurchaseUnavailable} onPress={() => void handleUpgrade()} style={[isCourseOffer ? styles.courseButton : styles.primaryButton, (actionBusy || annualPurchaseUnavailable) && styles.primaryButtonDisabled]}>
                {billing.isPurchasing ? <ActivityIndicator color={isCourseOffer ? Colors.brandPrimary : Colors.textOnBrand} /> : <Text style={isCourseOffer ? styles.courseButtonText : styles.primaryButtonText}>{upgradeLabel}</Text>}
              </TouchableOpacity>
              <Text style={styles.annualDisclosure}>{t.profile.premiumAnnualRenewalDisclosure}</Text>
              <Text style={styles.annualValue}>{t.profile.premiumAnnualValue}</Text>
              {annualPurchaseUnavailable ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{t.profile.purchaseUnavailable}</Text> : null}
            </View>

            <TouchableOpacity disabled={actionBusy} onPress={() => void handleRestore()} style={styles.textLink}>
              <Text style={styles.textLinkLabel}>{t.profile.restorePurchases}</Text>
            </TouchableOpacity>

            <View style={styles.legalLinksRow}>
              <TouchableOpacity disabled={actionBusy} onPress={() => void openExternalUrl(`${WEB_API_BASE_URL}/legal/privacy`, t.profile.privacyPolicyFallback)} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>{t.profile.privacyPolicyButton}</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}>·</Text>
              <TouchableOpacity disabled={actionBusy} onPress={() => void openExternalUrl(termsUrl, t.profile.termsOfUseFallback)} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>{t.profile.termsOfUseButton}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity disabled={actionBusy} onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  modalSheet: { position: 'relative', maxHeight: '100%', backgroundColor: Colors.surface, borderRadius: 24, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  modalContent: { padding: 22, paddingTop: 62 },
  iconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.brandSurface, borderWidth: 1, borderColor: Colors.brandBorder, alignItems: 'center', justifyContent: 'center', marginBottom: 14, alignSelf: 'center' },
  closeButton: { position: 'absolute', zIndex: 2, top: 12, right: 12, width: mobileComponents.closeButtonSize, height: mobileComponents.closeButtonSize, borderRadius: mobileComponents.closeButtonSize / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceSecondary },
  modalTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  modalMessage: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10, marginBottom: 18 },
  benefitsCard: { backgroundColor: Colors.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 14, gap: 10, marginBottom: 18 },
  offerSummary: { gap: 4, borderRadius: 14, borderWidth: 1, borderColor: Colors.brandBorder, backgroundColor: Colors.brandSurface, padding: 12 },
  offerTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800' },
  offerBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  offerPrice: { color: Colors.brandPrimary, fontSize: 20, fontWeight: '800' },
  inlineLoading: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { color: Colors.danger, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  benefitText: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 50, flexDirection: 'row', gap: 8, backgroundColor: Colors.brandPrimary, borderRadius: mobileComponents.buttonRadius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  primaryButtonDisabled: { opacity: 0.58 },
  primaryButtonText: { color: Colors.textOnBrand, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  retryButton: { minHeight: 48, flexDirection: 'row', gap: 8, borderRadius: mobileComponents.buttonRadius, borderWidth: 1, borderColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center' },
  retryButtonText: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '800' },
  annualSection: { marginTop: 14, gap: 7 },
  annualTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  courseButton: { minHeight: 48, borderRadius: mobileComponents.buttonRadius, borderWidth: 1, borderColor: Colors.brandPrimary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  courseButtonText: { color: Colors.brandPrimary, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  annualDisclosure: { marginTop: 2, color: Colors.textSecondary, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  annualValue: { color: Colors.brandPrimary, fontSize: 11, lineHeight: 16, fontWeight: '700', textAlign: 'center' },
  textLink: { minHeight: 44, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  textLinkLabel: { color: Colors.brandPrimary, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  legalLinksRow: { minHeight: 44, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 7 },
  legalLink: { minHeight: 44, justifyContent: 'center' },
  legalLinkText: { color: Colors.textSecondary, fontSize: 12, textDecorationLine: 'underline' },
  legalSeparator: { color: Colors.textMuted, fontSize: 12 },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
});
